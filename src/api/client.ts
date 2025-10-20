import * as https from 'https';
import * as http from 'http';

/**
 * Configuration for Sumo Logic API client
 */
export interface SumoLogicConfig {
    accessId: string;
    accessKey: string;
    endpoint: string;
}

/**
 * Base HTTP response
 */
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    statusCode?: number;
}

/**
 * Base client for Sumo Logic API with Basic Authentication
 * Based on the Python implementation in execute_search_job.py
 */
export class SumoLogicClient {
    private static readonly REGIONS: { [key: string]: string } = {
        'us1': 'https://api.sumologic.com',
        'us2': 'https://api.us2.sumologic.com',
        'eu': 'https://api.eu.sumologic.com',
        'au': 'https://api.au.sumologic.com',
        'de': 'https://api.de.sumologic.com',
        'jp': 'https://api.jp.sumologic.com',
        'ca': 'https://api.ca.sumologic.com',
        'in': 'https://api.in.sumologic.com'
    };

    private endpoint: string;
    private authHeader: string;
    private cookies: string[] = []; // Store cookies for session management

    constructor(config: SumoLogicConfig) {
        this.endpoint = this.resolveEndpoint(config.endpoint);
        this.authHeader = this.createAuthHeader(config.accessId, config.accessKey);
    }

    /**
     * Resolve endpoint from region code or use as-is if it's a URL
     */
    private resolveEndpoint(endpoint: string): string {
        const lowerEndpoint = endpoint.toLowerCase();
        if (lowerEndpoint in SumoLogicClient.REGIONS) {
            return SumoLogicClient.REGIONS[lowerEndpoint];
        } else if (endpoint.startsWith('http')) {
            return endpoint.replace(/\/$/, ''); // Remove trailing slash
        } else {
            throw new Error(`Invalid endpoint. Use a region code (${Object.keys(SumoLogicClient.REGIONS).join(', ')}) or full URL`);
        }
    }

    /**
     * Create Basic Auth header from access ID and key
     */
    private createAuthHeader(accessId: string, accessKey: string): string {
        const credentials = `${accessId}:${accessKey}`;
        const encoded = Buffer.from(credentials).toString('base64');
        return `Basic ${encoded}`;
    }

    /**
     * Make HTTP request to Sumo Logic API
     */
    protected async makeRequest<T>(
        path: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        body?: any,
        additionalHeaders?: { [key: string]: string },
        maxRedirects: number = 5
    ): Promise<ApiResponse<T>> {
        return new Promise((resolve) => {
            const url = new URL(path, this.endpoint);
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;

            const headers: { [key: string]: string } = {
                'Authorization': this.authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...additionalHeaders
            };

            // Add cookies if we have any stored
            if (this.cookies.length > 0) {
                headers['Cookie'] = this.cookies.join('; ');
            }

            const options: https.RequestOptions = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: method,
                headers
            };

            const req = client.request(options, (res) => {
                let data = '';

                // Capture cookies from response
                const setCookieHeaders = res.headers['set-cookie'];
                if (setCookieHeaders) {
                    // Extract and store cookies
                    for (const cookieHeader of setCookieHeaders) {
                        // Parse cookie - take only the name=value part before first semicolon
                        const cookieValue = cookieHeader.split(';')[0];
                        // Check if this cookie already exists (by name)
                        const cookieName = cookieValue.split('=')[0];
                        const existingIndex = this.cookies.findIndex(c => c.startsWith(cookieName + '='));
                        if (existingIndex >= 0) {
                            // Update existing cookie
                            this.cookies[existingIndex] = cookieValue;
                        } else {
                            // Add new cookie
                            this.cookies.push(cookieValue);
                        }
                    }
                }

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const statusCode = res.statusCode || 500;

                        // Handle redirects (301, 302, 307, 308)
                        if (statusCode >= 301 && statusCode <= 308 && res.headers.location) {
                            if (maxRedirects <= 0) {
                                resolve({
                                    error: `Too many redirects`,
                                    statusCode
                                });
                                return;
                            }

                            // Follow the redirect
                            const redirectUrl = res.headers.location;
                            // Use the full redirect URL, not relative to this.endpoint
                            this.makeRequest<T>(redirectUrl, method, body, additionalHeaders, maxRedirects - 1)
                                .then(resolve)
                                .catch(error => resolve({ error: `Redirect failed: ${error}` }));
                            return;
                        }

                        if (statusCode >= 200 && statusCode < 300) {
                            const parsed = data ? JSON.parse(data) : {};
                            resolve({ data: parsed as T, statusCode });
                        } else {
                            resolve({
                                error: `HTTP ${statusCode}: ${data || res.statusMessage}`,
                                statusCode
                            });
                        }
                    } catch (error) {
                        resolve({
                            error: `Failed to parse response: ${error}`,
                            statusCode: res.statusCode
                        });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({ error: `Request failed: ${error.message}` });
            });

            if (body) {
                const jsonData = JSON.stringify(body);
                req.write(jsonData);
            }

            req.end();
        });
    }

    /**
     * Test connection to Sumo Logic API
     * Uses the personal folder endpoint to verify credentials and region
     */
    async testConnection(): Promise<ApiResponse<any>> {
        // Use the personal folder endpoint to verify credentials, connectivity, and correct region
        // This is a real endpoint that confirms the user has proper access
        return this.makeRequest('/api/v2/content/folders/personal', 'GET');
    }

    /**
     * Get the configured endpoint URL
     */
    getEndpoint(): string {
        return this.endpoint;
    }

    /**
     * Make HTTP request and return raw response (for CSV downloads, etc.)
     */
    protected async makeRawRequest(
        path: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        body?: any,
        additionalHeaders?: { [key: string]: string },
        maxRedirects: number = 5,
        skipAuth: boolean = false
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.endpoint);
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;

            const headers: { [key: string]: string } = {
                ...additionalHeaders
            };

            // Only add Authorization header if not skipped (e.g., for pre-signed S3 URLs)
            if (!skipAuth) {
                headers['Authorization'] = this.authHeader;
            }

            // Add cookies if we have any stored
            if (this.cookies.length > 0) {
                headers['Cookie'] = this.cookies.join('; ');
            }

            const options: https.RequestOptions = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: method,
                headers
            };

            const req = client.request(options, (res) => {
                let data = '';

                // Capture cookies from response
                const setCookieHeaders = res.headers['set-cookie'];
                if (setCookieHeaders) {
                    for (const cookieHeader of setCookieHeaders) {
                        const cookieValue = cookieHeader.split(';')[0];
                        const cookieName = cookieValue.split('=')[0];
                        const existingIndex = this.cookies.findIndex(c => c.startsWith(cookieName + '='));
                        if (existingIndex >= 0) {
                            this.cookies[existingIndex] = cookieValue;
                        } else {
                            this.cookies.push(cookieValue);
                        }
                    }
                }

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    const statusCode = res.statusCode || 500;

                    // Handle redirects (301, 302, 307, 308)
                    if (statusCode >= 301 && statusCode <= 308 && res.headers.location) {
                        if (maxRedirects <= 0) {
                            reject(new Error('Too many redirects'));
                            return;
                        }

                        // Follow the redirect
                        const redirectUrl = res.headers.location;
                        this.makeRawRequest(redirectUrl, method, body, additionalHeaders, maxRedirects - 1, skipAuth)
                            .then(resolve)
                            .catch(reject);
                        return;
                    }

                    if (statusCode >= 200 && statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${statusCode}: ${data || res.statusMessage}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (body) {
                const jsonData = JSON.stringify(body);
                req.write(jsonData);
            }

            req.end();
        });
    }
}

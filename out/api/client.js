"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SumoLogicClient = void 0;
const https = require("https");
const http = require("http");
/**
 * Base client for Sumo Logic API with Basic Authentication
 * Based on the Python implementation in execute_search_job.py
 */
class SumoLogicClient {
    constructor(config) {
        this.endpoint = this.resolveEndpoint(config.endpoint);
        this.authHeader = this.createAuthHeader(config.accessId, config.accessKey);
    }
    /**
     * Resolve endpoint from region code or use as-is if it's a URL
     */
    resolveEndpoint(endpoint) {
        const lowerEndpoint = endpoint.toLowerCase();
        if (lowerEndpoint in SumoLogicClient.REGIONS) {
            return SumoLogicClient.REGIONS[lowerEndpoint];
        }
        else if (endpoint.startsWith('http')) {
            return endpoint.replace(/\/$/, ''); // Remove trailing slash
        }
        else {
            throw new Error(`Invalid endpoint. Use a region code (${Object.keys(SumoLogicClient.REGIONS).join(', ')}) or full URL`);
        }
    }
    /**
     * Create Basic Auth header from access ID and key
     */
    createAuthHeader(accessId, accessKey) {
        const credentials = `${accessId}:${accessKey}`;
        const encoded = Buffer.from(credentials).toString('base64');
        return `Basic ${encoded}`;
    }
    /**
     * Make HTTP request to Sumo Logic API
     */
    makeRequest(path_1) {
        return __awaiter(this, arguments, void 0, function* (path, method = 'GET', body, additionalHeaders) {
            return new Promise((resolve) => {
                const url = new URL(path, this.endpoint);
                const isHttps = url.protocol === 'https:';
                const client = isHttps ? https : http;
                const options = {
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname + url.search,
                    method: method,
                    headers: Object.assign({ 'Authorization': this.authHeader, 'Content-Type': 'application/json', 'Accept': 'application/json' }, additionalHeaders)
                };
                const req = client.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        try {
                            const statusCode = res.statusCode || 500;
                            if (statusCode >= 200 && statusCode < 300) {
                                const parsed = data ? JSON.parse(data) : {};
                                resolve({ data: parsed, statusCode });
                            }
                            else {
                                resolve({
                                    error: `HTTP ${statusCode}: ${data || res.statusMessage}`,
                                    statusCode
                                });
                            }
                        }
                        catch (error) {
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
        });
    }
    /**
     * Test connection to Sumo Logic API
     * Uses the personal folder endpoint to verify credentials and region
     */
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            // Use the personal folder endpoint to verify credentials, connectivity, and correct region
            // This is a real endpoint that confirms the user has proper access
            return this.makeRequest('/api/v2/content/folders/personal', 'GET');
        });
    }
    /**
     * Get the configured endpoint URL
     */
    getEndpoint() {
        return this.endpoint;
    }
}
exports.SumoLogicClient = SumoLogicClient;
SumoLogicClient.REGIONS = {
    'us1': 'https://api.sumologic.com',
    'us2': 'https://api.us2.sumologic.com',
    'eu': 'https://api.eu.sumologic.com',
    'au': 'https://api.au.sumologic.com',
    'de': 'https://api.de.sumologic.com',
    'jp': 'https://api.jp.sumologic.com',
    'ca': 'https://api.ca.sumologic.com',
    'in': 'https://api.in.sumologic.com'
};
//# sourceMappingURL=client.js.map
import { SumoLogicClient, ApiResponse } from './client';

/**
 * Search job creation request
 */
export interface SearchJobRequest {
    query: string;
    from: string;
    to: string;
    timeZone?: string;
    byReceiptTime?: boolean;
}

/**
 * Search job response
 */
export interface SearchJobResponse {
    id: string;
    link: {
        rel: string;
        href: string;
    };
}

/**
 * Search job status
 */
export interface SearchJobStatus {
    state: 'NOT STARTED' | 'GATHERING RESULTS' | 'FORCE PAUSED' | 'DONE GATHERING RESULTS' | 'CANCELLED';
    messageCount: number;
    histogramBuckets: number[];
    recordCount: number;
    pendingErrors: string[];
    pendingWarnings: string[];
}

/**
 * Search job message
 */
export interface SearchJobMessage {
    map: {
        [key: string]: string;
    };
}

/**
 * Search job record
 */
export interface SearchJobRecord {
    map: {
        [key: string]: string;
    };
}

/**
 * Messages response
 */
export interface MessagesResponse {
    messages: SearchJobMessage[];
}

/**
 * Records response
 */
export interface RecordsResponse {
    records: SearchJobRecord[];
}

/**
 * Client for Sumo Logic Search Job API
 * Based on: https://help.sumologic.com/docs/api/search-job/
 */
export class SearchJobClient extends SumoLogicClient {
    private static readonly SEARCH_JOB_API = '/api/v1/search/jobs';
    private static readonly POLL_INTERVAL_MS = 2000; // 2 seconds
    private static readonly MAX_POLL_ATTEMPTS = 300; // 10 minutes max

    /**
     * Create a new search job
     */
    async createSearchJob(request: SearchJobRequest): Promise<ApiResponse<SearchJobResponse>> {
        const payload = {
            query: request.query,
            from: request.from,
            to: request.to,
            timeZone: request.timeZone || 'UTC',
            byReceiptTime: request.byReceiptTime || false
        };

        return this.makeRequest<SearchJobResponse>(
            SearchJobClient.SEARCH_JOB_API,
            'POST',
            payload
        );
    }

    /**
     * Get search job status
     */
    async getSearchJobStatus(jobId: string): Promise<ApiResponse<SearchJobStatus>> {
        return this.makeRequest<SearchJobStatus>(
            `${SearchJobClient.SEARCH_JOB_API}/${jobId}`,
            'GET'
        );
    }

    /**
     * Get messages from a completed search job
     */
    async getMessages(jobId: string, offset: number = 0, limit: number = 10000): Promise<ApiResponse<MessagesResponse>> {
        const params = `?offset=${offset}&limit=${limit}`;
        return this.makeRequest<MessagesResponse>(
            `${SearchJobClient.SEARCH_JOB_API}/${jobId}/messages${params}`,
            'GET'
        );
    }

    /**
     * Get records from a completed search job
     */
    async getRecords(jobId: string, offset: number = 0, limit: number = 10000): Promise<ApiResponse<RecordsResponse>> {
        const params = `?offset=${offset}&limit=${limit}`;
        return this.makeRequest<RecordsResponse>(
            `${SearchJobClient.SEARCH_JOB_API}/${jobId}/records${params}`,
            'GET'
        );
    }

    /**
     * Delete a search job
     */
    async deleteSearchJob(jobId: string): Promise<ApiResponse<void>> {
        return this.makeRequest<void>(
            `${SearchJobClient.SEARCH_JOB_API}/${jobId}`,
            'DELETE'
        );
    }

    /**
     * Poll for search job completion
     * Returns when job is done or max attempts reached
     */
    async pollForCompletion(
        jobId: string,
        onProgress?: (status: SearchJobStatus) => void
    ): Promise<ApiResponse<SearchJobStatus>> {
        let attempts = 0;

        while (attempts < SearchJobClient.MAX_POLL_ATTEMPTS) {
            const statusResponse = await this.getSearchJobStatus(jobId);

            if (statusResponse.error) {
                return statusResponse;
            }

            const status = statusResponse.data!;

            if (onProgress) {
                onProgress(status);
            }

            if (status.state === 'DONE GATHERING RESULTS') {
                return { data: status };
            }

            if (status.state === 'CANCELLED') {
                return { error: 'Search job was cancelled' };
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, SearchJobClient.POLL_INTERVAL_MS));
            attempts++;
        }

        return { error: 'Search job polling timed out' };
    }

    /**
     * Execute a search job and wait for completion
     * Convenience method that combines create, poll, and fetch results
     */
    async executeSearch(
        request: SearchJobRequest,
        onProgress?: (status: SearchJobStatus) => void
    ): Promise<ApiResponse<RecordsResponse>> {
        // Create job
        const createResponse = await this.createSearchJob(request);
        if (createResponse.error || !createResponse.data) {
            return { error: createResponse.error || 'Failed to create search job' };
        }

        const jobId = createResponse.data.id;

        // Poll for completion
        const pollResponse = await this.pollForCompletion(jobId, onProgress);
        if (pollResponse.error) {
            return { error: pollResponse.error };
        }

        // Fetch records
        const recordsResponse = await this.getRecords(jobId);

        // Clean up job
        await this.deleteSearchJob(jobId);

        return recordsResponse;
    }

    /**
     * Parse relative time string to epoch milliseconds (as string)
     * Examples: "-1h" = 1 hour ago, "-30m" = 30 minutes ago, "now" = current time
     * Returns epoch milliseconds as a string (e.g., "1696723858832")
     */
    static parseRelativeTime(timeStr: string): string {
        if (timeStr === 'now') {
            return Date.now().toString();
        }

        // Check if it's already epoch milliseconds (all digits)
        if (/^\d+$/.test(timeStr)) {
            return timeStr;
        }

        // Check if it's an ISO timestamp
        if (timeStr.includes('T') || timeStr.includes('-') && timeStr.includes(':')) {
            try {
                const date = new Date(timeStr);
                if (!isNaN(date.getTime())) {
                    return date.getTime().toString();
                }
            } catch (e) {
                // Fall through to relative time parsing
            }
        }

        // Parse relative time format (e.g., "-1h", "-30m", "-2d")
        const match = timeStr.match(/^-(\d+)([smhdw])$/);
        if (!match) {
            // Not a recognized format, return as-is and let API handle error
            return timeStr;
        }

        const [, value, unit] = match;
        const amount = parseInt(value, 10);
        const now = new Date();

        switch (unit) {
            case 's':
                now.setSeconds(now.getSeconds() - amount);
                break;
            case 'm':
                now.setMinutes(now.getMinutes() - amount);
                break;
            case 'h':
                now.setHours(now.getHours() - amount);
                break;
            case 'd':
                now.setDate(now.getDate() - amount);
                break;
            case 'w':
                now.setDate(now.getDate() - (amount * 7));
                break;
        }

        return now.getTime().toString();
    }
}

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
exports.SearchJobClient = void 0;
const client_1 = require("./client");
/**
 * Client for Sumo Logic Search Job API
 * Based on: https://help.sumologic.com/docs/api/search-job/
 */
class SearchJobClient extends client_1.SumoLogicClient {
    /**
     * Create a new search job
     */
    createSearchJob(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = {
                query: request.query,
                from: request.from,
                to: request.to,
                timeZone: request.timeZone || 'UTC',
                byReceiptTime: request.byReceiptTime || false
            };
            return this.makeRequest(SearchJobClient.SEARCH_JOB_API, 'POST', payload);
        });
    }
    /**
     * Get search job status
     */
    getSearchJobStatus(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.makeRequest(`${SearchJobClient.SEARCH_JOB_API}/${jobId}`, 'GET');
        });
    }
    /**
     * Get messages from a completed search job
     */
    getMessages(jobId_1) {
        return __awaiter(this, arguments, void 0, function* (jobId, offset = 0, limit = 10000) {
            const params = `?offset=${offset}&limit=${limit}`;
            return this.makeRequest(`${SearchJobClient.SEARCH_JOB_API}/${jobId}/messages${params}`, 'GET');
        });
    }
    /**
     * Get records from a completed search job
     */
    getRecords(jobId_1) {
        return __awaiter(this, arguments, void 0, function* (jobId, offset = 0, limit = 10000) {
            const params = `?offset=${offset}&limit=${limit}`;
            return this.makeRequest(`${SearchJobClient.SEARCH_JOB_API}/${jobId}/records${params}`, 'GET');
        });
    }
    /**
     * Delete a search job
     */
    deleteSearchJob(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.makeRequest(`${SearchJobClient.SEARCH_JOB_API}/${jobId}`, 'DELETE');
        });
    }
    /**
     * Poll for search job completion
     * Returns when job is done or max attempts reached
     */
    pollForCompletion(jobId, onProgress) {
        return __awaiter(this, void 0, void 0, function* () {
            let attempts = 0;
            while (attempts < SearchJobClient.MAX_POLL_ATTEMPTS) {
                const statusResponse = yield this.getSearchJobStatus(jobId);
                if (statusResponse.error) {
                    return statusResponse;
                }
                const status = statusResponse.data;
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
                yield new Promise(resolve => setTimeout(resolve, SearchJobClient.POLL_INTERVAL_MS));
                attempts++;
            }
            return { error: 'Search job polling timed out' };
        });
    }
    /**
     * Execute a search job and wait for completion
     * Convenience method that combines create, poll, and fetch results
     */
    executeSearch(request, onProgress) {
        return __awaiter(this, void 0, void 0, function* () {
            // Create job
            const createResponse = yield this.createSearchJob(request);
            if (createResponse.error || !createResponse.data) {
                return { error: createResponse.error || 'Failed to create search job' };
            }
            const jobId = createResponse.data.id;
            // Poll for completion
            const pollResponse = yield this.pollForCompletion(jobId, onProgress);
            if (pollResponse.error) {
                return { error: pollResponse.error };
            }
            // Fetch records
            const recordsResponse = yield this.getRecords(jobId);
            // Clean up job
            yield this.deleteSearchJob(jobId);
            return recordsResponse;
        });
    }
    /**
     * Parse relative time string to epoch milliseconds (as string)
     * Examples: "-1h" = 1 hour ago, "-30m" = 30 minutes ago, "now" = current time
     * Returns epoch milliseconds as a string (e.g., "1696723858832")
     */
    static parseRelativeTime(timeStr) {
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
            }
            catch (e) {
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
exports.SearchJobClient = SearchJobClient;
SearchJobClient.SEARCH_JOB_API = '/api/v1/search/jobs';
SearchJobClient.POLL_INTERVAL_MS = 2000; // 2 seconds
SearchJobClient.MAX_POLL_ATTEMPTS = 300; // 10 minutes max
//# sourceMappingURL=searchJob.js.map
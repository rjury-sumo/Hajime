import { SumoLogicClient, ApiResponse } from './client';

/**
 * Collector definition
 */
export interface Collector {
    id: number;
    name: string;
    description?: string;
    category?: string;
    timeZone?: string;
    links?: Array<{
        rel: string;
        href: string;
    }>;
    collectorType: string;
    collectorVersion?: string;
    osVersion?: string;
    osName?: string;
    hostName?: string;
    alive: boolean;
    lastSeenAlive?: number;
    ephemeral?: boolean;
    sourceSyncMode?: string;
    cutoffTimestamp?: number;
    targetCpu?: number;
}

/**
 * Source definition
 */
export interface Source {
    id: number;
    name: string;
    description?: string;
    category?: string;
    hostName?: string;
    timeZone?: string;
    automaticDateParsing?: boolean;
    multilineProcessingEnabled?: boolean;
    useAutolineMatching?: boolean;
    forceTimeZone?: boolean;
    defaultDateFormat?: string;
    defaultDateFormats?: Array<{
        format: string;
        locator: string;
    }>;
    filters?: Array<{
        filterType: string;
        name: string;
        regexp: string;
        mask?: string;
    }>;
    cutoffTimestamp?: number;
    cutoffRelativeTime?: string;
    fields?: { [key: string]: string };
    sourceType: string;
    alive: boolean;
    status?: {
        code: string;
        message: string;
    };
    [key: string]: any; // Allow additional source-specific properties
}

/**
 * List collectors response
 */
export interface ListCollectorsResponse {
    collectors: Collector[];
}

/**
 * Get collector response
 */
export interface GetCollectorResponse {
    collector: Collector;
}

/**
 * List sources response
 */
export interface ListSourcesResponse {
    sources: Source[];
}

/**
 * Parameters for listing collectors
 */
export interface ListCollectorsParams {
    limit?: number;
    offset?: number;
    filter?: string;
}

/**
 * Parameters for listing sources
 */
export interface ListSourcesParams {
    limit?: number;
    offset?: number;
}

/**
 * Client for Sumo Logic Collectors API
 * Endpoint: GET /api/v1/collectors
 * Docs: https://help.sumologic.com/docs/api/collector-management/collector-api-methods-examples/
 */
export class CollectorsClient extends SumoLogicClient {
    private static readonly COLLECTORS_API = '/api/v1/collectors';
    private static readonly DEFAULT_LIMIT = 1000;

    /**
     * List collectors with pagination support
     * Requires: Manage or View Collectors capability
     *
     * @param params - Optional parameters for filtering and pagination
     * @param params.limit - Maximum number of collectors to return (default: 1000)
     * @param params.offset - Number of collectors to skip for pagination
     * @param params.filter - Filter expression (e.g., 'Installed' or 'Hosted')
     */
    async listCollectors(params?: ListCollectorsParams): Promise<ApiResponse<ListCollectorsResponse>> {
        const queryParams: Record<string, string> = {};

        if (params?.limit !== undefined) {
            queryParams.limit = params.limit.toString();
        } else {
            queryParams.limit = CollectorsClient.DEFAULT_LIMIT.toString();
        }

        if (params?.offset !== undefined) {
            queryParams.offset = params.offset.toString();
        }

        if (params?.filter) {
            queryParams.filter = params.filter;
        }

        const queryString = new URLSearchParams(queryParams).toString();
        const path = `${CollectorsClient.COLLECTORS_API}?${queryString}`;

        return this.makeRequest<ListCollectorsResponse>(path, 'GET');
    }

    /**
     * Fetch all collectors with automatic pagination
     * This method handles pagination automatically when there are more than 1000 collectors
     *
     * @param filter - Optional filter expression
     */
    async fetchAllCollectors(filter?: string): Promise<ApiResponse<ListCollectorsResponse>> {
        const allCollectors: Collector[] = [];
        let offset = 0;
        const limit = CollectorsClient.DEFAULT_LIMIT;
        let hasMore = true;

        while (hasMore) {
            const response = await this.listCollectors({ limit, offset, filter });

            if (response.error) {
                return response;
            }

            if (!response.data || !response.data.collectors) {
                break;
            }

            allCollectors.push(...response.data.collectors);

            // If we got fewer collectors than the limit, we've reached the end
            if (response.data.collectors.length < limit) {
                hasMore = false;
            } else {
                offset += limit;
            }
        }

        return {
            data: { collectors: allCollectors }
        };
    }

    /**
     * Get a single collector by ID
     * Requires: Manage or View Collectors capability
     *
     * @param collectorId - The collector ID
     * @returns Collector details and ETag header
     */
    async getCollector(collectorId: number): Promise<ApiResponse<GetCollectorResponse>> {
        const path = `${CollectorsClient.COLLECTORS_API}/${collectorId}`;
        return this.makeRequest<GetCollectorResponse>(path, 'GET');
    }

    /**
     * List sources for a specific collector
     * Requires: Manage or View Collectors capability
     *
     * @param collectorId - The collector ID
     * @param params - Optional parameters for pagination
     * @param params.limit - Maximum number of sources to return (default: 1000)
     * @param params.offset - Number of sources to skip for pagination
     */
    async listSources(collectorId: number, params?: ListSourcesParams): Promise<ApiResponse<ListSourcesResponse>> {
        const queryParams: Record<string, string> = {};

        if (params?.limit !== undefined) {
            queryParams.limit = params.limit.toString();
        } else {
            queryParams.limit = CollectorsClient.DEFAULT_LIMIT.toString();
        }

        if (params?.offset !== undefined) {
            queryParams.offset = params.offset.toString();
        }

        const queryString = new URLSearchParams(queryParams).toString();
        const path = `${CollectorsClient.COLLECTORS_API}/${collectorId}/sources?${queryString}`;

        return this.makeRequest<ListSourcesResponse>(path, 'GET');
    }

    /**
     * Fetch all sources for a collector with automatic pagination
     *
     * @param collectorId - The collector ID
     */
    async fetchAllSources(collectorId: number): Promise<ApiResponse<ListSourcesResponse>> {
        const allSources: Source[] = [];
        let offset = 0;
        const limit = CollectorsClient.DEFAULT_LIMIT;
        let hasMore = true;

        while (hasMore) {
            const response = await this.listSources(collectorId, { limit, offset });

            if (response.error) {
                return response;
            }

            if (!response.data || !response.data.sources) {
                break;
            }

            allSources.push(...response.data.sources);

            // If we got fewer sources than the limit, we've reached the end
            if (response.data.sources.length < limit) {
                hasMore = false;
            } else {
                offset += limit;
            }
        }

        return {
            data: { sources: allSources }
        };
    }

    /**
     * Format collectors as a readable table
     */
    static formatCollectorsAsTable(collectors: Collector[]): string {
        if (collectors.length === 0) {
            return 'No collectors found';
        }

        // Helper to format timestamp
        const formatTimestamp = (ts?: number): string => {
            if (!ts) return 'N/A';
            return new Date(ts).toISOString();
        };

        // Helper to format last seen
        const formatLastSeen = (ts?: number): string => {
            if (!ts) return 'N/A';
            const now = Date.now();
            const diff = now - ts;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) return `${days}d ago`;
            if (hours > 0) return `${hours}h ago`;
            if (minutes > 0) return `${minutes}m ago`;
            return 'Just now';
        };

        // Calculate column widths
        const nameWidth = Math.max(15, ...collectors.map(c => c.name.length));
        const typeWidth = Math.max(12, ...collectors.map(c => c.collectorType.length));
        const hostWidth = Math.max(15, ...collectors.map(c => (c.hostName || 'N/A').length));
        const categoryWidth = Math.max(12, ...collectors.map(c => (c.category || 'N/A').length));
        const aliveWidth = 6;
        const lastSeenWidth = 15;
        const versionWidth = 10;

        // Create header
        let table = '';
        table += 'Name'.padEnd(nameWidth) + ' | ';
        table += 'Type'.padEnd(typeWidth) + ' | ';
        table += 'Host'.padEnd(hostWidth) + ' | ';
        table += 'Category'.padEnd(categoryWidth) + ' | ';
        table += 'Alive'.padEnd(aliveWidth) + ' | ';
        table += 'Last Seen'.padEnd(lastSeenWidth) + ' | ';
        table += 'Version'.padEnd(versionWidth) + ' | ';
        table += 'ID' + '\n';

        table += '-'.repeat(nameWidth) + '-+-';
        table += '-'.repeat(typeWidth) + '-+-';
        table += '-'.repeat(hostWidth) + '-+-';
        table += '-'.repeat(categoryWidth) + '-+-';
        table += '-'.repeat(aliveWidth) + '-+-';
        table += '-'.repeat(lastSeenWidth) + '-+-';
        table += '-'.repeat(versionWidth) + '-+-';
        table += '-'.repeat(10) + '\n';

        // Create rows
        collectors.forEach(collector => {
            table += collector.name.padEnd(nameWidth) + ' | ';
            table += collector.collectorType.padEnd(typeWidth) + ' | ';
            table += (collector.hostName || 'N/A').padEnd(hostWidth) + ' | ';
            table += (collector.category || 'N/A').padEnd(categoryWidth) + ' | ';
            table += (collector.alive ? 'Yes' : 'No').padEnd(aliveWidth) + ' | ';
            table += formatLastSeen(collector.lastSeenAlive).padEnd(lastSeenWidth) + ' | ';
            table += (collector.collectorVersion || 'N/A').padEnd(versionWidth) + ' | ';
            table += collector.id.toString() + '\n';
        });

        return table;
    }

    /**
     * Get summary statistics for collectors
     */
    static getCollectorStats(collectors: Collector[]): {
        total: number;
        alive: number;
        dead: number;
        byType: { [key: string]: number };
        ephemeral: number;
    } {
        const stats = {
            total: collectors.length,
            alive: 0,
            dead: 0,
            byType: {} as { [key: string]: number },
            ephemeral: 0
        };

        collectors.forEach(collector => {
            if (collector.alive) {
                stats.alive++;
            } else {
                stats.dead++;
            }

            if (collector.ephemeral) {
                stats.ephemeral++;
            }

            const type = collector.collectorType;
            stats.byType[type] = (stats.byType[type] || 0) + 1;
        });

        return stats;
    }
}

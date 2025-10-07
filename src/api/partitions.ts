import { SumoLogicClient, ApiResponse } from './client';

/**
 * Partition definition
 */
export interface Partition {
    name: string;
    routingExpression: string;
    retentionPeriod: number;
    isCompliant: boolean;
    dataForwardingId?: string;
    id: string;
    totalBytes: number;
    isActive: boolean;
    newRetentionPeriod?: number;
    indexType?: string;
    retentionEffectiveAt?: string;
    dataForwardingEnabled?: boolean;
    analyticsTier?: string;
    isIncludedInDefaultSearch?: boolean;
}

/**
 * List partitions response
 */
export interface ListPartitionsResponse {
    data: Partition[];
}

/**
 * Client for Sumo Logic Partitions API
 * Endpoint: GET /api/v1/partitions
 * Docs: https://api.sumologic.com/docs/#operation/listPartitions
 */
export class PartitionsClient extends SumoLogicClient {
    private static readonly PARTITIONS_API = '/api/v1/partitions';

    /**
     * List all partitions
     * Requires: View Partitions capability
     */
    async listPartitions(): Promise<ApiResponse<ListPartitionsResponse>> {
        return this.makeRequest<ListPartitionsResponse>(
            PartitionsClient.PARTITIONS_API,
            'GET'
        );
    }

    /**
     * Extract partition names from partitions response
     */
    static extractPartitionNames(response: ListPartitionsResponse): string[] {
        if (!response || !response.data) {
            return [];
        }
        return response.data.map(partition => partition.name);
    }

    /**
     * Format partitions as a readable table
     */
    static formatPartitionsAsTable(partitions: Partition[]): string {
        if (partitions.length === 0) {
            return 'No partitions found';
        }

        // Helper to format bytes
        const formatBytes = (bytes: number): string => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
        };

        // Calculate column widths
        const nameWidth = Math.max(15, ...partitions.map(p => p.name.length));
        const expressionWidth = Math.min(50, Math.max(20, ...partitions.map(p => p.routingExpression.length)));
        const retentionWidth = 10;
        const statusWidth = 8;
        const tierWidth = 15;
        const defaultSearchWidth = 14;
        const indexTypeWidth = 12;
        const bytesWidth = 12;

        // Create header
        let table = '';
        table += 'Name'.padEnd(nameWidth) + ' | ';
        table += 'Routing Expression'.padEnd(expressionWidth) + ' | ';
        table += 'Retention'.padEnd(retentionWidth) + ' | ';
        table += 'Active'.padEnd(statusWidth) + ' | ';
        table += 'Analytics Tier'.padEnd(tierWidth) + ' | ';
        table += 'Default Search'.padEnd(defaultSearchWidth) + ' | ';
        table += 'Index Type'.padEnd(indexTypeWidth) + ' | ';
        table += 'Total Bytes'.padEnd(bytesWidth) + '\n';

        table += '-'.repeat(nameWidth) + '-+-';
        table += '-'.repeat(expressionWidth) + '-+-';
        table += '-'.repeat(retentionWidth) + '-+-';
        table += '-'.repeat(statusWidth) + '-+-';
        table += '-'.repeat(tierWidth) + '-+-';
        table += '-'.repeat(defaultSearchWidth) + '-+-';
        table += '-'.repeat(indexTypeWidth) + '-+-';
        table += '-'.repeat(bytesWidth) + '\n';

        // Create rows
        partitions.forEach(partition => {
            table += partition.name.padEnd(nameWidth) + ' | ';
            table += partition.routingExpression.substring(0, 50).padEnd(expressionWidth) + ' | ';
            table += `${partition.retentionPeriod}d`.padEnd(retentionWidth) + ' | ';
            table += (partition.isActive ? 'Yes' : 'No').padEnd(statusWidth) + ' | ';
            table += (partition.analyticsTier || 'N/A').padEnd(tierWidth) + ' | ';
            table += (partition.isIncludedInDefaultSearch !== undefined ? (partition.isIncludedInDefaultSearch ? 'Yes' : 'No') : 'N/A').padEnd(defaultSearchWidth) + ' | ';
            table += (partition.indexType || 'N/A').padEnd(indexTypeWidth) + ' | ';
            table += formatBytes(partition.totalBytes).padEnd(bytesWidth) + '\n';
        });

        return table;
    }
}

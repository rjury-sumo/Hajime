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

        // Calculate column widths
        const nameWidth = Math.max(15, ...partitions.map(p => p.name.length));
        const expressionWidth = Math.min(50, Math.max(20, ...partitions.map(p => p.routingExpression.length)));
        const retentionWidth = 10;
        const statusWidth = 8;

        // Create header
        let table = '';
        table += 'Name'.padEnd(nameWidth) + ' | ';
        table += 'Routing Expression'.padEnd(expressionWidth) + ' | ';
        table += 'Retention'.padEnd(retentionWidth) + ' | ';
        table += 'Active'.padEnd(statusWidth) + '\n';

        table += '-'.repeat(nameWidth) + '-+-';
        table += '-'.repeat(expressionWidth) + '-+-';
        table += '-'.repeat(retentionWidth) + '-+-';
        table += '-'.repeat(statusWidth) + '\n';

        // Create rows
        partitions.forEach(partition => {
            table += partition.name.padEnd(nameWidth) + ' | ';
            table += partition.routingExpression.substring(0, 50).padEnd(expressionWidth) + ' | ';
            table += `${partition.retentionPeriod}d`.padEnd(retentionWidth) + ' | ';
            table += (partition.isActive ? 'Yes' : 'No').padEnd(statusWidth) + '\n';
        });

        return table;
    }
}

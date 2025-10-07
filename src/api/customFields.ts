import { SumoLogicClient, ApiResponse } from './client';

/**
 * Custom field definition
 */
export interface CustomField {
    fieldId: string;
    fieldName: string;
    dataType: string;
    state: string;
}

/**
 * List custom fields response
 */
export interface ListCustomFieldsResponse {
    data: CustomField[];
}

/**
 * Client for Sumo Logic Custom Fields API
 * Endpoint: GET /api/v1/fields
 * Docs: https://api.sumologic.com/docs/#operation/listCustomFields
 */
export class CustomFieldsClient extends SumoLogicClient {
    private static readonly CUSTOM_FIELDS_API = '/api/v1/fields';

    /**
     * List all custom fields
     * Requires: Manage fields capability
     */
    async listCustomFields(): Promise<ApiResponse<ListCustomFieldsResponse>> {
        return this.makeRequest<ListCustomFieldsResponse>(
            CustomFieldsClient.CUSTOM_FIELDS_API,
            'GET'
        );
    }

    /**
     * Extract field names from custom fields response
     */
    static extractFieldNames(response: ListCustomFieldsResponse): string[] {
        if (!response || !response.data) {
            return [];
        }
        return response.data.map(field => field.fieldName);
    }

    /**
     * Format custom fields as a table
     */
    static formatCustomFieldsAsTable(fields: CustomField[]): string {
        if (fields.length === 0) {
            return 'No custom fields found.';
        }

        // Calculate column widths
        const nameWidth = Math.max(10, ...fields.map(f => f.fieldName.length));
        const typeWidth = Math.max(9, ...fields.map(f => f.dataType.length));
        const stateWidth = Math.max(5, ...fields.map(f => f.state.length));
        const idWidth = Math.max(8, ...fields.map(f => f.fieldId.length));

        // Create header
        const header =
            `${'Field Name'.padEnd(nameWidth)} | ` +
            `${'Data Type'.padEnd(typeWidth)} | ` +
            `${'State'.padEnd(stateWidth)} | ` +
            `${'Field ID'.padEnd(idWidth)}`;

        const separator = '-'.repeat(header.length);

        // Create rows
        const rows = fields.map(field =>
            `${field.fieldName.padEnd(nameWidth)} | ` +
            `${field.dataType.padEnd(typeWidth)} | ` +
            `${field.state.padEnd(stateWidth)} | ` +
            `${field.fieldId.padEnd(idWidth)}`
        );

        return [header, separator, ...rows].join('\n');
    }
}

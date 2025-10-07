import { SumoLogicClient, ApiResponse } from './client';

/**
 * Custom field definition
 */
export interface CustomField {
    id: string;
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
}

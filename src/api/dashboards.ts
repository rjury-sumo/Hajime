import { SumoLogicClient, ApiResponse } from './client';

/**
 * Dashboard response from list dashboards API
 */
export interface Dashboard {
    title: string;
    description?: string;
    folderId?: string;
    topologyLabelMap?: Record<string, unknown>;
    domain?: string;
    hierarchies?: string[];
    refreshInterval?: number;
    timeRange?: Record<string, unknown>;
    panels?: Record<string, unknown>[];
    layout?: Record<string, unknown>;
    variables?: Record<string, unknown>[];
    theme?: string;
    isPublic?: boolean;
    highlightViolations?: boolean;
    organizations?: Record<string, unknown>;
    id: string;                  // Dashboard ID (not content ID)
    contentId?: string;          // Content ID
    scheduleId?: string;
    scheduleCount?: number;
}

/**
 * List dashboards response
 */
export interface ListDashboardsResponse {
    dashboards: Dashboard[];
    next?: string;  // Pagination token
}

/**
 * Client for Sumo Logic Dashboard API
 * Endpoint: GET /api/v2/dashboards
 * Docs: https://api.sumologic.com/docs/#operation/listDashboards
 */
export class DashboardClient extends SumoLogicClient {
    /**
     * List dashboards owned by the user
     * Endpoint: GET /api/v2/dashboards
     * Docs: https://api.sumologic.com/docs/#operation/listDashboards
     */
    async listDashboards(limit: number = 100, token?: string): Promise<ApiResponse<ListDashboardsResponse>> {
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        if (token) {
            params.append('token', token);
        }

        return this.makeRequest<ListDashboardsResponse>(
            `/api/v2/dashboards?${params.toString()}`,
            'GET'
        );
    }

    /**
     * Get all dashboards owned by the user (handles pagination automatically)
     */
    async listAllDashboards(): Promise<ApiResponse<Dashboard[]>> {
        const allDashboards: Dashboard[] = [];
        let nextToken: string | undefined = undefined;
        let hasMore = true;

        while (hasMore) {
            const response = await this.listDashboards(100, nextToken);

            if (response.error || !response.data) {
                return {
                    error: response.error || 'Failed to fetch dashboards'
                };
            }

            allDashboards.push(...response.data.dashboards);
            nextToken = response.data.next;
            hasMore = !!nextToken;
        }

        return {
            data: allDashboards
        };
    }

    /**
     * Get a dashboard by ID
     * Endpoint: GET /api/v2/dashboards/{id}
     * Docs: https://api.sumologic.com/docs/#operation/getDashboard
     */
    async getDashboard(dashboardId: string): Promise<ApiResponse<Dashboard>> {
        return this.makeRequest<Dashboard>(
            `/api/v2/dashboards/${dashboardId}`,
            'GET'
        );
    }
}

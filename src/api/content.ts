import { SumoLogicClient, ApiResponse } from './client';

/**
 * Content item in Sumo Logic library
 */
export interface ContentItem {
    id: string;
    name: string;
    itemType: string;
    parentId: string;
    permissions: string[];
    description?: string;
    createdAt: string;
    createdBy: string;
    modifiedAt: string;
    modifiedBy: string;
    children?: ContentItem[];
}

/**
 * Personal folder response
 */
export interface PersonalFolderResponse {
    id: string;
    name: string;
    itemType: string;
    parentId: string;
    permissions: string[];
    description?: string;
    createdAt: string;
    createdBy: string;
    modifiedAt: string;
    modifiedBy: string;
    children: ContentItem[];
}

/**
 * Export job response
 */
export interface ExportJobResponse {
    id: string;
}

/**
 * Export job status response
 */
export interface ExportJobStatusResponse {
    status: 'InProgress' | 'Success' | 'Failed';
    statusMessage?: string;
    error?: string;
}

/**
 * Export result - the actual exported content
 */
export interface ExportResultResponse {
    type?: string;
    name?: string;
    description?: string;
    children?: ExportResultResponse[];
    data?: ExportResultResponse[]; // Global folder uses 'data' instead of 'children'
    search?: any;
    searchSchedule?: any;
    [key: string]: any; // Allow other properties depending on content type
}

/**
 * Client for Sumo Logic Content API
 * Endpoint: GET /api/v2/content/folders/personal
 * Docs: https://api.sumologic.com/docs/#operation/getPersonalFolder
 */
export class ContentClient extends SumoLogicClient {
    private static readonly PERSONAL_FOLDER_API = '/api/v2/content/folders/personal';

    /**
     * Get the user's personal folder
     */
    async getPersonalFolder(): Promise<ApiResponse<PersonalFolderResponse>> {
        return this.makeRequest<PersonalFolderResponse>(
            ContentClient.PERSONAL_FOLDER_API,
            'GET'
        );
    }

    /**
     * Get a folder by ID
     * Endpoint: GET /api/v2/content/folders/{id}
     * Docs: https://api.sumologic.com/docs/#operation/getFolder
     */
    async getFolder(folderId: string): Promise<ApiResponse<PersonalFolderResponse>> {
        return this.makeRequest<PersonalFolderResponse>(
            `/api/v2/content/folders/${folderId}`,
            'GET'
        );
    }

    /**
     * Get content by path
     * Endpoint: GET /api/v2/content/path
     * Docs: https://api.sumologic.com/docs/#operation/getItemByPath
     */
    async getContent(path: string): Promise<ApiResponse<ContentItem>> {
        const encodedPath = encodeURIComponent(path);
        return this.makeRequest<ContentItem>(
            `/api/v2/content/path?path=${encodedPath}`,
            'GET'
        );
    }

    /**
     * Get content path by ID
     * Endpoint: GET /api/v2/content/{id}/path
     * Docs: https://api.sumologic.com/docs/#operation/getPathById
     */
    async getContentPath(contentId: string): Promise<ApiResponse<{ path: string }>> {
        return this.makeRequest<{ path: string }>(
            `/api/v2/content/${contentId}/path`,
            'GET'
        );
    }

    /**
     * Begin async export of content
     * Endpoint: POST /api/v2/content/{id}/export
     * Docs: https://api.sumologic.com/docs/#operation/beginAsyncExport
     */
    async beginAsyncExport(contentId: string, isAdminMode?: boolean): Promise<ApiResponse<ExportJobResponse>> {
        const params = isAdminMode !== undefined ? { isAdminMode: isAdminMode.toString() } : undefined;
        return this.makeRequest<ExportJobResponse>(
            `/api/v2/content/${contentId}/export`,
            'POST',
            undefined,
            params
        );
    }

    /**
     * Begin async export of Admin Recommended folder
     * Endpoint: GET /api/v2/content/folders/adminRecommended
     * Docs: https://api.sumologic.com/docs/#operation/getAdminRecommendedFolderAsync
     */
    async beginAdminRecommendedExport(isAdminMode?: boolean): Promise<ApiResponse<ExportJobResponse>> {
        const params = isAdminMode !== undefined ? { isAdminMode: isAdminMode.toString() } : undefined;
        return this.makeRequest<ExportJobResponse>(
            `/api/v2/content/folders/adminRecommended`,
            'GET',
            undefined,
            params
        );
    }

    /**
     * Begin async export of Global folder
     * Endpoint: GET /api/v2/content/folders/global
     * Docs: https://api.sumologic.com/docs/#operation/getGlobalFolderAsync
     */
    async beginGlobalFolderExport(isAdminMode?: boolean): Promise<ApiResponse<ExportJobResponse>> {
        const params = isAdminMode !== undefined ? { isAdminMode: isAdminMode.toString() } : undefined;
        return this.makeRequest<ExportJobResponse>(
            `/api/v2/content/folders/global`,
            'GET',
            undefined,
            params
        );
    }

    /**
     * Get async export job status
     * Endpoint: GET /api/v2/content/{contentId}/export/{jobId}/status
     * Docs: https://api.sumologic.com/docs/#operation/getAsyncExportStatus
     */
    async getAsyncExportStatus(contentId: string, jobId: string): Promise<ApiResponse<ExportJobStatusResponse>> {
        return this.makeRequest<ExportJobStatusResponse>(
            `/api/v2/content/${contentId}/export/${jobId}/status`,
            'GET'
        );
    }

    /**
     * Get async export result
     * Endpoint: GET /api/v2/content/{contentId}/export/{jobId}/result
     * Docs: https://api.sumologic.com/docs/#operation/getAsyncExportResult
     */
    async getAsyncExportResult(contentId: string, jobId: string): Promise<ApiResponse<ExportResultResponse>> {
        return this.makeRequest<ExportResultResponse>(
            `/api/v2/content/${contentId}/export/${jobId}/result`,
            'GET'
        );
    }

    /**
     * Get Admin Recommended folder export job status
     * Endpoint: GET /api/v2/content/folders/adminRecommended/{jobId}/status
     * Docs: https://api.sumologic.com/docs/#operation/getAdminRecommendedFolderAsyncStatus
     */
    async getAdminRecommendedExportStatus(jobId: string): Promise<ApiResponse<ExportJobStatusResponse>> {
        return this.makeRequest<ExportJobStatusResponse>(
            `/api/v2/content/folders/adminRecommended/${jobId}/status`,
            'GET'
        );
    }

    /**
     * Get Admin Recommended folder export result
     * Endpoint: GET /api/v2/content/folders/adminRecommended/{jobId}/result
     * Docs: https://api.sumologic.com/docs/#operation/getAdminRecommendedFolderAsyncResult
     */
    async getAdminRecommendedExportResult(jobId: string): Promise<ApiResponse<ExportResultResponse>> {
        return this.makeRequest<ExportResultResponse>(
            `/api/v2/content/folders/adminRecommended/${jobId}/result`,
            'GET'
        );
    }

    /**
     * Get Global folder export job status
     * Endpoint: GET /api/v2/content/folders/global/{jobId}/status
     * Docs: https://api.sumologic.com/docs/#operation/getGlobalFolderAsyncStatus
     */
    async getGlobalFolderExportStatus(jobId: string): Promise<ApiResponse<ExportJobStatusResponse>> {
        return this.makeRequest<ExportJobStatusResponse>(
            `/api/v2/content/folders/global/${jobId}/status`,
            'GET'
        );
    }

    /**
     * Get Global folder export result
     * Endpoint: GET /api/v2/content/folders/global/{jobId}/result
     * Docs: https://api.sumologic.com/docs/#operation/getGlobalFolderAsyncResult
     */
    async getGlobalFolderExportResult(jobId: string): Promise<ApiResponse<ExportResultResponse>> {
        return this.makeRequest<ExportResultResponse>(
            `/api/v2/content/folders/global/${jobId}/result`,
            'GET'
        );
    }

    /**
     * Generic export poller - handles polling logic for any export type
     */
    private async pollExportJob(
        jobId: string,
        getStatus: () => Promise<ApiResponse<ExportJobStatusResponse>>,
        getResult: () => Promise<ApiResponse<ExportResultResponse>>,
        maxWaitSeconds: number = 300
    ): Promise<ApiResponse<ExportResultResponse>> {
        const pollInterval = 2000; // 2 seconds
        const maxAttempts = Math.floor((maxWaitSeconds * 1000) / pollInterval);

        // Poll for completion
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            const statusResponse = await getStatus();

            if (statusResponse.error) {
                return statusResponse as any;
            }

            const status = statusResponse.data!.status;

            if (status === 'Success') {
                // Job complete, get the result
                return await getResult();
            } else if (status === 'Failed') {
                return {
                    error: statusResponse.data!.error || statusResponse.data!.statusMessage || 'Export job failed',
                    statusCode: 500
                } as any;
            }

            // Status is 'InProgress', continue polling
        }

        // Timeout
        return {
            error: `Export job timed out after ${maxWaitSeconds} seconds`,
            statusCode: 408
        } as any;
    }

    /**
     * Export content with polling for completion
     * This is a high-level method that handles the full export workflow:
     * 1. Start export job
     * 2. Poll for completion
     * 3. Return result when ready
     */
    async exportContent(contentId: string, isAdminMode?: boolean, maxWaitSeconds: number = 300): Promise<ApiResponse<ExportResultResponse>> {
        // Start the export job
        const exportJobResponse = await this.beginAsyncExport(contentId, isAdminMode);

        if (exportJobResponse.error) {
            return exportJobResponse as any;
        }

        const jobId = exportJobResponse.data!.id;

        return this.pollExportJob(
            jobId,
            () => this.getAsyncExportStatus(contentId, jobId),
            () => this.getAsyncExportResult(contentId, jobId),
            maxWaitSeconds
        );
    }

    /**
     * Export Admin Recommended folder with polling for completion
     */
    async exportAdminRecommendedFolder(isAdminMode?: boolean, maxWaitSeconds: number = 300): Promise<ApiResponse<ExportResultResponse>> {
        // Start the export job
        const exportJobResponse = await this.beginAdminRecommendedExport(isAdminMode);

        if (exportJobResponse.error) {
            return exportJobResponse as any;
        }

        const jobId = exportJobResponse.data!.id;

        return this.pollExportJob(
            jobId,
            () => this.getAdminRecommendedExportStatus(jobId),
            () => this.getAdminRecommendedExportResult(jobId),
            maxWaitSeconds
        );
    }

    /**
     * Export Global folder with polling for completion
     */
    async exportGlobalFolder(isAdminMode?: boolean, maxWaitSeconds: number = 300): Promise<ApiResponse<ExportResultResponse>> {
        // Start the export job
        const exportJobResponse = await this.beginGlobalFolderExport(isAdminMode);

        if (exportJobResponse.error) {
            return exportJobResponse as any;
        }

        const jobId = exportJobResponse.data!.id;

        return this.pollExportJob(
            jobId,
            () => this.getGlobalFolderExportStatus(jobId),
            () => this.getGlobalFolderExportResult(jobId),
            maxWaitSeconds
        );
    }

    /**
     * Begin async export of Installed Apps folder
     * Endpoint: GET /api/v2/content/folders/installedApps
     */
    async beginInstalledAppsExport(isAdminMode?: boolean): Promise<ApiResponse<ExportJobResponse>> {
        const params = isAdminMode ? '?isAdminMode=true' : '';
        return this.makeRequest<ExportJobResponse>(
            `/api/v2/content/folders/installedApps${params}`,
            'GET'
        );
    }

    /**
     * Get status of Installed Apps folder export job
     * Endpoint: GET /api/v2/content/folders/installedApps/{jobId}/status
     */
    async getInstalledAppsExportStatus(jobId: string): Promise<ApiResponse<ExportJobStatusResponse>> {
        return this.makeRequest<ExportJobStatusResponse>(
            `/api/v2/content/folders/installedApps/${jobId}/status`,
            'GET'
        );
    }

    /**
     * Get result of Installed Apps folder export job
     * Endpoint: GET /api/v2/content/folders/installedApps/{jobId}/result
     */
    async getInstalledAppsExportResult(jobId: string): Promise<ApiResponse<ExportResultResponse>> {
        return this.makeRequest<ExportResultResponse>(
            `/api/v2/content/folders/installedApps/${jobId}/result`,
            'GET'
        );
    }

    /**
     * Export Installed Apps folder with polling for completion
     */
    async exportInstalledAppsFolder(isAdminMode?: boolean, maxWaitSeconds: number = 300): Promise<ApiResponse<ExportResultResponse>> {
        // Start the export job
        const exportJobResponse = await this.beginInstalledAppsExport(isAdminMode);

        if (exportJobResponse.error) {
            return exportJobResponse as any;
        }

        const jobId = exportJobResponse.data!.id;

        return this.pollExportJob(
            jobId,
            () => this.getInstalledAppsExportStatus(jobId),
            () => this.getInstalledAppsExportResult(jobId),
            maxWaitSeconds
        );
    }

    /**
     * Format content item with properties and optional children table
     * This is a reusable formatter for any content item (folder, dashboard, search, etc.)
     */
    static formatContentItem(item: ContentItem | PersonalFolderResponse, title?: string): string {
        let output = '';

        // Properties section
        output += `${title || 'Content Item'} Properties\n`;
        output += '='.repeat(80) + '\n\n';
        output += `ID:          ${item.id}\n`;
        output += `Name:        ${item.name}\n`;
        output += `Parent ID:   ${item.parentId}\n`;
        output += `Description: ${item.description || '(none)'}\n`;
        output += `Item Type:   ${item.itemType}\n`;
        output += `Created At:  ${item.createdAt}\n`;
        output += `Created By:  ${item.createdBy}\n`;
        output += `Modified At: ${item.modifiedAt}\n`;
        output += `Modified By: ${item.modifiedBy}\n`;
        output += `Permissions: ${item.permissions.join(', ')}\n`;
        output += '\n\n';

        // Children section (if exists)
        if (item.children && item.children.length > 0) {
            output += `Contents (${item.children.length} items)\n`;
            output += '='.repeat(80) + '\n\n';
            output += ContentClient.formatChildrenAsTable(item.children);
        } else if (item.children) {
            output += 'Contents\n';
            output += '='.repeat(80) + '\n\n';
            output += '(empty)\n';
        }

        return output;
    }

    /**
     * Format personal folder as a readable report
     */
    static formatPersonalFolder(folder: PersonalFolderResponse): string {
        return ContentClient.formatContentItem(folder, 'Personal Folder');
    }

    /**
     * Format export result as a readable markdown summary
     * Shows top-level properties and tables for array properties (children, panels, etc.)
     * @param exportData The export data to format
     * @param jsonFilename The actual JSON filename (e.g., export_content_123_name_20251013_143022.json)
     */
    static formatExportSummary(exportData: ExportResultResponse, jsonFilename: string): string {
        let output = '';

        // Header
        output += `# Content Export Summary\n\n`;
        output += `**Name:** ${exportData.name}  \n`;
        output += `**Type:** ${exportData.type}  \n\n`;
        output += `[View Full JSON Export](./${jsonFilename})\n\n`;
        output += '---\n\n';

        // Top-level properties (excluding arrays and objects)
        output += '## Properties\n\n';

        const excludeKeys = ['children', 'panels', 'search', 'searchSchedule', 'name', 'type'];
        const simpleProps: string[] = [];

        for (const [key, value] of Object.entries(exportData)) {
            if (excludeKeys.includes(key)) {
                continue; // Handle these separately
            }

            if (value === null || value === undefined) {
                continue;
            }

            if (typeof value !== 'object') {
                simpleProps.push(`- **${key}:** ${value}`);
            } else if (!Array.isArray(value)) {
                // For objects, show them as JSON on one line if small
                const jsonStr = JSON.stringify(value);
                if (jsonStr.length < 100) {
                    simpleProps.push(`- **${key}:** \`${jsonStr}\``);
                } else {
                    simpleProps.push(`- **${key}:** [Object - see JSON export for details]`);
                }
            }
        }

        simpleProps.forEach(prop => {
            output += `${prop}\n`;
        });

        output += '\n';

        // Handle specific array properties with tables
        // Global folder uses 'data' property instead of 'children'
        const childrenArray = exportData.children || exportData.data;
        if (childrenArray && Array.isArray(childrenArray)) {
            output += `## Children (${childrenArray.length} items)\n\n`;
            output += ContentClient.formatExportChildrenTable(childrenArray);
        }

        if (exportData.panels && Array.isArray(exportData.panels)) {
            output += `## Panels (${exportData.panels.length} items)\n\n`;
            output += ContentClient.formatPanelsTable(exportData.panels);
        }

        // Handle search object
        if (exportData.search && typeof exportData.search === 'object') {
            output += '## Search Configuration\n\n';
            const search = exportData.search;
            if (search.queryText) {
                output += `**Query:**\n\`\`\`\n${search.queryText}\n\`\`\`\n\n`;
            }
            if (search.defaultTimeRange) {
                output += `- **Time Range:** ${search.defaultTimeRange}\n`;
            }
            if (search.byReceiptTime !== undefined) {
                output += `- **By Receipt Time:** ${search.byReceiptTime}\n`;
            }
            if (search.viewName) {
                output += `- **View Name:** ${search.viewName}\n`;
            }
            if (search.viewStartTime) {
                output += `- **View Start Time:** ${search.viewStartTime}\n`;
            }
            if (search.queryParameters && Array.isArray(search.queryParameters)) {
                output += `\n**Query Parameters (${search.queryParameters.length}):**\n\n`;
                search.queryParameters.forEach((param: any) => {
                    output += `- **${param.name}:** ${param.value}\n`;
                });
            }
            output += '\n';
        }

        // Handle search schedule
        if (exportData.searchSchedule && typeof exportData.searchSchedule === 'object') {
            output += '## Search Schedule\n\n';
            const schedule = exportData.searchSchedule;
            if (schedule.cronExpression) {
                output += `- **Cron Expression:** \`${schedule.cronExpression}\`\n`;
            }
            if (schedule.displayableTimeRange) {
                output += `- **Time Range:** ${schedule.displayableTimeRange}\n`;
            }
            if (schedule.parseableTimeRange) {
                output += `- **Parseable Time Range:** \`${JSON.stringify(schedule.parseableTimeRange)}\`\n`;
            }
            if (schedule.timeZone) {
                output += `- **Time Zone:** ${schedule.timeZone}\n`;
            }
            if (schedule.threshold) {
                output += `- **Threshold:** \`${JSON.stringify(schedule.threshold)}\`\n`;
            }
            if (schedule.notification) {
                output += `- **Notification:** \`${JSON.stringify(schedule.notification)}\`\n`;
            }
            output += '\n';
        }

        return output;
    }

    /**
     * Format export children as a markdown table (one level only)
     */
    static formatExportChildrenTable(children: any[]): string {
        if (children.length === 0) {
            return '*(no children)*\n\n';
        }

        // Sort by name if available
        const sorted = [...children].sort((a, b) => {
            const nameA = a.name || '';
            const nameB = b.name || '';
            return nameA.localeCompare(nameB);
        });

        // Create markdown table with ID column
        let table = '| ID | Name | Type | Description | Has Children |\n';
        table += '|----|------|------|-------------|-------------|\n';

        // Create rows
        sorted.forEach(child => {
            const id = child.id || '';
            const name = child.name || '';
            const type = child.type || '';
            const desc = (child.description || '').substring(0, 60); // Truncate long descriptions
            const hasChildren = child.children && Array.isArray(child.children) && child.children.length > 0
                ? `Yes (${child.children.length})`
                : 'No';

            // Escape pipe characters in content
            const escapePipes = (str: string) => str.replace(/\|/g, '\\|');

            table += `| ${escapePipes(id)} | ${escapePipes(name)} | ${escapePipes(type)} | ${escapePipes(desc)} | ${hasChildren} |\n`;
        });

        return table + '\n';
    }

    /**
     * Format dashboard panels as a markdown table
     */
    static formatPanelsTable(panels: any[]): string {
        if (panels.length === 0) {
            return '*(no panels)*\n\n';
        }

        // Create markdown table
        let table = '| Name | Type | Key | Properties |\n';
        table += '|------|------|-----|------------|\n';

        // Create rows
        panels.forEach(panel => {
            const name = panel.name || '';
            const type = panel.panelType || '';
            const key = panel.key || '';

            // Collect interesting properties
            const props: string[] = [];
            if (panel.queryString) {
                props.push('has query');
            }
            if (panel.visualSettings) {
                props.push('has visual settings');
            }
            if (panel.timeRange) {
                props.push(`timeRange: ${JSON.stringify(panel.timeRange)}`);
            }

            const propsStr = props.join(', ').substring(0, 50);

            // Escape pipe characters in content
            const escapePipes = (str: string) => str.replace(/\|/g, '\\|');

            table += `| ${escapePipes(name)} | ${escapePipes(type)} | ${escapePipes(key)} | ${escapePipes(propsStr)} |\n`;
        });

        return table + '\n';
    }

    /**
     * Get Personal folder - top level only (optimized for library tree root)
     * Returns just the folder metadata without children details
     */
    async getPersonalFolderTopLevel(): Promise<ApiResponse<PersonalFolderResponse>> {
        return this.getPersonalFolder();
    }

    /**
     * Export content by ID and wait for completion
     * Wrapper for exportContent to match naming convention
     */
    async exportContentById(contentId: string, isAdminMode?: boolean, maxWaitSeconds?: number): Promise<ApiResponse<ExportResultResponse>> {
        return this.exportContent(contentId, isAdminMode, maxWaitSeconds);
    }

    /**
     * Batch get folders with rate limiting
     * Fetches multiple folders with automatic delay to respect API rate limits (4 requests/second)
     * @param folderIds Array of folder IDs to fetch
     * @param delayMs Delay between requests in milliseconds (default 250ms = ~4 requests/second)
     */
    async batchGetFolders(folderIds: string[], delayMs: number = 250): Promise<Map<string, PersonalFolderResponse>> {
        const results = new Map<string, PersonalFolderResponse>();

        for (let i = 0; i < folderIds.length; i++) {
            const folderId = folderIds[i];

            // Add delay between requests (except for first one)
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }

            const response = await this.getFolder(folderId);

            if (!response.error && response.data) {
                results.set(folderId, response.data);
            }
        }

        return results;
    }

    /**
     * Rate-limited delay utility for sequential API calls
     * Use this before making API calls to respect Sumo Logic's rate limit of 4 requests/second
     */
    static async rateLimitDelay(delayMs: number = 250): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, delayMs));
    }

    /**
     * Format children as a table
     */
    static formatChildrenAsTable(children: ContentItem[]): string {
        if (children.length === 0) {
            return '(no items)\n';
        }

        // Sort by name
        const sortedChildren = [...children].sort((a, b) => a.name.localeCompare(b.name));

        // Calculate column widths
        const nameWidth = Math.max(20, ...sortedChildren.map(c => c.name.length));
        const typeWidth = Math.max(10, ...sortedChildren.map(c => c.itemType.length));
        const idWidth = Math.max(20, ...sortedChildren.map(c => c.id.length));
        const descWidth = 30;

        // Create header
        let table = '';
        table += 'Name'.padEnd(nameWidth) + ' | ';
        table += 'Type'.padEnd(typeWidth) + ' | ';
        table += 'ID'.padEnd(idWidth) + ' | ';
        table += 'Description'.padEnd(descWidth) + ' | ';
        table += 'Modified At\n';

        table += '-'.repeat(nameWidth) + '-+-';
        table += '-'.repeat(typeWidth) + '-+-';
        table += '-'.repeat(idWidth) + '-+-';
        table += '-'.repeat(descWidth) + '-+-';
        table += '-'.repeat(20) + '\n';

        // Create rows
        sortedChildren.forEach(child => {
            const desc = (child.description || '').substring(0, 30);
            const modifiedAt = new Date(child.modifiedAt).toLocaleString();

            table += child.name.substring(0, nameWidth).padEnd(nameWidth) + ' | ';
            table += child.itemType.padEnd(typeWidth) + ' | ';
            table += child.id.padEnd(idWidth) + ' | ';
            table += desc.padEnd(descWidth) + ' | ';
            table += modifiedAt + '\n';
        });

        return table;
    }
}

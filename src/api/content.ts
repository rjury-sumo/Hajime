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

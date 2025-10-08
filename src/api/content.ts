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
     * Format personal folder as a readable report
     */
    static formatPersonalFolder(folder: PersonalFolderResponse): string {
        let output = '';

        // Folder properties section
        output += 'Personal Folder Properties\n';
        output += '='.repeat(80) + '\n\n';
        output += `ID:          ${folder.id}\n`;
        output += `Name:        ${folder.name}\n`;
        output += `Parent ID:   ${folder.parentId}\n`;
        output += `Description: ${folder.description || '(none)'}\n`;
        output += `Item Type:   ${folder.itemType}\n`;
        output += `Created At:  ${folder.createdAt}\n`;
        output += `Modified At: ${folder.modifiedAt}\n`;
        output += '\n\n';

        // Children section
        output += `Personal Folder Contents (${folder.children.length} items)\n`;
        output += '='.repeat(80) + '\n\n';

        if (folder.children.length === 0) {
            output += '(empty)\n';
        } else {
            output += ContentClient.formatChildrenAsTable(folder.children);
        }

        return output;
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

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager } from '../profileManager';
import { ContentClient, ContentItem } from '../api/content';
import { formatContentId } from '../utils/contentId';
import { createUsersRolesDB } from '../database/usersRoles';

/**
 * Webview provider for displaying library node details
 */
export class LibraryNodeDetailsWebviewProvider {
    private static currentPanel?: vscode.WebviewPanel;
    private static profileManager?: ProfileManager;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) {
        LibraryNodeDetailsWebviewProvider.profileManager = new ProfileManager(context);
    }

    /**
     * Show library node details
     */
    public async show(profileName: string, contentId: string, contentName: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Create or show panel
        if (LibraryNodeDetailsWebviewProvider.currentPanel) {
            LibraryNodeDetailsWebviewProvider.currentPanel.reveal(column);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'libraryNodeDetails',
                `📚 ${contentName}`,
                column || vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            LibraryNodeDetailsWebviewProvider.currentPanel = panel;

            panel.onDidDispose(() => {
                LibraryNodeDetailsWebviewProvider.currentPanel = undefined;
            });

            // Handle messages from webview
            panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.type) {
                    case 'refresh':
                        await this.loadContent(profileName, contentId, contentName);
                        break;
                    case 'copyId':
                        await vscode.env.clipboard.writeText(contentId);
                        vscode.window.showInformationMessage('Content ID copied to clipboard');
                        break;
                    case 'copyPath':
                        await vscode.env.clipboard.writeText(message.path);
                        vscode.window.showInformationMessage('Path copied to clipboard');
                        break;
                    case 'openInWeb':
                        await vscode.commands.executeCommand('sumologic.openLibraryNodeInWeb', { nodeId: contentId });
                        break;
                    case 'exportToFile':
                        await vscode.commands.executeCommand('sumologic.exportLibraryNodeToFile', { nodeId: contentId, nodeName: contentName });
                        break;
                }
            });
        }

        // Load content
        await this.loadContent(profileName, contentId, contentName);
    }

    /**
     * Load content from API and display
     */
    private async loadContent(profileName: string, contentId: string, contentName: string) {
        if (!LibraryNodeDetailsWebviewProvider.profileManager || !LibraryNodeDetailsWebviewProvider.currentPanel) {
            return;
        }

        try {
            // Show loading
            LibraryNodeDetailsWebviewProvider.currentPanel.webview.html = this.getLoadingHtml(contentName);

            // Get profile and credentials
            const profiles = await LibraryNodeDetailsWebviewProvider.profileManager.getProfiles();
            const profile = profiles.find(p => p.name === profileName);
            if (!profile) {
                throw new Error(`Profile not found: ${profileName}`);
            }

            const credentials = await LibraryNodeDetailsWebviewProvider.profileManager.getProfileCredentials(profileName);
            if (!credentials) {
                throw new Error(`No credentials for profile: ${profileName}`);
            }

            const endpoint = LibraryNodeDetailsWebviewProvider.profileManager.getProfileEndpoint(profile);
            const client = new ContentClient({
                accessId: credentials.accessId,
                accessKey: credentials.accessKey,
                endpoint
            });

            // Get path first
            const pathResponse = await client.getContentPath(contentId);
            if (pathResponse.error || !pathResponse.data) {
                throw new Error(pathResponse.error || 'Failed to get content path');
            }

            const contentPath = pathResponse.data.path;

            // Get content item by path (or folder if it's a folder type)
            let contentItem: ContentItem;
            let isFolder = false;

            // Try to get as folder first (includes children)
            const folderResponse = await client.getFolder(contentId);
            if (!folderResponse.error && folderResponse.data) {
                contentItem = folderResponse.data as any;
                isFolder = true;
            } else {
                // Fall back to getItemByPath
                const itemResponse = await client.getItemByPath(contentPath);
                if (itemResponse.error || !itemResponse.data) {
                    throw new Error(itemResponse.error || 'Failed to get content item');
                }
                contentItem = itemResponse.data;
            }

            // Enrich with user emails
            const profileDir = LibraryNodeDetailsWebviewProvider.profileManager.getProfileDirectory(profileName);
            const { createdByEmail, modifiedByEmail } = await this.enrichUserData(profileDir, profileName, contentItem);

            // Display in webview
            LibraryNodeDetailsWebviewProvider.currentPanel.webview.html = this.getContentHtml(
                contentItem,
                contentPath,
                createdByEmail,
                modifiedByEmail,
                isFolder
            );

        } catch (error: any) {
            LibraryNodeDetailsWebviewProvider.currentPanel.webview.html = this.getErrorHtml(contentName, error.message);
        }
    }

    /**
     * Enrich content item with user emails
     */
    private async enrichUserData(profileDir: string, profileName: string, contentItem: ContentItem): Promise<{ createdByEmail?: string; modifiedByEmail?: string }> {
        let createdByEmail: string | undefined;
        let modifiedByEmail: string | undefined;

        try {
            const usersRolesDbPath = path.join(profileDir, 'metadata', 'users_roles.db');
            if (fs.existsSync(usersRolesDbPath)) {
                const db = createUsersRolesDB(profileDir, profileName);

                if (contentItem.createdBy) {
                    createdByEmail = db.getUserEmail(contentItem.createdBy) || undefined;
                }

                if (contentItem.modifiedBy) {
                    modifiedByEmail = db.getUserEmail(contentItem.modifiedBy) || undefined;
                }

                db.close();
            }
        } catch (error) {
            console.log('[LibraryNodeDetails] Could not enrich user data:', error);
        }

        return { createdByEmail, modifiedByEmail };
    }

    /**
     * Generate HTML for content display
     */
    private getContentHtml(
        contentItem: ContentItem,
        contentPath: string,
        createdByEmail?: string,
        modifiedByEmail?: string,
        hasChildren: boolean = false
    ): string {
        const formattedId = formatContentId(contentItem.id);
        const escapeHtml = (str: string) => {
            if (!str) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };

        const childrenHtml = hasChildren && contentItem.children && contentItem.children.length > 0 ? `
            <h2>Children (${contentItem.children.length})</h2>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>ID</th>
                            <th>Modified</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${contentItem.children.map(child => `
                            <tr>
                                <td>${escapeHtml(child.name)}</td>
                                <td><span class="badge">${escapeHtml(child.itemType)}</span></td>
                                <td><code class="small-code">${escapeHtml(child.id)}</code></td>
                                <td>${new Date(child.modifiedAt).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(contentItem.name)}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }

        h1 {
            color: var(--vscode-editor-foreground);
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            margin-bottom: 20px;
        }

        h2 {
            color: var(--vscode-editor-foreground);
            margin-top: 30px;
            margin-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 5px;
        }

        .actions {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .properties {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }

        .property-row {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 10px;
            margin-bottom: 10px;
        }

        .property-label {
            font-weight: bold;
            color: var(--vscode-descriptionForeground);
        }

        .property-value {
            color: var(--vscode-foreground);
            word-break: break-word;
        }

        code {
            font-family: var(--vscode-editor-font-family);
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
        }

        .small-code {
            font-size: 11px;
        }

        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 11px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        .table-wrapper {
            overflow-x: auto;
            margin-bottom: 20px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        th {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 10px;
            text-align: left;
            font-weight: bold;
            border-bottom: 2px solid var(--vscode-panel-border);
        }

        td {
            padding: 8px 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .permissions {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }
    </style>
</head>
<body>
    <h1>📚 ${escapeHtml(contentItem.name)}</h1>

    <div class="actions">
        <button onclick="refresh()">🔄 Refresh</button>
        <button onclick="copyId()">📋 Copy ID</button>
        <button onclick="copyPath()">📋 Copy Path</button>
        <button onclick="openInWeb()">🌐 Open in Web</button>
        <button onclick="exportToFile()">💾 Export to File</button>
    </div>

    <div class="properties">
        <div class="property-row">
            <span class="property-label">ID:</span>
            <span class="property-value"><code>${formattedId}</code></span>
        </div>
        <div class="property-row">
            <span class="property-label">Path:</span>
            <span class="property-value"><code>${escapeHtml(contentPath)}</code></span>
        </div>
        <div class="property-row">
            <span class="property-label">Type:</span>
            <span class="property-value"><span class="badge">${escapeHtml(contentItem.itemType)}</span></span>
        </div>
        ${contentItem.description ? `
        <div class="property-row">
            <span class="property-label">Description:</span>
            <span class="property-value">${escapeHtml(contentItem.description)}</span>
        </div>
        ` : ''}
        <div class="property-row">
            <span class="property-label">Parent ID:</span>
            <span class="property-value"><code class="small-code">${escapeHtml(contentItem.parentId)}</code></span>
        </div>
        <div class="property-row">
            <span class="property-label">Created:</span>
            <span class="property-value">${new Date(contentItem.createdAt).toLocaleString()}</span>
        </div>
        <div class="property-row">
            <span class="property-label">Created By:</span>
            <span class="property-value">${escapeHtml(createdByEmail || contentItem.createdBy)}</span>
        </div>
        <div class="property-row">
            <span class="property-label">Modified:</span>
            <span class="property-value">${new Date(contentItem.modifiedAt).toLocaleString()}</span>
        </div>
        <div class="property-row">
            <span class="property-label">Modified By:</span>
            <span class="property-value">${escapeHtml(modifiedByEmail || contentItem.modifiedBy)}</span>
        </div>
        <div class="property-row">
            <span class="property-label">Permissions:</span>
            <span class="property-value">
                <div class="permissions">
                    ${contentItem.permissions.map(p => `<span class="badge">${escapeHtml(p)}</span>`).join('')}
                </div>
            </span>
        </div>
    </div>

    ${childrenHtml}

    <script>
        const vscode = acquireVsCodeApi();

        function refresh() {
            vscode.postMessage({ type: 'refresh' });
        }

        function copyId() {
            vscode.postMessage({ type: 'copyId' });
        }

        function copyPath() {
            vscode.postMessage({ type: 'copyPath', path: '${contentPath.replace(/'/g, "\\'")}' });
        }

        function openInWeb() {
            vscode.postMessage({ type: 'openInWeb' });
        }

        function exportToFile() {
            vscode.postMessage({ type: 'exportToFile' });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Loading HTML
     */
    private getLoadingHtml(contentName: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${contentName}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }
        .loading {
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="loading">
        <h2>Loading ${contentName}...</h2>
        <p>Fetching content details...</p>
    </div>
</body>
</html>`;
    }

    /**
     * Error HTML
     */
    private getErrorHtml(contentName: string, error: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - ${contentName}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }
        .error {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-errorForeground);
            padding: 15px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <h1>Error Loading ${contentName}</h1>
    <div class="error">
        <strong>Error:</strong> ${error}
    </div>
</body>
</html>`;
    }

    /**
     * Dispose
     */
    public dispose() {
        // Nothing to dispose
    }
}

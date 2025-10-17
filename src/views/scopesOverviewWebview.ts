import * as vscode from 'vscode';
import { ProfileManager } from '../profileManager';
import { createScopesCacheDB, Scope } from '../database/scopesCache';
import { PartitionsClient } from '../api/partitions';

/**
 * Manage Scopes Overview webview panel
 */
export class ScopesOverviewWebviewProvider {
    private static panel: vscode.WebviewPanel | undefined;

    /**
     * Show scopes overview in webview
     */
    static async showScopesOverview(
        context: vscode.ExtensionContext,
        profileName: string
    ): Promise<void> {
        const profileManager = new ProfileManager(context);
        const storageRoot = profileManager.getStorageRoot();
        const db = createScopesCacheDB(storageRoot, profileName);

        try {
            const scopes = db.getAllScopes();

            // Check if panel already exists
            if (this.panel) {
                // Panel exists, reveal it and update content
                this.panel.reveal(vscode.ViewColumn.One);
                this.panel.webview.html = this.getHtmlContent(scopes, profileName, this.panel.webview, context);
            } else {
                // Create new panel
                this.panel = vscode.window.createWebviewPanel(
                    'scopesOverview',
                    `Scopes - ${profileName}`,
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );

                this.panel.webview.html = this.getHtmlContent(scopes, profileName, this.panel.webview, context);

                // Handle panel disposal
                this.panel.onDidDispose(() => {
                    this.panel = undefined;
                });

                // Handle messages from webview
                this.panel.webview.onDidReceiveMessage(
                    async (message) => {
                        await this.handleMessage(message, context, profileName);
                    },
                    undefined,
                    context.subscriptions
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show scopes overview: ${error}`);
        } finally {
            db.close();
        }
    }

    /**
     * Handle messages from webview
     */
    private static async handleMessage(
        message: any,
        context: vscode.ExtensionContext,
        profileName: string
    ): Promise<void> {
        switch (message.command) {
            case 'createScope':
                await vscode.commands.executeCommand('sumologic.createScope');
                // Refresh webview after creation
                setTimeout(() => {
                    this.showScopesOverview(context, profileName);
                }, 500);
                break;

            case 'addPartitionScopes':
                await this.addPartitionScopes(context, profileName);
                // Refresh webview after adding partitions
                setTimeout(() => {
                    this.showScopesOverview(context, profileName);
                }, 500);
                break;

            case 'refreshPartitionScopes':
                await this.refreshPartitionScopes(context, profileName);
                // Refresh webview after refreshing partitions
                setTimeout(() => {
                    this.showScopesOverview(context, profileName);
                }, 500);
                break;

            case 'viewScope':
                await vscode.commands.executeCommand('sumologic.viewScope', message.scopeId, profileName);
                break;

            case 'refresh':
                this.showScopesOverview(context, profileName);
                break;
        }
    }

    /**
     * Add partition scopes automatically (skips existing)
     */
    private static async addPartitionScopes(
        context: vscode.ExtensionContext,
        profileName: string
    ): Promise<void> {
        await this.syncPartitionScopes(context, profileName, false);
    }

    /**
     * Refresh partition scopes (overwrites existing)
     */
    private static async refreshPartitionScopes(
        context: vscode.ExtensionContext,
        profileName: string
    ): Promise<void> {
        await this.syncPartitionScopes(context, profileName, true);
    }

    /**
     * Sync partition scopes with optional refresh
     */
    private static async syncPartitionScopes(
        context: vscode.ExtensionContext,
        profileName: string,
        refresh: boolean
    ): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: refresh ? 'Refreshing partition scopes...' : 'Adding partition scopes...',
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: 'Fetching partitions...' });

                // Get credentials for the profile
                const profileManager = new ProfileManager(context);
                const profile = (await profileManager.getProfiles()).find(p => p.name === profileName);
                if (!profile) {
                    throw new Error('Profile not found');
                }

                const credentials = await profileManager.getProfileCredentials(profileName);
                if (!credentials) {
                    throw new Error('No credentials found for profile');
                }

                // Create partitions client
                const partitionsClient = new PartitionsClient({
                    accessId: credentials.accessId,
                    accessKey: credentials.accessKey,
                    endpoint: profileManager.getProfileEndpoint(profile)
                });

                const response = await partitionsClient.listPartitions();

                if (response.error || !response.data) {
                    throw new Error(response.error || 'Failed to fetch partitions');
                }

                const partitions = response.data.data || [];
                progress.report({ message: `Found ${partitions.length} partitions...` });

                // Get existing scopes to check for duplicates
                const storageRoot = profileManager.getStorageRoot();
                const db = createScopesCacheDB(storageRoot, profileName);

                try {
                    const existingScopes = db.getAllScopes();
                    const existingScopeMap = new Map(
                        existingScopes.map(s => [s.name, s])
                    );

                    let addedCount = 0;
                    let updatedCount = 0;
                    let skippedCount = 0;

                    // Create a scope for each partition
                    for (const partition of partitions) {
                        const scopeName = `Partition: ${partition.name}`;

                        // Check if scope already exists with same profile
                        const existingScope = existingScopeMap.get(scopeName);
                        const existsForThisProfile = existingScope && existingScope.profiles === profileName;

                        if (existsForThisProfile && !refresh) {
                            // Skip if exists and not refreshing
                            skippedCount++;
                            continue;
                        }

                        // Build search scope query
                        const searchScope = `_index=${partition.name}`;

                        // Build description
                        const description = `Auto-generated scope for partition "${partition.name}"`;

                        // Build context with partition properties
                        const contextObj = {
                            source: 'partition',
                            partitionId: partition.id,
                            routingExpression: partition.routingExpression,
                            indexType: partition.indexType || 'Default',
                            analyticsTier: partition.analyticsTier || 'continuous',
                            retentionPeriod: partition.retentionPeriod,
                            isActive: partition.isActive,
                            totalBytes: partition.totalBytes
                        };
                        const context = JSON.stringify(contextObj, null, 2);

                        if (existsForThisProfile && refresh) {
                            // Update existing scope
                            db.updateScope(existingScope!.id, {
                                searchScope: searchScope,
                                description: description,
                                context: context
                            });
                            updatedCount++;
                        } else {
                            // Create new scope (profile-specific)
                            db.createScope({
                                profile: profileName,
                                profiles: profileName,  // Only apply to this profile
                                name: scopeName,
                                searchScope: searchScope,
                                description: description,
                                context: context
                            });
                            addedCount++;
                        }
                    }

                    const messages = [];
                    if (addedCount > 0) {
                        messages.push(`Added ${addedCount} partition scope(s)`);
                    }
                    if (updatedCount > 0) {
                        messages.push(`Updated ${updatedCount} partition scope(s)`);
                    }
                    if (skippedCount > 0) {
                        messages.push(`Skipped ${skippedCount} existing scope(s)`);
                    }

                    vscode.window.showInformationMessage(
                        messages.join('. ') + '.'
                    );

                    // Refresh explorer
                    await vscode.commands.executeCommand('sumologic.refreshExplorer');
                } finally {
                    db.close();
                }

            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to add partition scopes: ${error.message || error}`);
            }
        });
    }

    /**
     * Generate HTML content for scopes overview webview
     */
    private static getHtmlContent(
        scopes: Scope[],
        profileName: string,
        webview: vscode.Webview,
        context: vscode.ExtensionContext
    ): string {
        const scopeRows = scopes.map(scope => {
            // Handle both old and new schema
            const profilesDisplay = scope.profiles
                ? (scope.profiles === '*' ? 'All' : this.escapeHtml(scope.profiles))
                : this.escapeHtml(scope.profile);
            return `
            <tr>
                <td><a href="#" onclick="viewScope('${scope.id}'); return false;">${this.escapeHtml(scope.name)}</a></td>
                <td>${this.escapeHtml(scope.searchScope)}</td>
                <td>${profilesDisplay}</td>
                <td>${this.escapeHtml(scope.description || '')}</td>
                <td>${scope.facetsTimestamp ? '✓' : ''}</td>
                <td>${scope.sampleLogsTimestamp ? '✓' : ''}</td>
                <td>${scope.metadataTimestamp ? '✓' : ''}</td>
                <td>${new Date(scope.modifiedAt).toLocaleDateString()}</td>
            </tr>
        `;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scopes - ${this.escapeHtml(profileName)}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        h1, h2 {
            color: var(--vscode-foreground);
            margin-top: 24px;
            margin-bottom: 12px;
        }
        h1 {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        .button-group {
            display: flex;
            gap: 8px;
            margin: 20px 0;
            flex-wrap: wrap;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
        }
        th, td {
            text-align: left;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        th {
            background-color: var(--vscode-editor-background);
            font-weight: 600;
            position: sticky;
            top: 0;
        }
        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .stats {
            margin: 20px 0;
            padding: 12px;
            background-color: var(--vscode-textCodeBlock-background);
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }
        .no-scopes {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            padding: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <h1>Scopes - ${this.escapeHtml(profileName)}</h1>

    <div class="stats">
        <strong>Total Scopes:</strong> ${scopes.length}
    </div>

    <h2>Scope Actions</h2>
    <div class="button-group">
        <button onclick="createScope()">➕ Create Scope</button>
        <button onclick="addPartitionScopes()" class="secondary">📦 Add Partition Scopes</button>
        <button onclick="refreshPartitionScopes()" class="secondary">🔄 Refresh Partition Scopes</button>
        <button onclick="refresh()" class="secondary">🔄 Refresh View</button>
    </div>

    <h2>All Scopes</h2>
    ${scopes.length > 0 ? `
    <table>
        <thead>
            <tr>
                <th>Name</th>
                <th>Search Scope</th>
                <th>Profiles</th>
                <th>Description</th>
                <th>Facets</th>
                <th>Samples</th>
                <th>Metadata</th>
                <th>Modified</th>
            </tr>
        </thead>
        <tbody>
            ${scopeRows}
        </tbody>
    </table>
    ` : '<div class="no-scopes">No scopes defined yet. Create your first scope to get started.</div>'}

    <script>
        const vscode = acquireVsCodeApi();

        function createScope() {
            vscode.postMessage({ command: 'createScope' });
        }

        function addPartitionScopes() {
            vscode.postMessage({ command: 'addPartitionScopes' });
        }

        function refreshPartitionScopes() {
            vscode.postMessage({ command: 'refreshPartitionScopes' });
        }

        function viewScope(scopeId) {
            vscode.postMessage({ command: 'viewScope', scopeId: scopeId });
        }

        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Escape HTML to prevent XSS
     */
    private static escapeHtml(text: string): string {
        const div = {
            '"': '&quot;',
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;'
        } as any;
        return text.replace(/[&<>"]/g, (char) => div[char]);
    }
}

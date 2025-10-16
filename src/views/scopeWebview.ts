import * as vscode from 'vscode';
import { ProfileManager } from '../profileManager';
import { createScopesCacheDB, Scope } from '../database/scopesCache';

/**
 * Manage Scope webview panels
 */
export class ScopeWebviewProvider {
    private static panels: Map<string, vscode.WebviewPanel> = new Map();

    /**
     * Show scope in webview
     */
    static async showScope(
        context: vscode.ExtensionContext,
        scopeId: string,
        profileName: string
    ): Promise<void> {
        const profileManager = new ProfileManager(context);
        const profileDir = profileManager.getProfileDirectory(profileName);
        const db = createScopesCacheDB(profileDir, profileName);

        try {
            const scope = db.getScopeById(scopeId);
            if (!scope) {
                vscode.window.showErrorMessage('Scope not found');
                return;
            }

            // Check if panel already exists
            const panelKey = `${profileName}:${scopeId}`;
            let panel = this.panels.get(panelKey);

            if (panel) {
                // Panel exists, reveal it and update content
                panel.reveal(vscode.ViewColumn.One);
                panel.webview.html = this.getHtmlContent(scope, panel.webview, context);
            } else {
                // Create new panel
                panel = vscode.window.createWebviewPanel(
                    'scopeView',
                    `Scope: ${scope.name}`,
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );

                panel.webview.html = this.getHtmlContent(scope, panel.webview, context);
                this.panels.set(panelKey, panel);

                // Handle panel disposal
                panel.onDidDispose(() => {
                    this.panels.delete(panelKey);
                });

                // Handle messages from webview
                panel.webview.onDidReceiveMessage(
                    async (message) => {
                        await this.handleMessage(message, context, scopeId, profileName, panel!);
                    },
                    undefined,
                    context.subscriptions
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show scope: ${error}`);
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
        scopeId: string,
        profileName: string,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        switch (message.command) {
            case 'editScope':
                await vscode.commands.executeCommand('sumologic.editScope', scopeId, profileName);
                break;

            case 'deleteScope':
                await vscode.commands.executeCommand('sumologic.deleteScope', scopeId, profileName);
                panel.dispose();
                break;

            case 'profileScope':
                await vscode.commands.executeCommand('sumologic.profileScope', scopeId, profileName);
                // Refresh webview with updated results
                setTimeout(() => {
                    this.showScope(context, scopeId, profileName);
                }, 1000);
                break;

            case 'sampleLogs':
                await vscode.commands.executeCommand('sumologic.sampleScopeLogs', scopeId, profileName);
                // Refresh webview with updated results
                setTimeout(() => {
                    this.showScope(context, scopeId, profileName);
                }, 1000);
                break;

            case 'refresh':
                this.showScope(context, scopeId, profileName);
                break;
        }
    }

    /**
     * Generate HTML content for scope webview
     */
    private static getHtmlContent(
        scope: Scope,
        webview: vscode.Webview,
        context: vscode.ExtensionContext
    ): string {
        const facetsData = scope.facetsResult ? JSON.parse(scope.facetsResult) : null;
        const sampleLogsData = scope.sampleLogsResult ? JSON.parse(scope.sampleLogsResult) : null;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scope: ${this.escapeHtml(scope.name)}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        h1, h2, h3 {
            color: var(--vscode-foreground);
            margin-top: 24px;
            margin-bottom: 12px;
        }
        h1 {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        .property-grid {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 12px;
            margin-bottom: 24px;
        }
        .property-label {
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        .property-value {
            font-family: var(--vscode-editor-font-family);
            background-color: var(--vscode-input-background);
            padding: 6px 8px;
            border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
        }
        .code-block {
            font-family: var(--vscode-editor-font-family);
            background-color: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
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
        .action-section {
            margin-top: 32px;
            padding: 16px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        .timestamp {
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
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
        }
        .no-results {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            padding: 12px;
        }
        .facet-row {
            margin-bottom: 16px;
        }
        .facet-name {
            font-weight: 600;
            margin-bottom: 4px;
        }
        .facet-values {
            margin-left: 16px;
            font-size: 0.95em;
        }
        .log-entry {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 8px;
            margin-bottom: 8px;
            border-radius: 3px;
            border-left: 3px solid var(--vscode-textLink-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <h1>${this.escapeHtml(scope.name)}</h1>

    <div class="button-group">
        <button onclick="editScope()">✏️ Edit Scope</button>
        <button onclick="deleteScope()" class="secondary">🗑️ Delete Scope</button>
        <button onclick="refresh()" class="secondary">🔄 Refresh</button>
    </div>

    <h2>Properties</h2>
    <div class="property-grid">
        <div class="property-label">Search Scope:</div>
        <div class="property-value">${this.escapeHtml(scope.searchScope)}</div>

        ${scope.description ? `
        <div class="property-label">Description:</div>
        <div class="property-value">${this.escapeHtml(scope.description)}</div>
        ` : ''}

        ${scope.context ? `
        <div class="property-label">Context:</div>
        <div class="property-value">${this.escapeHtml(scope.context)}</div>
        ` : ''}

        <div class="property-label">Created:</div>
        <div class="property-value">${new Date(scope.createdAt).toLocaleString()}</div>

        <div class="property-label">Modified:</div>
        <div class="property-value">${new Date(scope.modifiedAt).toLocaleString()}</div>
    </div>

    <h2>Actions</h2>
    <div class="button-group">
        <button onclick="profileScope()">🔍 Profile Scope (Facets)</button>
        <button onclick="sampleLogs()">📄 Sample Logs (Messages)</button>
    </div>

    ${facetsData ? this.renderFacetsResults(facetsData, scope.facetsTimestamp) : ''}
    ${sampleLogsData ? this.renderSampleLogsResults(sampleLogsData, scope.sampleLogsTimestamp) : ''}

    <script>
        const vscode = acquireVsCodeApi();

        function editScope() {
            vscode.postMessage({ command: 'editScope' });
        }

        function deleteScope() {
            if (confirm('Are you sure you want to delete this scope?')) {
                vscode.postMessage({ command: 'deleteScope' });
            }
        }

        function profileScope() {
            vscode.postMessage({ command: 'profileScope' });
        }

        function sampleLogs() {
            vscode.postMessage({ command: 'sampleLogs' });
        }

        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Render facets results section
     */
    private static renderFacetsResults(facetsData: any, timestamp?: string): string {
        if (!facetsData || !facetsData.fields || facetsData.fields.length === 0) {
            return `
            <div class="action-section">
                <h3>Field Profile (Facets)</h3>
                ${timestamp ? `<div class="timestamp">Last run: ${new Date(timestamp).toLocaleString()}</div>` : ''}
                <div class="no-results">No facets data available</div>
            </div>`;
        }

        const facetsHtml = facetsData.fields.map((field: any) => {
            const topValues = field.topValues || [];
            const valuesHtml = topValues.slice(0, 5).map((v: any) =>
                `<div>${this.escapeHtml(v.value)} (${v.count})</div>`
            ).join('');

            return `
            <div class="facet-row">
                <div class="facet-name">${this.escapeHtml(field.name)}</div>
                <div class="facet-values">
                    Count: ${field.count || 0}<br>
                    ${valuesHtml ? `Top values:<br>${valuesHtml}` : 'No values'}
                </div>
            </div>`;
        }).join('');

        return `
        <div class="action-section">
            <h3>Field Profile (Facets)</h3>
            ${timestamp ? `<div class="timestamp">Last run: ${new Date(timestamp).toLocaleString()}</div>` : ''}
            ${facetsHtml}
        </div>`;
    }

    /**
     * Render sample logs results section
     */
    private static renderSampleLogsResults(sampleLogsData: any, timestamp?: string): string {
        if (!sampleLogsData || !sampleLogsData.messages || sampleLogsData.messages.length === 0) {
            return `
            <div class="action-section">
                <h3>Sample Logs</h3>
                ${timestamp ? `<div class="timestamp">Last run: ${new Date(timestamp).toLocaleString()}</div>` : ''}
                <div class="no-results">No sample logs available</div>
            </div>`;
        }

        const logsHtml = sampleLogsData.messages.slice(0, 10).map((msg: any) => {
            const rawMsg = msg.map._raw || JSON.stringify(msg.map);
            return `<div class="log-entry">${this.escapeHtml(rawMsg)}</div>`;
        }).join('');

        return `
        <div class="action-section">
            <h3>Sample Logs (showing first 10 of ${sampleLogsData.messages.length})</h3>
            ${timestamp ? `<div class="timestamp">Last run: ${new Date(timestamp).toLocaleString()}</div>` : ''}
            ${logsHtml}
        </div>`;
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

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

            case 'viewFacetsResults':
                const profileManager = new ProfileManager(context);
                const profileDir = profileManager.getProfileDirectory(profileName);
                const db = createScopesCacheDB(profileDir, profileName);
                try {
                    const scope = db.getScopeById(scopeId);
                    if (scope?.facetsResult) {
                        // Save to temp file and open in webview
                        const tempFile = await this.saveTempResultFile(profileDir, scopeId, 'facets', scope.facetsResult);
                        await vscode.commands.executeCommand('sumologic.openQueryResultAsWebview', { data: { path: tempFile } });
                    }
                } finally {
                    db.close();
                }
                break;

            case 'viewSampleLogsResults':
                const pm = new ProfileManager(context);
                const pd = pm.getProfileDirectory(profileName);
                const sdb = createScopesCacheDB(pd, profileName);
                try {
                    const sc = sdb.getScopeById(scopeId);
                    if (sc?.sampleLogsResult) {
                        const tempFile = await this.saveTempResultFile(pd, scopeId, 'sample', sc.sampleLogsResult);
                        await vscode.commands.executeCommand('sumologic.openQueryResultAsWebview', { data: { path: tempFile } });
                    }
                } finally {
                    sdb.close();
                }
                break;

            case 'viewRawLogs':
                const pm2 = new ProfileManager(context);
                const pd2 = pm2.getProfileDirectory(profileName);
                const sdb2 = createScopesCacheDB(pd2, profileName);
                try {
                    const sc2 = sdb2.getScopeById(scopeId);
                    if (sc2?.sampleLogsResult) {
                        const rawLogsFile = await this.saveRawLogsFile(pd2, scopeId, sc2.sampleLogsResult);
                        const doc = await vscode.workspace.openTextDocument(rawLogsFile);
                        await vscode.window.showTextDocument(doc);
                    }
                } finally {
                    sdb2.close();
                }
                break;
        }
    }

    /**
     * Save result data to temporary file for viewing
     * Extracts the array from the response for the webview
     */
    private static async saveTempResultFile(
        profileDir: string,
        scopeId: string,
        type: string,
        resultJson: string
    ): Promise<string> {
        const fs = require('fs');
        const path = require('path');

        // Parse the stored result
        const data = JSON.parse(resultJson);

        // Extract the array - either records or messages
        const arrayData = type === 'facets' ? data.records : data.messages;

        const outputDir = path.join(profileDir, 'scopes');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const fileName = `${scopeId}_${type}_latest.json`;
        const filePath = path.join(outputDir, fileName);

        // Save as array for the webview to consume
        fs.writeFileSync(filePath, JSON.stringify(arrayData, null, 2), 'utf-8');
        return filePath;
    }

    /**
     * Save raw logs as text file
     * Extracts _raw field from messages if available, otherwise formats as JSON
     */
    private static async saveRawLogsFile(
        profileDir: string,
        scopeId: string,
        resultJson: string
    ): Promise<string> {
        const fs = require('fs');
        const path = require('path');

        // Parse the stored result
        const data = JSON.parse(resultJson);
        const messages = data.messages || [];

        // Build raw log content
        const lines: string[] = [];
        for (const message of messages) {
            if (message.map && message.map._raw) {
                // Use _raw field if available
                lines.push(message.map._raw);
            } else {
                // Otherwise use JSON representation of the message
                lines.push(JSON.stringify(message));
            }
        }

        const outputDir = path.join(profileDir, 'scopes');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const fileName = `${scopeId}_raw_logs.txt`;
        const filePath = path.join(outputDir, fileName);

        // Save as text file
        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
        return filePath;
    }

    /**
     * Generate HTML content for scope webview
     */
    private static getHtmlContent(
        scope: Scope,
        webview: vscode.Webview,
        context: vscode.ExtensionContext
    ): string {
        const hasFacetsResult = scope.facetsResult && scope.facetsTimestamp;
        const hasSampleLogsResult = scope.sampleLogsResult && scope.sampleLogsTimestamp;

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

    ${hasFacetsResult ? this.renderFacetsResults(scope) : ''}
    ${hasSampleLogsResult ? this.renderSampleLogsResults(scope) : ''}

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

        function viewFacetsResults() {
            vscode.postMessage({ command: 'viewFacetsResults' });
        }

        function viewSampleLogsResults() {
            vscode.postMessage({ command: 'viewSampleLogsResults' });
        }

        function viewRawLogs() {
            vscode.postMessage({ command: 'viewRawLogs' });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Render facets results section
     */
    private static renderFacetsResults(scope: Scope): string {
        const data = JSON.parse(scope.facetsResult!);
        const recordCount = data.records?.length || 0;

        return `
        <div class="action-section">
            <h3>Field Profile (Facets)</h3>
            <div class="timestamp">Last run: ${new Date(scope.facetsTimestamp!).toLocaleString()}</div>
            <p>Facets query returned ${recordCount} field profiles.</p>
            <button onclick="viewFacetsResults()">📊 View Facets Results Table</button>
        </div>`;
    }

    /**
     * Render sample logs results section
     */
    private static renderSampleLogsResults(scope: Scope): string {
        const data = JSON.parse(scope.sampleLogsResult!);
        const messageCount = data.messages?.length || 0;

        return `
        <div class="action-section">
            <h3>Sample Logs</h3>
            <div class="timestamp">Last run: ${new Date(scope.sampleLogsTimestamp!).toLocaleString()}</div>
            <p>Sample query returned ${messageCount} log messages.</p>
            <div class="button-group">
                <button onclick="viewSampleLogsResults()">📄 View Sample Logs Table</button>
                <button onclick="viewRawLogs()">📝 View Raw Logs</button>
            </div>
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

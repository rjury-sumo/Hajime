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
        const storageRoot = profileManager.getStorageRoot();
        const db = createScopesCacheDB(storageRoot, profileName);

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
                const storageRoot = profileManager.getStorageRoot();
                const db = createScopesCacheDB(storageRoot, profileName);
                try {
                    const scope = db.getScopeById(scopeId);
                    if (scope?.facetsResultPath) {
                        // Extract array from stored file and save for webview
                        const tempFile = await this.extractArrayFromResultFile(scope.facetsResultPath, 'records');
                        await vscode.commands.executeCommand('sumologic.openQueryResultAsWebview', { data: { path: tempFile } });
                    }
                } finally {
                    db.close();
                }
                break;

            case 'viewSampleLogsResults':
                const pm = new ProfileManager(context);
                const sr = pm.getStorageRoot();
                const sdb = createScopesCacheDB(sr, profileName);
                try {
                    const sc = sdb.getScopeById(scopeId);
                    if (sc?.sampleLogsResultPath) {
                        // Extract array from stored file and save for webview
                        const tempFile = await this.extractArrayFromResultFile(sc.sampleLogsResultPath, 'messages');
                        await vscode.commands.executeCommand('sumologic.openQueryResultAsWebview', { data: { path: tempFile } });
                    }
                } finally {
                    sdb.close();
                }
                break;

            case 'viewRawLogs':
                const pm2 = new ProfileManager(context);
                const sr2 = pm2.getStorageRoot();
                const sdb2 = createScopesCacheDB(sr2, profileName);
                try {
                    const sc2 = sdb2.getScopeById(scopeId);
                    if (sc2?.sampleLogsResultPath) {
                        const rawLogsFile = await this.saveRawLogsFileFromPath(sc2.sampleLogsResultPath);
                        const doc = await vscode.workspace.openTextDocument(rawLogsFile);
                        await vscode.window.showTextDocument(doc);
                    }
                } finally {
                    sdb2.close();
                }
                break;

            case 'newQuery':
                const pm3 = new ProfileManager(context);
                const sr3 = pm3.getStorageRoot();
                const pd3 = pm3.getProfileDirectory(profileName);
                const sdb3 = createScopesCacheDB(sr3, profileName);
                try {
                    const sc3 = sdb3.getScopeById(scopeId);
                    if (sc3) {
                        await this.createNewQueryFromScope(sc3, pd3, profileName);
                    }
                } finally {
                    sdb3.close();
                }
                break;

            case 'cacheMetadata':
                await vscode.commands.executeCommand('sumologic.cacheScopeMetadata', scopeId, profileName);
                // Refresh webview after action completion
                setTimeout(() => {
                    this.showScope(context, scopeId, profileName);
                }, 1000);
                break;

            case 'viewMetadataResults':
                const pm4 = new ProfileManager(context);
                const sr4 = pm4.getStorageRoot();
                const sdb4 = createScopesCacheDB(sr4, profileName);
                try {
                    const sc4 = sdb4.getScopeById(scopeId);
                    if (sc4?.metadataResultPath) {
                        // Extract array from stored file and save for webview
                        const tempFile = await this.extractArrayFromResultFile(sc4.metadataResultPath, 'records');
                        await vscode.commands.executeCommand('sumologic.openQueryResultAsWebview', { data: { path: tempFile } });
                    }
                } finally {
                    sdb4.close();
                }
                break;

            case 'updateQueryFrom':
                const pm5 = new ProfileManager(context);
                const sr5 = pm5.getStorageRoot();
                const sdb5 = createScopesCacheDB(sr5, profileName);
                try {
                    const success = sdb5.updateScope(scopeId, { queryFrom: message.value });
                    if (success) {
                        vscode.window.showInformationMessage(`Updated query from to: ${message.value}`);
                        // Refresh webview
                        this.showScope(context, scopeId, profileName);
                    }
                } finally {
                    sdb5.close();
                }
                break;
        }
    }

    /**
     * Extract array from result file for viewing in webview
     * Extracts the array from the response (records or messages)
     */
    private static async extractArrayFromResultFile(
        resultFilePath: string,
        arrayKey: 'records' | 'messages'
    ): Promise<string> {
        const fs = require('fs');
        const path = require('path');

        // Read and parse the stored result file
        const data = JSON.parse(fs.readFileSync(resultFilePath, 'utf-8'));

        // Extract the array
        const arrayData = data[arrayKey] || [];

        // Create temp file for webview (same path but with _view suffix)
        const dir = path.dirname(resultFilePath);
        const basename = path.basename(resultFilePath, '.json');
        const viewFilePath = path.join(dir, `${basename}_view.json`);

        // Save as array for the webview to consume
        fs.writeFileSync(viewFilePath, JSON.stringify(arrayData, null, 2), 'utf-8');
        return viewFilePath;
    }

    /**
     * Save raw logs as text file from result file path
     * Extracts _raw field from messages if available, otherwise formats as JSON
     */
    private static async saveRawLogsFileFromPath(
        resultFilePath: string
    ): Promise<string> {
        const fs = require('fs');
        const path = require('path');

        // Read and parse the stored result file
        const data = JSON.parse(fs.readFileSync(resultFilePath, 'utf-8'));
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

        // Create raw logs file path
        const dir = path.dirname(resultFilePath);
        const basename = path.basename(resultFilePath, '.json');
        const rawLogsPath = path.join(dir, `${basename}_raw.txt`);

        // Save as text file
        fs.writeFileSync(rawLogsPath, lines.join('\n'), 'utf-8');
        return rawLogsPath;
    }

    /**
     * Create a new .sumo query file from scope with field list
     */
    private static async createNewQueryFromScope(
        scope: Scope,
        profileDir: string,
        profileName: string
    ): Promise<void> {
        const fs = require('fs');
        const path = require('path');

        // Extract field list from facets results or sample logs
        const fields = this.extractFieldsFromScope(scope);

        // Build query content
        const lines: string[] = [];
        lines.push(`// @name ${scope.name}`);
        lines.push('// @from -1h');
        lines.push('// @to now');
        lines.push('');

        // Add field list as block comment with wrapping
        if (fields.length > 0) {
            // Separate built-in fields (starting with _) from custom fields
            const builtInFields = fields.filter(f => f.startsWith('_')).sort();
            const customFields = fields.filter(f => !f.startsWith('_')).sort();

            lines.push('/*');
            lines.push('Available fields in this scope:');

            if (builtInFields.length > 0) {
                const builtInLines = this.wrapFieldList(builtInFields, 80);
                builtInLines.forEach(line => lines.push(line));
            }

            if (customFields.length > 0) {
                if (builtInFields.length > 0) {
                    lines.push(''); // Blank line between built-in and custom
                }
                const customLines = this.wrapFieldList(customFields, 80);
                customLines.forEach(line => lines.push(line));
            }

            lines.push('*/');
            lines.push('');
        }

        // Add the scope query
        lines.push(scope.searchScope);
        lines.push('');

        const content = lines.join('\n');

        // Create queries directory if it doesn't exist
        const queriesDir = path.join(profileDir, 'queries');
        if (!fs.existsSync(queriesDir)) {
            fs.mkdirSync(queriesDir, { recursive: true });
        }

        // Create file with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const sanitizedName = scope.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${sanitizedName}_${timestamp}.sumo`;
        const filePath = path.join(queriesDir, fileName);

        fs.writeFileSync(filePath, content, 'utf-8');

        // Open the file
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
    }

    /**
     * Wrap a list of fields into multiple lines with max width
     */
    private static wrapFieldList(fields: string[], maxWidth: number): string[] {
        const lines: string[] = [];
        let currentLine = '';

        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            const separator = i < fields.length - 1 ? ', ' : '';
            const addition = currentLine ? field + separator : field + separator;

            // Check if adding this field would exceed max width
            if (currentLine && (currentLine.length + addition.length) > maxWidth) {
                // Start a new line
                lines.push(currentLine);
                currentLine = field + separator;
            } else {
                currentLine += addition;
            }
        }

        // Add the last line if it has content
        if (currentLine) {
            // Remove trailing comma and space if present
            if (currentLine.endsWith(', ')) {
                currentLine = currentLine.slice(0, -2);
            }
            lines.push(currentLine);
        }

        return lines;
    }

    /**
     * Extract field names from scope results
     */
    private static extractFieldsFromScope(scope: Scope): string[] {
        const fs = require('fs');
        const fields = new Set<string>();

        // Try to get fields from facets results first
        if (scope.facetsResultPath && fs.existsSync(scope.facetsResultPath)) {
            try {
                const facetsData = JSON.parse(fs.readFileSync(scope.facetsResultPath, 'utf-8'));
                if (facetsData.records && facetsData.records.length > 0) {
                    // Each record in facets represents a field
                    for (const record of facetsData.records) {
                        if (record.map && record.map.field) {
                            fields.add(record.map.field);
                        }
                    }
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

        // If no fields from facets, try to get from sample logs
        if (fields.size === 0 && scope.sampleLogsResultPath && fs.existsSync(scope.sampleLogsResultPath)) {
            try {
                const sampleData = JSON.parse(fs.readFileSync(scope.sampleLogsResultPath, 'utf-8'));
                if (sampleData.messages && sampleData.messages.length > 0) {
                    // Get field names from first message
                    const firstMessage = sampleData.messages[0];
                    if (firstMessage.map) {
                        for (const fieldName of Object.keys(firstMessage.map)) {
                            fields.add(fieldName);
                        }
                    }
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

        return Array.from(fields).sort();
    }

    /**
     * Generate HTML content for scope webview
     */
    private static getHtmlContent(
        scope: Scope,
        webview: vscode.Webview,
        context: vscode.ExtensionContext
    ): string {
        const hasFacetsResult = scope.facetsResultPath && scope.facetsTimestamp;
        const hasSampleLogsResult = scope.sampleLogsResultPath && scope.sampleLogsTimestamp;
        const hasMetadataResult = scope.metadataResultPath && scope.metadataTimestamp;

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
        <div class="property-label">ID:</div>
        <div class="property-value">${this.escapeHtml(scope.id)}</div>

        <div class="property-label">Profile:</div>
        <div class="property-value">${this.escapeHtml(scope.profile)}</div>

        <div class="property-label">Name:</div>
        <div class="property-value">${this.escapeHtml(scope.name)}</div>

        <div class="property-label">Search Scope:</div>
        <div class="property-value">${this.escapeHtml(scope.searchScope)}</div>

        <div class="property-label">Description:</div>
        <div class="property-value">${this.escapeHtml(scope.description || '')}</div>

        <div class="property-label">Context:</div>
        <div class="property-value">${this.escapeHtml(scope.context || '')}</div>

        <div class="property-label">Query From:</div>
        <div class="property-value">
            <input type="text" id="queryFrom" value="${this.escapeHtml(scope.queryFrom || '-3h')}"
                   style="width: 100%; background-color: var(--vscode-input-background);
                          color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border);
                          padding: 4px 6px; border-radius: 2px; font-family: var(--vscode-editor-font-family);"
                   onchange="updateQueryFrom(this.value)">
        </div>

        <div class="property-label">Created:</div>
        <div class="property-value">${new Date(scope.createdAt).toLocaleString()}</div>

        <div class="property-label">Modified:</div>
        <div class="property-value">${new Date(scope.modifiedAt).toLocaleString()}</div>

        ${scope.facetsResultPath ? `
        <div class="property-label">Facets Result Path:</div>
        <div class="property-value">${this.escapeHtml(scope.facetsResultPath)}</div>
        ` : ''}

        ${scope.facetsTimestamp ? `
        <div class="property-label">Facets Last Run:</div>
        <div class="property-value">${new Date(scope.facetsTimestamp).toLocaleString()}</div>
        ` : ''}

        ${scope.sampleLogsResultPath ? `
        <div class="property-label">Sample Logs Result Path:</div>
        <div class="property-value">${this.escapeHtml(scope.sampleLogsResultPath)}</div>
        ` : ''}

        ${scope.sampleLogsTimestamp ? `
        <div class="property-label">Sample Logs Last Run:</div>
        <div class="property-value">${new Date(scope.sampleLogsTimestamp).toLocaleString()}</div>
        ` : ''}

        ${scope.metadataResultPath ? `
        <div class="property-label">Metadata Result Path:</div>
        <div class="property-value">${this.escapeHtml(scope.metadataResultPath)}</div>
        ` : ''}

        ${scope.metadataTimestamp ? `
        <div class="property-label">Metadata Last Cached:</div>
        <div class="property-value">${new Date(scope.metadataTimestamp).toLocaleString()}</div>
        ` : ''}
    </div>

    <h2>Actions</h2>
    <div class="button-group">
        <button onclick="profileScope()">🔍 Profile Scope (Facets)</button>
        <button onclick="sampleLogs()">📄 Sample Logs (Messages)</button>
        <button onclick="cacheMetadata()">🔑 Cache Metadata</button>
        <button onclick="newQuery()">📝 New Query</button>
    </div>

    ${hasFacetsResult ? this.renderFacetsResults(scope) : ''}
    ${hasSampleLogsResult ? this.renderSampleLogsResults(scope) : ''}
    ${hasMetadataResult ? this.renderMetadataResults(scope) : ''}

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

        function newQuery() {
            vscode.postMessage({ command: 'newQuery' });
        }

        function cacheMetadata() {
            vscode.postMessage({ command: 'cacheMetadata' });
        }

        function viewMetadataResults() {
            vscode.postMessage({ command: 'viewMetadataResults' });
        }

        function updateQueryFrom(value) {
            vscode.postMessage({ command: 'updateQueryFrom', value: value });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Render facets results section
     */
    private static renderFacetsResults(scope: Scope): string {
        const fs = require('fs');
        let recordCount = 0;

        if (scope.facetsResultPath && fs.existsSync(scope.facetsResultPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(scope.facetsResultPath, 'utf-8'));
                recordCount = data.records?.length || 0;
            } catch (e) {
                // Ignore parse errors
            }
        }

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
        const fs = require('fs');
        let messageCount = 0;

        if (scope.sampleLogsResultPath && fs.existsSync(scope.sampleLogsResultPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(scope.sampleLogsResultPath, 'utf-8'));
                messageCount = data.messages?.length || 0;
            } catch (e) {
                // Ignore parse errors
            }
        }

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
     * Render metadata results section
     */
    private static renderMetadataResults(scope: Scope): string {
        const fs = require('fs');
        let recordCount = 0;

        if (scope.metadataResultPath && fs.existsSync(scope.metadataResultPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(scope.metadataResultPath, 'utf-8'));
                recordCount = data.records?.length || 0;
            } catch (e) {
                // Ignore parse errors
            }
        }

        return `
        <div class="action-section">
            <h3>Key Metadata</h3>
            <div class="timestamp">Last run: ${new Date(scope.metadataTimestamp!).toLocaleString()}</div>
            <p>Metadata query returned ${recordCount} key combinations.</p>
            <p>Autocomplete values have been updated (merged) for this scope.</p>
            <button onclick="viewMetadataResults()">🔑 View Metadata Table</button>
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

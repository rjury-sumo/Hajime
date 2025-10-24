import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager } from '../profileManager';

/**
 * Panel provider for Search Audit interface
 * Allows users to initiate search audit queries and view previous results
 */
export class SearchAuditWebviewProvider {
    private static currentPanel?: vscode.WebviewPanel;
    private static profileManager?: ProfileManager;
    private static currentProfileName?: string;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) {
        SearchAuditWebviewProvider.profileManager = new ProfileManager(context);
    }

    /**
     * Show the search audit panel
     */
    public async show(profileName?: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (SearchAuditWebviewProvider.currentPanel) {
            SearchAuditWebviewProvider.currentPanel.reveal(column);
            if (profileName) {
                SearchAuditWebviewProvider.currentProfileName = profileName;
                await SearchAuditWebviewProvider.updateResultsList();
            }
            return;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'searchAuditPanel',
            'Search Audit',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this._extensionUri]
            }
        );

        SearchAuditWebviewProvider.currentPanel = panel;

        panel.webview.html = SearchAuditWebviewProvider.getHtmlForWebview(panel.webview);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'runSearchAudit':
                    await vscode.commands.executeCommand(
                        'sumologic.runSearchAuditQuery',
                        message.from,
                        message.to,
                        message.type,
                        message.userName,
                        message.contentName,
                        message.queryFilter,
                        message.queryRegex
                    );
                    // Refresh results list after query completes
                    setTimeout(() => SearchAuditWebviewProvider.updateResultsList(), 2000);
                    break;
                case 'openResult':
                    await vscode.commands.executeCommand('sumologic.openSearchAuditResult', message.filePath);
                    break;
                case 'refresh':
                    await SearchAuditWebviewProvider.updateResultsList();
                    break;
            }
        });

        // Clean up when panel is closed
        panel.onDidDispose(() => {
            SearchAuditWebviewProvider.currentPanel = undefined;
        });

        // Set profile and load results
        if (profileName) {
            SearchAuditWebviewProvider.currentProfileName = profileName;
        } else {
            await SearchAuditWebviewProvider.loadActiveProfile();
        }
        await SearchAuditWebviewProvider.updateResultsList();
    }

    /**
     * Load active profile
     */
    private static async loadActiveProfile() {
        if (!SearchAuditWebviewProvider.profileManager) {
            return;
        }
        const activeProfile = await SearchAuditWebviewProvider.profileManager.getActiveProfile();
        if (activeProfile) {
            SearchAuditWebviewProvider.currentProfileName = activeProfile.name;
        }
    }

    /**
     * Update the list of previous results
     */
    private static async updateResultsList() {
        if (!SearchAuditWebviewProvider.currentPanel || !SearchAuditWebviewProvider.profileManager) {
            return;
        }

        const profileName = SearchAuditWebviewProvider.currentProfileName;
        if (!profileName) {
            return;
        }

        const searchAuditDir = SearchAuditWebviewProvider.profileManager.getProfileSearchAuditDirectory(profileName);
        const results = SearchAuditWebviewProvider.getSearchAuditResults(searchAuditDir);

        SearchAuditWebviewProvider.currentPanel.webview.postMessage({
            command: 'updateResults',
            results: results
        });
    }

    /**
     * Get list of search audit result files
     */
    private static getSearchAuditResults(directory: string): any[] {
        if (!fs.existsSync(directory)) {
            return [];
        }

        const files = fs.readdirSync(directory)
            .filter(f => f.startsWith('search_audit_') && f.endsWith('.json'))
            .map(f => {
                const filePath = path.join(directory, f);
                const stats = fs.statSync(filePath);
                return {
                    name: f,
                    path: filePath,
                    modified: stats.mtime.toISOString()
                };
            })
            .sort((a, b) => b.modified.localeCompare(a.modified));

        return files;
    }

    /**
     * Generate HTML for the webview
     */
    private static getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search Audit</title>
    <style>
        body {
            padding: 20px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        .section h2 {
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 16px;
            font-weight: 600;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 500;
        }
        input, select {
            width: 100%;
            padding: 6px 10px;
            font-size: 13px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
        }
        input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        button {
            padding: 8px 16px;
            font-size: 13px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .result-item {
            padding: 12px;
            margin-bottom: 8px;
            background: var(--vscode-list-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 2px;
            cursor: pointer;
            transition: background 0.1s;
        }
        .result-item:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .result-name {
            font-weight: 600;
            font-size: 13px;
            margin-bottom: 4px;
        }
        .result-date {
            font-size: 12px;
            opacity: 0.8;
        }
        .empty-state {
            padding: 40px 20px;
            text-align: center;
            opacity: 0.6;
            font-size: 13px;
        }
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .help-text {
            margin-top: 15px;
            padding: 10px;
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            font-size: 12px;
            line-height: 1.5;
        }
        .help-text a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        .help-text a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="section">
        <h2>Run Search Audit Query</h2>
        <div class="form-row">
            <div class="form-group">
                <label for="from">From (e.g., -24h, -7d)</label>
                <input type="text" id="from" value="-24h" />
            </div>
            <div class="form-group">
                <label for="to">To (e.g., now, -1h)</label>
                <input type="text" id="to" value="now" />
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="type">Query Type (e.g., *, Search API, Monitors)</label>
                <input type="text" id="type" value="*" />
            </div>
            <div class="form-group">
                <label for="userName">User Name (e.g., *, user@example.com)</label>
                <input type="text" id="userName" value="*" />
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="contentName">Content Name (e.g., *, "My Dashboard", prod*)</label>
                <input type="text" id="contentName" value="*" />
            </div>
            <div class="form-group">
                <label for="queryFilter">Query Filter (e.g., *, _sourceCategory, error*)</label>
                <input type="text" id="queryFilter" value="*" />
            </div>
        </div>
        <div class="form-group">
            <label for="queryRegex">Query Regex Filter (RE2 format, e.g., .*, error|warn, .*_sourceCategory.*)</label>
            <input type="text" id="queryRegex" value=".*" />
        </div>
        <div class="help-text">
            <strong>Filter Syntax:</strong> Use keyword expressions: <code>*</code> (any chars), <code>?</code> (single char), quoted strings for text with spaces (e.g., <code>"My Dashboard"</code>).
            <br/>
            For content names with spaces, use quotes or replace spaces with <code>?</code> (e.g., <code>My?Dashboard</code>).
            <a href="https://www.sumologic.com/help/docs/search/get-started-with-search/build-search/keyword-search-expressions/" target="_blank">Learn more about keyword expressions →</a>
        </div>
        <div class="help-text" style="border-left-color: var(--vscode-editorWarning-foreground); background: var(--vscode-inputValidation-warningBackground);">
            <strong>⚠️ Performance Note:</strong> The <strong>Query Regex Filter</strong> uses <code>matches</code> clause which is much slower and more I/O intensive than the keyword-based <strong>Query Filter</strong>.
            Use regex only when you need very granular pattern matching. For simple wildcard filtering, prefer the Query Filter field above.
        </div>
        <button onclick="runQuery()">Run Search Audit Query</button>
    </div>

    <div class="section">
        <h2>Previous Results</h2>
        <button class="secondary" onclick="refresh()" style="margin-bottom: 15px;">Refresh</button>
        <div id="results">
            <div class="empty-state">No results yet</div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function runQuery() {
            const from = document.getElementById('from').value;
            const to = document.getElementById('to').value;
            const type = document.getElementById('type').value;
            const userName = document.getElementById('userName').value;
            const contentName = document.getElementById('contentName').value;
            const queryFilter = document.getElementById('queryFilter').value;
            const queryRegex = document.getElementById('queryRegex').value;

            vscode.postMessage({
                command: 'runSearchAudit',
                from: from,
                to: to,
                type: type,
                userName: userName,
                contentName: contentName,
                queryFilter: queryFilter,
                queryRegex: queryRegex
            });
        }

        function openResult(filePath) {
            vscode.postMessage({
                command: 'openResult',
                filePath: filePath
            });
        }

        function refresh() {
            vscode.postMessage({
                command: 'refresh'
            });
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateResults':
                    updateResultsList(message.results);
                    break;
            }
        });

        function updateResultsList(results) {
            const container = document.getElementById('results');

            if (results.length === 0) {
                container.innerHTML = '<div class="empty-state">No results yet. Run a query to get started.</div>';
                return;
            }

            container.innerHTML = results.map(result => {
                const date = new Date(result.modified).toLocaleString();
                return \`
                    <div class="result-item" onclick='openResult(\${JSON.stringify(result.path)})'>
                        <div class="result-name">\${result.name}</div>
                        <div class="result-date">\${date}</div>
                    </div>
                \`;
            }).join('');
        }
    </script>
</body>
</html>`;
    }
}

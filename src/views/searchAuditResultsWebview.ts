import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Display search audit results in a filterable, sortable table
 */
export async function showSearchAuditResults(filePath: string, context: vscode.ExtensionContext) {
    // Read the JSON file
    if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let data;
    try {
        data = JSON.parse(content);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to parse JSON: ${error}`);
        return;
    }

    // Create and show webview panel
    const panel = vscode.window.createWebviewPanel(
        'searchAuditResults',
        `Search Audit Results - ${path.basename(filePath)}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case 'openQuery':
                await openQueryInNewFile(message.query);
                break;
        }
    });

    panel.webview.html = getWebviewContent(data, path.basename(filePath));
}

/**
 * Open a query in a new .sumo file
 */
async function openQueryInNewFile(query: string) {
    const doc = await vscode.workspace.openTextDocument({
        content: query,
        language: 'sumo'
    });
    await vscode.window.showTextDocument(doc);
}

/**
 * Generate HTML for the results webview
 */
function getWebviewContent(data: any[], fileName: string): string {
    // Extract metadata from filename if possible
    const fileInfo = parseFileName(fileName);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search Audit Results</title>
    <style>
        body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        .header {
            padding: 16px;
            background: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .header h2 {
            margin: 0 0 10px 0;
            font-size: 16px;
        }
        .header-info {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 10px;
        }
        .controls {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 10px;
        }
        .filter-input {
            flex: 1;
            min-width: 200px;
            padding: 6px 8px;
            font-size: 12px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        .table-container {
            overflow: auto;
            height: calc(100vh - 200px);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        th {
            background: var(--vscode-editor-background);
            padding: 8px;
            text-align: left;
            font-weight: 600;
            position: sticky;
            top: 0;
            cursor: pointer;
            user-select: none;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        th:hover {
            background: var(--vscode-list-hoverBackground);
        }
        th.sorted {
            background: var(--vscode-list-inactiveSelectionBackground);
        }
        td {
            padding: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        tr:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .query-cell {
            min-width: 200px;
            max-width: 550px;
            position: relative;
        }
        .query-preview {
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            line-height: 1.4;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .query-preview.collapsed {
            max-height: 4.2em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
        .query-actions {
            margin-top: 4px;
        }
        .query-action-btn {
            padding: 2px 8px;
            font-size: 10px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }
        .query-action-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .number-cell {
            text-align: right;
        }
        .open-query-btn {
            padding: 2px 6px;
            font-size: 11px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
        .open-query-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .stats {
            padding: 10px 16px;
            background: var(--vscode-editor-background);
            border-top: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Search Audit Results</h2>
        <div class="header-info">
            ${fileInfo.timeRange ? `Time Range: ${fileInfo.timeRange}` : ''}
            ${fileInfo.timestamp ? `• Generated: ${new Date(fileInfo.timestamp).toLocaleString()}` : ''}
        </div>
        <div class="controls">
            <input type="text" class="filter-input" id="filterInput" placeholder="Filter results..." />
        </div>
    </div>

    <div class="table-container">
        <table id="resultsTable">
            <thead>
                <tr>
                    <th data-column="user_name">User Name</th>
                    <th data-column="query_type">Query Type</th>
                    <th data-column="content_name">Content Name</th>
                    <th data-column="searches" class="number-cell">Searches</th>
                    <th data-column="scan_gb" class="number-cell">Scan GB</th>
                    <th data-column="sum_runtime_minutes" class="number-cell">Runtime (min)</th>
                    <th data-column="avg_runtime_minutes" class="number-cell">Avg Runtime</th>
                    <th data-column="results" class="number-cell">Results</th>
                    <th data-column="query">Query</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody id="tableBody">
            </tbody>
        </table>
    </div>

    <div class="stats" id="stats"></div>

    <script>
        const vscode = acquireVsCodeApi();
        const data = ${JSON.stringify(data)};
        let sortColumn = null;
        let sortAscending = true;
        let filteredData = [...data];

        function renderTable() {
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = filteredData.map((row, index) => {
                const map = row.map || row;
                const query = map.query || '';
                const queryId = 'query-' + index;
                return \`
                    <tr>
                        <td>\${escapeHtml(map.user_name || '')}</td>
                        <td>\${escapeHtml(map.query_type || '')}</td>
                        <td>\${escapeHtml(map.content_name || '')}</td>
                        <td class="number-cell">\${formatNumber(map.searches)}</td>
                        <td class="number-cell">\${formatNumber(map.scan_gb, 2)}</td>
                        <td class="number-cell">\${formatNumber(map.sum_runtime_minutes, 2)}</td>
                        <td class="number-cell">\${formatNumber(map.avg_runtime_minutes, 4)}</td>
                        <td class="number-cell">\${formatNumber(map.results, 0)}</td>
                        <td class="query-cell">
                            <div class="query-preview collapsed" id="\${queryId}">\${escapeHtml(query)}</div>
                            <div class="query-actions">
                                <button class="query-action-btn" onclick='toggleQuery("\${queryId}")'>Expand</button>
                            </div>
                        </td>
                        <td>
                            <button class="open-query-btn" onclick='openQuery(\${index})'>Open</button>
                        </td>
                    </tr>
                \`;
            }).join('');

            updateStats();
        }

        function updateStats() {
            const totalSearches = filteredData.reduce((sum, row) => sum + parseFloat((row.map || row).searches || 0), 0);
            const totalScanGB = filteredData.reduce((sum, row) => sum + parseFloat((row.map || row).scan_gb || 0), 0);
            const totalRuntime = filteredData.reduce((sum, row) => sum + parseFloat((row.map || row).sum_runtime_minutes || 0), 0);

            document.getElementById('stats').innerHTML = \`
                Showing \${filteredData.length} of \${data.length} rows
                • Total Searches: \${formatNumber(totalSearches, 0)}
                • Total Scan: \${formatNumber(totalScanGB, 2)} GB
                • Total Runtime: \${formatNumber(totalRuntime, 2)} min
            \`;
        }

        function sortTable(column) {
            if (sortColumn === column) {
                sortAscending = !sortAscending;
            } else {
                sortColumn = column;
                sortAscending = true;
            }

            filteredData.sort((a, b) => {
                const aVal = (a.map || a)[column] || '';
                const bVal = (b.map || b)[column] || '';

                // Try to parse as numbers
                const aNum = parseFloat(aVal);
                const bNum = parseFloat(bVal);

                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return sortAscending ? aNum - bNum : bNum - aNum;
                }

                // String comparison
                return sortAscending
                    ? String(aVal).localeCompare(String(bVal))
                    : String(bVal).localeCompare(String(aVal));
            });

            // Update header styles
            document.querySelectorAll('th').forEach(th => {
                th.classList.remove('sorted');
                if (th.dataset.column === column) {
                    th.classList.add('sorted');
                    th.textContent = th.textContent.replace(/ [▲▼]/, '') + (sortAscending ? ' ▲' : ' ▼');
                } else {
                    th.textContent = th.textContent.replace(/ [▲▼]/, '');
                }
            });

            renderTable();
        }

        function filterTable(searchText) {
            const lower = searchText.toLowerCase();
            filteredData = data.filter(row => {
                const map = row.map || row;
                return Object.values(map).some(val =>
                    String(val).toLowerCase().includes(lower)
                );
            });
            renderTable();
        }

        function toggleQuery(queryId) {
            const element = document.getElementById(queryId);
            const button = event.target;

            if (element.classList.contains('collapsed')) {
                element.classList.remove('collapsed');
                button.textContent = 'Collapse';
            } else {
                element.classList.add('collapsed');
                button.textContent = 'Expand';
            }
        }

        function openQuery(index) {
            const map = filteredData[index].map || filteredData[index];
            vscode.postMessage({
                command: 'openQuery',
                query: map.query || ''
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function formatNumber(val, decimals = 0) {
            const num = parseFloat(val);
            if (isNaN(num)) return val || '';
            return num.toLocaleString(undefined, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        }

        // Event listeners
        document.querySelectorAll('th[data-column]').forEach(th => {
            th.addEventListener('click', () => sortTable(th.dataset.column));
        });

        document.getElementById('filterInput').addEventListener('input', (e) => {
            filterTable(e.target.value);
        });

        // Initial render
        renderTable();
    </script>
</body>
</html>`;
}

/**
 * Parse information from search audit filename
 */
function parseFileName(fileName: string): { timeRange?: string; timestamp?: number } {
    // Expected format: search_audit_TIMERANGE_TIMESTAMP.json
    // e.g., search_audit_-24h_to_now_20251024_141359.json
    const match = fileName.match(/search_audit_(.+?)_(\d{8}_\d{6})\.json/);
    if (match) {
        const timeRange = match[1].replace(/_/g, ' ');
        const timestamp = match[2];
        // Parse timestamp: YYYYMMDD_HHMMSS
        const year = parseInt(timestamp.substring(0, 4));
        const month = parseInt(timestamp.substring(4, 6)) - 1;
        const day = parseInt(timestamp.substring(6, 8));
        const hour = parseInt(timestamp.substring(9, 11));
        const minute = parseInt(timestamp.substring(11, 13));
        const second = parseInt(timestamp.substring(13, 15));

        return {
            timeRange,
            timestamp: new Date(year, month, day, hour, minute, second).getTime()
        };
    }
    return {};
}

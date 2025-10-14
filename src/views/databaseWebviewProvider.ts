import * as vscode from 'vscode';
import { LibraryCacheDB, ContentItem } from '../database/libraryCache';
import { ProfileManager } from '../profileManager';
import { formatContentId } from '../utils/contentId';

/**
 * Panel provider for viewing and managing SQLite library cache database
 */
export class DatabaseWebviewProvider {
    private static currentPanel?: vscode.WebviewPanel;
    private static profileManager?: ProfileManager;
    private static currentProfileName?: string;
    private static currentDb?: LibraryCacheDB;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) {
        DatabaseWebviewProvider.profileManager = new ProfileManager(context);
    }

    /**
     * Show the database viewer panel
     */
    public async show(profileName?: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (DatabaseWebviewProvider.currentPanel) {
            DatabaseWebviewProvider.currentPanel.reveal(column);
            if (profileName) {
                await DatabaseWebviewProvider.loadProfileData(profileName);
            }
            return;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'databaseViewer',
            'Library Cache Database',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this._extensionUri]
            }
        );

        DatabaseWebviewProvider.currentPanel = panel;

        panel.webview.html = DatabaseWebviewProvider.getHtmlForWebview(panel.webview);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'loadProfile':
                    await DatabaseWebviewProvider.loadProfileData(data.profileName);
                    break;
                case 'exportData':
                    await DatabaseWebviewProvider.exportData(data.items);
                    break;
                case 'runContentCommand':
                    await DatabaseWebviewProvider.runContentCommand(data.contentId, data.itemType, data.name);
                    break;
                case 'refreshData':
                    await DatabaseWebviewProvider.loadProfileData(DatabaseWebviewProvider.currentProfileName || '');
                    break;
            }
        });

        // Clean up when panel is closed
        panel.onDidDispose(() => {
            DatabaseWebviewProvider.currentPanel = undefined;
            if (DatabaseWebviewProvider.currentDb) {
                DatabaseWebviewProvider.currentDb.close();
                DatabaseWebviewProvider.currentDb = undefined;
            }
        });

        // Load profile data
        if (profileName) {
            await DatabaseWebviewProvider.loadProfileData(profileName);
        } else {
            await DatabaseWebviewProvider.loadActiveProfile();
        }
    }

    /**
     * Load data for active profile
     */
    private static async loadActiveProfile() {
        if (!DatabaseWebviewProvider.profileManager) {
            return;
        }
        const activeProfile = await DatabaseWebviewProvider.profileManager.getActiveProfile();
        if (activeProfile) {
            await DatabaseWebviewProvider.loadProfileData(activeProfile.name);
        }
    }

    /**
     * Load profile data and send to webview
     */
    private static async loadProfileData(profileName: string) {
        if (!profileName || !DatabaseWebviewProvider.profileManager) {
            return;
        }

        try {
            DatabaseWebviewProvider.currentProfileName = profileName;
            const profileDir = DatabaseWebviewProvider.profileManager.getProfileDirectory(profileName);

            // Close existing DB if any
            if (DatabaseWebviewProvider.currentDb) {
                DatabaseWebviewProvider.currentDb.close();
            }

            // Create new DB connection
            const { createLibraryCacheDB } = await import('../database/libraryCache');
            DatabaseWebviewProvider.currentDb = createLibraryCacheDB(profileDir, profileName);

            // Get all items from database
            const stats = DatabaseWebviewProvider.currentDb.getCacheStats();
            const allItems = DatabaseWebviewProvider.getAllItems(DatabaseWebviewProvider.currentDb);

            // Send data to webview
            if (DatabaseWebviewProvider.currentPanel) {
                DatabaseWebviewProvider.currentPanel.webview.postMessage({
                    type: 'data',
                    profileName,
                    items: allItems.map(item => ({
                        ...item,
                        formattedId: formatContentId(item.id),
                        permissions: item.permissions || []
                    })),
                    stats
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load database: ${error}`);
        }
    }

    /**
     * Get all items from database
     */
    private static getAllItems(db: LibraryCacheDB): ContentItem[] {
        // Use raw SQL to get all items
        const stmt = (db as any).db.prepare(`
            SELECT * FROM content_items
            ORDER BY name ASC
        `);
        const rows = stmt.all() as any[];

        return rows.map(row => ({
            id: row.id,
            profile: row.profile,
            name: row.name,
            itemType: row.itemType,
            parentId: row.parentId,
            description: row.description,
            createdAt: row.createdAt,
            createdBy: row.createdBy,
            modifiedAt: row.modifiedAt,
            modifiedBy: row.modifiedBy,
            hasChildren: Boolean(row.hasChildren),
            childrenFetched: Boolean(row.childrenFetched),
            permissions: row.permissions ? JSON.parse(row.permissions) : undefined,
            lastFetched: row.lastFetched
        }));
    }

    /**
     * Export data to CSV
     */
    private static async exportData(items: any[]) {
        const csv = DatabaseWebviewProvider.convertToCSV(items);
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`library_cache_${DatabaseWebviewProvider.currentProfileName}.csv`),
            filters: {
                'CSV Files': ['csv'],
                'All Files': ['*']
            }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(csv, 'utf-8'));
            vscode.window.showInformationMessage(`Exported ${items.length} items to ${uri.fsPath}`);
        }
    }

    /**
     * Convert items to CSV format
     */
    private static convertToCSV(items: any[]): string {
        if (items.length === 0) {
            return '';
        }

        const headers = Object.keys(items[0]);
        const rows = items.map(item =>
            headers.map(header => {
                const value = item[header];
                if (value === null || value === undefined) {
                    return '';
                }
                if (typeof value === 'object') {
                    return JSON.stringify(value);
                }
                const strValue = String(value);
                // Escape quotes and wrap in quotes if contains comma or newline
                if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
                    return `"${strValue.replace(/"/g, '""')}"`;
                }
                return strValue;
            }).join(',')
        );

        return [headers.join(','), ...rows].join('\n');
    }

    /**
     * Run content command (view/open content item)
     */
    private static async runContentCommand(contentId: string, itemType: string, name: string) {
        if (itemType === 'Folder') {
            // Open folder in tree view
            vscode.commands.executeCommand('sumologic.viewLibraryContent', DatabaseWebviewProvider.currentProfileName, contentId, name);
        } else {
            // Open content item
            vscode.commands.executeCommand('sumologic.viewLibraryContent', DatabaseWebviewProvider.currentProfileName, contentId, name);
        }
    }

    /**
     * Refresh the webview with current profile data
     */
    public async refresh() {
        if (DatabaseWebviewProvider.currentProfileName) {
            await DatabaseWebviewProvider.loadProfileData(DatabaseWebviewProvider.currentProfileName);
        }
    }

    /**
     * Generate HTML for webview
     */
    private static getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Library Cache Database Viewer</title>
    <style>
        body {
            padding: 20px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }

        .controls {
            margin-bottom: 15px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .control-row {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }

        input, select, button {
            padding: 6px 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 13px;
        }

        input[type="text"] {
            flex: 1;
            min-width: 300px;
        }

        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            padding: 6px 14px;
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .stats {
            margin-bottom: 15px;
            padding: 10px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            font-size: 12px;
        }

        .stats-row {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
        }

        .stat-item {
            display: flex;
            gap: 5px;
        }

        .stat-label {
            font-weight: bold;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }

        th, td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        th {
            background: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: bold;
            cursor: pointer;
            user-select: none;
            position: sticky;
            top: 0;
            z-index: 10;
        }

        th:hover {
            background: var(--vscode-list-hoverBackground);
        }

        th.sorted-asc::after {
            content: ' ↑';
        }

        th.sorted-desc::after {
            content: ' ↓';
        }

        tr:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .table-container {
            overflow: auto;
            max-height: calc(100vh - 250px);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }

        .action-link {
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            text-decoration: underline;
        }

        .action-link:hover {
            color: var(--vscode-textLink-activeForeground);
        }

        .no-data {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }

        .truncate {
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
    </style>
</head>
<body>
    <div class="controls">
        <div class="control-row">
            <input type="text" id="searchInput" placeholder="Search by name, ID, or description..." />
            <button onclick="clearSearch()">Clear</button>
            <button onclick="exportToCSV()">Export CSV</button>
            <button onclick="refreshData()">Refresh</button>
        </div>
        <div class="control-row">
            <label>Filter by type:</label>
            <select id="typeFilter" onchange="applyFilters()">
                <option value="">All Types</option>
            </select>
            <label>Items per page:</label>
            <select id="pageSizeSelect" onchange="changePageSize()">
                <option value="50">50</option>
                <option value="100" selected>100</option>
                <option value="250">250</option>
                <option value="500">500</option>
                <option value="all">All</option>
            </select>
        </div>
    </div>

    <div class="stats" id="stats"></div>

    <div class="table-container">
        <table id="dataTable">
            <thead>
                <tr>
                    <th onclick="sortTable('name')">Name</th>
                    <th onclick="sortTable('itemType')">Type</th>
                    <th onclick="sortTable('formattedId')">ID</th>
                    <th onclick="sortTable('modifiedAt')">Modified</th>
                    <th onclick="sortTable('createdBy')">Created By</th>
                    <th>Description</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="tableBody">
                <tr><td colspan="7" class="no-data">Loading...</td></tr>
            </tbody>
        </table>
    </div>

    <div id="pagination" style="margin-top: 15px; text-align: center;"></div>

    <script>
        const vscode = acquireVsCodeApi();
        let allData = [];
        let filteredData = [];
        let currentSort = { column: 'name', ascending: true };
        let currentPage = 1;
        let pageSize = 100;

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'data') {
                allData = message.items;
                updateStats(message.stats, message.profileName);
                populateTypeFilter();
                applyFilters();
            }
        });

        function updateStats(stats, profileName) {
            const statsDiv = document.getElementById('stats');
            const typesList = Object.entries(stats.itemsByType || {})
                .map(([type, count]) => \`\${type}: \${count}\`)
                .join(', ');

            statsDiv.innerHTML = \`
                <div class="stats-row">
                    <div class="stat-item">
                        <span class="stat-label">Profile:</span>
                        <span>\${profileName}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Total Items:</span>
                        <span>\${stats.totalItems}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Showing:</span>
                        <span>\${filteredData.length}</span>
                    </div>
                </div>
                <div style="margin-top: 5px;">
                    <span class="stat-label">Types:</span> \${typesList}
                </div>
            \`;
        }

        function populateTypeFilter() {
            const types = [...new Set(allData.map(item => item.itemType))].sort();
            const select = document.getElementById('typeFilter');
            const currentValue = select.value;

            select.innerHTML = '<option value="">All Types</option>';
            types.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                select.appendChild(option);
            });

            select.value = currentValue;
        }

        function applyFilters() {
            const searchText = document.getElementById('searchInput').value.toLowerCase();
            const typeFilter = document.getElementById('typeFilter').value;

            filteredData = allData.filter(item => {
                const matchesSearch = !searchText ||
                    item.name.toLowerCase().includes(searchText) ||
                    item.formattedId.toLowerCase().includes(searchText) ||
                    (item.description || '').toLowerCase().includes(searchText);

                const matchesType = !typeFilter || item.itemType === typeFilter;

                return matchesSearch && matchesType;
            });

            currentPage = 1;
            sortAndRenderTable();
        }

        function sortTable(column) {
            if (currentSort.column === column) {
                currentSort.ascending = !currentSort.ascending;
            } else {
                currentSort.column = column;
                currentSort.ascending = true;
            }
            sortAndRenderTable();
        }

        function sortAndRenderTable() {
            // Sort data
            filteredData.sort((a, b) => {
                let valA = a[currentSort.column] || '';
                let valB = b[currentSort.column] || '';

                // Handle dates
                if (currentSort.column.includes('At')) {
                    valA = new Date(valA).getTime() || 0;
                    valB = new Date(valB).getTime() || 0;
                }

                if (valA < valB) return currentSort.ascending ? -1 : 1;
                if (valA > valB) return currentSort.ascending ? 1 : -1;
                return 0;
            });

            renderTable();
            updateSortIndicators();
        }

        function renderTable() {
            const tbody = document.getElementById('tableBody');
            const statsDiv = document.getElementById('stats');

            if (filteredData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="no-data">No items found</td></tr>';
                document.getElementById('pagination').innerHTML = '';
                return;
            }

            // Pagination
            const startIdx = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
            const endIdx = pageSize === 'all' ? filteredData.length : startIdx + pageSize;
            const pageData = filteredData.slice(startIdx, endIdx);

            tbody.innerHTML = pageData.map(item => {
                const modifiedDate = item.modifiedAt ? new Date(item.modifiedAt).toLocaleDateString() : '-';
                const createdBy = item.createdBy || '-';
                const description = item.description || '';

                return \`
                    <tr>
                        <td>\${escapeHtml(item.name)}</td>
                        <td><span class="badge">\${escapeHtml(item.itemType)}</span></td>
                        <td><code>\${escapeHtml(item.formattedId)}</code></td>
                        <td>\${modifiedDate}</td>
                        <td class="truncate" title="\${escapeHtml(createdBy)}">\${escapeHtml(createdBy)}</td>
                        <td class="truncate" title="\${escapeHtml(description)}">\${escapeHtml(description)}</td>
                        <td>
                            <a class="action-link" onclick="runCommand('\${item.id}', '\${item.itemType}', '\${escapeHtml(item.name)}')">
                                View
                            </a>
                        </td>
                    </tr>
                \`;
            }).join('');

            // Update pagination
            renderPagination();

            // Update stats
            const currentStats = statsDiv.querySelector('.stat-item:nth-child(3) span:last-child');
            if (currentStats) {
                currentStats.textContent = filteredData.length;
            }
        }

        function renderPagination() {
            if (pageSize === 'all') {
                document.getElementById('pagination').innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(filteredData.length / pageSize);
            const paginationDiv = document.getElementById('pagination');

            if (totalPages <= 1) {
                paginationDiv.innerHTML = '';
                return;
            }

            let html = '<button onclick="changePage(' + (currentPage - 1) + ')" ' +
                       (currentPage === 1 ? 'disabled' : '') + '>Previous</button> ';

            html += \`Page \${currentPage} of \${totalPages} \`;

            html += '<button onclick="changePage(' + (currentPage + 1) + ')" ' +
                    (currentPage === totalPages ? 'disabled' : '') + '>Next</button>';

            paginationDiv.innerHTML = html;
        }

        function changePage(page) {
            const totalPages = Math.ceil(filteredData.length / pageSize);
            if (page < 1 || page > totalPages) return;
            currentPage = page;
            renderTable();
        }

        function changePageSize() {
            const select = document.getElementById('pageSizeSelect');
            pageSize = select.value === 'all' ? 'all' : parseInt(select.value);
            currentPage = 1;
            renderTable();
        }

        function updateSortIndicators() {
            document.querySelectorAll('th').forEach(th => {
                th.classList.remove('sorted-asc', 'sorted-desc');
            });

            const columnIndex = ['name', 'itemType', 'formattedId', 'modifiedAt', 'createdBy'].indexOf(currentSort.column);
            if (columnIndex !== -1) {
                const th = document.querySelectorAll('th')[columnIndex];
                th.classList.add(currentSort.ascending ? 'sorted-asc' : 'sorted-desc');
            }
        }

        function clearSearch() {
            document.getElementById('searchInput').value = '';
            document.getElementById('typeFilter').value = '';
            applyFilters();
        }

        function exportToCSV() {
            vscode.postMessage({
                type: 'exportData',
                items: filteredData
            });
        }

        function refreshData() {
            vscode.postMessage({
                type: 'refreshData'
            });
        }

        function runCommand(contentId, itemType, name) {
            vscode.postMessage({
                type: 'runContentCommand',
                contentId: contentId,
                itemType: itemType,
                name: name
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Search on input
        document.getElementById('searchInput').addEventListener('input', applyFilters);
    </script>
</body>
</html>`;
    }

    /**
     * Dispose of resources
     */
    public dispose() {
        if (DatabaseWebviewProvider.currentDb) {
            DatabaseWebviewProvider.currentDb.close();
        }
    }
}

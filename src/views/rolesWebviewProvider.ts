import * as vscode from 'vscode';
import { createUsersRolesDB, Role } from '../database/usersRoles';
import { ProfileManager } from '../profileManager';

/**
 * Panel provider for viewing and managing Roles
 */
export class RolesWebviewProvider {
    private static currentPanel?: vscode.WebviewPanel;
    private static profileManager?: ProfileManager;
    private static currentProfileName?: string;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) {
        RolesWebviewProvider.profileManager = new ProfileManager(context);
    }

    /**
     * Show the roles viewer panel
     */
    public async show(profileName?: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (RolesWebviewProvider.currentPanel) {
            RolesWebviewProvider.currentPanel.reveal(column);
            if (profileName) {
                await RolesWebviewProvider.loadProfileData(profileName);
            }
            return;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'rolesViewer',
            'Roles',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this._extensionUri]
            }
        );

        RolesWebviewProvider.currentPanel = panel;

        panel.webview.html = RolesWebviewProvider.getHtmlForWebview(panel.webview);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'loadProfile':
                    await RolesWebviewProvider.loadProfileData(data.profileName);
                    break;
                case 'exportData':
                    await RolesWebviewProvider.exportData(data.items);
                    break;
                case 'refreshData':
                    await vscode.commands.executeCommand('sumologic.fetchRoles', RolesWebviewProvider.currentProfileName);
                    setTimeout(() => RolesWebviewProvider.loadProfileData(RolesWebviewProvider.currentProfileName || ''), 1000);
                    break;
            }
        });

        // Clean up when panel is closed
        panel.onDidDispose(() => {
            RolesWebviewProvider.currentPanel = undefined;
        });

        // Load profile data
        if (profileName) {
            await RolesWebviewProvider.loadProfileData(profileName);
        } else {
            await RolesWebviewProvider.loadActiveProfile();
        }
    }

    /**
     * Load data for active profile
     */
    private static async loadActiveProfile() {
        if (!RolesWebviewProvider.profileManager) {
            return;
        }
        const activeProfile = await RolesWebviewProvider.profileManager.getActiveProfile();
        if (activeProfile) {
            await RolesWebviewProvider.loadProfileData(activeProfile.name);
        }
    }

    /**
     * Load profile data and send to webview
     */
    private static async loadProfileData(profileName: string) {
        if (!profileName || !RolesWebviewProvider.profileManager) {
            return;
        }

        try {
            RolesWebviewProvider.currentProfileName = profileName;
            const profileDir = RolesWebviewProvider.profileManager.getProfileDirectory(profileName);

            // Open database
            const db = createUsersRolesDB(profileDir, profileName);

            // Get all roles from database
            const roles = db.getAllRoles();
            const stats = db.getStats();

            db.close();

            // Send data to webview
            if (RolesWebviewProvider.currentPanel) {
                RolesWebviewProvider.currentPanel.webview.postMessage({
                    type: 'data',
                    profileName,
                    roles,
                    stats
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load roles: ${error}`);
        }
    }

    /**
     * Export data to CSV
     */
    private static async exportData(items: any[]) {
        const csv = RolesWebviewProvider.convertToCSV(items);
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`roles_${RolesWebviewProvider.currentProfileName}.csv`),
            filters: {
                'CSV Files': ['csv'],
                'All Files': ['*']
            }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(csv, 'utf-8'));
            vscode.window.showInformationMessage(`Exported ${items.length} roles to ${uri.fsPath}`);
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
     * Refresh the webview with current profile data
     */
    public async refresh() {
        if (RolesWebviewProvider.currentProfileName) {
            await RolesWebviewProvider.loadProfileData(RolesWebviewProvider.currentProfileName);
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
    <title>Roles Viewer</title>
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
            margin-right: 2px;
            margin-bottom: 2px;
        }

        .capabilities-cell {
            max-width: 400px;
        }

        .capability-count {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            margin-left: 5px;
        }
    </style>
</head>
<body>
    <div class="controls">
        <div class="control-row">
            <input type="text" id="searchInput" placeholder="Search by ID, name, or description..." />
            <button onclick="clearSearch()">Clear</button>
            <button onclick="exportToCSV()">Export CSV</button>
            <button onclick="refreshData()">Refresh</button>
        </div>
        <div class="control-row">
            <label>Items per page:</label>
            <select id="pageSizeSelect" onchange="changePageSize()">
                <option value="50">50</option>
                <option value="100" selected>100</option>
                <option value="250">250</option>
                <option value="all">All</option>
            </select>
        </div>
    </div>

    <div class="stats" id="stats"></div>

    <div class="table-container">
        <table id="dataTable">
            <thead>
                <tr>
                    <th onclick="sortTable('id')">ID</th>
                    <th onclick="sortTable('name')">Name</th>
                    <th onclick="sortTable('description')">Description</th>
                    <th>Capabilities</th>
                    <th onclick="sortTable('userCount')">Users</th>
                    <th onclick="sortTable('createdAt')">Created</th>
                </tr>
            </thead>
            <tbody id="tableBody">
                <tr><td colspan="6" class="no-data">Loading...</td></tr>
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
                allData = message.roles.map(role => ({
                    ...role,
                    userCount: role.users ? role.users.length : 0
                }));
                updateStats(message.stats, message.profileName);
                applyFilters();
            }
        });

        function updateStats(stats, profileName) {
            const statsDiv = document.getElementById('stats');
            statsDiv.innerHTML = \`
                <div class="stats-row">
                    <div class="stat-item">
                        <span class="stat-label">Profile:</span>
                        <span>\${profileName}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Total Roles:</span>
                        <span>\${stats.totalRoles}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Showing:</span>
                        <span>\${filteredData.length}</span>
                    </div>
                </div>
            \`;
        }

        function applyFilters() {
            const searchText = document.getElementById('searchInput').value.toLowerCase();

            filteredData = allData.filter(role => {
                const matchesSearch = !searchText ||
                    role.id.toLowerCase().includes(searchText) ||
                    role.name.toLowerCase().includes(searchText) ||
                    (role.description || '').toLowerCase().includes(searchText);

                return matchesSearch;
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

                // Handle numbers
                if (typeof valA === 'number') {
                    return currentSort.ascending ? valA - valB : valB - valA;
                }

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

            if (filteredData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="no-data">No roles found</td></tr>';
                document.getElementById('pagination').innerHTML = '';
                return;
            }

            // Pagination
            const startIdx = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
            const endIdx = pageSize === 'all' ? filteredData.length : startIdx + pageSize;
            const pageData = filteredData.slice(startIdx, endIdx);

            tbody.innerHTML = pageData.map(role => {
                const description = role.description || '-';
                const createdAt = role.createdAt ? new Date(role.createdAt).toLocaleDateString() : '-';

                // Capabilities - show first few, then count
                const capabilitiesToShow = 5;
                let capabilitiesHtml = '';
                if (role.capabilities && role.capabilities.length > 0) {
                    const visibleCaps = role.capabilities.slice(0, capabilitiesToShow);
                    capabilitiesHtml = visibleCaps.map(c => \`<span class="badge">\${escapeHtml(c)}</span>\`).join('');
                    if (role.capabilities.length > capabilitiesToShow) {
                        capabilitiesHtml += \`<span class="capability-count">+\${role.capabilities.length - capabilitiesToShow} more</span>\`;
                    }
                } else {
                    capabilitiesHtml = '-';
                }

                return \`
                    <tr>
                        <td class="truncate" title="\${escapeHtml(role.id)}"><code>\${escapeHtml(role.id)}</code></td>
                        <td>\${escapeHtml(role.name)}</td>
                        <td class="truncate" title="\${escapeHtml(description)}">\${escapeHtml(description)}</td>
                        <td class="capabilities-cell">\${capabilitiesHtml}</td>
                        <td>\${role.userCount}</td>
                        <td>\${createdAt}</td>
                    </tr>
                \`;
            }).join('');

            // Update pagination
            renderPagination();

            // Update stats
            const statsDiv = document.getElementById('stats');
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

            const columnIndex = ['id', 'name', 'description', '', 'userCount', 'createdAt'].indexOf(currentSort.column);
            if (columnIndex !== -1) {
                const th = document.querySelectorAll('th')[columnIndex];
                th.classList.add(currentSort.ascending ? 'sorted-asc' : 'sorted-desc');
            }
        }

        function clearSearch() {
            document.getElementById('searchInput').value = '';
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
        // Nothing to dispose currently
    }
}

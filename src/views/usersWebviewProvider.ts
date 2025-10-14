import * as vscode from 'vscode';
import { createUsersRolesDB, User } from '../database/usersRoles';
import { ProfileManager } from '../profileManager';

/**
 * Panel provider for viewing and managing Users
 */
export class UsersWebviewProvider {
    private static currentPanel?: vscode.WebviewPanel;
    private static profileManager?: ProfileManager;
    private static currentProfileName?: string;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) {
        UsersWebviewProvider.profileManager = new ProfileManager(context);
    }

    /**
     * Show the users viewer panel
     */
    public async show(profileName?: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (UsersWebviewProvider.currentPanel) {
            UsersWebviewProvider.currentPanel.reveal(column);
            if (profileName) {
                await UsersWebviewProvider.loadProfileData(profileName);
            }
            return;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'usersViewer',
            'Users',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this._extensionUri]
            }
        );

        UsersWebviewProvider.currentPanel = panel;

        panel.webview.html = UsersWebviewProvider.getHtmlForWebview(panel.webview);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'loadProfile':
                    await UsersWebviewProvider.loadProfileData(data.profileName);
                    break;
                case 'exportData':
                    await UsersWebviewProvider.exportData(data.items);
                    break;
                case 'refreshData':
                    await vscode.commands.executeCommand('sumologic.fetchUsers', UsersWebviewProvider.currentProfileName);
                    setTimeout(() => UsersWebviewProvider.loadProfileData(UsersWebviewProvider.currentProfileName || ''), 1000);
                    break;
            }
        });

        // Clean up when panel is closed
        panel.onDidDispose(() => {
            UsersWebviewProvider.currentPanel = undefined;
        });

        // Load profile data
        if (profileName) {
            await UsersWebviewProvider.loadProfileData(profileName);
        } else {
            await UsersWebviewProvider.loadActiveProfile();
        }
    }

    /**
     * Load data for active profile
     */
    private static async loadActiveProfile() {
        if (!UsersWebviewProvider.profileManager) {
            return;
        }
        const activeProfile = await UsersWebviewProvider.profileManager.getActiveProfile();
        if (activeProfile) {
            await UsersWebviewProvider.loadProfileData(activeProfile.name);
        }
    }

    /**
     * Load profile data and send to webview
     */
    private static async loadProfileData(profileName: string) {
        if (!profileName || !UsersWebviewProvider.profileManager) {
            return;
        }

        try {
            UsersWebviewProvider.currentProfileName = profileName;
            const profileDir = UsersWebviewProvider.profileManager.getProfileDirectory(profileName);

            // Open database
            const db = createUsersRolesDB(profileDir, profileName);

            // Get all users and roles from database
            const users = db.getAllUsers();
            const stats = db.getStats();

            // Enrich users with role names
            const enrichedUsers = users.map(user => {
                const roleNames = user.roleIds.map(roleId => {
                    const roleName = db.getRoleName(roleId);
                    return roleName || roleId;
                });

                return {
                    ...user,
                    roleNames
                };
            });

            db.close();

            // Send data to webview
            if (UsersWebviewProvider.currentPanel) {
                UsersWebviewProvider.currentPanel.webview.postMessage({
                    type: 'data',
                    profileName,
                    users: enrichedUsers,
                    stats
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load users: ${error}`);
        }
    }

    /**
     * Export data to CSV
     */
    private static async exportData(items: any[]) {
        const csv = UsersWebviewProvider.convertToCSV(items);
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`users_${UsersWebviewProvider.currentProfileName}.csv`),
            filters: {
                'CSV Files': ['csv'],
                'All Files': ['*']
            }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(csv, 'utf-8'));
            vscode.window.showInformationMessage(`Exported ${items.length} users to ${uri.fsPath}`);
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
        if (UsersWebviewProvider.currentProfileName) {
            await UsersWebviewProvider.loadProfileData(UsersWebviewProvider.currentProfileName);
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
    <title>Users Viewer</title>
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
            max-width: 200px;
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
            margin-right: 4px;
        }

        .badge.active {
            background: #28a745;
        }

        .badge.inactive {
            background: #dc3545;
        }

        .badge.mfa {
            background: #007acc;
        }

        .badge.locked {
            background: #ffc107;
            color: #000;
        }
    </style>
</head>
<body>
    <div class="controls">
        <div class="control-row">
            <input type="text" id="searchInput" placeholder="Search by ID, name, or email..." />
            <button onclick="clearSearch()">Clear</button>
            <button onclick="exportToCSV()">Export CSV</button>
            <button onclick="refreshData()">Refresh</button>
        </div>
        <div class="control-row">
            <label>Filter by status:</label>
            <select id="statusFilter" onchange="applyFilters()">
                <option value="">All Users</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
            </select>
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
                    <th onclick="sortTable('lastName')">Name</th>
                    <th onclick="sortTable('email')">Email</th>
                    <th onclick="sortTable('isActive')">Status</th>
                    <th>Roles</th>
                    <th onclick="sortTable('lastModified')">Last Modified</th>
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
        let currentSort = { column: 'lastName', ascending: true };
        let currentPage = 1;
        let pageSize = 100;

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'data') {
                allData = message.users;
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
                        <span class="stat-label">Total Users:</span>
                        <span>\${stats.totalUsers}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Active Users:</span>
                        <span>\${stats.activeUsers}</span>
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
            const statusFilter = document.getElementById('statusFilter').value;

            filteredData = allData.filter(user => {
                const matchesSearch = !searchText ||
                    user.id.toLowerCase().includes(searchText) ||
                    user.firstName.toLowerCase().includes(searchText) ||
                    user.lastName.toLowerCase().includes(searchText) ||
                    user.email.toLowerCase().includes(searchText);

                const matchesStatus = !statusFilter ||
                    (statusFilter === 'active' && user.isActive) ||
                    (statusFilter === 'inactive' && !user.isActive);

                return matchesSearch && matchesStatus;
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
                let valA = a[currentSort.column];
                let valB = b[currentSort.column];

                // Handle booleans
                if (typeof valA === 'boolean') {
                    valA = valA ? 1 : 0;
                    valB = valB ? 1 : 0;
                }

                // Handle dates
                if (currentSort.column.includes('Modified') || currentSort.column.includes('At')) {
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
                tbody.innerHTML = '<tr><td colspan="6" class="no-data">No users found</td></tr>';
                document.getElementById('pagination').innerHTML = '';
                return;
            }

            // Pagination
            const startIdx = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
            const endIdx = pageSize === 'all' ? filteredData.length : startIdx + pageSize;
            const pageData = filteredData.slice(startIdx, endIdx);

            tbody.innerHTML = pageData.map(user => {
                const fullName = \`\${user.firstName} \${user.lastName}\`;
                const lastModified = user.lastModified ? new Date(user.lastModified).toLocaleDateString() : '-';

                // Status badges
                let statusBadges = '';
                if (user.isActive) {
                    statusBadges += '<span class="badge active">Active</span>';
                } else {
                    statusBadges += '<span class="badge inactive">Inactive</span>';
                }
                if (user.isLockedOut) {
                    statusBadges += '<span class="badge locked">Locked</span>';
                }
                if (user.isMfaEnabled) {
                    statusBadges += '<span class="badge mfa">MFA</span>';
                }

                // Role names
                const roleNames = user.roleNames && user.roleNames.length > 0
                    ? user.roleNames.map(r => \`<span class="badge">\${escapeHtml(r)}</span>\`).join('')
                    : '-';

                return \`
                    <tr>
                        <td class="truncate" title="\${escapeHtml(user.id)}"><code>\${escapeHtml(user.id)}</code></td>
                        <td>\${escapeHtml(fullName)}</td>
                        <td class="truncate" title="\${escapeHtml(user.email)}">\${escapeHtml(user.email)}</td>
                        <td>\${statusBadges}</td>
                        <td class="truncate">\${roleNames}</td>
                        <td>\${lastModified}</td>
                    </tr>
                \`;
            }).join('');

            // Update pagination
            renderPagination();

            // Update stats
            const statsDiv = document.getElementById('stats');
            const currentStats = statsDiv.querySelector('.stat-item:nth-child(4) span:last-child');
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

            const columnIndex = ['id', 'lastName', 'email', 'isActive', '', 'lastModified'].indexOf(currentSort.column);
            if (columnIndex !== -1) {
                const th = document.querySelectorAll('th')[columnIndex];
                th.classList.add(currentSort.ascending ? 'sorted-asc' : 'sorted-desc');
            }
        }

        function clearSearch() {
            document.getElementById('searchInput').value = '';
            document.getElementById('statusFilter').value = '';
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

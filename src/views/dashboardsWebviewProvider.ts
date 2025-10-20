import * as vscode from 'vscode';
import { DashboardsCacheDB, DashboardItem } from '../database/dashboardsCache';
import { ProfileManager } from '../profileManager';

/**
 * Panel provider for viewing and managing dashboards cache database
 */
export class DashboardsWebviewProvider {
    private static currentPanel?: vscode.WebviewPanel;
    private static profileManager?: ProfileManager;
    private static currentProfileName?: string;
    private static currentDb?: DashboardsCacheDB;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) {
        DashboardsWebviewProvider.profileManager = new ProfileManager(context);
    }

    /**
     * Show the dashboards viewer panel
     */
    public async show(profileName?: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (DashboardsWebviewProvider.currentPanel) {
            DashboardsWebviewProvider.currentPanel.reveal(column);
            if (profileName) {
                await DashboardsWebviewProvider.loadProfileData(profileName);
            }
            return;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'dashboardsViewer',
            'Dashboards',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this._extensionUri]
            }
        );

        DashboardsWebviewProvider.currentPanel = panel;

        panel.webview.html = DashboardsWebviewProvider.getHtmlForWebview(panel.webview);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'loadProfile':
                    await DashboardsWebviewProvider.loadProfileData(data.profileName);
                    break;
                case 'exportData':
                    await DashboardsWebviewProvider.exportData(data.items);
                    break;
                case 'openDashboardJson':
                    await DashboardsWebviewProvider.openDashboardJson(data.dashboardId, data.title, data.contentId);
                    break;
                case 'getDashboard':
                    await DashboardsWebviewProvider.getDashboard(data.dashboardId, data.title);
                    break;
                case 'openDashboardInUI':
                    await DashboardsWebviewProvider.openDashboardInUI(data.dashboardId, data.title);
                    break;
                case 'importToLibrary':
                    await DashboardsWebviewProvider.importToLibrary(data.dashboard);
                    break;
                case 'refreshData':
                    await DashboardsWebviewProvider.loadProfileData(DashboardsWebviewProvider.currentProfileName || '');
                    break;
                case 'addDashboardById':
                    await DashboardsWebviewProvider.addDashboardById();
                    break;
            }
        });

        // Clean up when panel is closed
        panel.onDidDispose(() => {
            DashboardsWebviewProvider.currentPanel = undefined;
            if (DashboardsWebviewProvider.currentDb) {
                DashboardsWebviewProvider.currentDb.close();
                DashboardsWebviewProvider.currentDb = undefined;
            }
        });

        // Load profile data
        if (profileName) {
            await DashboardsWebviewProvider.loadProfileData(profileName);
        } else {
            await DashboardsWebviewProvider.loadActiveProfile();
        }
    }

    /**
     * Load data for active profile
     */
    private static async loadActiveProfile() {
        if (!DashboardsWebviewProvider.profileManager) {
            return;
        }
        const activeProfile = await DashboardsWebviewProvider.profileManager.getActiveProfile();
        if (activeProfile) {
            await DashboardsWebviewProvider.loadProfileData(activeProfile.name);
        }
    }

    /**
     * Load profile data and send to webview
     */
    private static async loadProfileData(profileName: string) {
        if (!profileName || !DashboardsWebviewProvider.profileManager) {
            return;
        }

        try {
            DashboardsWebviewProvider.currentProfileName = profileName;
            const profileDir = DashboardsWebviewProvider.profileManager.getProfileDirectory(profileName);

            // Close existing DB if any
            if (DashboardsWebviewProvider.currentDb) {
                DashboardsWebviewProvider.currentDb.close();
            }

            // Create new DB connection
            const { createDashboardsCacheDB } = await import('../database/dashboardsCache');
            DashboardsWebviewProvider.currentDb = createDashboardsCacheDB(profileDir, profileName);

            // Get all dashboards from database
            const stats = DashboardsWebviewProvider.currentDb.getCacheStats();
            const allDashboards = DashboardsWebviewProvider.currentDb.getAllDashboards();

            // Send data to webview
            if (DashboardsWebviewProvider.currentPanel) {
                DashboardsWebviewProvider.currentPanel.webview.postMessage({
                    type: 'data',
                    profileName,
                    dashboards: allDashboards,
                    stats
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load dashboards database: ${error}`);
        }
    }

    /**
     * Export data to CSV
     */
    private static async exportData(items: any[]) {
        const csv = DashboardsWebviewProvider.convertToCSV(items);
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`dashboards_${DashboardsWebviewProvider.currentProfileName}.csv`),
            filters: {
                'CSV Files': ['csv'],
                'All Files': ['*']
            }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(csv, 'utf-8'));
            vscode.window.showInformationMessage(`Exported ${items.length} dashboards to ${uri.fsPath}`);
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
     * Open dashboard JSON file in the specialized dashboard webview
     * The dashboard JSON files from the Dashboard API need special handling because they
     * don't have the same structure as exported content from the Content API
     */
    private static async openDashboardJson(dashboardId: string, title: string, contentId?: string) {
        if (!DashboardsWebviewProvider.profileManager) {
            return;
        }

        const profileName = DashboardsWebviewProvider.currentProfileName;
        if (!profileName) {
            return;
        }

        const dashboardsDir = DashboardsWebviewProvider.profileManager.getProfileDashboardsDirectory(profileName);
        const path = require('path');
        const fs = require('fs');
        const filePath = path.join(dashboardsDir, `${dashboardId}.json`);

        if (!fs.existsSync(filePath)) {
            vscode.window.showErrorMessage(`Dashboard JSON file not found: ${dashboardId}.json`);
            return;
        }

        // Read the dashboard JSON to ensure it has the itemType field for proper detection
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        let dashboardContent = JSON.parse(fileContent);

        // Dashboard API returns dashboards without an itemType field, but with properties like:
        // title, description, panels, variables, etc.
        // We need to add itemType: "Dashboard" so the webview can detect it properly
        if (!dashboardContent.itemType && !dashboardContent.type) {
            // This is a raw dashboard from the Dashboard API - add itemType
            dashboardContent.itemType = 'Dashboard';

            // Also ensure it has a name field (uses title from Dashboard API)
            if (!dashboardContent.name && dashboardContent.title) {
                dashboardContent.name = dashboardContent.title;
            }

            // Save the updated JSON back to the file so it has the correct structure
            fs.writeFileSync(filePath, JSON.stringify(dashboardContent, null, 2), 'utf-8');
        }

        // Use openExportedContentFromPath which handles dashboard detection and shows the specialized webview
        vscode.commands.executeCommand('sumologic.openExportedContentFromPath', filePath);
    }

    /**
     * Get dashboard from API and update local JSON file
     */
    private static async getDashboard(dashboardId: string, title: string) {
        const profileName = DashboardsWebviewProvider.currentProfileName;
        if (!profileName || !DashboardsWebviewProvider.profileManager) {
            return;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Fetching dashboard "${title}" from API...`,
                cancellable: false
            }, async (progress) => {
                // Get profile
                const profileManager = DashboardsWebviewProvider.profileManager;
                if (!profileManager) {
                    throw new Error('Profile manager not available');
                }

                const profiles = await profileManager.getProfiles();
                const profile = profiles.find(p => p.name === profileName);
                if (!profile) {
                    throw new Error(`Profile not found: ${profileName}`);
                }

                // Get credentials
                const credentials = await profileManager.getProfileCredentials(profileName);
                if (!credentials) {
                    throw new Error(`No credentials found for profile: ${profileName}`);
                }

                // Create dashboard API client
                const { DashboardClient } = await import('../api/dashboards');
                const client = new DashboardClient({
                    accessId: credentials.accessId,
                    accessKey: credentials.accessKey,
                    endpoint: profileManager.getProfileEndpoint(profile)
                });

                // Fetch dashboard from API
                progress.report({ message: 'Retrieving dashboard from API...' });
                const response = await client.getDashboard(dashboardId);

                if (response.error || !response.data) {
                    if (response.statusCode === 403 || response.statusCode === 401) {
                        vscode.window.showWarningMessage(
                            `Unable to fetch dashboard ${dashboardId}: Insufficient permissions. ` +
                            `HTTP Status: ${response.statusCode}`
                        );
                    } else if (response.statusCode === 404) {
                        vscode.window.showErrorMessage(
                            `Dashboard not found: ${dashboardId} (HTTP 404)`
                        );
                    } else {
                        vscode.window.showErrorMessage(
                            `Failed to fetch dashboard ${dashboardId}: ${response.error}` +
                            (response.statusCode ? ` (HTTP ${response.statusCode})` : '')
                        );
                    }
                    return;
                }

                const dashboard = response.data;
                progress.report({ message: 'Saving to local file...' });

                // Get dashboards directory
                const dashboardsDir = profileManager.getProfileDashboardsDirectory(profileName);
                const path = require('path');
                const fs = require('fs');

                // Ensure directory exists
                if (!fs.existsSync(dashboardsDir)) {
                    fs.mkdirSync(dashboardsDir, { recursive: true });
                }

                // Save/update JSON file
                const jsonFilePath = path.join(dashboardsDir, `${dashboardId}.json`);
                fs.writeFileSync(jsonFilePath, JSON.stringify(dashboard, null, 2), 'utf-8');

                // Update the dashboard in the database cache
                const { createDashboardsCacheDB } = await import('../database/dashboardsCache');
                const db = createDashboardsCacheDB(profileManager.getProfileDirectory(profileName), profileName);

                const now = new Date().toISOString();
                db.upsertDashboard({
                    id: dashboard.id,
                    profile: profileName,
                    title: dashboard.title,
                    description: dashboard.description,
                    folderId: dashboard.folderId,
                    contentId: dashboard.contentId,
                    lastFetched: now
                });

                db.close();

                vscode.window.showInformationMessage(
                    `Dashboard "${dashboard.title}" fetched and updated successfully`
                );

                // Refresh the dashboards webview to show updated timestamp
                await DashboardsWebviewProvider.loadProfileData(profileName);
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to get dashboard: ${error.message}`);
        }
    }

    /**
     * Open dashboard in Sumo Logic web UI
     */
    private static async openDashboardInUI(dashboardId: string, title: string) {
        if (!DashboardsWebviewProvider.profileManager) {
            return;
        }

        const profileName = DashboardsWebviewProvider.currentProfileName;
        if (!profileName) {
            return;
        }

        // Get the profile to determine the instance name
        const profiles = await DashboardsWebviewProvider.profileManager.getProfiles();
        const profile = profiles.find(p => p.name === profileName);
        if (!profile) {
            vscode.window.showErrorMessage(`Profile not found: ${profileName}`);
            return;
        }

        // Get the instance name from profile (with fallback to global setting and default)
        const instanceName = DashboardsWebviewProvider.profileManager.getInstanceName(profile);

        // Construct the dashboard URL
        const dashboardUrl = `https://${instanceName}/dashboard/${dashboardId}`;

        // Open in external browser
        vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
        vscode.window.showInformationMessage(`Opening dashboard "${title}" in Sumo Logic UI`);
    }

    /**
     * Add a dashboard by ID - prompts user for ID and fetches it
     */
    private static async addDashboardById() {
        if (!DashboardsWebviewProvider.profileManager) {
            return;
        }

        const profileName = DashboardsWebviewProvider.currentProfileName;
        if (!profileName) {
            return;
        }

        // Use VSCode's built-in input box for the dashboard ID
        const vscode = await import('vscode');
        const dashboardId = await vscode.window.showInputBox({
            prompt: 'Enter Dashboard ID',
            placeHolder: 'e.g., B23OjNs5ZCyn5VdMwOBoLo3PjgRnJSAlNTKEDAcpuDG2CIgRe9KFXMofm2H2',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Dashboard ID cannot be empty';
                }
                return null;
            }
        });

        if (!dashboardId) {
            return;
        }

        // Use the existing getDashboard method which fetches and stores in the database
        await DashboardsWebviewProvider.getDashboard(dashboardId.trim(), 'Dashboard');
    }

    /**
     * Import dashboard to library database with full metadata
     */
    private static async importToLibrary(dashboard: any) {
        if (!dashboard.contentId || dashboard.contentId === '-') {
            vscode.window.showWarningMessage('This dashboard does not have a content ID and cannot be imported to library');
            return;
        }

        const profileName = DashboardsWebviewProvider.currentProfileName;
        if (!profileName || !DashboardsWebviewProvider.profileManager) {
            return;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Importing dashboard "${dashboard.title}" to library...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ message: 'Fetching content metadata from API...' });

                // Get profile manager
                const profileManager = DashboardsWebviewProvider.profileManager;
                if (!profileManager) {
                    throw new Error('Profile manager not available');
                }

                const profiles = await profileManager.getProfiles();
                const profile = profiles.find(p => p.name === profileName);
                if (!profile) {
                    throw new Error(`Profile not found: ${profileName}`);
                }

                // Get credentials
                const credentials = await profileManager.getProfileCredentials(profileName);
                if (!credentials) {
                    throw new Error(`No credentials found for profile: ${profileName}`);
                }

                // Create content API client
                const { ContentClient } = await import('../api/content');
                const client = new ContentClient({
                    accessId: credentials.accessId,
                    accessKey: credentials.accessKey,
                    endpoint: profileManager.getProfileEndpoint(profile)
                });

                // Step 1: Get the path by ID to get the full content metadata
                const pathResponse = await client.getContentPath(dashboard.contentId);

                if (pathResponse.error || !pathResponse.data) {
                    // If we can't get the path, fall back to basic info
                    vscode.window.showWarningMessage(
                        `Could not fetch full metadata for dashboard (${pathResponse.error || 'unknown error'}). ` +
                        `Using basic information from dashboards API.`
                    );

                    // Use basic dashboard info
                    await DashboardsWebviewProvider.insertBasicDashboard(dashboard, profileName);
                    return;
                }

                const contentPath = pathResponse.data.path;
                progress.report({ message: `Found at: ${contentPath}` });

                // Step 2: Get the full content object by path to get created/modified metadata
                const contentResponse = await client.getContent(contentPath);

                if (contentResponse.error || !contentResponse.data) {
                    // Fall back to basic info if we can't get full content
                    vscode.window.showWarningMessage(
                        `Could not fetch full content details (${contentResponse.error || 'unknown error'}). ` +
                        `Using basic information from dashboards API.`
                    );

                    await DashboardsWebviewProvider.insertBasicDashboard(dashboard, profileName);
                    return;
                }

                const contentItem = contentResponse.data;
                progress.report({ message: 'Saving to library database...' });

                // Import the library cache module
                const { createLibraryCacheDB } = await import('../database/libraryCache');

                // Get profile directory and create library database
                const profileDir = profileManager.getProfileDirectory(profileName);
                const libraryDb = createLibraryCacheDB(profileDir, profileName);

                // Insert the dashboard with full metadata into the library database
                libraryDb.upsertContentItem({
                    id: dashboard.contentId,
                    profile: profileName,
                    name: contentItem.name,
                    itemType: contentItem.itemType,
                    parentId: contentItem.parentId,
                    description: contentItem.description,
                    createdAt: contentItem.createdAt,
                    createdBy: contentItem.createdBy,
                    modifiedAt: contentItem.modifiedAt,
                    modifiedBy: contentItem.modifiedBy,
                    hasChildren: false,
                    childrenFetched: false,
                    permissions: contentItem.permissions,
                    lastFetched: new Date().toISOString()
                });

                libraryDb.close();

                vscode.window.showInformationMessage(
                    `Dashboard "${contentItem.name}" imported to library cache for ${profileName}`
                );

                // Refresh the library explorer to show the new item
                vscode.commands.executeCommand('sumologic.refreshExplorer');
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to import dashboard to library: ${error.message}`);
        }
    }

    /**
     * Insert dashboard with basic info (fallback when API calls fail)
     */
    private static async insertBasicDashboard(dashboard: any, profileName: string) {
        const { createLibraryCacheDB } = await import('../database/libraryCache');

        const profileDir = DashboardsWebviewProvider.profileManager!.getProfileDirectory(profileName);
        const libraryDb = createLibraryCacheDB(profileDir, profileName);

        // Insert the dashboard into the library database with basic info
        libraryDb.upsertContentItem({
            id: dashboard.contentId,
            profile: profileName,
            name: dashboard.title,
            itemType: 'Dashboard',
            parentId: dashboard.folderId || '0000000000000000',
            description: dashboard.description,
            createdAt: undefined,
            createdBy: undefined,
            modifiedAt: undefined,
            modifiedBy: undefined,
            hasChildren: false,
            childrenFetched: false,
            permissions: undefined,
            lastFetched: dashboard.lastFetched
        });

        libraryDb.close();

        vscode.window.showInformationMessage(
            `Dashboard "${dashboard.title}" added to library cache for ${profileName} (basic info only)`
        );

        // Refresh the library explorer to show the new item
        vscode.commands.executeCommand('sumologic.refreshExplorer');
    }

    /**
     * Refresh the webview with current profile data
     */
    public async refresh() {
        if (DashboardsWebviewProvider.currentProfileName) {
            await DashboardsWebviewProvider.loadProfileData(DashboardsWebviewProvider.currentProfileName);
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
    <title>Dashboards Viewer</title>
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
            margin-right: 8px;
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
            <button onclick="addDashboardById()">Add Dashboard by ID</button>
            <button onclick="exportToCSV()">Export CSV</button>
            <button onclick="refreshData()">Refresh</button>
        </div>
        <div class="control-row">
            <input type="text" id="searchInput" placeholder="Search by title, ID, or description..." />
            <button onclick="clearSearch()">Clear</button>
        </div>
        <div class="control-row">
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
                    <th onclick="sortTable('title')">Title</th>
                    <th onclick="sortTable('id')">ID</th>
                    <th onclick="sortTable('folderId')">Folder ID</th>
                    <th onclick="sortTable('contentId')">Content ID</th>
                    <th>Description</th>
                    <th>Actions</th>
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
        let currentSort = { column: 'title', ascending: true };
        let currentPage = 1;
        let pageSize = 100;

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'data') {
                allData = message.dashboards;
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
                        <span class="stat-label">Total Dashboards:</span>
                        <span>\${stats.totalDashboards}</span>
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

            filteredData = allData.filter(item => {
                const matchesSearch = !searchText ||
                    item.title.toLowerCase().includes(searchText) ||
                    item.id.toLowerCase().includes(searchText) ||
                    (item.description || '').toLowerCase().includes(searchText) ||
                    (item.folderId || '').toLowerCase().includes(searchText) ||
                    (item.contentId || '').toLowerCase().includes(searchText);

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
                tbody.innerHTML = '<tr><td colspan="6" class="no-data">No dashboards found</td></tr>';
                document.getElementById('pagination').innerHTML = '';
                return;
            }

            // Pagination
            const startIdx = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
            const endIdx = pageSize === 'all' ? filteredData.length : startIdx + pageSize;
            const pageData = filteredData.slice(startIdx, endIdx);

            tbody.innerHTML = pageData.map((item, index) => {
                const description = item.description || '';
                const folderId = item.folderId || '-';
                const contentId = item.contentId || '-';
                const itemIndex = startIdx + index;

                // Build action buttons
                let actions = \`<a class="action-link" onclick="openDashboardJson(\${itemIndex})">View JSON</a>\`;
                actions += \`<a class="action-link" onclick="getDashboard('\${escapeHtml(item.id)}', '\${escapeHtml(item.title)}')">Get Dashboard</a>\`;
                actions += \`<a class="action-link" onclick="openDashboardInUI('\${escapeHtml(item.id)}', '\${escapeHtml(item.title)}')">Open in UI</a>\`;

                if (item.contentId) {
                    actions += \`<a class="action-link" onclick="importToLibrary(\${itemIndex})">Import to Library</a>\`;
                }

                return \`
                    <tr>
                        <td>\${escapeHtml(item.title)}</td>
                        <td><code class="truncate" title="\${escapeHtml(item.id)}">\${escapeHtml(item.id)}</code></td>
                        <td><code>\${escapeHtml(folderId)}</code></td>
                        <td><code>\${escapeHtml(contentId)}</code></td>
                        <td class="truncate" title="\${escapeHtml(description)}">\${escapeHtml(description)}</td>
                        <td>
                            \${actions}
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

            const columnIndex = ['title', 'id', 'folderId', 'contentId'].indexOf(currentSort.column);
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

        function addDashboardById() {
            vscode.postMessage({
                type: 'addDashboardById'
            });
        }

        function openDashboardJson(itemIndex) {
            const dashboard = filteredData[itemIndex];
            if (!dashboard) {
                return;
            }
            vscode.postMessage({
                type: 'openDashboardJson',
                dashboardId: dashboard.id,
                title: dashboard.title,
                contentId: dashboard.contentId
            });
        }

        function getDashboard(dashboardId, title) {
            vscode.postMessage({
                type: 'getDashboard',
                dashboardId: dashboardId,
                title: title
            });
        }

        function openDashboardInUI(dashboardId, title) {
            vscode.postMessage({
                type: 'openDashboardInUI',
                dashboardId: dashboardId,
                title: title
            });
        }

        function importToLibrary(itemIndex) {
            const dashboard = filteredData[itemIndex];
            if (!dashboard) {
                return;
            }
            vscode.postMessage({
                type: 'importToLibrary',
                dashboard: dashboard
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
        if (DashboardsWebviewProvider.currentDb) {
            DashboardsWebviewProvider.currentDb.close();
        }
    }
}

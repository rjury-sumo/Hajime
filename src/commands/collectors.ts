import * as vscode from 'vscode';
import { CollectorsClient } from '../api/collectors';
import { createClient } from './authenticate';
import { OutputWriter } from '../outputWriter';

/**
 * Helper to create and configure a CollectorsClient for the specified or active profile
 * @param context Extension context
 * @param profileName Optional profile name. If not provided, uses active profile
 * @returns CollectorsClient and profile info, or null if profile not found
 */
async function createCollectorsClient(
    context: vscode.ExtensionContext,
    profileName?: string
): Promise<{ client: CollectorsClient; profile: any } | null> {
    const profileManager = await import('../profileManager');
    const pm = new profileManager.ProfileManager(context);

    let targetProfile;
    if (profileName) {
        const profiles = await pm.getProfiles();
        targetProfile = profiles.find(p => p.name === profileName);
        if (!targetProfile) {
            vscode.window.showErrorMessage(`Profile '${profileName}' not found.`);
            return null;
        }
    } else {
        targetProfile = await pm.getActiveProfile();
        if (!targetProfile) {
            vscode.window.showErrorMessage('No active profile. Please create a profile first.');
            return null;
        }
    }

    const credentials = await pm.getProfileCredentials(targetProfile.name);
    if (!credentials) {
        vscode.window.showErrorMessage(`No credentials found for profile '${targetProfile.name}'.`);
        return null;
    }

    const client = new CollectorsClient({
        accessId: credentials.accessId,
        accessKey: credentials.accessKey,
        endpoint: pm.getProfileEndpoint(targetProfile)
    });

    return { client, profile: targetProfile };
}

/**
 * Format collectors as HTML for webview display with filtering, sorting and export
 */
function formatCollectorsAsHTML(collectors: any[], profileName: string): string {
    // Serialize data for JavaScript
    const collectorsJson = JSON.stringify(collectors);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .header {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 18px;
            font-weight: 600;
        }
        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            flex-wrap: wrap;
            align-items: center;
        }
        .control-group {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .control-group label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        input, select, button {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 8px;
            font-size: 13px;
            font-family: var(--vscode-font-family);
        }
        input {
            min-width: 200px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            padding: 6px 12px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .stats {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 10px;
        }
        .stats span {
            margin-right: 15px;
        }
        .table-container {
            overflow: auto;
            max-height: calc(100vh - 200px);
            border: 1px solid var(--vscode-panel-border);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        thead {
            position: sticky;
            top: 0;
            background-color: var(--vscode-editor-background);
            z-index: 10;
        }
        th {
            text-align: left;
            padding: 8px;
            border-bottom: 2px solid var(--vscode-panel-border);
            font-weight: 600;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }
        th:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        th.sorted-asc::after {
            content: ' ▲';
            font-size: 10px;
        }
        th.sorted-desc::after {
            content: ' ▼';
            font-size: 10px;
        }
        td {
            padding: 6px 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .status-alive {
            color: #4ec9b0;
        }
        .status-dead {
            color: #f48771;
        }
        .action-btn {
            padding: 3px 8px;
            font-size: 11px;
            margin-right: 4px;
        }
        .pagination {
            margin-top: 15px;
            display: flex;
            gap: 10px;
            align-items: center;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Collectors - ${profileName}</h1>
        <div class="stats" id="stats"></div>
    </div>

    <div class="controls">
        <div class="control-group">
            <label>Filter:</label>
            <input type="text" id="filterInput" placeholder="Search by name, type, host...">
        </div>
        <div class="control-group">
            <label>Status:</label>
            <select id="statusFilter">
                <option value="all">All</option>
                <option value="alive">Alive</option>
                <option value="dead">Dead</option>
            </select>
        </div>
        <div class="control-group">
            <label>Type:</label>
            <select id="typeFilter">
                <option value="all">All Types</option>
            </select>
        </div>
        <button id="exportCsvBtn">Export CSV</button>
        <button id="exportJsonBtn">Export JSON</button>
    </div>

    <div class="table-container">
        <table id="collectorsTable">
            <thead>
                <tr>
                    <th data-sort="name">Name</th>
                    <th data-sort="collectorType">Type</th>
                    <th data-sort="hostName">Host</th>
                    <th data-sort="category">Category</th>
                    <th data-sort="alive">Status</th>
                    <th data-sort="lastSeenAlive">Last Seen</th>
                    <th data-sort="collectorVersion">Version</th>
                    <th data-sort="osName">OS</th>
                    <th data-sort="id">ID</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="tableBody">
            </tbody>
        </table>
    </div>

    <div class="pagination">
        <span id="recordInfo"></span>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let allCollectors = ${collectorsJson};
        let filteredCollectors = [...allCollectors];
        let sortColumn = null; // Start with null so first sort sets direction to 'asc'
        let sortDirection = 'asc';

        // Initialize type filter options
        const types = [...new Set(allCollectors.map(c => c.collectorType))].sort();
        const typeFilter = document.getElementById('typeFilter');
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeFilter.appendChild(option);
        });

        function formatLastSeen(timestamp) {
            if (!timestamp) return 'N/A';
            const now = Date.now();
            const diff = now - timestamp;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) return days + 'd ago';
            if (hours > 0) return hours + 'h ago';
            if (minutes > 0) return minutes + 'm ago';
            return 'Just now';
        }

        function updateStats() {
            const total = filteredCollectors.length;
            const alive = filteredCollectors.filter(c => c.alive).length;
            const dead = total - alive;
            const ephemeral = filteredCollectors.filter(c => c.ephemeral).length;

            document.getElementById('stats').innerHTML =
                '<span><strong>Total:</strong> ' + total + '</span>' +
                '<span><strong>Alive:</strong> ' + alive + '</span>' +
                '<span><strong>Dead:</strong> ' + dead + '</span>' +
                '<span><strong>Ephemeral:</strong> ' + ephemeral + '</span>';
        }

        function sortCollectors(column) {
            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortDirection = 'asc';
            }

            filteredCollectors.sort((a, b) => {
                let aVal = a[column];
                let bVal = b[column];

                // Handle null/undefined - convert to empty string for consistent sorting
                if (aVal == null || aVal === undefined) aVal = '';
                if (bVal == null || bVal === undefined) bVal = '';

                // Convert to string for comparison if needed
                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                } else {
                    aVal = String(aVal).toLowerCase();
                }

                if (typeof bVal === 'string') {
                    bVal = bVal.toLowerCase();
                } else {
                    bVal = String(bVal).toLowerCase();
                }

                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });

            renderTable();
        }

        function filterCollectors() {
            const searchText = document.getElementById('filterInput').value.toLowerCase();
            const statusFilter = document.getElementById('statusFilter').value;
            const typeFilterValue = document.getElementById('typeFilter').value;

            filteredCollectors = allCollectors.filter(collector => {
                // Text search
                const matchesSearch = !searchText ||
                    collector.name.toLowerCase().includes(searchText) ||
                    collector.collectorType.toLowerCase().includes(searchText) ||
                    (collector.hostName && collector.hostName.toLowerCase().includes(searchText)) ||
                    (collector.category && collector.category.toLowerCase().includes(searchText));

                // Status filter
                const matchesStatus = statusFilter === 'all' ||
                    (statusFilter === 'alive' && collector.alive) ||
                    (statusFilter === 'dead' && !collector.alive);

                // Type filter
                const matchesType = typeFilterValue === 'all' ||
                    collector.collectorType === typeFilterValue;

                return matchesSearch && matchesStatus && matchesType;
            });

            sortCollectors(sortColumn || 'name');
            updateStats();
        }

        function renderTable() {
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = '';

            // Update sort indicators
            document.querySelectorAll('th').forEach(th => {
                th.classList.remove('sorted-asc', 'sorted-desc');
                if (th.dataset.sort === sortColumn) {
                    th.classList.add('sorted-' + sortDirection);
                }
            });

            filteredCollectors.forEach(collector => {
                const row = document.createElement('tr');
                row.innerHTML =
                    '<td>' + collector.name + '</td>' +
                    '<td>' + collector.collectorType + '</td>' +
                    '<td>' + (collector.hostName || 'N/A') + '</td>' +
                    '<td>' + (collector.category || 'N/A') + '</td>' +
                    '<td class="' + (collector.alive ? 'status-alive' : 'status-dead') + '">' +
                        (collector.alive ? 'Alive' : 'Dead') + '</td>' +
                    '<td>' + formatLastSeen(collector.lastSeenAlive) + '</td>' +
                    '<td>' + (collector.collectorVersion || 'N/A') + '</td>' +
                    '<td>' + (collector.osName || 'N/A') + '</td>' +
                    '<td>' + collector.id + '</td>' +
                    '<td><button class="action-btn" data-collector-id="' + collector.id + '" data-collector-name="' + collector.name + '">Get Sources</button></td>';
                tbody.appendChild(row);
            });

            document.getElementById('recordInfo').textContent =
                'Showing ' + filteredCollectors.length + ' of ' + allCollectors.length + ' collectors';
        }

        function exportCSV() {
            const headers = ['Name', 'Type', 'Host', 'Category', 'Status', 'Last Seen', 'Version', 'OS', 'ID'];
            let csv = headers.join(',') + '\\n';

            filteredCollectors.forEach(c => {
                const row = [
                    '"' + c.name + '"',
                    '"' + c.collectorType + '"',
                    '"' + (c.hostName || '') + '"',
                    '"' + (c.category || '') + '"',
                    c.alive ? 'Alive' : 'Dead',
                    '"' + formatLastSeen(c.lastSeenAlive) + '"',
                    '"' + (c.collectorVersion || '') + '"',
                    '"' + (c.osName || '') + '"',
                    c.id
                ];
                csv += row.join(',') + '\\n';
            });

            vscode.postMessage({ command: 'exportCSV', csvData: csv });
        }

        function exportJSON() {
            const jsonData = JSON.stringify(filteredCollectors, null, 2);
            vscode.postMessage({ command: 'exportJSON', jsonData: jsonData });
        }

        function getSources(collectorId, collectorName) {
            vscode.postMessage({
                command: 'getSources',
                collectorId: collectorId,
                collectorName: collectorName
            });
        }

        // Event listeners
        document.getElementById('filterInput').addEventListener('input', filterCollectors);
        document.getElementById('statusFilter').addEventListener('change', filterCollectors);
        document.getElementById('typeFilter').addEventListener('change', filterCollectors);
        document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
        document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);

        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => sortCollectors(th.dataset.sort));
        });

        // Delegate event listener for dynamically created buttons
        document.getElementById('tableBody').addEventListener('click', (e) => {
            if (e.target.classList.contains('action-btn')) {
                const collectorId = e.target.getAttribute('data-collector-id');
                const collectorName = e.target.getAttribute('data-collector-name');
                getSources(collectorId, collectorName);
            }
        });

        // Initial render
        filterCollectors();
    </script>
</body>
</html>
    `;
}

/**
 * Format sources as HTML for webview display with filtering, sorting and export
 */
function formatSourcesAsHTML(sources: any[], collectorId: number, collectorName: string, profileName: string, savedFilePath?: string): string {
    // Serialize data for JavaScript
    const sourcesJson = JSON.stringify(sources);
    const filePathJson = savedFilePath ? JSON.stringify(savedFilePath) : 'null';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .header {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 18px;
            font-weight: 600;
        }
        .header .subtitle {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 10px;
        }
        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            flex-wrap: wrap;
            align-items: center;
        }
        .control-group {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .control-group label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        input, select, button {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 8px;
            font-size: 13px;
            font-family: var(--vscode-font-family);
        }
        input {
            min-width: 200px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            padding: 6px 12px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .stats {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 10px;
        }
        .stats span {
            margin-right: 15px;
        }
        .file-link {
            margin-bottom: 15px;
            padding: 8px 12px;
            background-color: var(--vscode-textCodeBlock-background);
            border-radius: 3px;
            font-size: 12px;
        }
        .file-link a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        .file-link a:hover {
            text-decoration: underline;
        }
        .table-container {
            overflow: auto;
            max-height: calc(100vh - 300px);
            border: 1px solid var(--vscode-panel-border);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        thead {
            position: sticky;
            top: 0;
            background-color: var(--vscode-editor-background);
            z-index: 10;
        }
        th {
            text-align: left;
            padding: 8px;
            border-bottom: 2px solid var(--vscode-panel-border);
            font-weight: 600;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }
        th:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        th.sorted-asc::after {
            content: ' ▲';
            font-size: 10px;
        }
        th.sorted-desc::after {
            content: ' ▼';
            font-size: 10px;
        }
        td {
            padding: 6px 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .status-alive {
            color: #4ec9b0;
        }
        .status-dead {
            color: #f48771;
        }
        .pagination {
            margin-top: 15px;
            display: flex;
            gap: 10px;
            align-items: center;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Sources for Collector: ${collectorName}</h1>
        <div class="subtitle">Collector ID: ${collectorId} | Profile: ${profileName}</div>
        <div class="stats" id="stats"></div>
    </div>

    ${savedFilePath ? `<div class="file-link" id="fileLink">
        📄 Saved to: <a href="#" onclick="openFile(); return false;">${savedFilePath}</a>
    </div>` : ''}

    <div class="controls">
        <div class="control-group">
            <label>Filter:</label>
            <input type="text" id="filterInput" placeholder="Search by name, type, category...">
        </div>
        <div class="control-group">
            <label>Status:</label>
            <select id="statusFilter">
                <option value="all">All</option>
                <option value="alive">Alive</option>
                <option value="dead">Dead</option>
            </select>
        </div>
        <div class="control-group">
            <label>Type:</label>
            <select id="typeFilter">
                <option value="all">All Types</option>
            </select>
        </div>
        <button id="exportCsvBtn">Export CSV</button>
        <button id="exportJsonBtn">Export JSON</button>
    </div>

    <div class="table-container">
        <table id="sourcesTable">
            <thead>
                <tr>
                    <th data-sort="name">Name</th>
                    <th data-sort="sourceType">Type</th>
                    <th data-sort="category">Category</th>
                    <th data-sort="alive">Status</th>
                    <th data-sort="automaticDateParsing">Auto Date Parse</th>
                    <th data-sort="multilineProcessingEnabled">Multiline</th>
                    <th data-sort="id">ID</th>
                </tr>
            </thead>
            <tbody id="tableBody">
            </tbody>
        </table>
    </div>

    <div class="pagination">
        <span id="recordInfo"></span>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let allSources = ${sourcesJson};
        let filteredSources = [...allSources];
        let sortColumn = 'name';
        let sortDirection = 'asc';
        const savedFilePath = ${filePathJson};

        // Initialize type filter options
        const types = [...new Set(allSources.map(s => s.sourceType))].sort();
        const typeFilter = document.getElementById('typeFilter');
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeFilter.appendChild(option);
        });

        function openFile() {
            if (savedFilePath) {
                vscode.postMessage({ command: 'openFile', filePath: savedFilePath });
            }
        }

        function updateStats() {
            const total = filteredSources.length;
            const alive = filteredSources.filter(s => s.alive).length;
            const dead = total - alive;

            document.getElementById('stats').innerHTML =
                '<span><strong>Total:</strong> ' + total + '</span>' +
                '<span><strong>Alive:</strong> ' + alive + '</span>' +
                '<span><strong>Dead:</strong> ' + dead + '</span>';
        }

        function sortSources(column) {
            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortDirection = 'asc';
            }

            filteredSources.sort((a, b) => {
                let aVal = a[column];
                let bVal = b[column];

                // Handle null/undefined - convert to empty string for consistent sorting
                if (aVal == null || aVal === undefined) aVal = '';
                if (bVal == null || bVal === undefined) bVal = '';

                // Convert to string for comparison if needed
                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                } else {
                    aVal = String(aVal).toLowerCase();
                }

                if (typeof bVal === 'string') {
                    bVal = bVal.toLowerCase();
                } else {
                    bVal = String(bVal).toLowerCase();
                }

                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });

            renderTable();
        }

        function filterSources() {
            const searchText = document.getElementById('filterInput').value.toLowerCase();
            const statusFilter = document.getElementById('statusFilter').value;
            const typeFilterValue = document.getElementById('typeFilter').value;

            filteredSources = allSources.filter(source => {
                // Text search
                const matchesSearch = !searchText ||
                    source.name.toLowerCase().includes(searchText) ||
                    source.sourceType.toLowerCase().includes(searchText) ||
                    (source.category && source.category.toLowerCase().includes(searchText));

                // Status filter
                const matchesStatus = statusFilter === 'all' ||
                    (statusFilter === 'alive' && source.alive) ||
                    (statusFilter === 'dead' && !source.alive);

                // Type filter
                const matchesType = typeFilterValue === 'all' ||
                    source.sourceType === typeFilterValue;

                return matchesSearch && matchesStatus && matchesType;
            });

            sortSources(sortColumn);
            updateStats();
        }

        function renderTable() {
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = '';

            // Update sort indicators
            document.querySelectorAll('th').forEach(th => {
                th.classList.remove('sorted-asc', 'sorted-desc');
                if (th.dataset.sort === sortColumn) {
                    th.classList.add('sorted-' + sortDirection);
                }
            });

            filteredSources.forEach(source => {
                const row = document.createElement('tr');
                row.innerHTML =
                    '<td>' + source.name + '</td>' +
                    '<td>' + source.sourceType + '</td>' +
                    '<td>' + (source.category || 'N/A') + '</td>' +
                    '<td class="' + (source.alive ? 'status-alive' : 'status-dead') + '">' +
                        (source.alive ? 'Alive' : 'Dead') + '</td>' +
                    '<td>' + (source.automaticDateParsing ? 'Yes' : 'No') + '</td>' +
                    '<td>' + (source.multilineProcessingEnabled ? 'Yes' : 'No') + '</td>' +
                    '<td>' + source.id + '</td>';
                tbody.appendChild(row);
            });

            document.getElementById('recordInfo').textContent =
                'Showing ' + filteredSources.length + ' of ' + allSources.length + ' sources';
        }

        function exportCSV() {
            const headers = ['Name', 'Type', 'Category', 'Status', 'Auto Date Parse', 'Multiline', 'ID'];
            let csv = headers.join(',') + '\\n';

            filteredSources.forEach(s => {
                const row = [
                    '"' + s.name + '"',
                    '"' + s.sourceType + '"',
                    '"' + (s.category || '') + '"',
                    s.alive ? 'Alive' : 'Dead',
                    s.automaticDateParsing ? 'Yes' : 'No',
                    s.multilineProcessingEnabled ? 'Yes' : 'No',
                    s.id
                ];
                csv += row.join(',') + '\\n';
            });

            vscode.postMessage({ command: 'exportCSV', csvData: csv });
        }

        function exportJSON() {
            const jsonData = JSON.stringify(filteredSources, null, 2);
            vscode.postMessage({ command: 'exportJSON', jsonData: jsonData });
        }

        // Event listeners
        document.getElementById('filterInput').addEventListener('input', filterSources);
        document.getElementById('statusFilter').addEventListener('change', filterSources);
        document.getElementById('typeFilter').addEventListener('change', filterSources);
        document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
        document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);

        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => sortSources(th.dataset.sort));
        });

        // Initial render
        filterSources();
    </script>
</body>
</html>
    `;
}

/**
 * Command to fetch collectors and save to file
 */
export async function fetchCollectorsCommand(context: vscode.ExtensionContext, profileName?: string, outputType: 'file' | 'webview' = 'webview'): Promise<void> {
    const result = await createCollectorsClient(context, profileName);
    if (!result) {
        return;
    }

    const { client, profile } = result;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Fetching collectors from Sumo Logic (${profile.name})...`,
        cancellable: false
    }, async (progress) => {
        // Fetch all collectors with automatic pagination
        const response = await client.fetchAllCollectors();

        if (response.error) {
            // Check if it's a permission error
            if (response.statusCode === 403 || response.statusCode === 401) {
                vscode.window.showWarningMessage(
                    'Unable to fetch collectors: Insufficient permissions. ' +
                    'Your user role may not have "Manage or View Collectors" capability.'
                );
            } else {
                vscode.window.showErrorMessage(`Failed to fetch collectors: ${response.error}`);
            }
            return;
        }

        if (!response.data || !response.data.collectors) {
            vscode.window.showWarningMessage('No collectors returned from API.');
            return;
        }

        const collectors = response.data.collectors;

        if (collectors.length === 0) {
            vscode.window.showInformationMessage('No collectors found in this organization.');
            return;
        }

        // Sort by name ascending - handle undefined/null names
        collectors.sort((a, b) => {
            const aName = a.name || '';
            const bName = b.name || '';
            return aName.localeCompare(bName);
        });

        // Get statistics
        const stats = CollectorsClient.getCollectorStats(collectors);

        if (outputType === 'webview') {
            // Create webview panel
            const panel = vscode.window.createWebviewPanel(
                'sumoCollectors',
                `Collectors - ${profile.name}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            const htmlContent = formatCollectorsAsHTML(collectors, profile.name);
            panel.webview.html = htmlContent;

            // Handle messages from webview
            panel.webview.onDidReceiveMessage(
                async (message) => {
                    const fs = await import('fs');
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    const defaultUri = workspaceFolder
                        ? vscode.Uri.file(workspaceFolder.uri.fsPath)
                        : undefined;

                    if (message.command === 'exportCSV') {
                        // Prompt user for save location
                        const uri = await vscode.window.showSaveDialog({
                            defaultUri: defaultUri,
                            filters: {
                                'CSV Files': ['csv'],
                                'All Files': ['*']
                            },
                            saveLabel: 'Export CSV'
                        });

                        if (uri) {
                            fs.writeFileSync(uri.fsPath, message.csvData, 'utf-8');
                            vscode.window.showInformationMessage(`CSV exported to ${uri.fsPath}`);
                        }
                    } else if (message.command === 'exportJSON') {
                        // Prompt user for save location
                        const uri = await vscode.window.showSaveDialog({
                            defaultUri: defaultUri,
                            filters: {
                                'JSON Files': ['json'],
                                'All Files': ['*']
                            },
                            saveLabel: 'Export JSON'
                        });

                        if (uri) {
                            fs.writeFileSync(uri.fsPath, message.jsonData, 'utf-8');
                            vscode.window.showInformationMessage(`JSON exported to ${uri.fsPath}`);
                        }
                    } else if (message.command === 'getSources') {
                        // Call getSources command with collector ID and name
                        await getSourcesCommand(context, parseInt(message.collectorId, 10), message.collectorName);
                    }
                },
                undefined,
                context.subscriptions
            );

            vscode.window.showInformationMessage(
                `Found ${collectors.length} collectors (${stats.alive} alive, ${stats.dead} dead).`
            );
        } else {
            // Original file output
            // Format as table
            const tableText = CollectorsClient.formatCollectorsAsTable(collectors);

            // Build statistics text
            let statsText = `Statistics:\n`;
            statsText += `  Total Collectors: ${stats.total}\n`;
            statsText += `  Alive: ${stats.alive}\n`;
            statsText += `  Dead: ${stats.dead}\n`;
            statsText += `  Ephemeral: ${stats.ephemeral}\n`;
            statsText += `  By Type:\n`;
            Object.entries(stats.byType).forEach(([type, count]) => {
                statsText += `    ${type}: ${count}\n`;
            });

            const outputText = `Sumo Logic Collectors (${profile.name})\n` +
                              `=========================================\n` +
                              `Total: ${collectors.length} collectors\n` +
                              `\n` +
                              `${statsText}\n` +
                              tableText;

            // Write to file
            const outputWriter = new OutputWriter(context);
            const filename = `collectors_${profile.name}`;

            try {
                await outputWriter.writeAndOpen('collectors', filename, outputText, 'txt');
                vscode.window.showInformationMessage(
                    `Found ${collectors.length} collectors (${stats.alive} alive, ${stats.dead} dead).`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to write collectors data: ${error}`);
            }
        }
    });
}

/**
 * Command to get a collector by ID
 */
export async function getCollectorCommand(context: vscode.ExtensionContext, profileName?: string): Promise<void> {
    const result = await createCollectorsClient(context, profileName);
    if (!result) {
        return;
    }

    const { client, profile } = result;

    // Prompt user for collector ID
    const collectorIdInput = await vscode.window.showInputBox({
        prompt: 'Enter Collector ID',
        placeHolder: '12345678',
        validateInput: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num <= 0) {
                return 'Please enter a valid positive number';
            }
            return null;
        }
    });

    if (!collectorIdInput) {
        return;
    }

    const collectorId = parseInt(collectorIdInput, 10);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Fetching collector ${collectorId}...`,
        cancellable: false
    }, async (progress) => {
        const response = await client.getCollector(collectorId);

        if (response.error) {
            if (response.statusCode === 403 || response.statusCode === 401) {
                vscode.window.showWarningMessage(
                    'Unable to fetch collector: Insufficient permissions. ' +
                    'Your user role may not have "Manage or View Collectors" capability.'
                );
            } else if (response.statusCode === 404) {
                vscode.window.showErrorMessage(`Collector ${collectorId} not found.`);
            } else {
                vscode.window.showErrorMessage(`Failed to fetch collector: ${response.error}`);
            }
            return;
        }

        if (!response.data || !response.data.collector) {
            vscode.window.showWarningMessage('No collector data returned from API.');
            return;
        }

        const collector = response.data.collector;

        // Format as JSON
        const outputText = JSON.stringify(collector, null, 2);

        // Write to file
        const outputWriter = new OutputWriter(context);
        const filename = `collector_${collectorId}_${profile.name}`;

        try {
            await outputWriter.writeAndOpen('collectors', filename, outputText, 'json');
            vscode.window.showInformationMessage(
                `Collector: ${collector.name} (ID: ${collector.id}, Type: ${collector.collectorType})`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write collector data: ${error}`);
        }
    });
}

/**
 * Command to get sources for a collector
 */
export async function getSourcesCommand(context: vscode.ExtensionContext, collectorIdParam?: number, collectorNameParam?: string, outputType: 'file' | 'webview' = 'webview', profileName?: string): Promise<void> {
    const result = await createCollectorsClient(context, profileName);
    if (!result) {
        return;
    }

    const { client, profile } = result;

    let collectorId: number;
    let collectorName: string = 'Unknown';

    // If collector ID is not provided as parameter, prompt user
    if (collectorIdParam === undefined) {
        const collectorIdInput = await vscode.window.showInputBox({
            prompt: 'Enter Collector ID to fetch sources',
            placeHolder: '12345678',
            validateInput: (value) => {
                const num = parseInt(value, 10);
                if (isNaN(num) || num <= 0) {
                    return 'Please enter a valid positive number';
                }
                return null;
            }
        });

        if (!collectorIdInput) {
            return;
        }

        collectorId = parseInt(collectorIdInput, 10);
    } else {
        collectorId = collectorIdParam;
        collectorName = collectorNameParam || 'Unknown';
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Fetching sources for collector ${collectorId}...`,
        cancellable: false
    }, async (progress) => {
        const response = await client.fetchAllSources(collectorId);

        if (response.error) {
            if (response.statusCode === 403 || response.statusCode === 401) {
                vscode.window.showWarningMessage(
                    'Unable to fetch sources: Insufficient permissions. ' +
                    'Your user role may not have "Manage or View Collectors" capability.'
                );
            } else if (response.statusCode === 404) {
                vscode.window.showErrorMessage(`Collector ${collectorId} not found.`);
            } else {
                vscode.window.showErrorMessage(`Failed to fetch sources: ${response.error}`);
            }
            return;
        }

        if (!response.data || !response.data.sources) {
            vscode.window.showWarningMessage('No sources returned from API.');
            return;
        }

        const sources = response.data.sources;

        if (sources.length === 0) {
            vscode.window.showInformationMessage(`No sources found for collector ${collectorId}.`);
            return;
        }

        // Sort by name ascending - handle undefined/null names
        sources.sort((a, b) => {
            const aName = a.name || '';
            const bName = b.name || '';
            return aName.localeCompare(bName);
        });

        // Count alive vs dead sources
        const aliveCount = sources.filter(s => s.alive).length;
        const deadCount = sources.length - aliveCount;

        // Always save to file first
        const outputWriter = new OutputWriter(context);
        const filename = `collector_${collectorId}_sources_${profile.name}`;
        const outputText = JSON.stringify(sources, null, 2);

        let savedFilePath: string | undefined;
        try {
            savedFilePath = await outputWriter.writeOutput('collectors', filename, outputText, 'json');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write sources data: ${error}`);
            return;
        }

        if (outputType === 'webview') {
            // Create webview panel
            const panel = vscode.window.createWebviewPanel(
                'sumoSources',
                `Sources - ${collectorName} (${collectorId})`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            const htmlContent = formatSourcesAsHTML(sources, collectorId, collectorName, profile.name, savedFilePath);
            panel.webview.html = htmlContent;

            // Handle messages from webview
            panel.webview.onDidReceiveMessage(
                async (message) => {
                    const fs = await import('fs');
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    const defaultUri = workspaceFolder
                        ? vscode.Uri.file(workspaceFolder.uri.fsPath)
                        : undefined;

                    if (message.command === 'exportCSV') {
                        // Prompt user for save location
                        const uri = await vscode.window.showSaveDialog({
                            defaultUri: defaultUri,
                            filters: {
                                'CSV Files': ['csv'],
                                'All Files': ['*']
                            },
                            saveLabel: 'Export CSV'
                        });

                        if (uri) {
                            fs.writeFileSync(uri.fsPath, message.csvData, 'utf-8');
                            vscode.window.showInformationMessage(`CSV exported to ${uri.fsPath}`);
                        }
                    } else if (message.command === 'exportJSON') {
                        // Prompt user for save location
                        const uri = await vscode.window.showSaveDialog({
                            defaultUri: defaultUri,
                            filters: {
                                'JSON Files': ['json'],
                                'All Files': ['*']
                            },
                            saveLabel: 'Export JSON'
                        });

                        if (uri) {
                            fs.writeFileSync(uri.fsPath, message.jsonData, 'utf-8');
                            vscode.window.showInformationMessage(`JSON exported to ${uri.fsPath}`);
                        }
                    } else if (message.command === 'openFile') {
                        // Open the saved file
                        const uri = vscode.Uri.file(message.filePath);
                        await vscode.window.showTextDocument(uri);
                    }
                },
                undefined,
                context.subscriptions
            );

            vscode.window.showInformationMessage(
                `Found ${sources.length} sources for collector ${collectorId} (${aliveCount} alive, ${deadCount} dead).`
            );
        } else {
            // Original file output - just open the file
            try {
                const document = await vscode.workspace.openTextDocument(savedFilePath);
                await vscode.window.showTextDocument(document, { preview: false });
                vscode.window.showInformationMessage(
                    `Found ${sources.length} sources for collector ${collectorId} (${aliveCount} alive, ${deadCount} dead).`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open sources file: ${error}`);
            }
        }
    });
}

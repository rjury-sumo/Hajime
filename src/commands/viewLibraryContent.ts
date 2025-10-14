import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager } from '../profileManager';
import { formatContentId } from '../utils/contentId';
import { ContentClient } from '../api/content';
import { createLibraryCacheDB } from '../database/libraryCache';

/**
 * Command to view library content in a webview
 */
export async function viewLibraryContentCommand(
    context: vscode.ExtensionContext,
    profileName: string,
    contentId: string,
    contentName: string
): Promise<void> {
    const profileManager = new ProfileManager(context);
    const contentDir = profileManager.getProfileLibraryContentDirectory(profileName);
    const filePath = path.join(contentDir, `${contentId}.json`);

    let content: any;

    // Check if the content file exists
    if (!fs.existsSync(filePath)) {
        // Content not cached - fetch it from API
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Fetching ${contentName}...`,
            cancellable: false
        }, async () => {
            return await fetchAndCacheContent(context, profileName, contentId);
        });

        if (!result.success) {
            vscode.window.showErrorMessage(`Failed to fetch content: ${result.error}`);
            return;
        }

        content = result.data;
    } else {
        // Read from cache
        content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    // Get library path from database
    const profileDir = profileManager.getProfileDirectory(profileName);
    const db = createLibraryCacheDB(profileDir, profileName);
    const pathItems = db.getContentPath(contentId);
    const libraryPath = pathItems.length > 0 ? '/' + pathItems.map(p => p.name).join('/') : '';
    db.close();

    // Create and show webview
    const panel = vscode.window.createWebviewPanel(
        'sumoLibraryContent',
        `📚 ${contentName}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    panel.webview.html = getWebviewContent(content, contentName, contentId, libraryPath);
}

/**
 * Fetch content from API and cache it
 */
async function fetchAndCacheContent(
    context: vscode.ExtensionContext,
    profileName: string,
    contentId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
    const profileManager = new ProfileManager(context);

    // Get profile
    const profiles = await profileManager.getProfiles();
    const profile = profiles.find(p => p.name === profileName);
    if (!profile) {
        return { success: false, error: `Profile not found: ${profileName}` };
    }

    // Get credentials
    const credentials = await profileManager.getProfileCredentials(profileName);
    if (!credentials) {
        return { success: false, error: `No credentials for profile: ${profileName}` };
    }

    // Create content client
    const client = new ContentClient({
        accessId: credentials.accessId,
        accessKey: credentials.accessKey,
        endpoint: profileManager.getProfileEndpoint(profile)
    });

    // Export the content
    const response = await client.exportContent(contentId);
    if (response.error || !response.data) {
        return { success: false, error: response.error || 'Unknown error' };
    }

    // Save to cache
    const contentDir = profileManager.getProfileLibraryContentDirectory(profileName);
    if (!fs.existsSync(contentDir)) {
        fs.mkdirSync(contentDir, { recursive: true });
    }

    const filePath = path.join(contentDir, `${contentId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(response.data, null, 2), 'utf-8');

    return { success: true, data: response.data };
}

/**
 * Generate specialized webview content for dashboards
 */
function getDashboardWebviewContent(content: any, contentName: string, contentId: string, formattedId: string, libraryPath: string): string {
    // Top-level string properties to display at the top
    const topLevelProps = ['name', 'description', 'title', 'theme', 'type'];

    // Extract all queries from panels
    const queries: any[] = [];
    if (content.panels && Array.isArray(content.panels)) {
        content.panels.forEach((panel: any) => {
            if (panel.queries && Array.isArray(panel.queries)) {
                panel.queries.forEach((query: any) => {
                    queries.push({
                        panelName: panel.title || 'Untitled Panel',
                        panelKey: panel.key,
                        queryKey: query.queryKey,
                        queryType: query.queryType,
                        queryString: query.queryString,
                        parseMode: query.parseMode,
                        timeSource: query.timeSource
                    });
                });
            }
        });
    }

    // Sort panels by title
    if (content.panels && Array.isArray(content.panels)) {
        content.panels.sort((a: any, b: any) => {
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();
            return titleA.localeCompare(titleB);
        });
    }

    // Sort queries by panel name, then query key
    queries.sort((a, b) => {
        const panelCompare = a.panelName.localeCompare(b.panelName);
        if (panelCompare !== 0) return panelCompare;
        return (a.queryKey || '').localeCompare(b.queryKey || '');
    });

    // Escape HTML function
    const escapeHtml = (str: string) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    // Generate top-level properties HTML
    const topPropsHtml = topLevelProps
        .filter(prop => content[prop])
        .map(prop => `
            <div class="property-row">
                <span class="property-label">${prop}:</span>
                <span class="property-value">${escapeHtml(content[prop])}</span>
            </div>
        `).join('');

    // Generate variables table HTML
    const variablesHtml = content.variables && content.variables.length > 0 ? `
        <h2>Variables (${content.variables.length})</h2>
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Display Name</th>
                        <th>Default Value</th>
                        <th>Allow Multi-Select</th>
                        <th>Source Definition</th>
                    </tr>
                </thead>
                <tbody>
                    ${content.variables.map((v: any) => `
                        <tr>
                            <td>${escapeHtml(v.name)}</td>
                            <td>${escapeHtml(v.displayName)}</td>
                            <td>${escapeHtml(v.defaultValue)}</td>
                            <td>${v.allowMultiSelect ? 'Yes' : 'No'}</td>
                            <td class="truncate" title="${escapeHtml(JSON.stringify(v.sourceDefinition))}">${escapeHtml(JSON.stringify(v.sourceDefinition))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : '';

    // Generate panels table HTML
    const panelsHtml = content.panels && content.panels.length > 0 ? `
        <h2>Panels (${content.panels.length})</h2>
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Key</th>
                        <th>Queries</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    ${content.panels.map((p: any) => `
                        <tr>
                            <td>${escapeHtml(p.title)}</td>
                            <td>${escapeHtml(p.panelType)}</td>
                            <td class="monospace">${escapeHtml(p.key)}</td>
                            <td>${p.queries ? p.queries.length : 0}</td>
                            <td>${escapeHtml(p.description) || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : '';

    // Generate queries table HTML
    const queriesHtml = queries.length > 0 ? `
        <h2>Queries (${queries.length})</h2>
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Panel Name</th>
                        <th>Query Key</th>
                        <th>Type</th>
                        <th>Parse Mode</th>
                        <th>Time Source</th>
                        <th>Query String</th>
                    </tr>
                </thead>
                <tbody>
                    ${queries.map((q: any) => `
                        <tr>
                            <td>${escapeHtml(q.panelName)}</td>
                            <td class="monospace">${escapeHtml(q.queryKey)}</td>
                            <td>${escapeHtml(q.queryType)}</td>
                            <td>${escapeHtml(q.parseMode)}</td>
                            <td>${escapeHtml(q.timeSource)}</td>
                            <td class="query-cell"><pre>${escapeHtml(q.queryString)}</pre></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : '';

    // Other properties to show at the bottom
    const excludeProps = [...topLevelProps, 'variables', 'panels', 'layout'];
    const otherPropsHtml = Object.entries(content)
        .filter(([key]) => !excludeProps.includes(key))
        .map(([key, value]) => `
            <div class="property-card">
                <div class="property-card-name">${escapeHtml(key)}</div>
                <div class="property-card-type">${typeof value}</div>
                <pre class="property-card-value">${escapeHtml(JSON.stringify(value, null, 2))}</pre>
            </div>
        `).join('');

    // Format full JSON for raw view
    const jsonFormatted = JSON.stringify(content, null, 2);
    const jsonEscaped = escapeHtml(jsonFormatted);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(contentName)}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }

        h1 {
            color: var(--vscode-editor-foreground);
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            margin-bottom: 20px;
        }

        h2 {
            color: var(--vscode-editor-foreground);
            margin-top: 30px;
            margin-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 5px;
        }

        .header-info {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .top-properties {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }

        .property-row {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 10px;
            margin-bottom: 8px;
        }

        .property-label {
            font-weight: bold;
            color: var(--vscode-descriptionForeground);
        }

        .property-value {
            color: var(--vscode-foreground);
        }

        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 15px;
            margin-top: 20px;
        }

        .tab {
            padding: 10px 20px;
            cursor: pointer;
            border: none;
            background: none;
            color: var(--vscode-foreground);
            font-size: 14px;
            border-bottom: 2px solid transparent;
        }

        .tab:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .tab.active {
            border-bottom-color: var(--vscode-focusBorder);
            font-weight: bold;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .table-wrapper {
            overflow-x: auto;
            margin-bottom: 20px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        th {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 10px;
            text-align: left;
            font-weight: bold;
            border-bottom: 2px solid var(--vscode-panel-border);
            position: sticky;
            top: 0;
        }

        td {
            padding: 8px 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            vertical-align: top;
        }

        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .monospace {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }

        .truncate {
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .query-cell {
            max-width: 600px;
        }

        .query-cell pre {
            margin: 0;
            padding: 5px;
            background-color: var(--vscode-textCodeBlock-background);
            border-radius: 3px;
            overflow-x: auto;
            font-size: 11px;
            line-height: 1.4;
            white-space: pre-wrap;
        }

        .property-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 10px;
        }

        .property-card-name {
            font-weight: bold;
            margin-bottom: 5px;
            color: var(--vscode-symbolIcon-variableForeground);
        }

        .property-card-type {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-bottom: 5px;
        }

        .property-card-value {
            margin: 0;
            padding: 8px;
            background-color: var(--vscode-textCodeBlock-background);
            border-radius: 3px;
            overflow-x: auto;
            font-size: 11px;
            line-height: 1.4;
        }

        pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
            line-height: 1.5;
        }

        code {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-textPreformat-foreground);
        }
    </style>
</head>
<body>
    <h1>📊 ${escapeHtml(contentName)}</h1>

    <div class="header-info">
        <strong>ID:</strong> ${formattedId}
        ${libraryPath ? ` | <strong>Path:</strong> ${escapeHtml(libraryPath)}` : ''}
        ${content.itemType ? ` | <strong>Type:</strong> ${escapeHtml(content.itemType)}` : ''}
    </div>

    <div class="top-properties">
        ${topPropsHtml}
    </div>

    ${variablesHtml}
    ${panelsHtml}
    ${queriesHtml}

    <div class="tabs">
        <button class="tab active" onclick="showTab('other')">Other Properties</button>
        <button class="tab" onclick="showTab('raw')">Raw JSON</button>
    </div>

    <div id="other" class="tab-content active">
        ${otherPropsHtml}
    </div>

    <div id="raw" class="tab-content">
        <pre><code>${jsonEscaped}</code></pre>
    </div>

    <script>
        function showTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });

            // Show selected tab content
            document.getElementById(tabName).classList.add('active');

            // Add active class to clicked tab
            event.target.classList.add('active');
        }
    </script>
</body>
</html>`;
}

function getWebviewContent(content: any, contentName: string, contentId: string, libraryPath: string): string {
    const formattedId = formatContentId(contentId);

    // Check if this is a dashboard
    // Note: In folder listings, dashboards have itemType: "Dashboard"
    // In exported JSON, they have type: "DashboardV2SyncDefinition"
    const isDashboard = content.type === 'DashboardV2SyncDefinition' ||
                       content.itemType === 'Dashboard' ||
                       content.itemType === 'DashboardV2SyncDefinition';

    console.log(`[viewLibraryContent] Content type: ${content.type}, itemType: ${content.itemType}, isDashboard: ${isDashboard}`);

    if (isDashboard) {
        return getDashboardWebviewContent(content, contentName, contentId, formattedId, libraryPath);
    }

    // Format the JSON for display
    const jsonFormatted = JSON.stringify(content, null, 2);
    const jsonEscaped = jsonFormatted
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${contentName}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }

        h1 {
            color: var(--vscode-editor-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            margin-bottom: 20px;
        }

        .header-info {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 10px 20px;
            margin-bottom: 20px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 4px;
        }

        .label {
            font-weight: bold;
            color: var(--vscode-descriptionForeground);
        }

        .value {
            color: var(--vscode-foreground);
            word-break: break-word;
        }

        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 15px;
        }

        .tab {
            padding: 10px 20px;
            cursor: pointer;
            border: none;
            background: none;
            color: var(--vscode-foreground);
            font-size: 14px;
            border-bottom: 2px solid transparent;
        }

        .tab:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .tab.active {
            border-bottom-color: var(--vscode-focusBorder);
            font-weight: bold;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 13px;
            line-height: 1.5;
        }

        code {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-textPreformat-foreground);
        }

        .description {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 10px 15px;
            margin: 15px 0;
        }

        .properties {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }

        .property-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 12px;
            border-radius: 4px;
        }

        .property-card .name {
            font-weight: bold;
            margin-bottom: 5px;
            color: var(--vscode-symbolIcon-variableForeground);
        }

        .property-card .type {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        .children-list {
            list-style: none;
            padding: 0;
        }

        .children-list li {
            padding: 8px 12px;
            margin: 4px 0;
            background-color: var(--vscode-list-inactiveSelectionBackground);
            border-radius: 3px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .children-list li:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .item-type {
            font-size: 11px;
            padding: 2px 8px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <h1>📚 ${contentName}</h1>

    <div class="header-info">
        <span class="label">ID:</span>
        <span class="value">${formattedId}</span>

        ${libraryPath ? `
            <span class="label">Path:</span>
            <span class="value">${libraryPath}</span>
        ` : ''}

        <span class="label">Type:</span>
        <span class="value">${content.itemType || 'Unknown'}</span>

        ${content.createdAt ? `
            <span class="label">Created:</span>
            <span class="value">${new Date(content.createdAt).toLocaleString()}</span>
        ` : ''}

        ${content.modifiedAt ? `
            <span class="label">Modified:</span>
            <span class="value">${new Date(content.modifiedAt).toLocaleString()}</span>
        ` : ''}
    </div>

    ${content.description ? `
        <div class="description">
            <strong>Description:</strong> ${content.description}
        </div>
    ` : ''}

    <div class="tabs">
        <button class="tab active" onclick="showTab('overview')">Overview</button>
        <button class="tab" onclick="showTab('raw')">Raw JSON</button>
        ${content.children && content.children.length > 0 ? '<button class="tab" onclick="showTab(\'children\')">Children</button>' : ''}
    </div>

    <div id="overview" class="tab-content active">
        <div class="properties">
            ${Object.entries(content)
                .filter(([key]) => !['children', 'permissions'].includes(key))
                .map(([key, value]) => `
                    <div class="property-card">
                        <div class="name">${key}</div>
                        <div class="type">${typeof value}</div>
                        <div class="value">${typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</div>
                    </div>
                `)
                .join('')}
        </div>
    </div>

    <div id="raw" class="tab-content">
        <pre><code>${jsonEscaped}</code></pre>
    </div>

    ${content.children && content.children.length > 0 ? `
        <div id="children" class="tab-content">
            <h3>${content.children.length} Children</h3>
            <ul class="children-list">
                ${content.children
                    .map((child: any) => `
                        <li>
                            <span>${child.name}</span>
                            <span class="item-type">${child.itemType}</span>
                        </li>
                    `)
                    .join('')}
            </ul>
        </div>
    ` : ''}

    <script>
        function showTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });

            // Show selected tab content
            document.getElementById(tabName).classList.add('active');

            // Add active class to clicked tab
            event.target.classList.add('active');
        }
    </script>
</body>
</html>`;
}

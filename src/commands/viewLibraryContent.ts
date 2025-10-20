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

    // Get library path from database and enrich with user emails
    const profileDir = profileManager.getProfileDirectory(profileName);
    const db = createLibraryCacheDB(profileDir, profileName);
    const pathItems = db.getContentPath(contentId);
    const libraryPath = pathItems.length > 0 ? '/' + pathItems.map(p => p.name).join('/') : '';

    // Try to enrich createdBy and modifiedBy with user emails
    let createdByEmail: string | undefined;
    let modifiedByEmail: string | undefined;

    try {
        // Check if users_roles database exists
        const usersRolesDbPath = path.join(profileDir, 'metadata', 'users_roles.db');

        if (fs.existsSync(usersRolesDbPath)) {
            // Attach the users_roles database
            (db as any).db.prepare(`ATTACH DATABASE ? AS users_db`).run(usersRolesDbPath);

            if (content.createdBy) {
                const userStmt = (db as any).db.prepare(`
                    SELECT email FROM users_db.users WHERE id = ? AND profile = ?
                `);
                const userRow = userStmt.get(content.createdBy, profileName);
                if (userRow) {
                    createdByEmail = userRow.email;
                }
            }

            if (content.modifiedBy) {
                const userStmt = (db as any).db.prepare(`
                    SELECT email FROM users_db.users WHERE id = ? AND profile = ?
                `);
                const userRow = userStmt.get(content.modifiedBy, profileName);
                if (userRow) {
                    modifiedByEmail = userRow.email;
                }
            }

            // Detach the database
            (db as any).db.prepare(`DETACH DATABASE users_db`).run();
        }
    } catch (error) {
        // Silently fail if users database doesn't exist or query fails
        console.log('Could not enrich user data:', error);
    }

    db.close();

    // Track this as recently opened content
    const contentType = content.type || content.itemType || 'Unknown';
    const { RecentContentManager } = require('../recentContentManager');
    const recentContentManager = new RecentContentManager(context);
    recentContentManager.addContent(filePath, contentId, contentName, contentType, profileName);

    // Refresh the explorer to show the new recent item
    vscode.commands.executeCommand('sumologic.refreshExplorer');

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

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.type) {
            case 'extractSearch':
                await vscode.commands.executeCommand(
                    'sumologic.extractSearchToFile',
                    profileName,
                    contentId,
                    contentName,
                    content
                );
                break;
            case 'refreshContent':
                await refreshDashboardContent(context, profileName, message.dashboardId, message.contentId, panel);
                break;
            case 'openDashboardInUI':
                await openDashboardInUI(context, profileName, message.dashboardId);
                break;
            case 'openFolderInLibrary':
                await openFolderInLibrary(message.folderId, profileName, context);
                break;
        }
    });

    panel.webview.html = getWebviewContent(content, contentName, contentId, libraryPath, createdByEmail, modifiedByEmail, filePath, profileName);
}

/**
 * Refresh dashboard content by fetching from API (exported for use in openExportedContent)
 */
export async function refreshDashboardContentFromPath(
    context: vscode.ExtensionContext,
    profileName: string,
    dashboardId: string | undefined,
    contentId: string | undefined,
    panel: vscode.WebviewPanel,
    filePath: string
): Promise<void> {
    return refreshDashboardContent(context, profileName, dashboardId, contentId, panel);
}

/**
 * Refresh dashboard content by fetching from API
 */
async function refreshDashboardContent(
    context: vscode.ExtensionContext,
    profileName: string,
    dashboardId: string | undefined,
    contentId: string | undefined,
    panel: vscode.WebviewPanel
): Promise<void> {
    const profileManager = new ProfileManager(context);

    // Get profile
    const profiles = await profileManager.getProfiles();
    const profile = profiles.find(p => p.name === profileName);
    if (!profile) {
        vscode.window.showErrorMessage(`Profile not found: ${profileName}`);
        return;
    }

    // Get credentials
    const credentials = await profileManager.getProfileCredentials(profileName);
    if (!credentials) {
        vscode.window.showErrorMessage(`No credentials for profile: ${profileName}`);
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Refreshing content...',
            cancellable: false
        }, async (progress) => {
            // Determine if this is a dashboard ID or content ID
            const isDashboardId = dashboardId && dashboardId.length > 40; // Dashboard IDs are ~60+ chars

            if (isDashboardId && dashboardId) {
                // Use Dashboard API
                progress.report({ message: 'Fetching dashboard from API...' });
                const { DashboardClient } = await import('../api/dashboards');
                const client = new DashboardClient({
                    accessId: credentials.accessId,
                    accessKey: credentials.accessKey,
                    endpoint: profileManager.getProfileEndpoint(profile)
                });

                const response = await client.getDashboard(dashboardId);
                if (response.error || !response.data) {
                    vscode.window.showErrorMessage(`Failed to refresh dashboard: ${response.error}`);
                    return;
                }

                let dashboard: any = response.data;

                // Dashboard API returns dashboards without an itemType field, but with properties like:
                // title, description, panels, variables, etc.
                // We need to add itemType: "Dashboard" so the webview can detect it properly
                if (!dashboard.itemType && !dashboard.type) {
                    // This is a raw dashboard from the Dashboard API - add itemType
                    dashboard.itemType = 'Dashboard';

                    // Also ensure it has a name field (uses title from Dashboard API)
                    if (!dashboard.name && dashboard.title) {
                        dashboard.name = dashboard.title;
                    }
                }

                // Save to dashboards directory
                const dashboardsDir = profileManager.getProfileDashboardsDirectory(profileName);
                if (!fs.existsSync(dashboardsDir)) {
                    fs.mkdirSync(dashboardsDir, { recursive: true });
                }

                const jsonFilePath = path.join(dashboardsDir, `${dashboardId}.json`);
                fs.writeFileSync(jsonFilePath, JSON.stringify(dashboard, null, 2), 'utf-8');

                vscode.window.showInformationMessage('Dashboard refreshed successfully');

                // Reload the webview - dispose first, then reopen with specialized dashboard webview
                panel.dispose();
                await vscode.commands.executeCommand('sumologic.openExportedContentFromPath', jsonFilePath);
            } else if (contentId) {
                // Use Content API
                progress.report({ message: 'Exporting content from API...' });
                const client = new ContentClient({
                    accessId: credentials.accessId,
                    accessKey: credentials.accessKey,
                    endpoint: profileManager.getProfileEndpoint(profile)
                });

                const response = await client.exportContent(contentId);
                if (response.error || !response.data) {
                    vscode.window.showErrorMessage(`Failed to refresh content: ${response.error}`);
                    return;
                }

                // Save to library content directory
                const contentDir = profileManager.getProfileLibraryContentDirectory(profileName);
                if (!fs.existsSync(contentDir)) {
                    fs.mkdirSync(contentDir, { recursive: true });
                }

                const jsonFilePath = path.join(contentDir, `${contentId}.json`);
                fs.writeFileSync(jsonFilePath, JSON.stringify(response.data, null, 2), 'utf-8');

                vscode.window.showInformationMessage('Content refreshed successfully');

                // Reload the webview - dispose first, then reopen
                panel.dispose();
                await vscode.commands.executeCommand('sumologic.openExportedContentFromPath', jsonFilePath);
            } else {
                vscode.window.showErrorMessage('No dashboard ID or content ID available to refresh');
            }
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to refresh content: ${error.message}`);
    }
}

/**
 * Open dashboard in Sumo Logic web UI (exported for use in openExportedContent)
 */
export async function openDashboardInUIFromPath(
    context: vscode.ExtensionContext,
    profileName: string,
    dashboardId: string
): Promise<void> {
    return openDashboardInUI(context, profileName, dashboardId);
}

/**
 * Open dashboard in Sumo Logic web UI
 */
async function openDashboardInUI(
    context: vscode.ExtensionContext,
    profileName: string,
    dashboardId: string
): Promise<void> {
    const profileManager = new ProfileManager(context);

    // Get the profile to determine the instance name
    const profiles = await profileManager.getProfiles();
    const profile = profiles.find(p => p.name === profileName);
    if (!profile) {
        vscode.window.showErrorMessage(`Profile not found: ${profileName}`);
        return;
    }

    // Get the instance name from profile (with fallback to global setting and default)
    const instanceName = profileManager.getInstanceName(profile);

    // Construct the dashboard URL
    const dashboardUrl = `https://${instanceName}/dashboard/${dashboardId}`;

    // Open in external browser
    vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
    vscode.window.showInformationMessage(`Opening dashboard in Sumo Logic UI`);
}

/**
 * Open folder in library explorer (exported for use in openExportedContent)
 */
export async function openFolderInLibraryFromPath(
    folderId: string,
    profileName: string,
    context?: vscode.ExtensionContext
): Promise<void> {
    return openFolderInLibrary(folderId, profileName, context);
}

/**
 * Open folder in library explorer
 */
async function openFolderInLibrary(
    folderId: string,
    profileName: string,
    context?: vscode.ExtensionContext
): Promise<void> {
    try {
        if (!context) {
            vscode.window.showWarningMessage('Cannot open folder: context not available');
            return;
        }

        const profileManager = new ProfileManager(context);

        // Get the profile to determine the instance name
        const profiles = await profileManager.getProfiles();
        const profile = profiles.find(p => p.name === profileName);
        if (!profile) {
            vscode.window.showErrorMessage(`Profile not found: ${profileName}`);
            return;
        }

        // Get the instance name from profile (with fallback to global setting and default)
        const instanceName = profileManager.getInstanceName(profile);

        // Construct the folder URL
        const folderUrl = `https://${instanceName}/library/${folderId}`;

        // Get folder name from cache if available
        let folderName = 'folder';
        try {
            const profileDir = profileManager.getProfileDirectory(profileName);
            const db = createLibraryCacheDB(profileDir, profileName);
            const folder = db.getContentItem(folderId);
            db.close();

            if (folder) {
                folderName = folder.name;
            }
        } catch (e) {
            // Ignore cache errors, just use default name
        }

        // Open in external browser
        vscode.env.openExternal(vscode.Uri.parse(folderUrl));
        vscode.window.showInformationMessage(`Opening folder "${folderName}" in Sumo Logic UI`);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to open folder: ${error.message}`);
    }
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
 * Generate specialized webview content for searches
 */
function getSearchWebviewContent(content: any, contentName: string, contentId: string, formattedId: string, libraryPath: string, createdByEmail?: string, modifiedByEmail?: string, filePath?: string): string {
    // Top-level string properties to display at the top
    const topLevelProps = ['name', 'description', 'type'];

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

    // Generate search section HTML
    const searchHtml = content.search ? `
        <h2>Search Query</h2>
        <div class="search-section">
            <div class="search-property">
                <div class="search-property-label">By Receipt Time:</div>
                <div class="search-property-value">${content.search.byReceiptTime ? 'Yes' : 'No'}</div>
            </div>
            ${content.search.parsingMode ? `
                <div class="search-property">
                    <div class="search-property-label">Parsing Mode:</div>
                    <div class="search-property-value">${escapeHtml(content.search.parsingMode)}</div>
                </div>
            ` : ''}
            ${content.search.defaultTimeRange ? `
                <div class="search-property">
                    <div class="search-property-label">Default Time Range:</div>
                    <div class="search-property-value">${escapeHtml(content.search.defaultTimeRange)}</div>
                </div>
            ` : ''}
            ${content.search.viewName ? `
                <div class="search-property">
                    <div class="search-property-label">View Name:</div>
                    <div class="search-property-value">${escapeHtml(content.search.viewName)}</div>
                </div>
            ` : ''}
            <div class="query-text">
                <div class="search-property-label">
                    Query Text:
                    <button class="extract-button" onclick="extractSearch()">Open in .sumo File</button>
                </div>
                <pre>${escapeHtml(content.search.queryText || '')}</pre>
            </div>
        </div>
    ` : '';

    // Other properties to show at the bottom
    const excludeProps = [...topLevelProps, 'search'];
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

        .search-section {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }

        .search-property {
            display: grid;
            grid-template-columns: 200px 1fr;
            gap: 10px;
            margin-bottom: 10px;
        }

        .search-property-label {
            font-weight: bold;
            color: var(--vscode-descriptionForeground);
        }

        .search-property-value {
            color: var(--vscode-foreground);
        }

        .query-text {
            margin-top: 15px;
        }

        .query-text .search-property-label {
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .extract-button {
            padding: 6px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            font-family: var(--vscode-font-family);
        }

        .extract-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .extract-button:active {
            background-color: var(--vscode-button-hoverBackground);
            opacity: 0.8;
        }

        .query-text pre {
            margin: 0;
            padding: 12px;
            background-color: var(--vscode-textCodeBlock-background);
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
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
    <h1>🔍 ${escapeHtml(contentName)}</h1>

    <div class="header-info">
        <strong>ID:</strong> ${formattedId}
        ${libraryPath ? ` | <strong>Path:</strong> ${escapeHtml(libraryPath)}` : ''}
        ${content.itemType ? ` | <strong>Type:</strong> ${escapeHtml(content.itemType)}` : ''}
        ${filePath ? `<br/><strong>File:</strong> ${escapeHtml(filePath)}` : ''}
        ${content.createdBy ? `<br/><strong>Created By:</strong> ${escapeHtml(createdByEmail || content.createdBy)}` : ''}
        ${content.modifiedBy ? ` | <strong>Modified By:</strong> ${escapeHtml(modifiedByEmail || content.modifiedBy)}` : ''}
    </div>

    <div class="top-properties">
        ${topPropsHtml}
    </div>

    ${searchHtml}

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
        const vscode = acquireVsCodeApi();

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

        function extractSearch() {
            vscode.postMessage({
                type: 'extractSearch'
            });
        }
    </script>
</body>
</html>`;
}

/**
 * Generate specialized webview content for dashboards
 */
function getDashboardWebviewContent(content: any, contentName: string, contentId: string, formattedId: string, libraryPath: string, createdByEmail?: string, modifiedByEmail?: string, filePath?: string, profileName?: string): string {
    // Top-level string properties to display at the top
    // Include dashboard API specific properties: id, contentId, folderId, domain, isPublic
    const topLevelProps = ['name', 'description', 'title', 'id', 'contentId', 'folderId', 'domain', 'theme', 'type', 'isPublic', 'refreshInterval'];

    // Detect dashboard version
    const isV1Dashboard = content.type === 'DashboardSyncDefinition';

    // Extract all queries from panels (handle both v1 and v2 formats)
    const queries: any[] = [];
    if (content.panels && Array.isArray(content.panels)) {
        content.panels.forEach((panel: any) => {
            if (isV1Dashboard) {
                // v1 Dashboard: queryString is directly on panel
                if (panel.queryString) {
                    queries.push({
                        panelName: panel.name || panel.title || 'Untitled Panel',
                        panelKey: panel.id,
                        queryKey: 'A',
                        queryType: 'Logs',
                        queryString: panel.queryString,
                        parseMode: panel.autoParsingInfo?.mode || 'Auto',
                        timeSource: 'Message'
                    });
                }
            } else {
                // v2 Dashboard: queries array
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
            }
        });
    }

    // Sort panels by title/name
    if (content.panels && Array.isArray(content.panels)) {
        content.panels.sort((a: any, b: any) => {
            const titleA = (a.title || a.name || '').toLowerCase();
            const titleB = (b.title || b.name || '').toLowerCase();
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
                    ${content.panels.map((p: any) => {
                        // Handle both v1 (name, viewerType) and v2 (title, panelType) formats
                        const title = p.title || p.name || 'Untitled';
                        const type = p.panelType || p.viewerType || 'Unknown';
                        const key = p.key || p.id || '-';
                        const queryCount = p.queries ? p.queries.length : (p.queryString ? 1 : 0);
                        const description = p.description || '-';

                        return `
                        <tr>
                            <td>${escapeHtml(title)}</td>
                            <td>${escapeHtml(type)}</td>
                            <td class="monospace">${escapeHtml(key)}</td>
                            <td>${queryCount}</td>
                            <td>${escapeHtml(description)}</td>
                        </tr>
                        `;
                    }).join('')}
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

    // Generate layout table HTML
    let layoutHtml = '';
    if (content.layout && content.layout.layoutStructures && Array.isArray(content.layout.layoutStructures)) {
        // Create a map of panel keys to panel names for quick lookup
        const panelKeyToName: { [key: string]: string } = {};
        if (content.panels && Array.isArray(content.panels)) {
            content.panels.forEach((panel: any) => {
                const key = panel.key || panel.id;
                const name = panel.title || panel.name || 'Untitled';
                if (key) {
                    panelKeyToName[key] = name;
                }
            });
        }

        // Parse and enrich layout structures with panel names
        const layoutItems = content.layout.layoutStructures.map((item: any) => {
            const key = item.key || '';
            let panelName = '-';

            // Match the key directly with panel keys
            // Keys look like "panelpane-03afc899b83e3b40" or "panelPANE-4AD569BB8E29FA47"
            if (key) {
                panelName = panelKeyToName[key] || '-';
            }

            // Parse the structure JSON
            let structureObj: any = {};
            try {
                structureObj = JSON.parse(item.structure);
            } catch (e) {
                // If parsing fails, leave it as empty object
            }

            return {
                key,
                panelName,
                x: structureObj.x ?? '-',
                y: structureObj.y ?? '-',
                width: structureObj.width ?? '-',
                height: structureObj.height ?? '-'
            };
        });

        // Sort by panel name for the table
        const sortedLayoutItems = [...layoutItems].sort((a, b) => {
            return a.panelName.localeCompare(b.panelName);
        });

        // Generate visual grid preview
        const gridWidth = 24; // Standard Sumo Logic dashboard grid width

        // Group panels by their Y position to create logical rows
        type PanelInfo = {
            name: string;
            key: string;
            x: number;
            y: number;
            width: number;
            height: number;
        };

        const panelsByRow = new Map<number, PanelInfo[]>();
        layoutItems.forEach((item: any) => {
            const x = typeof item.x === 'number' ? item.x : 0;
            const y = typeof item.y === 'number' ? item.y : 0;
            const width = typeof item.width === 'number' ? item.width : 1;
            const height = typeof item.height === 'number' ? item.height : 1;

            if (!panelsByRow.has(y)) {
                panelsByRow.set(y, []);
            }

            panelsByRow.get(y)!.push({
                name: item.panelName,
                key: item.key,
                x,
                y,
                width,
                height
            });
        });

        // Sort rows by Y position
        const sortedRows = Array.from(panelsByRow.entries()).sort((a, b) => a[0] - b[0]);

        // Generate HTML grid visualization
        let gridHtml = '<div class="grid-preview">';

        sortedRows.forEach(([rowY, panels]) => {
            // Sort panels in the row by X position
            panels.sort((a, b) => a.x - b.x);

            // Find the max height in this row (all panels should have same height ideally)
            const rowHeight = Math.max(...panels.map(p => p.height));

            gridHtml += `<div class="grid-row" style="min-height: ${rowHeight * 60}px;">`;

            let currentX = 0;

            panels.forEach((panel, idx) => {
                // Add empty space if there's a gap before this panel
                if (panel.x > currentX) {
                    const gapWidth = panel.x - currentX;
                    gridHtml += `<div class="grid-cell empty" style="flex: ${gapWidth}"></div>`;
                    currentX = panel.x;
                }

                // Extract full panel ID from key (e.g., "panelpane-03afc899b83e3b40" -> "03afc899b83e3b40")
                const keyMatch = panel.key.match(/panelpane-(.+)/i);
                const panelId = keyMatch ? keyMatch[1] : '';

                // Add the panel with name on first line, ID and dimensions on second line
                const panelContent = `<div style="line-height: 1.3;">${escapeHtml(panel.name)}<br/><span style="font-size: 9px; opacity: 0.7;">${escapeHtml(panelId)}<br/>(${panel.width}×${panel.height})</span></div>`;
                const panelTitle = `${escapeHtml(panel.name)}\\nID: ${escapeHtml(panel.key)}\\nPosition: (${panel.x}, ${panel.y})\\nSize: ${panel.width}×${panel.height}`;

                gridHtml += `<div class="grid-cell" style="flex: ${panel.width}" title="${panelTitle}">${panelContent}</div>`;
                currentX = panel.x + panel.width;
            });

            // Fill remaining space to reach gridWidth
            if (currentX < gridWidth) {
                const remainingWidth = gridWidth - currentX;
                gridHtml += `<div class="grid-cell empty" style="flex: ${remainingWidth}"></div>`;
            }

            gridHtml += '</div>';
        });

        gridHtml += '</div>';

        layoutHtml = `
        <h2>Layout (${content.layout.layoutType || 'Grid'}, ${layoutItems.length} items)</h2>

        <h3>Visual Preview</h3>
        ${gridHtml}

        <h3 style="margin-top: 30px;">Layout Details</h3>
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Panel Name</th>
                        <th>Panel Key</th>
                        <th>X</th>
                        <th>Y</th>
                        <th>Width</th>
                        <th>Height</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedLayoutItems.map((item: any) => `
                        <tr>
                            <td>${escapeHtml(item.panelName)}</td>
                            <td class="monospace">${escapeHtml(item.key)}</td>
                            <td>${escapeHtml(String(item.x))}</td>
                            <td>${escapeHtml(String(item.y))}</td>
                            <td>${escapeHtml(String(item.width))}</td>
                            <td>${escapeHtml(String(item.height))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        `;
    }

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

        .grid-preview {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 20px;
            overflow-x: auto;
        }

        .grid-row {
            display: flex;
            min-height: 60px;
            gap: 2px;
            margin-bottom: 2px;
        }

        .grid-cell {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 8px;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            overflow: hidden;
            min-width: 0;
            word-break: break-word;
        }

        .grid-cell.empty {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-style: dashed;
            opacity: 0.3;
        }

        .grid-cell:not(.empty):hover {
            background-color: var(--vscode-button-hoverBackground);
            cursor: default;
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

        .action-buttons {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        .action-button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
            font-family: var(--vscode-font-family);
        }

        .action-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .action-button:active {
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <h1>📊 ${escapeHtml(contentName)}</h1>

    <div class="header-info">
        <strong>ID:</strong> ${formattedId}
        ${libraryPath ? ` | <strong>Path:</strong> ${escapeHtml(libraryPath)}` : ''}
        ${content.itemType ? ` | <strong>Type:</strong> ${escapeHtml(content.itemType)}` : ''}
        ${filePath ? `<br/><strong>File:</strong> ${escapeHtml(filePath)}` : ''}
        ${content.createdBy ? `<br/><strong>Created By:</strong> ${escapeHtml(createdByEmail || content.createdBy)}` : ''}
        ${content.modifiedBy ? ` | <strong>Modified By:</strong> ${escapeHtml(modifiedByEmail || content.modifiedBy)}` : ''}
    </div>

    <div class="action-buttons">
        ${content.id || content.contentId ? `<button class="action-button" onclick="refreshContent()">🔄 Refresh Content</button>` : ''}
        ${content.id && content.id.length > 40 ? `<button class="action-button" onclick="openInUI()">🌐 Open in UI</button>` : ''}
        ${content.folderId ? `<button class="action-button" onclick="openFolder()">📁 Open Folder</button>` : ''}
    </div>

    <div class="top-properties">
        ${topPropsHtml}
    </div>

    ${variablesHtml}
    ${panelsHtml}
    ${queriesHtml}
    ${layoutHtml}

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
        const vscode = acquireVsCodeApi();

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

        function refreshContent() {
            vscode.postMessage({
                type: 'refreshContent',
                dashboardId: ${content.id ? `'${escapeHtml(String(content.id))}'` : 'null'},
                contentId: ${content.contentId ? `'${escapeHtml(String(content.contentId))}'` : 'null'}
            });
        }

        function openInUI() {
            vscode.postMessage({
                type: 'openDashboardInUI',
                dashboardId: '${content.id ? escapeHtml(String(content.id)) : ''}'
            });
        }

        function openFolder() {
            vscode.postMessage({
                type: 'openFolderInLibrary',
                folderId: '${content.folderId ? escapeHtml(String(content.folderId)) : ''}'
            });
        }
    </script>
</body>
</html>`;
}

export function getWebviewContent(content: any, contentName: string, contentId: string, libraryPath: string, createdByEmail?: string, modifiedByEmail?: string, filePath?: string, profileName?: string): string {
    const formattedId = formatContentId(contentId);

    // Check if this is a dashboard
    // Note: In folder listings, dashboards have itemType: "Dashboard" or "Report" (v1 legacy)
    // In exported JSON, they have type: "DashboardV2SyncDefinition" or "DashboardSyncDefinition" (v1)
    const isDashboard = content.type === 'DashboardV2SyncDefinition' ||
                       content.type === 'DashboardSyncDefinition' ||
                       content.itemType === 'Dashboard' ||
                       content.itemType === 'Report' ||
                       content.itemType === 'DashboardV2SyncDefinition';

    // Check if this is a search
    // Note: In folder listings, searches have itemType: "Search"
    // In exported JSON, they have type: "SavedSearchWithScheduleSyncDefinition"
    const isSearch = content.type === 'SavedSearchWithScheduleSyncDefinition' ||
                    content.itemType === 'Search' ||
                    content.itemType === 'SavedSearchWithScheduleSyncDefinition';

    console.log(`[viewLibraryContent] Content type: ${content.type}, itemType: ${content.itemType}, isDashboard: ${isDashboard}, isSearch: ${isSearch}`);

    if (isDashboard) {
        return getDashboardWebviewContent(content, contentName, contentId, formattedId, libraryPath, createdByEmail, modifiedByEmail, filePath, profileName);
    }

    if (isSearch) {
        return getSearchWebviewContent(content, contentName, contentId, formattedId, libraryPath, createdByEmail, modifiedByEmail, filePath);
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

        ${content.createdBy ? `
            <span class="label">Created By:</span>
            <span class="value">${createdByEmail || content.createdBy}</span>
        ` : ''}

        ${content.modifiedAt ? `
            <span class="label">Modified:</span>
            <span class="value">${new Date(content.modifiedAt).toLocaleString()}</span>
        ` : ''}

        ${content.modifiedBy ? `
            <span class="label">Modified By:</span>
            <span class="value">${modifiedByEmail || content.modifiedBy}</span>
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

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager } from '../profileManager';
import { formatContentId } from '../utils/contentId';
import { ContentClient } from '../api/content';

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

    panel.webview.html = getWebviewContent(content, contentName, contentId);
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

function getWebviewContent(content: any, contentName: string, contentId: string): string {
    const formattedId = formatContentId(contentId);

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

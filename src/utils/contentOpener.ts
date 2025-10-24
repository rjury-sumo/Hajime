import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProfileManager } from '../profileManager';
import { RecentContentManager } from '../recentContentManager';
import { getWebviewContent } from '../commands/viewLibraryContent';

/**
 * Shared utility for opening content JSON files with proper recent tracking
 * This handles content from all sources:
 * - Library content (via Content API export)
 * - Dashboard JSON (via Dashboard API)
 * - Standalone JSON files
 */
export async function openContentWebview(
    context: vscode.ExtensionContext,
    filePath: string,
    options?: {
        profileName?: string;
        contentId?: string;
        contentName?: string;
        libraryPath?: string;
        createdByEmail?: string;
        modifiedByEmail?: string;
    }
): Promise<void> {
    try {
        // Read and parse the JSON file
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        let content = JSON.parse(fileContent);

        // Extract content name and ID from the JSON or options
        const contentName = options?.contentName || content.name || content.title || path.basename(filePath, '.json');
        const contentId = options?.contentId || content.id || content.contentId || 'unknown';
        const contentType = content.type || content.itemType || 'Unknown';

        // Dashboard API returns dashboards without an itemType field, but with properties like:
        // title, description, panels, variables, etc.
        // We need to add itemType: "Dashboard" so the webview can detect it properly
        if (!content.itemType && !content.type && content.panels) {
            // This is a raw dashboard from the Dashboard API - add itemType
            content.itemType = 'Dashboard';

            // Also ensure it has a name field (uses title from Dashboard API)
            if (!content.name && content.title) {
                content.name = content.title;
            }

            // Save the updated JSON back to the file so it has the correct structure
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
        }

        // Determine profile name from file path if not provided
        let profileName = options?.profileName;
        if (!profileName) {
            const pathParts = filePath.split(path.sep);
            const sumoLogicIndex = pathParts.indexOf('.sumologic');
            if (sumoLogicIndex !== -1 && sumoLogicIndex + 1 < pathParts.length) {
                profileName = pathParts[sumoLogicIndex + 1];
                // Skip if it's the _global directory
                if (profileName === '_global') {
                    profileName = undefined;
                }
            }
        }

        // Track this as recently opened content
        const profileManager = new ProfileManager(context);
        const recentContentManager = new RecentContentManager(context, profileManager);
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
                case 'viewChild':
                    // View a child item from folder
                    if (profileName) {
                        vscode.commands.executeCommand('sumologic.viewLibraryContent', profileName, message.childId, message.childName);
                    }
                    break;
                case 'extractSearch':
                    // For standalone JSON files, we don't have a profile context
                    // so we'll create a temporary file directly
                    const { extractSearchToFileCommand } = require('../commands/extractSearchToFile');
                    await extractSearchToFileCommand(context, profileName || 'standalone', contentId, contentName, content);
                    break;
                case 'refreshContent':
                    if (profileName) {
                        const { refreshDashboardContentFromPath } = require('../commands/viewLibraryContent');
                        await refreshDashboardContentFromPath(context, profileName, message.dashboardId, message.contentId, panel, filePath);
                    } else {
                        vscode.window.showWarningMessage('Cannot refresh: unable to determine profile from file path');
                    }
                    break;
                case 'openDashboardInUI':
                    if (profileName) {
                        const { openDashboardInUIFromPath } = require('../commands/viewLibraryContent');
                        await openDashboardInUIFromPath(context, profileName, message.dashboardId);
                    } else {
                        vscode.window.showWarningMessage('Cannot open in UI: unable to determine profile from file path');
                    }
                    break;
                case 'openFolderInLibrary':
                    if (profileName) {
                        const { openFolderInLibraryFromPath } = require('../commands/viewLibraryContent');
                        await openFolderInLibraryFromPath(message.folderId, profileName, context);
                    } else {
                        vscode.window.showWarningMessage('Cannot open folder: unable to determine profile from file path');
                    }
                    break;
            }
        });

        // Use the existing webview generation logic
        panel.webview.html = getWebviewContent(
            content,
            contentName,
            contentId,
            options?.libraryPath || '',
            options?.createdByEmail,
            options?.modifiedByEmail,
            filePath,
            profileName
        );

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (error instanceof SyntaxError) {
            vscode.window.showErrorMessage(`Failed to parse JSON file: ${errorMessage}`);
        } else if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            vscode.window.showErrorMessage(`File not found: ${filePath}`);
        } else {
            vscode.window.showErrorMessage(`Failed to open content: ${errorMessage}`);
        }
    }
}

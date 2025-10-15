import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWebviewContent } from './viewLibraryContent';

/**
 * Internal function to open a content file from a given path
 */
async function openContentFromPath(context: vscode.ExtensionContext, filePath: string): Promise<void> {
    try {
        // Read and parse the JSON file
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const content = JSON.parse(fileContent);

        // Extract content name and ID from the JSON
        const contentName = content.name || path.basename(filePath, '.json');
        const contentId = content.id || 'unknown';
        const contentType = content.type || content.itemType || 'Unknown';

        // Track this as recently opened content
        const { RecentContentManager } = require('../recentContentManager');
        const recentContentManager = new RecentContentManager(context);
        recentContentManager.addContent(filePath, contentId, contentName, contentType);

        // Refresh the explorer to show the new recent item
        vscode.commands.executeCommand('sumologic.refreshExplorer');

        // Create and show webview directly
        const panel = vscode.window.createWebviewPanel(
            'sumoLibraryContent',
            `📚 ${contentName}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Handle messages from webview (for extract search functionality)
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'extractSearch') {
                // For standalone JSON files, we don't have a profile context
                // so we'll create a temporary file directly
                const { extractSearchToFileCommand } = require('./extractSearchToFile');
                await extractSearchToFileCommand(context, 'standalone', contentId, contentName, content);
            }
        });

        // Use the existing webview generation logic
        panel.webview.html = getWebviewContent(content, contentName, contentId, '', undefined, undefined, filePath);

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

/**
 * Command to open an exported content JSON file and display it in the type-specific webview
 */
export async function openExportedContentCommand(context: vscode.ExtensionContext): Promise<void> {
    // Prompt user to select a JSON file
    const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        canSelectFiles: true,
        canSelectFolders: false,
        filters: {
            'JSON Files': ['json'],
            'All Files': ['*']
        },
        title: 'Select Exported Content JSON File'
    });

    if (!fileUris || fileUris.length === 0) {
        return; // User cancelled
    }

    const filePath = fileUris[0].fsPath;
    await openContentFromPath(context, filePath);
}

/**
 * Command to open exported content from a specific file path (for recent content)
 */
export async function openExportedContentFromPathCommand(context: vscode.ExtensionContext, filePath: string): Promise<void> {
    await openContentFromPath(context, filePath);
}

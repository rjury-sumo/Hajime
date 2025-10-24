import * as vscode from 'vscode';
import { openContentWebview } from '../utils/contentOpener';

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
    await openContentWebview(context, filePath);
}

/**
 * Command to open exported content from a specific file path (for recent content)
 */
export async function openExportedContentFromPathCommand(context: vscode.ExtensionContext, filePath: string): Promise<void> {
    await openContentWebview(context, filePath);
}

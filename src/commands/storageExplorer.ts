import * as vscode from 'vscode';
import * as fs from 'fs';

/**
 * Reveal a storage item (file or folder) in the system file explorer
 */
export async function revealStorageInExplorerCommand(treeItem: any): Promise<void> {
    // Try to get file path from different possible locations
    const filePath = treeItem?.data?.path || treeItem?.data?.filePath;

    if (!filePath) {
        console.error('No file path available. TreeItem:', JSON.stringify(treeItem, null, 2));
        vscode.window.showErrorMessage('No file path available');
        return;
    }

    // Check if path exists
    if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`Path does not exist: ${filePath}`);
        return;
    }

    try {
        // Use VSCode's built-in command to reveal in system explorer
        const uri = vscode.Uri.file(filePath);
        await vscode.commands.executeCommand('revealFileInOS', uri);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to reveal in explorer: ${error}`);
    }
}

/**
 * Delete a storage file
 */
export async function deleteStorageItemCommand(
    context: vscode.ExtensionContext,
    treeItem: any
): Promise<void> {
    const filePath = treeItem?.data?.path;

    if (!filePath) {
        vscode.window.showErrorMessage('No file path available');
        return;
    }

    // Check if path exists
    if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`File does not exist: ${filePath}`);
        return;
    }

    // Confirm deletion
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'file';
    const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to delete "${fileName}"?`,
        { modal: true },
        'Delete'
    );

    if (confirmation !== 'Delete') {
        return;
    }

    try {
        // Delete the file
        fs.unlinkSync(filePath);
        vscode.window.showInformationMessage(`Deleted: ${fileName}`);

        // Refresh the tree
        vscode.commands.executeCommand('sumologic.refreshExplorer');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete file: ${error}`);
    }
}

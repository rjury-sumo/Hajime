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
 * Copy path to clipboard
 */
export async function copyStoragePathCommand(treeItem: any): Promise<void> {
    // Try to get file path from different possible locations
    const filePath = treeItem?.data?.path || treeItem?.data?.filePath;

    if (!filePath) {
        console.error('No file path available. TreeItem:', JSON.stringify(treeItem, null, 2));
        vscode.window.showErrorMessage('No file path available');
        return;
    }

    try {
        await vscode.env.clipboard.writeText(filePath);
        vscode.window.showInformationMessage(`Path copied to clipboard: ${filePath}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to copy path: ${error}`);
    }
}

/**
 * Open path in integrated terminal
 */
export async function openStorageInTerminalCommand(treeItem: any): Promise<void> {
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
        // Determine the directory to open
        let dirPath: string;
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            dirPath = filePath;
        } else {
            // If it's a file, get the parent directory
            const pathSeparator = filePath.includes('/') ? '/' : '\\';
            const parts = filePath.split(pathSeparator);
            parts.pop(); // Remove the file name
            dirPath = parts.join(pathSeparator);
        }

        // Create and show a terminal with the directory as cwd
        const terminal = vscode.window.createTerminal({
            name: 'Storage Explorer',
            cwd: dirPath
        });
        terminal.show();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open terminal: ${error}`);
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

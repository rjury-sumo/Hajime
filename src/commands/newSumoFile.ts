import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export async function newSumoFileCommand(): Promise<void> {
    // Get workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        // No workspace - create untitled file
        const doc = await vscode.workspace.openTextDocument({
            language: 'sumo',
            content: ''
        });
        await vscode.window.showTextDocument(doc);
        return;
    }

    // Ask user for filename
    const fileName = await vscode.window.showInputBox({
        prompt: 'Enter filename for new Sumo query file',
        placeHolder: 'query.sumo',
        validateInput: (value: string) => {
            if (!value) {
                return 'Filename cannot be empty';
            }
            if (!value.endsWith('.sumo')) {
                return 'Filename must end with .sumo';
            }
            return null;
        }
    });

    if (!fileName) {
        return; // User cancelled
    }

    // Determine target directory
    let targetDir: string;

    if (workspaceFolders.length === 1) {
        targetDir = workspaceFolders[0].uri.fsPath;
    } else {
        // Multiple workspace folders - ask user to pick one
        const folder = await vscode.window.showWorkspaceFolderPick({
            placeHolder: 'Select workspace folder for new file'
        });

        if (!folder) {
            return; // User cancelled
        }

        targetDir = folder.uri.fsPath;
    }

    const filePath = path.join(targetDir, fileName);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
        const overwrite = await vscode.window.showWarningMessage(
            `File ${fileName} already exists. Overwrite?`,
            'Yes', 'No'
        );

        if (overwrite !== 'Yes') {
            return;
        }
    }

    // Create the file with empty content
    fs.writeFileSync(filePath, '', 'utf8');

    // Open the file
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
}

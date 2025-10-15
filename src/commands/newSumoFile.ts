import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager } from '../profileManager';

export async function newSumoFileCommand(context?: vscode.ExtensionContext): Promise<void> {
    // Ask user for filename first
    const fileName = await vscode.window.showInputBox({
        prompt: 'Enter filename for new Sumo query file',
        placeHolder: 'myquery.sumo',
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

    // Get the active profile and save to profile's searches directory
    if (context) {
        const profileManager = new ProfileManager(context);
        const activeProfile = await profileManager.getActiveProfile();

        if (activeProfile) {
            // Create searches subdirectory in profile directory if it doesn't exist
            const profileDir = profileManager.getProfileDirectory(activeProfile.name);
            const searchesDir = path.join(profileDir, 'searches');

            if (!fs.existsSync(searchesDir)) {
                fs.mkdirSync(searchesDir, { recursive: true });
            }

            const filePath = path.join(searchesDir, fileName);

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
            return;
        }
    }

    // Fallback: No active profile - create untitled file
    const doc = await vscode.workspace.openTextDocument({
        language: 'sumo',
        content: ''
    });
    await vscode.window.showTextDocument(doc);
}

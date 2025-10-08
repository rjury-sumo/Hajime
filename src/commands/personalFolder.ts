import * as vscode from 'vscode';
import { ContentClient } from '../api/content';
import { createClient } from './authenticate';

/**
 * Command to fetch and display a folder by ID
 */
export async function getFolderCommand(context: vscode.ExtensionContext): Promise<void> {
    // Prompt for folder ID
    const folderId = await vscode.window.showInputBox({
        prompt: 'Enter the folder ID',
        placeHolder: '0000000000ABC123',
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Folder ID cannot be empty';
            }
            return null;
        }
    });

    if (!folderId) {
        return; // User cancelled
    }

    const baseClient = await createClient(context);

    if (!baseClient) {
        vscode.window.showErrorMessage('No active profile. Please create a profile first.');
        return;
    }

    // Get credentials from the active profile
    const profileManager = await import('../profileManager');
    const pm = new profileManager.ProfileManager(context);
    const activeProfile = await pm.getActiveProfile();

    if (!activeProfile) {
        vscode.window.showErrorMessage('No active profile found.');
        return;
    }

    const credentials = await pm.getProfileCredentials(activeProfile.name);
    if (!credentials) {
        vscode.window.showErrorMessage('No credentials found for active profile.');
        return;
    }

    const client = new ContentClient({
        accessId: credentials.accessId,
        accessKey: credentials.accessKey,
        endpoint: pm.getProfileEndpoint(activeProfile)
    });

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Fetching folder ${folderId} from Sumo Logic...`,
        cancellable: false
    }, async (progress) => {
        const response = await client.getFolder(folderId);

        if (response.error) {
            // Check if it's a permission error
            if (response.statusCode === 403 || response.statusCode === 401) {
                vscode.window.showWarningMessage(
                    `Unable to fetch folder: Insufficient permissions.`
                );
            } else if (response.statusCode === 404) {
                vscode.window.showErrorMessage(`Folder not found: ${folderId}`);
            } else {
                vscode.window.showErrorMessage(`Failed to fetch folder: ${response.error}`);
            }
            return;
        }

        if (!response.data) {
            vscode.window.showWarningMessage('No folder data returned from API.');
            return;
        }

        const folder = response.data;

        // Format the output (reuse the same formatter)
        const outputText = ContentClient.formatPersonalFolder(folder);

        // Display in new document
        const doc = await vscode.workspace.openTextDocument({
            content: `Sumo Logic Folder (${activeProfile.name})\n` +
                     `${'='.repeat(80)}\n\n` +
                     outputText,
            language: 'plaintext'
        });

        await vscode.window.showTextDocument(doc, { preview: false });

        vscode.window.showInformationMessage(
            `Folder loaded: ${folder.name} (${folder.children.length} items)`
        );
    });
}

/**
 * Command to fetch and display the user's personal folder
 */
export async function getPersonalFolderCommand(context: vscode.ExtensionContext): Promise<void> {
    const baseClient = await createClient(context);

    if (!baseClient) {
        vscode.window.showErrorMessage('No active profile. Please create a profile first.');
        return;
    }

    // Get credentials from the active profile
    const profileManager = await import('../profileManager');
    const pm = new profileManager.ProfileManager(context);
    const activeProfile = await pm.getActiveProfile();

    if (!activeProfile) {
        vscode.window.showErrorMessage('No active profile found.');
        return;
    }

    const credentials = await pm.getProfileCredentials(activeProfile.name);
    if (!credentials) {
        vscode.window.showErrorMessage('No credentials found for active profile.');
        return;
    }

    const client = new ContentClient({
        accessId: credentials.accessId,
        accessKey: credentials.accessKey,
        endpoint: pm.getProfileEndpoint(activeProfile)
    });

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Fetching personal folder from Sumo Logic...',
        cancellable: false
    }, async (progress) => {
        const response = await client.getPersonalFolder();

        if (response.error) {
            // Check if it's a permission error
            if (response.statusCode === 403 || response.statusCode === 401) {
                vscode.window.showWarningMessage(
                    'Unable to fetch personal folder: Insufficient permissions.'
                );
            } else {
                vscode.window.showErrorMessage(`Failed to fetch personal folder: ${response.error}`);
            }
            return;
        }

        if (!response.data) {
            vscode.window.showWarningMessage('No personal folder returned from API.');
            return;
        }

        const folder = response.data;

        // Format the output
        const outputText = ContentClient.formatPersonalFolder(folder);

        // Display in new document
        const doc = await vscode.workspace.openTextDocument({
            content: `Sumo Logic Personal Folder (${activeProfile.name})\n` +
                     `${'='.repeat(80)}\n\n` +
                     outputText +
                     `\n\n` +
                     `ℹ️ The Personal Folder ID (${folder.id}) is used as the default\n` +
                     `location for saving content in Sumo Logic.\n`,
            language: 'plaintext'
        });

        await vscode.window.showTextDocument(doc, { preview: false });

        vscode.window.showInformationMessage(
            `Personal folder loaded: ${folder.children.length} items found.`
        );
    });
}

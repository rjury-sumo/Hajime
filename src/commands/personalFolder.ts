import * as vscode from 'vscode';
import { ContentClient } from '../api/content';
import { createClient } from './authenticate';
import { OutputWriter } from '../outputWriter';

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
        const outputText = `Sumo Logic Folder (${activeProfile.name})\n` +
                          `${'='.repeat(80)}\n\n` +
                          ContentClient.formatPersonalFolder(folder);

        // Write to file
        const outputWriter = new OutputWriter(context);
        const filename = `folder_${folder.name}_${folderId}`;

        try {
            await outputWriter.writeAndOpen('folders', filename, outputText, 'txt');
            vscode.window.showInformationMessage(
                `Folder loaded: ${folder.name} (${folder.children.length} items)`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write folder data: ${error}`);
        }
    });
}

/**
 * Command to fetch and display content by path
 */
export async function getContentByPathCommand(context: vscode.ExtensionContext): Promise<void> {
    // Prompt for content path
    const contentPath = await vscode.window.showInputBox({
        prompt: 'Enter the content path (e.g., /Library/Users/username@example.com/MyFolder)',
        placeHolder: '/Library/Users/username@example.com/MyFolder',
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Content path cannot be empty';
            }
            if (!value.startsWith('/')) {
                return 'Path must start with /';
            }
            return null;
        }
    });

    if (!contentPath) {
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
        title: `Fetching content from ${contentPath}...`,
        cancellable: false
    }, async (progress) => {
        const response = await client.getContent(contentPath);

        if (response.error) {
            // Check if it's a permission error
            if (response.statusCode === 403 || response.statusCode === 401) {
                vscode.window.showWarningMessage(
                    `Unable to fetch content: Insufficient permissions.`
                );
            } else if (response.statusCode === 404) {
                vscode.window.showErrorMessage(`Content not found: ${contentPath}`);
            } else {
                vscode.window.showErrorMessage(`Failed to fetch content: ${response.error}`);
            }
            return;
        }

        if (!response.data) {
            vscode.window.showWarningMessage('No content data returned from API.');
            return;
        }

        const content = response.data;

        // Prompt for output format
        const format = await vscode.window.showQuickPick(['Summary', 'JSON'], {
            placeHolder: 'Select output format',
            ignoreFocusOut: true
        });

        if (!format) {
            return; // User cancelled
        }

        let outputText: string;
        let fileExtension: string;

        if (format === 'JSON') {
            outputText = JSON.stringify(content, null, 2);
            fileExtension = 'json';
        } else {
            // Summary format with table if children exist
            outputText = `Sumo Logic Content (${activeProfile.name})\n` +
                        `${'='.repeat(80)}\n\n` +
                        ContentClient.formatContentItem(content);
            fileExtension = 'txt';
        }

        // Write to file
        const outputWriter = new OutputWriter(context);
        const safeName = content.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `content_${safeName}_${content.id}`;

        try {
            await outputWriter.writeAndOpen('content', filename, outputText, fileExtension);
            const childrenInfo = content.children ? ` (${content.children.length} items)` : '';
            vscode.window.showInformationMessage(
                `Content loaded: ${content.name}${childrenInfo}`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write content data: ${error}`);
        }
    });
}

/**
 * Command to fetch and display content path by ID
 */
export async function getContentByIdCommand(context: vscode.ExtensionContext): Promise<void> {
    // Prompt for content ID
    const contentId = await vscode.window.showInputBox({
        prompt: 'Enter the content ID',
        placeHolder: '0000000000ABC123',
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Content ID cannot be empty';
            }
            return null;
        }
    });

    if (!contentId) {
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
        title: `Fetching content path for ${contentId}...`,
        cancellable: false
    }, async (progress) => {
        const response = await client.getContentPath(contentId);

        if (response.error) {
            // Check if it's a permission error
            if (response.statusCode === 403 || response.statusCode === 401) {
                vscode.window.showWarningMessage(
                    `Unable to fetch content path: Insufficient permissions.`
                );
            } else if (response.statusCode === 404) {
                vscode.window.showErrorMessage(`Content not found: ${contentId}`);
            } else {
                vscode.window.showErrorMessage(`Failed to fetch content path: ${response.error}`);
            }
            return;
        }

        if (!response.data) {
            vscode.window.showWarningMessage('No content path returned from API.');
            return;
        }

        const contentPath = response.data.path;

        // Show the path in a message
        const action = await vscode.window.showInformationMessage(
            `Content path: ${contentPath}`,
            'Copy Path',
            'Get Content Details'
        );

        if (action === 'Copy Path') {
            await vscode.env.clipboard.writeText(contentPath);
            vscode.window.showInformationMessage('Path copied to clipboard');
        } else if (action === 'Get Content Details') {
            // Fetch the full content details using the path
            await getContentByPathCommand(context);
        }
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
        const outputText = `Sumo Logic Personal Folder (${activeProfile.name})\n` +
                          `${'='.repeat(80)}\n\n` +
                          ContentClient.formatPersonalFolder(folder) +
                          `\n\n` +
                          `ℹ️ The Personal Folder ID (${folder.id}) is used as the default\n` +
                          `location for saving content in Sumo Logic.\n`;

        // Write to file
        const outputWriter = new OutputWriter(context);
        const filename = `personal_folder_${activeProfile.name}`;

        try {
            await outputWriter.writeAndOpen('folders', filename, outputText, 'txt');
            vscode.window.showInformationMessage(
                `Personal folder loaded: ${folder.children.length} items found.`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write folder data: ${error}`);
        }
    });
}

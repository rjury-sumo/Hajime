import * as vscode from 'vscode';
import * as path from 'path';
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
 * Helper function to handle export workflow
 */
async function handleExport(
    context: vscode.ExtensionContext,
    exportName: string,
    exportFn: (client: ContentClient, isAdminMode?: boolean) => Promise<any>,
    filenamePrefix: string,
    includeTimestamp: boolean = true
): Promise<void> {
    // Prompt for isAdminMode
    const isAdminModeChoice = await vscode.window.showQuickPick(
        ['No', 'Yes'],
        {
            placeHolder: 'Export as admin? (isAdminMode parameter)',
            ignoreFocusOut: true
        }
    );

    if (!isAdminModeChoice) {
        return; // User cancelled
    }

    const isAdminMode = isAdminModeChoice === 'Yes';

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
        title: `Exporting ${exportName}...`,
        cancellable: false
    }, async (progress) => {
        progress.report({ message: 'Starting export job...' });

        const response = await exportFn(client, isAdminMode);

        if (response.error) {
            // Check if it's a permission error
            if (response.statusCode === 403 || response.statusCode === 401) {
                vscode.window.showWarningMessage(
                    `Unable to export ${exportName}: Insufficient permissions. You may need admin access or special permissions.`
                );
            } else if (response.statusCode === 404) {
                vscode.window.showErrorMessage(
                    `${exportName} not found. This may mean:\n` +
                    `- The folder doesn't exist in your environment\n` +
                    `- You need admin permissions to access it\n` +
                    `- Try setting isAdminMode to "Yes"\n\n` +
                    `Error: ${response.error}`
                );
            } else if (response.statusCode === 408) {
                vscode.window.showErrorMessage(`Export timed out: ${response.error}`);
            } else {
                vscode.window.showErrorMessage(
                    `Failed to export ${exportName}:\n` +
                    `Status: ${response.statusCode || 'unknown'}\n` +
                    `Error: ${response.error}`
                );
            }
            return;
        }

        if (!response.data) {
            vscode.window.showWarningMessage('No export data returned from API.');
            return;
        }

        const exportData = response.data;

        progress.report({ message: 'Export complete, saving files...' });

        // Sanitize name for filename
        const sanitizeName = (name: string | undefined): string => {
            // Remove invalid filename characters and limit length
            if (!name) {
                return 'unnamed';
            }
            return name
                .replace(/[^a-zA-Z0-9_-]/g, '_')
                .substring(0, 50); // Limit to 50 chars
        };

        const safeName = sanitizeName(exportData.name);
        const filename = `${filenamePrefix}_${safeName}`;

        // Format JSON output
        const jsonOutput = JSON.stringify(exportData, null, 2);

        // Write to files
        const outputWriter = new OutputWriter(context);

        try {
            // Write JSON file (don't open in editor) and get the actual filename
            const jsonFilePath = await outputWriter.writeAndOpen('content', filename, jsonOutput, 'json', false, includeTimestamp);
            const jsonFilename = path.basename(jsonFilePath);

            // Format summary with the actual JSON filename
            const summaryOutput = ContentClient.formatExportSummary(exportData, jsonFilename);

            // Write summary file (markdown) - open this one
            await outputWriter.writeAndOpen('content', `${filename}_summary`, summaryOutput, 'md', true, includeTimestamp);

            // Count items if it's a folder with children
            let itemCount = 0;
            const countItems = (item: any): number => {
                let count = 1;
                // Global folder uses 'data' property instead of 'children'
                const childrenArray = item.children || item.data;
                if (childrenArray && Array.isArray(childrenArray)) {
                    for (const child of childrenArray) {
                        count += countItems(child);
                    }
                }
                return count;
            };

            itemCount = countItems(exportData);

            const adminModeNote = isAdminMode ? ' (admin mode)' : '';
            const displayName = exportData.name || exportName;
            const displayType = exportData.type || 'folder';
            vscode.window.showInformationMessage(
                `${exportName} exported${adminModeNote}: ${displayName} (${displayType}, ${itemCount} item${itemCount > 1 ? 's' : ''})`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write export data: ${error}`);
        }
    });
}

/**
 * Command to export content by ID
 */
export async function exportContentCommand(context: vscode.ExtensionContext, contentId?: string): Promise<void> {
    // If contentId not provided, prompt for it
    if (!contentId) {
        contentId = await vscode.window.showInputBox({
            prompt: 'Enter the content ID to export (folder, search, dashboard, etc.)',
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
            return;
        }
    }

    await handleExport(
        context,
        `content ${contentId}`,
        (client, isAdminMode) => client.exportContent(contentId, isAdminMode),
        `export_content_${contentId}`
    );
}

/**
 * Command to export Admin Recommended folder
 */
export async function exportAdminRecommendedCommand(context: vscode.ExtensionContext): Promise<void> {
    await handleExport(
        context,
        'Admin Recommended folder',
        (client, isAdminMode) => client.exportAdminRecommendedFolder(isAdminMode),
        'export_admin_recommended',
        false // No timestamp - overwrites previous exports
    );
}

/**
 * Command to export Global folder
 */
export async function exportGlobalFolderCommand(context: vscode.ExtensionContext): Promise<void> {
    await handleExport(
        context,
        'Global folder',
        (client, isAdminMode) => client.exportGlobalFolder(isAdminMode),
        'export_global',
        false // No timestamp - overwrites previous exports
    );
}

/**
 * Command to export Installed Apps folder
 */
export async function exportInstalledAppsCommand(context: vscode.ExtensionContext): Promise<void> {
    await handleExport(
        context,
        'Installed Apps folder',
        (client, isAdminMode) => client.exportInstalledAppsFolder(isAdminMode),
        'export_installed_apps',
        false // No timestamp - overwrites previous exports
    );
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

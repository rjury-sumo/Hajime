import * as vscode from 'vscode';
import { getDynamicCompletionProvider } from '../extension';

/**
 * Command to view autocomplete data for the active profile
 */
export async function viewAutocompleteCommand(context: vscode.ExtensionContext): Promise<void> {
    const dynamicProvider = getDynamicCompletionProvider();

    if (!dynamicProvider) {
        vscode.window.showErrorMessage('Autocomplete provider not initialized');
        return;
    }

    const currentProfile = dynamicProvider.getCurrentProfile();

    if (!currentProfile) {
        vscode.window.showInformationMessage('No active profile. Please select a profile first.');
        return;
    }

    // Get all autocomplete data
    const discoveredFields = dynamicProvider.getFieldNames();
    const customFields = dynamicProvider.getCustomFieldNames();
    const partitions = dynamicProvider.getPartitionNames();

    // Format as a readable report
    const totalCount = discoveredFields.length + customFields.length + partitions.length;

    let content = `Autocomplete Data for Profile: ${currentProfile}\n`;
    content += `${'='.repeat(60)}\n\n`;
    content += `Total Items: ${totalCount}\n\n`;

    // Discovered Fields Section
    content += `Discovered Fields (${discoveredFields.length})\n`;
    content += `${'-'.repeat(60)}\n`;
    if (discoveredFields.length > 0) {
        discoveredFields.sort();
        discoveredFields.forEach(field => {
            content += `  • ${field}\n`;
        });
    } else {
        content += `  (none)\n`;
    }
    content += `\n`;

    // Custom Fields Section
    content += `Custom Fields (${customFields.length})\n`;
    content += `${'-'.repeat(60)}\n`;
    if (customFields.length > 0) {
        customFields.sort();
        customFields.forEach(field => {
            content += `  • ${field}\n`;
        });
    } else {
        content += `  (none)\n`;
    }
    content += `\n`;

    // Partitions Section
    content += `Partitions (${partitions.length})\n`;
    content += `${'-'.repeat(60)}\n`;
    if (partitions.length > 0) {
        partitions.sort();
        partitions.forEach(partition => {
            content += `  • ${partition}\n`;
        });
    } else {
        content += `  (none)\n`;
    }
    content += `\n`;

    content += `\nℹ️ This data is stored per profile in the workspace.\n`;
    content += `It persists across VS Code restarts and is automatically\n`;
    content += `loaded when switching profiles.\n`;

    // Display in new document
    const doc = await vscode.workspace.openTextDocument({
        content: content,
        language: 'plaintext'
    });

    await vscode.window.showTextDocument(doc, { preview: false });
}

/**
 * Command to clear autocomplete data for the active profile
 */
export async function clearAutocompleteCommand(context: vscode.ExtensionContext): Promise<void> {
    const dynamicProvider = getDynamicCompletionProvider();

    if (!dynamicProvider) {
        vscode.window.showErrorMessage('Autocomplete provider not initialized');
        return;
    }

    const currentProfile = dynamicProvider.getCurrentProfile();

    if (!currentProfile) {
        vscode.window.showInformationMessage('No active profile. Please select a profile first.');
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Clear all autocomplete data for profile '${currentProfile}'?`,
        'Clear', 'Cancel'
    );

    if (confirm !== 'Clear') {
        return;
    }

    try {
        await dynamicProvider.clearProfileData(currentProfile);
        vscode.window.showInformationMessage(`Autocomplete data cleared for profile '${currentProfile}'`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to clear autocomplete data: ${error}`);
    }
}

import * as vscode from 'vscode';
import { CustomFieldsClient } from '../api/customFields';
import { createClient } from './authenticate';
import { getDynamicCompletionProvider } from '../extension';

/**
 * Command to fetch custom fields and add to autocomplete
 */
export async function fetchCustomFieldsCommand(context: vscode.ExtensionContext): Promise<void> {
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

    const client = new CustomFieldsClient({
        accessId: credentials.accessId,
        accessKey: credentials.accessKey,
        endpoint: pm.getProfileEndpoint(activeProfile)
    });

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Fetching custom fields from Sumo Logic...',
        cancellable: false
    }, async (progress) => {
        const response = await client.listCustomFields();

        if (response.error) {
            // Check if it's a permission error
            if (response.statusCode === 403 || response.statusCode === 401) {
                vscode.window.showWarningMessage(
                    'Unable to fetch custom fields: Insufficient permissions. ' +
                    'Your user role may not have "Manage fields" capability.'
                );
            } else {
                vscode.window.showErrorMessage(`Failed to fetch custom fields: ${response.error}`);
            }
            return;
        }

        if (!response.data || !response.data.data) {
            vscode.window.showWarningMessage('No custom fields returned from API.');
            return;
        }

        const customFields = response.data.data;

        if (!Array.isArray(customFields) || customFields.length === 0) {
            vscode.window.showInformationMessage('No custom fields found in this organization.');
            return;
        }

        // Sort by fieldName ascending
        customFields.sort((a, b) => a.fieldName.localeCompare(b.fieldName));

        // Extract field names
        const fieldNames = customFields.map(f => f.fieldName);

        // Add to dynamic completion provider
        const dynamicProvider = getDynamicCompletionProvider();
        if (dynamicProvider) {
            fieldNames.forEach(fieldName => {
                dynamicProvider.addCustomField(fieldName);
            });
        }

        // Format as table
        const tableText = CustomFieldsClient.formatCustomFieldsAsTable(customFields);

        // Display in new document
        const doc = await vscode.workspace.openTextDocument({
            content: `Sumo Logic Custom Fields (${activeProfile.name})\n` +
                     `==========================================\n` +
                     `Total: ${customFields.length} fields\n` +
                     `\n` +
                     tableText +
                     `\n` +
                     `\nℹ️ Custom field names have been added to autocomplete.`,
            language: 'plaintext'
        });

        await vscode.window.showTextDocument(doc, { preview: false });

        vscode.window.showInformationMessage(
            `Found ${customFields.length} custom fields. Names added to autocomplete.`
        );
    });
}

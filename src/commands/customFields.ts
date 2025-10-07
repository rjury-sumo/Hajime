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

        if (!response.data) {
            vscode.window.showWarningMessage('No custom fields returned from API.');
            return;
        }

        // Extract field names
        const fieldNames = CustomFieldsClient.extractFieldNames(response.data);

        if (fieldNames.length === 0) {
            vscode.window.showInformationMessage('No custom fields found in this organization.');
            return;
        }

        // Add to dynamic completion provider
        const dynamicProvider = getDynamicCompletionProvider();
        if (dynamicProvider) {
            // Add each custom field to autocomplete
            fieldNames.forEach(fieldName => {
                dynamicProvider.addCustomField(fieldName);
            });

            vscode.window.showInformationMessage(
                `Added ${fieldNames.length} custom fields to autocomplete: ${fieldNames.slice(0, 5).join(', ')}${fieldNames.length > 5 ? '...' : ''}`
            );
        }
    });
}

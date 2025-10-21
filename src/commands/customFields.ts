import * as vscode from 'vscode';
import { CustomFieldsClient } from '../api/customFields';
import { createClient, createClientForProfile } from './authenticate';
import { getDynamicCompletionProvider } from '../extension';
import { OutputWriter } from '../outputWriter';
import { ProfileManager } from '../profileManager';

/**
 * Command to fetch custom fields and add to autocomplete
 * @param context Extension context
 * @param profileName Optional profile name. If not provided, uses active profile
 */
export async function fetchCustomFieldsCommand(context: vscode.ExtensionContext, profileName?: string): Promise<void> {
    const profileManager = new ProfileManager(context);

    // Get base client for specified or active profile
    let baseClient;
    let targetProfileName: string;

    if (profileName) {
        baseClient = await createClientForProfile(context, profileName);
        targetProfileName = profileName;
    } else {
        baseClient = await createClient(context);
        const activeProfile = await profileManager.getActiveProfile();
        if (!activeProfile) {
            vscode.window.showErrorMessage('No active profile. Please create a profile first.');
            return;
        }
        targetProfileName = activeProfile.name;
    }

    if (!baseClient) {
        // Error message already shown by createClient/createClientForProfile
        return;
    }

    // Get the profile details
    const profiles = await profileManager.getProfiles();
    const targetProfile = profiles.find(p => p.name === targetProfileName);
    if (!targetProfile) {
        vscode.window.showErrorMessage(`Profile '${targetProfileName}' not found.`);
        return;
    }

    const credentials = await profileManager.getProfileCredentials(targetProfileName);
    if (!credentials) {
        vscode.window.showErrorMessage(`No credentials found for profile '${targetProfileName}'.`);
        return;
    }

    const client = new CustomFieldsClient({
        accessId: credentials.accessId,
        accessKey: credentials.accessKey,
        endpoint: profileManager.getProfileEndpoint(targetProfile)
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
            for (const fieldName of fieldNames) {
                await dynamicProvider.addCustomField(fieldName);
            }
        }

        // Format as table
        const tableText = CustomFieldsClient.formatCustomFieldsAsTable(customFields);

        const outputText = `Sumo Logic Custom Fields (${targetProfile.name})\n` +
                          `==========================================\n` +
                          `Total: ${customFields.length} fields\n` +
                          `\n` +
                          tableText +
                          `\n` +
                          `\nℹ️ Custom field names have been added to autocomplete.`;

        // Write to file
        const outputWriter = new OutputWriter(context);
        const filename = `customfields_${targetProfile.name}`;

        try {
            await outputWriter.writeAndOpen('customfields', filename, outputText, 'txt');
            vscode.window.showInformationMessage(
                `Found ${customFields.length} custom fields. Names added to autocomplete.`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write custom fields data: ${error}`);
        }
    });
}

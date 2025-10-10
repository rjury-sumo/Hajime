import * as vscode from 'vscode';
import { PartitionsClient } from '../api/partitions';
import { createClient } from './authenticate';
import { getDynamicCompletionProvider } from '../extension';
import { OutputWriter } from '../outputWriter';

/**
 * Command to fetch partitions, display them, and add to autocomplete
 */
export async function fetchPartitionsCommand(context: vscode.ExtensionContext): Promise<void> {
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

    const client = new PartitionsClient({
        accessId: credentials.accessId,
        accessKey: credentials.accessKey,
        endpoint: pm.getProfileEndpoint(activeProfile)
    });

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Fetching partitions from Sumo Logic...',
        cancellable: false
    }, async (progress) => {
        const response = await client.listPartitions();

        if (response.error) {
            // Check if it's a permission error
            if (response.statusCode === 403 || response.statusCode === 401) {
                vscode.window.showWarningMessage(
                    'Unable to fetch partitions: Insufficient permissions. ' +
                    'Your user role may not have "View Partitions" capability.'
                );
            } else {
                vscode.window.showErrorMessage(`Failed to fetch partitions: ${response.error}`);
            }
            return;
        }

        if (!response.data || !response.data.data) {
            vscode.window.showWarningMessage('No partitions returned from API.');
            return;
        }

        const partitions = response.data.data;

        if (partitions.length === 0) {
            vscode.window.showInformationMessage('No partitions found in this organization.');
            return;
        }

        // Sort by name ascending
        partitions.sort((a, b) => a.name.localeCompare(b.name));

        // Extract partition names
        const partitionNames = PartitionsClient.extractPartitionNames(response.data);

        // Add to dynamic completion provider
        const dynamicProvider = getDynamicCompletionProvider();
        if (dynamicProvider) {
            for (const name of partitionNames) {
                await dynamicProvider.addPartition(name);
            }
        }

        // Format as table
        const tableText = PartitionsClient.formatPartitionsAsTable(partitions);

        const outputText = `Sumo Logic Partitions (${activeProfile.name})\n` +
                          `=========================================\n` +
                          `Total: ${partitions.length} partitions\n` +
                          `\n` +
                          `Use in queries: _index=partition_name or _view=partition_name\n` +
                          `\n` +
                          tableText +
                          `\n` +
                          `\nℹ️ Partition names have been added to autocomplete for _index and _view.`;

        // Write to file
        const outputWriter = new OutputWriter(context);
        const filename = `partitions_${activeProfile.name}`;

        try {
            await outputWriter.writeAndOpen('partitions', filename, outputText, 'txt');
            vscode.window.showInformationMessage(
                `Found ${partitions.length} partitions. Names added to autocomplete.`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write partitions data: ${error}`);
        }
    });
}

import * as vscode from 'vscode';
import { CollectorsClient } from '../api/collectors';
import { createClient } from './authenticate';
import { OutputWriter } from '../outputWriter';

/**
 * Helper to create and configure a CollectorsClient for the active profile
 */
async function createCollectorsClient(context: vscode.ExtensionContext): Promise<CollectorsClient | null> {
    const baseClient = await createClient(context);
    if (!baseClient) {
        vscode.window.showErrorMessage('No active profile. Please create a profile first.');
        return null;
    }

    const profileManager = await import('../profileManager');
    const pm = new profileManager.ProfileManager(context);
    const activeProfile = await pm.getActiveProfile();

    if (!activeProfile) {
        vscode.window.showErrorMessage('No active profile found.');
        return null;
    }

    const credentials = await pm.getProfileCredentials(activeProfile.name);
    if (!credentials) {
        vscode.window.showErrorMessage('No credentials found for active profile.');
        return null;
    }

    return new CollectorsClient({
        accessId: credentials.accessId,
        accessKey: credentials.accessKey,
        endpoint: pm.getProfileEndpoint(activeProfile)
    });
}

/**
 * Command to fetch collectors and save to file
 */
export async function fetchCollectorsCommand(context: vscode.ExtensionContext): Promise<void> {
    const client = await createCollectorsClient(context);
    if (!client) {
        return;
    }

    const profileManager = await import('../profileManager');
    const pm = new profileManager.ProfileManager(context);
    const activeProfile = await pm.getActiveProfile();
    if (!activeProfile) {
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Fetching collectors from Sumo Logic...',
        cancellable: false
    }, async (progress) => {
        // Fetch all collectors with automatic pagination
        const response = await client.fetchAllCollectors();

        if (response.error) {
            // Check if it's a permission error
            if (response.statusCode === 403 || response.statusCode === 401) {
                vscode.window.showWarningMessage(
                    'Unable to fetch collectors: Insufficient permissions. ' +
                    'Your user role may not have "Manage or View Collectors" capability.'
                );
            } else {
                vscode.window.showErrorMessage(`Failed to fetch collectors: ${response.error}`);
            }
            return;
        }

        if (!response.data || !response.data.collectors) {
            vscode.window.showWarningMessage('No collectors returned from API.');
            return;
        }

        const collectors = response.data.collectors;

        if (collectors.length === 0) {
            vscode.window.showInformationMessage('No collectors found in this organization.');
            return;
        }

        // Sort by name ascending
        collectors.sort((a, b) => a.name.localeCompare(b.name));

        // Get statistics
        const stats = CollectorsClient.getCollectorStats(collectors);

        // Format as table
        const tableText = CollectorsClient.formatCollectorsAsTable(collectors);

        // Build statistics text
        let statsText = `Statistics:\n`;
        statsText += `  Total Collectors: ${stats.total}\n`;
        statsText += `  Alive: ${stats.alive}\n`;
        statsText += `  Dead: ${stats.dead}\n`;
        statsText += `  Ephemeral: ${stats.ephemeral}\n`;
        statsText += `  By Type:\n`;
        Object.entries(stats.byType).forEach(([type, count]) => {
            statsText += `    ${type}: ${count}\n`;
        });

        const outputText = `Sumo Logic Collectors (${activeProfile.name})\n` +
                          `=========================================\n` +
                          `Total: ${collectors.length} collectors\n` +
                          `\n` +
                          `${statsText}\n` +
                          tableText;

        // Write to file
        const outputWriter = new OutputWriter(context);
        const filename = `collectors_${activeProfile.name}`;

        try {
            await outputWriter.writeAndOpen('collectors', filename, outputText, 'txt');
            vscode.window.showInformationMessage(
                `Found ${collectors.length} collectors (${stats.alive} alive, ${stats.dead} dead).`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write collectors data: ${error}`);
        }
    });
}

/**
 * Command to get a collector by ID
 */
export async function getCollectorCommand(context: vscode.ExtensionContext): Promise<void> {
    const client = await createCollectorsClient(context);
    if (!client) {
        return;
    }

    const profileManager = await import('../profileManager');
    const pm = new profileManager.ProfileManager(context);
    const activeProfile = await pm.getActiveProfile();
    if (!activeProfile) {
        return;
    }

    // Prompt user for collector ID
    const collectorIdInput = await vscode.window.showInputBox({
        prompt: 'Enter Collector ID',
        placeHolder: '12345678',
        validateInput: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num <= 0) {
                return 'Please enter a valid positive number';
            }
            return null;
        }
    });

    if (!collectorIdInput) {
        return;
    }

    const collectorId = parseInt(collectorIdInput, 10);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Fetching collector ${collectorId}...`,
        cancellable: false
    }, async (progress) => {
        const response = await client.getCollector(collectorId);

        if (response.error) {
            if (response.statusCode === 403 || response.statusCode === 401) {
                vscode.window.showWarningMessage(
                    'Unable to fetch collector: Insufficient permissions. ' +
                    'Your user role may not have "Manage or View Collectors" capability.'
                );
            } else if (response.statusCode === 404) {
                vscode.window.showErrorMessage(`Collector ${collectorId} not found.`);
            } else {
                vscode.window.showErrorMessage(`Failed to fetch collector: ${response.error}`);
            }
            return;
        }

        if (!response.data || !response.data.collector) {
            vscode.window.showWarningMessage('No collector data returned from API.');
            return;
        }

        const collector = response.data.collector;

        // Format as JSON
        const outputText = JSON.stringify(collector, null, 2);

        // Write to file
        const outputWriter = new OutputWriter(context);
        const filename = `collector_${collectorId}_${activeProfile.name}`;

        try {
            await outputWriter.writeAndOpen('collectors', filename, outputText, 'json');
            vscode.window.showInformationMessage(
                `Collector: ${collector.name} (ID: ${collector.id}, Type: ${collector.collectorType})`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write collector data: ${error}`);
        }
    });
}

/**
 * Command to get sources for a collector
 */
export async function getSourcesCommand(context: vscode.ExtensionContext): Promise<void> {
    const client = await createCollectorsClient(context);
    if (!client) {
        return;
    }

    const profileManager = await import('../profileManager');
    const pm = new profileManager.ProfileManager(context);
    const activeProfile = await pm.getActiveProfile();
    if (!activeProfile) {
        return;
    }

    // Prompt user for collector ID
    const collectorIdInput = await vscode.window.showInputBox({
        prompt: 'Enter Collector ID to fetch sources',
        placeHolder: '12345678',
        validateInput: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num <= 0) {
                return 'Please enter a valid positive number';
            }
            return null;
        }
    });

    if (!collectorIdInput) {
        return;
    }

    const collectorId = parseInt(collectorIdInput, 10);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Fetching sources for collector ${collectorId}...`,
        cancellable: false
    }, async (progress) => {
        const response = await client.fetchAllSources(collectorId);

        if (response.error) {
            if (response.statusCode === 403 || response.statusCode === 401) {
                vscode.window.showWarningMessage(
                    'Unable to fetch sources: Insufficient permissions. ' +
                    'Your user role may not have "Manage or View Collectors" capability.'
                );
            } else if (response.statusCode === 404) {
                vscode.window.showErrorMessage(`Collector ${collectorId} not found.`);
            } else {
                vscode.window.showErrorMessage(`Failed to fetch sources: ${response.error}`);
            }
            return;
        }

        if (!response.data || !response.data.sources) {
            vscode.window.showWarningMessage('No sources returned from API.');
            return;
        }

        const sources = response.data.sources;

        if (sources.length === 0) {
            vscode.window.showInformationMessage(`No sources found for collector ${collectorId}.`);
            return;
        }

        // Sort by name ascending
        sources.sort((a, b) => a.name.localeCompare(b.name));

        // Format as JSON
        const outputText = JSON.stringify(sources, null, 2);

        // Write to file
        const outputWriter = new OutputWriter(context);
        const filename = `collector_${collectorId}_sources_${activeProfile.name}`;

        try {
            await outputWriter.writeAndOpen('collectors', filename, outputText, 'json');

            // Count alive vs dead sources
            const aliveCount = sources.filter(s => s.alive).length;
            const deadCount = sources.length - aliveCount;

            vscode.window.showInformationMessage(
                `Found ${sources.length} sources for collector ${collectorId} (${aliveCount} alive, ${deadCount} dead).`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write sources data: ${error}`);
        }
    });
}

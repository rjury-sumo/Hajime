import * as vscode from 'vscode';
import { SearchJobClient, SearchJobRequest, SearchJobStatus } from '../api/searchJob';
import { createClient } from './authenticate';
import { OutputWriter } from '../outputWriter';
import { chartCSVCommand } from './chartCSV';
import { ProfileManager } from '../profileManager';
import {
    parseQueryMetadata,
    cleanQuery,
    extractQueryParams,
    substituteParams
} from '../services/queryMetadata';

/**
 * Format records as CSV
 */
function formatRecordsAsCSV(records: any[]): string {
    if (records.length === 0) {
        return 'No results found';
    }

    // Get all unique keys from all records
    const allKeys = new Set<string>();
    records.forEach(record => {
        Object.keys(record.map).forEach(key => allKeys.add(key));
    });

    const keys = Array.from(allKeys);

    // Helper to escape CSV values
    const escapeCSV = (value: any): string => {
        const str = String(value || '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    // Create header
    let csv = keys.map(escapeCSV).join(',') + '\n';

    // Create rows
    records.forEach(record => {
        const row = keys.map(key => escapeCSV(record.map[key])).join(',');
        csv += row + '\n';
    });

    return csv;
}

/**
 * Command to run query and automatically chart the results
 */
export async function runQueryAndChartCommand(context: vscode.ExtensionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    if (editor.document.languageId !== 'sumo') {
        vscode.window.showErrorMessage('Current file is not a Sumo Logic query (.sumo)');
        return;
    }

    // Get client for active profile
    const baseClient = await createClient(context);
    if (!baseClient) {
        vscode.window.showErrorMessage('No credentials configured. Please run "Sumo Logic: Configure Credentials" first.');
        return;
    }

    // Get active profile credentials
    const profileManager = new ProfileManager(context);
    const activeProfile = await profileManager.getActiveProfile();
    if (!activeProfile) {
        vscode.window.showErrorMessage('No active profile found. Please select a profile first.');
        return;
    }

    const credentials = await profileManager.getProfileCredentials(activeProfile.name);
    if (!credentials) {
        vscode.window.showErrorMessage(`No credentials found for profile '${activeProfile.name}'`);
        return;
    }

    const client = new SearchJobClient({
        accessId: credentials.accessId,
        accessKey: credentials.accessKey,
        endpoint: baseClient.getEndpoint()
    });

    // Get query text
    const queryText = editor.document.getText();
    if (!queryText.trim()) {
        vscode.window.showErrorMessage('Query is empty');
        return;
    }

    // Parse metadata from comments
    const metadata = parseQueryMetadata(queryText);
    let cleanedQuery = cleanQuery(queryText);

    // Handle query parameters
    const queryParams = extractQueryParams(cleanedQuery);
    const paramValues = metadata.params || new Map<string, string>();

    // Check for missing parameters
    const missingParams: string[] = [];
    for (const param of queryParams) {
        if (!paramValues.has(param)) {
            missingParams.push(param);
        }
    }

    // Prompt for missing parameters
    if (missingParams.length > 0) {
        vscode.window.showWarningMessage(
            `Missing parameter values for: ${missingParams.join(', ')}. Using default values from @param directives or prompting.`
        );

        for (const param of missingParams) {
            const value = await vscode.window.showInputBox({
                prompt: `Enter value for parameter '${param}'`,
                value: '*',
                ignoreFocusOut: true
            });

            if (value === undefined) {
                return; // User cancelled
            }

            paramValues.set(param, value);
        }
    }

    // Substitute parameters
    cleanedQuery = substituteParams(cleanedQuery, paramValues);

    // Prompt for time range if not specified
    let from = metadata.from;
    let to = metadata.to;

    if (!from) {
        from = await vscode.window.showInputBox({
            prompt: 'Enter start time (e.g., -1h, -30m, -1d, or ISO timestamp)',
            value: '-1h',
            ignoreFocusOut: true
        });

        if (!from) {
            return; // User cancelled
        }
    }

    if (!to) {
        to = await vscode.window.showInputBox({
            prompt: 'Enter end time (e.g., now, -30m, or ISO timestamp)',
            value: 'now',
            ignoreFocusOut: true
        });

        if (!to) {
            return; // User cancelled
        }
    }

    // Parse relative times
    const fromTime = SearchJobClient.parseRelativeTime(from);
    const toTime = SearchJobClient.parseRelativeTime(to);

    const request: SearchJobRequest = {
        query: cleanedQuery,
        from: fromTime,
        to: toTime,
        timeZone: metadata.timeZone || 'UTC',
        byReceiptTime: metadata.byReceiptTime,
        autoParsingMode: metadata.autoParsingMode
    };

    // Enable debug mode if requested
    const debugMode = metadata.debug || false;
    let debugChannel: vscode.OutputChannel | undefined;
    if (debugMode) {
        debugChannel = vscode.window.createOutputChannel('Sumo Logic Quick Chart Debug');
        debugChannel.show(true); // Show but don't focus
        debugChannel.appendLine('=== Sumo Logic Quick Chart Debug Log ===');
        debugChannel.appendLine(`Time: ${new Date().toISOString()}`);
        debugChannel.appendLine('');
        debugChannel.appendLine(`Profile: ${activeProfile.name}`);
        debugChannel.appendLine(`Endpoint: ${client.getEndpoint()}`);
        debugChannel.appendLine('');
        debugChannel.appendLine('--- Query ---');
        debugChannel.appendLine(cleanedQuery);
        debugChannel.appendLine('');
        debugChannel.appendLine('--- Request Payload ---');
        debugChannel.appendLine(JSON.stringify(request, null, 2));
        debugChannel.appendLine('');
    }

    // Execute search with progress
    let csvFilePath: string | undefined;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Running query and generating chart...',
        cancellable: false
    }, async (progress) => {
        progress.report({ message: 'Creating search job...' });

        // Create job
        const createResponse = await client.createSearchJob(request);
        if (createResponse.error || !createResponse.data) {
            if (debugChannel) {
                debugChannel.appendLine('--- Create Job Error ---');
                debugChannel.appendLine(`Error: ${createResponse.error}`);
                debugChannel.appendLine(`Status Code: ${createResponse.statusCode}`);
                debugChannel.appendLine('');
            }
            vscode.window.showErrorMessage(`Failed to create search job: ${createResponse.error}`);
            return;
        }

        if (debugChannel) {
            debugChannel.appendLine('--- Create Job Response ---');
            debugChannel.appendLine(JSON.stringify(createResponse.data, null, 2));
            debugChannel.appendLine('');
        }

        const jobId = createResponse.data.id;
        progress.report({ message: `Job created: ${jobId}` });

        // Poll for completion
        const pollResponse = await client.pollForCompletion(jobId, (status: SearchJobStatus) => {
            progress.report({
                message: `State: ${status.state}, Records: ${status.recordCount}`
            });
        });

        if (pollResponse.error) {
            vscode.window.showErrorMessage(`Search job failed: ${pollResponse.error}`);
            return;
        }

        progress.report({ message: 'Fetching results...' });

        // Fetch records (forced to records mode for charting)
        const recordsResponse = await client.getRecords(jobId);
        if (recordsResponse.error || !recordsResponse.data) {
            vscode.window.showErrorMessage(`Failed to fetch records: ${recordsResponse.error}`);
            await client.deleteSearchJob(jobId);
            return;
        }

        const results = recordsResponse.data.records;

        // Clean up job
        await client.deleteSearchJob(jobId);

        if (results.length === 0) {
            vscode.window.showInformationMessage('Query completed: No results found');
            return;
        }

        progress.report({ message: 'Generating CSV and chart...' });

        // Format as CSV
        const csvContent = formatRecordsAsCSV(results);

        // Write CSV to file
        const outputWriter = new OutputWriter(context);
        const queryIdentifier = metadata.name || cleanedQuery.split('\n')[0].substring(0, 50);
        const filename = `query_${queryIdentifier}_records_${from}_to_${to}`;

        try {
            csvFilePath = await outputWriter.writeOutput('queries', filename, csvContent, 'csv');
            vscode.window.showInformationMessage(`Query completed: ${results.length} records found`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write CSV: ${error}`);
            return;
        }
    });

    // Launch chart if CSV was created
    if (csvFilePath) {
        const uri = vscode.Uri.file(csvFilePath);
        await chartCSVCommand(context, uri);
    }
}

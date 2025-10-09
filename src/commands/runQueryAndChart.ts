import * as vscode from 'vscode';
import { SearchJobClient, SearchJobRequest, SearchJobStatus } from '../api/searchJob';
import { createClient } from './authenticate';
import { OutputWriter } from '../outputWriter';
import { chartCSVCommand } from './chartCSV';

/**
 * Parse query metadata from comments
 */
function parseQueryMetadata(queryText: string): {
    name?: string;
    from?: string;
    to?: string;
    timeZone?: string;
} {
    const metadata: {
        name?: string;
        from?: string;
        to?: string;
        timeZone?: string;
    } = {};

    const lines = queryText.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();

        const nameMatch = trimmed.match(/^\/\/\s*@name\s+(.+)$/i);
        if (nameMatch) {
            metadata.name = nameMatch[1].trim();
            continue;
        }

        const fromMatch = trimmed.match(/^\/\/\s*@from\s+(.+)$/i);
        if (fromMatch) {
            metadata.from = fromMatch[1].trim();
            continue;
        }

        const toMatch = trimmed.match(/^\/\/\s*@to\s+(.+)$/i);
        if (toMatch) {
            metadata.to = toMatch[1].trim();
            continue;
        }

        const tzMatch = trimmed.match(/^\/\/\s*@timezone\s+(.+)$/i);
        if (tzMatch) {
            metadata.timeZone = tzMatch[1].trim();
            continue;
        }
    }

    return metadata;
}

/**
 * Remove metadata comments from query
 */
function cleanQuery(queryText: string): string {
    const lines = queryText.split('\n');
    const cleanedLines = lines.filter(line => {
        const trimmed = line.trim();
        return !trimmed.match(/^\/\/\s*@(name|from|to|timezone|mode|output)\s+/i);
    });
    return cleanedLines.join('\n').trim();
}

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

    // Get client
    const baseClient = await createClient(context);
    if (!baseClient) {
        vscode.window.showErrorMessage('No credentials configured. Please run "Sumo Logic: Configure Credentials" first.');
        return;
    }

    const client = new SearchJobClient({
        accessId: (await context.secrets.get('sumologic.accessId'))!,
        accessKey: (await context.secrets.get('sumologic.accessKey'))!,
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
    const cleanedQuery = cleanQuery(queryText);

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
        timeZone: metadata.timeZone || 'UTC'
    };

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
            vscode.window.showErrorMessage(`Failed to create search job: ${createResponse.error}`);
            return;
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

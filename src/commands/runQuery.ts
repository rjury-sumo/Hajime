import * as vscode from 'vscode';
import { SearchJobClient, SearchJobRequest, SearchJobStatus } from '../api/searchJob';
import { createClient } from './authenticate';
import { getDynamicCompletionProvider } from '../extension';
import { OutputWriter } from '../outputWriter';

/**
 * Parse query metadata from comments
 * Looks for special comments like:
 * // @name my-query-name
 * // @from -1h
 * // @to now
 * // @timezone UTC
 * // @mode messages
 * // @output csv
 */
function parseQueryMetadata(queryText: string): {
    name?: string;
    from?: string;
    to?: string;
    timeZone?: string;
    mode?: 'records' | 'messages';
    output?: 'table' | 'json' | 'csv';
} {
    const metadata: {
        name?: string;
        from?: string;
        to?: string;
        timeZone?: string;
        mode?: 'records' | 'messages';
        output?: 'table' | 'json' | 'csv';
    } = {};

    const lines = queryText.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();

        // Match @name directive
        const nameMatch = trimmed.match(/^\/\/\s*@name\s+(.+)$/i);
        if (nameMatch) {
            metadata.name = nameMatch[1].trim();
            continue;
        }

        // Match @from directive
        const fromMatch = trimmed.match(/^\/\/\s*@from\s+(.+)$/i);
        if (fromMatch) {
            metadata.from = fromMatch[1].trim();
            continue;
        }

        // Match @to directive
        const toMatch = trimmed.match(/^\/\/\s*@to\s+(.+)$/i);
        if (toMatch) {
            metadata.to = toMatch[1].trim();
            continue;
        }

        // Match @timezone directive
        const tzMatch = trimmed.match(/^\/\/\s*@timezone\s+(.+)$/i);
        if (tzMatch) {
            metadata.timeZone = tzMatch[1].trim();
            continue;
        }

        // Match @mode directive
        const modeMatch = trimmed.match(/^\/\/\s*@mode\s+(records|messages)$/i);
        if (modeMatch) {
            metadata.mode = modeMatch[1].toLowerCase() as 'records' | 'messages';
            continue;
        }

        // Match @output directive
        const outputMatch = trimmed.match(/^\/\/\s*@output\s+(table|json|csv)$/i);
        if (outputMatch) {
            metadata.output = outputMatch[1].toLowerCase() as 'table' | 'json' | 'csv';
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
 * Detect if query is an aggregation (has aggregation operators)
 */
function isAggregationQuery(query: string): boolean {
    const aggregationOperators = [
        'count', 'sum', 'avg', 'min', 'max', 'stddev', 'pct',
        'first', 'last', 'most_recent', 'least_recent',
        'count_distinct', 'count_frequent', 'fillmissing',
        'transpose', 'timeslice', 'rollingstd'
    ];

    const lowerQuery = query.toLowerCase();
    return aggregationOperators.some(op =>
        lowerQuery.includes(`| ${op}`) ||
        lowerQuery.includes(`|${op}`)
    );
}

/**
 * Format records as a table string
 */
function formatRecordsAsTable(records: any[]): string {
    if (records.length === 0) {
        return 'No results found';
    }

    // Get all unique keys from all records
    const allKeys = new Set<string>();
    records.forEach(record => {
        Object.keys(record.map).forEach(key => allKeys.add(key));
    });

    const keys = Array.from(allKeys);
    const columnWidths = keys.map(key => {
        const maxValueLength = Math.max(
            key.length,
            ...records.map(r => String(r.map[key] || '').length)
        );
        return Math.min(maxValueLength, 50); // Cap at 50 chars
    });

    // Create header
    let table = keys.map((key, i) => key.padEnd(columnWidths[i])).join(' | ') + '\n';
    table += columnWidths.map(w => '-'.repeat(w)).join('-+-') + '\n';

    // Create rows
    records.forEach(record => {
        const row = keys.map((key, i) => {
            const value = String(record.map[key] || '');
            return value.substring(0, 50).padEnd(columnWidths[i]);
        }).join(' | ');
        table += row + '\n';
    });

    return table;
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
        // If contains comma, quote, or newline, wrap in quotes and escape quotes
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
 * Format results as JSON
 */
function formatResultsAsJSON(results: any[]): string {
    return JSON.stringify(results, null, 2);
}

/**
 * Command to run the current query
 */
export async function runQueryCommand(context: vscode.ExtensionContext): Promise<void> {
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

    // Determine mode: explicit from metadata, user choice, or auto-detect
    let mode: 'records' | 'messages' = metadata.mode || 'records';

    // If no explicit mode and query doesn't look like aggregation, prompt user
    if (!metadata.mode && !isAggregationQuery(cleanedQuery)) {
        const modeChoice = await vscode.window.showQuickPick(
            [
                { label: 'Messages (Raw Events)', value: 'messages', description: 'Return raw log messages' },
                { label: 'Records (Aggregated)', value: 'records', description: 'Return aggregated results' }
            ],
            {
                placeHolder: 'This appears to be a raw search. Select result type:',
                ignoreFocusOut: true
            }
        );

        if (!modeChoice) {
            return; // User cancelled
        }
        mode = modeChoice.value as 'records' | 'messages';
    }

    // Determine output format: explicit from metadata or prompt user
    let outputFormat: 'table' | 'json' | 'csv' = metadata.output || 'table';

    // If no explicit output format, prompt user
    if (!metadata.output) {
        const formatOptions = mode === 'records'
            ? [
                { label: 'Table', value: 'table', description: 'Formatted table view' },
                { label: 'JSON', value: 'json', description: 'JSON format' },
                { label: 'CSV', value: 'csv', description: 'CSV format (records only)' }
              ]
            : [
                { label: 'Table', value: 'table', description: 'Formatted table view' },
                { label: 'JSON', value: 'json', description: 'JSON format' }
              ];

        const formatChoice = await vscode.window.showQuickPick(formatOptions, {
            placeHolder: 'Select output format:',
            ignoreFocusOut: true
        });

        if (!formatChoice) {
            return; // User cancelled
        }
        outputFormat = formatChoice.value as 'table' | 'json' | 'csv';
    } else {
        // Validate that CSV is only used with records mode
        if (outputFormat === 'csv' && mode === 'messages') {
            vscode.window.showWarningMessage('CSV format is only available for records mode. Using table format instead.');
            outputFormat = 'table';
        }
    }

    const request: SearchJobRequest = {
        query: cleanedQuery,
        from: fromTime,
        to: toTime,
        timeZone: metadata.timeZone || 'UTC'
    };

    // Execute search with progress
    let jobId: string | undefined;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Running Sumo Logic query...',
        cancellable: false
    }, async (progress) => {
        progress.report({ message: 'Creating search job...' });

        // Create job
        const createResponse = await client.createSearchJob(request);
        if (createResponse.error || !createResponse.data) {
            vscode.window.showErrorMessage(`Failed to create search job: ${createResponse.error}`);
            return;
        }

        jobId = createResponse.data.id;
        progress.report({ message: `Job created: ${jobId}` });

        // Poll for completion
        const pollResponse = await client.pollForCompletion(jobId, (status: SearchJobStatus) => {
            progress.report({
                message: `State: ${status.state}, Records: ${status.recordCount}, Messages: ${status.messageCount}`
            });
        });

        if (pollResponse.error) {
            vscode.window.showErrorMessage(`Search job failed: ${pollResponse.error}`);
            return;
        }

        progress.report({ message: 'Fetching results...' });

        // Fetch results based on mode
        let results: any[];
        let resultCount: number;

        if (mode === 'messages') {
            const messagesResponse = await client.getMessages(jobId);
            if (messagesResponse.error || !messagesResponse.data) {
                vscode.window.showErrorMessage(`Failed to fetch messages: ${messagesResponse.error}`);
                await client.deleteSearchJob(jobId);
                return;
            }
            results = messagesResponse.data.messages;
            resultCount = results.length;
        } else {
            const recordsResponse = await client.getRecords(jobId);
            if (recordsResponse.error || !recordsResponse.data) {
                vscode.window.showErrorMessage(`Failed to fetch records: ${recordsResponse.error}`);
                await client.deleteSearchJob(jobId);
                return;
            }
            results = recordsResponse.data.records;
            resultCount = results.length;
        }

        // Clean up job
        await client.deleteSearchJob(jobId);

        // Display results
        if (results.length === 0) {
            vscode.window.showInformationMessage('Query completed: No results found');
            return;
        }


        // Add discovered fields to autocomplete
        const dynamicProvider = getDynamicCompletionProvider();
        if (dynamicProvider) {
            dynamicProvider.addFieldsFromResults(results);
            const fieldCount = dynamicProvider.getFieldCount();
            console.log(`Dynamic autocomplete now has ${fieldCount} discovered fields`);
        }

        // Format results based on selected format
        let resultText: string;
        let fileExtension: string;

        switch (outputFormat) {
            case 'json':
                resultText = formatResultsAsJSON(results);
                fileExtension = 'json';
                break;
            case 'csv':
                resultText = formatRecordsAsCSV(results);
                fileExtension = 'csv';
                break;
            case 'table':
            default:
                resultText = `Sumo Logic Query Results (${mode} - ${outputFormat})\n` +
                             `====================================\n` +
                             `Query: ${cleanedQuery.split('\n')[0]}...\n` +
                             `From: ${from} (${fromTime})\n` +
                             `To: ${to} (${toTime})\n` +
                             `Results: ${resultCount} ${mode}\n` +
                             `\n` +
                             formatRecordsAsTable(results);
                fileExtension = 'txt';
                break;
        }

        // Write results to file
        const outputWriter = new OutputWriter(context);
        const queryIdentifier = metadata.name || cleanedQuery.split('\n')[0].substring(0, 50);
        const filename = `query_${queryIdentifier}_${mode}_${from}_to_${to}`;

        try {
            const filePath = await outputWriter.writeAndOpen('queries', filename, resultText, fileExtension);
            vscode.window.showInformationMessage(`Query completed: ${resultCount} ${mode} found (${outputFormat} format)`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write results: ${error}`);
        }
    });
}

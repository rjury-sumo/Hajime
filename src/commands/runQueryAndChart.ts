import * as vscode from 'vscode';
import { SearchJobClient, SearchJobRequest } from '../api/searchJob';
import { chartCSVCommand } from './chartCSV';
import {
    getActiveProfileClient,
    processQueryMetadata,
    promptForTimeRange,
    executeSearchJob,
    saveQueryResults,
    updateDynamicFieldAutocomplete,
    formatRecordsAsCSV
} from './runQuery';

/**
 * Command to run query and automatically chart the results
 * This command forces records mode and CSV output, then launches the chart command
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

    // Get query text
    const queryText = editor.document.getText();
    if (!queryText.trim()) {
        vscode.window.showErrorMessage('Query is empty');
        return;
    }

    // Get authenticated client using shared function
    const clientResult = await getActiveProfileClient(context);
    if (!clientResult) {
        return;
    }
    const { client, profileName } = clientResult;

    // Process metadata and parameters using shared function
    const metadataResult = await processQueryMetadata(queryText);
    if (!metadataResult) {
        return; // User cancelled
    }
    const { metadata, cleanedQuery } = metadataResult;

    // Prompt for time range using shared function
    const timeRangeResult = await promptForTimeRange(metadata);
    if (!timeRangeResult) {
        return; // User cancelled
    }
    const { from, to } = timeRangeResult;

    // Parse relative times
    const fromTime = SearchJobClient.parseRelativeTime(from);
    const toTime = SearchJobClient.parseRelativeTime(to);

    // Create search job request (preserve all metadata directives)
    const request: SearchJobRequest = {
        query: cleanedQuery,
        from: fromTime,
        to: toTime,
        timeZone: metadata.timeZone || 'UTC',
        byReceiptTime: metadata.byReceiptTime,
        autoParsingMode: metadata.autoParsingMode
    };

    // Enable debug mode if requested
    let debugChannel: vscode.OutputChannel | undefined;
    if (metadata.debug) {
        debugChannel = vscode.window.createOutputChannel('Sumo Logic Quick Chart Debug');
        debugChannel.show(true);
        debugChannel.appendLine('=== Sumo Logic Quick Chart Debug Log ===');
        debugChannel.appendLine(`Time: ${new Date().toISOString()}`);
        debugChannel.appendLine('');
        debugChannel.appendLine(`Profile: ${profileName}`);
        debugChannel.appendLine(`Endpoint: ${client.getEndpoint()}`);
        debugChannel.appendLine('');
        debugChannel.appendLine('--- Query ---');
        debugChannel.appendLine(cleanedQuery);
        debugChannel.appendLine('');
    }

    // Execute search job using shared function (forced to records mode for charting)
    const jobResult = await executeSearchJob(client, request, 'records', {
        progressTitle: 'Running query and generating chart...',
        debugChannel
    });

    if (!jobResult) {
        return;
    }

    const { results } = jobResult;

    if (results.length === 0) {
        vscode.window.showInformationMessage('Query completed: No results found');
        return;
    }

    // Update dynamic field autocomplete
    updateDynamicFieldAutocomplete(results);

    // Format as CSV
    const csvContent = formatRecordsAsCSV(results);

    // Save CSV file using shared function
    const queryIdentifier = metadata.name || cleanedQuery.split('\n')[0].substring(0, 50);
    const csvFilePath = await saveQueryResults(context, results, {
        queryIdentifier,
        mode: 'records',
        from,
        to,
        format: 'csv',
        content: csvContent
    });

    if (!csvFilePath) {
        return;
    }

    vscode.window.showInformationMessage(`Query completed: ${results.length} records found`);

    // Launch chart command with the CSV file
    const uri = vscode.Uri.file(csvFilePath);
    await chartCSVCommand(context, uri);
}

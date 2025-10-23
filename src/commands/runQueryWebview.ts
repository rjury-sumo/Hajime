import * as vscode from 'vscode';
import { SearchJobClient, SearchJobRequest } from '../api/searchJob';
import { getSumoExplorerProvider } from '../extension';
import { formatRecordsAsHTML } from './runQuery';
import { FieldAnalyzer } from '../services/fieldAnalyzer';
import {
    getActiveProfileClient,
    processQueryMetadata,
    promptForTimeRange,
    determineQueryMode,
    executeSearchJob,
    saveQueryResults,
    updateDynamicFieldAutocomplete
} from './runQuery';

/**
 * Command to run query and force webview output
 * This command always displays results in a webview, ignoring @output directive
 */
export async function runQueryWebviewCommand(context: vscode.ExtensionContext): Promise<void> {
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
    const { client } = clientResult;

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

    // Determine mode using shared function
    const mode = await determineQueryMode(metadata, cleanedQuery);
    if (!mode) {
        return; // User cancelled
    }

    // Create search job request (preserve all metadata directives)
    const request: SearchJobRequest = {
        query: cleanedQuery,
        from: fromTime,
        to: toTime,
        timeZone: metadata.timeZone || 'UTC',
        byReceiptTime: metadata.byReceiptTime,
        autoParsingMode: metadata.autoParsingMode
    };

    // Execute search job using shared function
    const jobResult = await executeSearchJob(client, request, mode);
    if (!jobResult) {
        return;
    }

    const { results, executionTime, jobStats } = jobResult;

    if (results.length === 0) {
        vscode.window.showInformationMessage('Query completed: No results found');
        return;
    }

    // Update dynamic field autocomplete
    updateDynamicFieldAutocomplete(results);

    // Save JSON file to queries subfolder using shared function
    const queryIdentifier = metadata.name || cleanedQuery.split('\n')[0].substring(0, 50);
    const jsonContent = JSON.stringify(results, null, 2);
    const jsonFilePath = await saveQueryResults(context, results, {
        queryIdentifier,
        mode,
        from,
        to,
        format: 'json',
        content: jsonContent
    });

    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
        'sumoQueryResults',
        `Query Results: ${metadata.name || cleanedQuery.split('\n')[0].substring(0, 30)}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // Get page size from settings
    const config = vscode.workspace.getConfiguration('sumologic');
    const pageSize = config.get<number>('webviewPageSize') || 200;

    // Generate HTML content
    const htmlContent = formatRecordsAsHTML(results, {
        query: cleanedQuery,
        from: from,
        to: to,
        mode: mode,
        count: results.length,
        pageSize: pageSize,
        executionTime: executionTime,
        jobStats: jobStats,
        jsonFilePath: jsonFilePath
    });

    panel.webview.html = htmlContent;

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            const fs = await import('fs');
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const defaultUri = workspaceFolder
                ? vscode.Uri.file(workspaceFolder.uri.fsPath)
                : undefined;

            if (message.command === 'exportCSV') {
                // Prompt user for save location
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: defaultUri,
                    filters: {
                        'CSV Files': ['csv'],
                        'All Files': ['*']
                    },
                    saveLabel: 'Export CSV'
                });

                if (uri) {
                    fs.writeFileSync(uri.fsPath, message.csvData, 'utf-8');
                    vscode.window.showInformationMessage(`CSV exported to ${uri.fsPath}`);
                }
            } else if (message.command === 'exportJSON') {
                // Prompt user for save location
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: defaultUri,
                    filters: {
                        'JSON Files': ['json'],
                        'All Files': ['*']
                    },
                    saveLabel: 'Export JSON'
                });

                if (uri) {
                    fs.writeFileSync(uri.fsPath, message.jsonData, 'utf-8');
                    vscode.window.showInformationMessage(`JSON exported to ${uri.fsPath}`);
                }
            } else if (message.command === 'showFieldValues') {
                // Show field values in a new panel
                const { generateFieldValuesHTML } = await import('./runQuery');
                const fieldName = message.fieldName;
                const distribution = FieldAnalyzer.getValueDistribution(fieldName, results, 1000);

                const valuesPanel = vscode.window.createWebviewPanel(
                    'fieldValues',
                    `Field Values: ${fieldName}`,
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: false
                    }
                );

                valuesPanel.webview.html = generateFieldValuesHTML(fieldName, distribution, results.length);
            } else if (message.command === 'chartField') {
                // Import and use chart handler from runQuery
                const { handleChartFieldExternal } = await import('./runQuery');
                const fieldAnalysis = FieldAnalyzer.analyze(results, mode as 'records' | 'messages');
                await handleChartFieldExternal(message.fieldName, results, fieldAnalysis);
            }
        },
        undefined,
        context.subscriptions
    );

    vscode.window.showInformationMessage(`Query completed: ${results.length} ${mode} found (webview)${jsonFilePath ? ` - JSON saved to ${jsonFilePath}` : ''}`);
}

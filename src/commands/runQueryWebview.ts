import * as vscode from 'vscode';
import { SearchJobClient, SearchJobRequest, SearchJobStatus } from '../api/searchJob';
import { createClient } from './authenticate';
import { getDynamicCompletionProvider, getSumoExplorerProvider } from '../extension';
import { formatRecordsAsHTML } from './runQuery';
import { FieldAnalyzer } from '../services/fieldAnalyzer';
import { ProfileManager } from '../profileManager';

/**
 * Parse query metadata from comments
 */
function parseQueryMetadata(queryText: string): {
    name?: string;
    from?: string;
    to?: string;
    timeZone?: string;
    mode?: 'records' | 'messages';
} {
    const metadata: {
        name?: string;
        from?: string;
        to?: string;
        timeZone?: string;
        mode?: 'records' | 'messages';
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

        const modeMatch = trimmed.match(/^\/\/\s*@mode\s+(records|messages)$/i);
        if (modeMatch) {
            metadata.mode = modeMatch[1].toLowerCase() as 'records' | 'messages';
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
 * Command to run query and force webview output
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

    // Parse metadata from comments (ignore @output directive)
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
            return;
        }
    }

    if (!to) {
        to = await vscode.window.showInputBox({
            prompt: 'Enter end time (e.g., now, -30m, or ISO timestamp)',
            value: 'now',
            ignoreFocusOut: true
        });

        if (!to) {
            return;
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
            return;
        }
        mode = modeChoice.value as 'records' | 'messages';
    }

    const request: SearchJobRequest = {
        query: cleanedQuery,
        from: fromTime,
        to: toTime,
        timeZone: metadata.timeZone || 'UTC'
    };

    // Execute search with progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Running Sumo Logic query...',
        cancellable: false
    }, async (progress) => {
        progress.report({ message: 'Creating search job...' });

        const createResponse = await client.createSearchJob(request);
        if (createResponse.error || !createResponse.data) {
            vscode.window.showErrorMessage(`Failed to create search job: ${createResponse.error}`);
            return;
        }

        const jobId = createResponse.data.id;
        progress.report({ message: `Job created: ${jobId}` });

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

        await client.deleteSearchJob(jobId);

        if (results.length === 0) {
            vscode.window.showInformationMessage('Query completed: No results found');
            return;
        }

        // Add discovered fields to autocomplete
        const dynamicProvider = getDynamicCompletionProvider();
        if (dynamicProvider) {
            dynamicProvider.addFieldsFromResults(results);
        }

        // Save JSON file to queries subfolder
        const { OutputWriter } = await import('../outputWriter');
        const outputWriter = new OutputWriter(context);
        const queryIdentifier = metadata.name || cleanedQuery.split('\n')[0].substring(0, 50);
        const filename = `query_${queryIdentifier}_${mode}_${from}_to_${to}`;
        let jsonFilePath: string | undefined;

        try {
            const jsonContent = JSON.stringify(results, null, 2);
            jsonFilePath = await outputWriter.writeOutput('queries', filename, jsonContent, 'json');

            // Track the result file in recent results
            const explorerProvider = getSumoExplorerProvider();
            if (explorerProvider && jsonFilePath) {
                const recentResultsManager = explorerProvider.getRecentResultsManager();
                recentResultsManager.addResult(jsonFilePath);
                explorerProvider.refresh();
            }
        } catch (error) {
            console.error('Failed to write JSON file:', error);
        }

        // Force webview output
        const panel = vscode.window.createWebviewPanel(
            'sumoQueryResults',
            `Query Results: ${metadata.name || cleanedQuery.split('\n')[0].substring(0, 30)}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const config = vscode.workspace.getConfiguration('sumologic');
        const pageSize = config.get<number>('webviewPageSize') || 200;

        const htmlContent = formatRecordsAsHTML(results, {
            query: cleanedQuery,
            from: from,
            to: to,
            mode: mode,
            count: resultCount,
            pageSize: pageSize,
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

        vscode.window.showInformationMessage(`Query completed: ${resultCount} ${mode} found (webview)${jsonFilePath ? ` - JSON saved to ${jsonFilePath}` : ''}`);
    });
}

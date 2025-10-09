"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runQueryWebviewCommand = runQueryWebviewCommand;
const vscode = require("vscode");
const searchJob_1 = require("../api/searchJob");
const authenticate_1 = require("./authenticate");
const extension_1 = require("../extension");
const runQuery_1 = require("./runQuery");
/**
 * Parse query metadata from comments
 */
function parseQueryMetadata(queryText) {
    const metadata = {};
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
            metadata.mode = modeMatch[1].toLowerCase();
            continue;
        }
    }
    return metadata;
}
/**
 * Remove metadata comments from query
 */
function cleanQuery(queryText) {
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
function isAggregationQuery(query) {
    const aggregationOperators = [
        'count', 'sum', 'avg', 'min', 'max', 'stddev', 'pct',
        'first', 'last', 'most_recent', 'least_recent',
        'count_distinct', 'count_frequent', 'fillmissing',
        'transpose', 'timeslice', 'rollingstd'
    ];
    const lowerQuery = query.toLowerCase();
    return aggregationOperators.some(op => lowerQuery.includes(`| ${op}`) ||
        lowerQuery.includes(`|${op}`));
}
/**
 * Command to run query and force webview output
 */
function runQueryWebviewCommand(context) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const baseClient = yield (0, authenticate_1.createClient)(context);
        if (!baseClient) {
            vscode.window.showErrorMessage('No credentials configured. Please run "Sumo Logic: Configure Credentials" first.');
            return;
        }
        const client = new searchJob_1.SearchJobClient({
            accessId: (yield context.secrets.get('sumologic.accessId')),
            accessKey: (yield context.secrets.get('sumologic.accessKey')),
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
            from = yield vscode.window.showInputBox({
                prompt: 'Enter start time (e.g., -1h, -30m, -1d, or ISO timestamp)',
                value: '-1h',
                ignoreFocusOut: true
            });
            if (!from) {
                return;
            }
        }
        if (!to) {
            to = yield vscode.window.showInputBox({
                prompt: 'Enter end time (e.g., now, -30m, or ISO timestamp)',
                value: 'now',
                ignoreFocusOut: true
            });
            if (!to) {
                return;
            }
        }
        // Parse relative times
        const fromTime = searchJob_1.SearchJobClient.parseRelativeTime(from);
        const toTime = searchJob_1.SearchJobClient.parseRelativeTime(to);
        // Determine mode: explicit from metadata, user choice, or auto-detect
        let mode = metadata.mode || 'records';
        // If no explicit mode and query doesn't look like aggregation, prompt user
        if (!metadata.mode && !isAggregationQuery(cleanedQuery)) {
            const modeChoice = yield vscode.window.showQuickPick([
                { label: 'Messages (Raw Events)', value: 'messages', description: 'Return raw log messages' },
                { label: 'Records (Aggregated)', value: 'records', description: 'Return aggregated results' }
            ], {
                placeHolder: 'This appears to be a raw search. Select result type:',
                ignoreFocusOut: true
            });
            if (!modeChoice) {
                return;
            }
            mode = modeChoice.value;
        }
        const request = {
            query: cleanedQuery,
            from: fromTime,
            to: toTime,
            timeZone: metadata.timeZone || 'UTC'
        };
        // Execute search with progress
        yield vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Running Sumo Logic query...',
            cancellable: false
        }, (progress) => __awaiter(this, void 0, void 0, function* () {
            progress.report({ message: 'Creating search job...' });
            const createResponse = yield client.createSearchJob(request);
            if (createResponse.error || !createResponse.data) {
                vscode.window.showErrorMessage(`Failed to create search job: ${createResponse.error}`);
                return;
            }
            const jobId = createResponse.data.id;
            progress.report({ message: `Job created: ${jobId}` });
            const pollResponse = yield client.pollForCompletion(jobId, (status) => {
                progress.report({
                    message: `State: ${status.state}, Records: ${status.recordCount}, Messages: ${status.messageCount}`
                });
            });
            if (pollResponse.error) {
                vscode.window.showErrorMessage(`Search job failed: ${pollResponse.error}`);
                return;
            }
            progress.report({ message: 'Fetching results...' });
            let results;
            let resultCount;
            if (mode === 'messages') {
                const messagesResponse = yield client.getMessages(jobId);
                if (messagesResponse.error || !messagesResponse.data) {
                    vscode.window.showErrorMessage(`Failed to fetch messages: ${messagesResponse.error}`);
                    yield client.deleteSearchJob(jobId);
                    return;
                }
                results = messagesResponse.data.messages;
                resultCount = results.length;
            }
            else {
                const recordsResponse = yield client.getRecords(jobId);
                if (recordsResponse.error || !recordsResponse.data) {
                    vscode.window.showErrorMessage(`Failed to fetch records: ${recordsResponse.error}`);
                    yield client.deleteSearchJob(jobId);
                    return;
                }
                results = recordsResponse.data.records;
                resultCount = results.length;
            }
            yield client.deleteSearchJob(jobId);
            if (results.length === 0) {
                vscode.window.showInformationMessage('Query completed: No results found');
                return;
            }
            // Add discovered fields to autocomplete
            const dynamicProvider = (0, extension_1.getDynamicCompletionProvider)();
            if (dynamicProvider) {
                dynamicProvider.addFieldsFromResults(results);
            }
            // Force webview output
            const panel = vscode.window.createWebviewPanel('sumoQueryResults', `Query Results: ${metadata.name || cleanedQuery.split('\n')[0].substring(0, 30)}`, vscode.ViewColumn.One, {
                enableScripts: true,
                retainContextWhenHidden: true
            });
            const config = vscode.workspace.getConfiguration('sumologic');
            const pageSize = config.get('webviewPageSize') || 200;
            const htmlContent = (0, runQuery_1.formatRecordsAsHTML)(results, {
                query: cleanedQuery,
                from: from,
                to: to,
                mode: mode,
                count: resultCount,
                pageSize: pageSize
            });
            panel.webview.html = htmlContent;
            // Handle messages from webview
            panel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                if (message.command === 'exportCSV') {
                    // Get workspace folder or use home directory
                    const workspaceFolder = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0];
                    const defaultUri = workspaceFolder
                        ? vscode.Uri.file(workspaceFolder.uri.fsPath)
                        : undefined;
                    // Prompt user for save location
                    const uri = yield vscode.window.showSaveDialog({
                        defaultUri: defaultUri,
                        filters: {
                            'CSV Files': ['csv'],
                            'All Files': ['*']
                        },
                        saveLabel: 'Export CSV'
                    });
                    if (uri) {
                        const fs = yield Promise.resolve().then(() => require('fs'));
                        fs.writeFileSync(uri.fsPath, message.csvData, 'utf-8');
                        vscode.window.showInformationMessage(`CSV exported to ${uri.fsPath}`);
                    }
                }
            }), undefined, context.subscriptions);
            vscode.window.showInformationMessage(`Query completed: ${resultCount} ${mode} found (webview)`);
        }));
    });
}
//# sourceMappingURL=runQueryWebview.js.map
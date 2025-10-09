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
exports.runQueryAndChartCommand = runQueryAndChartCommand;
const vscode = require("vscode");
const searchJob_1 = require("../api/searchJob");
const authenticate_1 = require("./authenticate");
const outputWriter_1 = require("../outputWriter");
const chartCSV_1 = require("./chartCSV");
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
 * Format records as CSV
 */
function formatRecordsAsCSV(records) {
    if (records.length === 0) {
        return 'No results found';
    }
    // Get all unique keys from all records
    const allKeys = new Set();
    records.forEach(record => {
        Object.keys(record.map).forEach(key => allKeys.add(key));
    });
    const keys = Array.from(allKeys);
    // Helper to escape CSV values
    const escapeCSV = (value) => {
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
function runQueryAndChartCommand(context) {
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
        // Parse metadata from comments
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
                return; // User cancelled
            }
        }
        if (!to) {
            to = yield vscode.window.showInputBox({
                prompt: 'Enter end time (e.g., now, -30m, or ISO timestamp)',
                value: 'now',
                ignoreFocusOut: true
            });
            if (!to) {
                return; // User cancelled
            }
        }
        // Parse relative times
        const fromTime = searchJob_1.SearchJobClient.parseRelativeTime(from);
        const toTime = searchJob_1.SearchJobClient.parseRelativeTime(to);
        const request = {
            query: cleanedQuery,
            from: fromTime,
            to: toTime,
            timeZone: metadata.timeZone || 'UTC'
        };
        // Execute search with progress
        let csvFilePath;
        yield vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Running query and generating chart...',
            cancellable: false
        }, (progress) => __awaiter(this, void 0, void 0, function* () {
            progress.report({ message: 'Creating search job...' });
            // Create job
            const createResponse = yield client.createSearchJob(request);
            if (createResponse.error || !createResponse.data) {
                vscode.window.showErrorMessage(`Failed to create search job: ${createResponse.error}`);
                return;
            }
            const jobId = createResponse.data.id;
            progress.report({ message: `Job created: ${jobId}` });
            // Poll for completion
            const pollResponse = yield client.pollForCompletion(jobId, (status) => {
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
            const recordsResponse = yield client.getRecords(jobId);
            if (recordsResponse.error || !recordsResponse.data) {
                vscode.window.showErrorMessage(`Failed to fetch records: ${recordsResponse.error}`);
                yield client.deleteSearchJob(jobId);
                return;
            }
            const results = recordsResponse.data.records;
            // Clean up job
            yield client.deleteSearchJob(jobId);
            if (results.length === 0) {
                vscode.window.showInformationMessage('Query completed: No results found');
                return;
            }
            progress.report({ message: 'Generating CSV and chart...' });
            // Format as CSV
            const csvContent = formatRecordsAsCSV(results);
            // Write CSV to file
            const outputWriter = new outputWriter_1.OutputWriter(context);
            const queryIdentifier = metadata.name || cleanedQuery.split('\n')[0].substring(0, 50);
            const filename = `query_${queryIdentifier}_records_${from}_to_${to}`;
            try {
                csvFilePath = yield outputWriter.writeOutput('queries', filename, csvContent, 'csv');
                vscode.window.showInformationMessage(`Query completed: ${results.length} records found`);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to write CSV: ${error}`);
                return;
            }
        }));
        // Launch chart if CSV was created
        if (csvFilePath) {
            const uri = vscode.Uri.file(csvFilePath);
            yield (0, chartCSV_1.chartCSVCommand)(context, uri);
        }
    });
}
//# sourceMappingURL=runQueryAndChart.js.map
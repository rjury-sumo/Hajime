import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SearchJobClient } from '../api/searchJob';
import { ProfileManager } from '../profileManager';
import { getActiveProfileClient } from './runQuery';
import { showSearchAuditResults } from '../views/searchAuditResultsWebview';

/**
 * Default search audit query template
 */
const SEARCH_AUDIT_QUERY = `_view=sumologic_search_usage_per_query
query_type={{type}}
// not user_name=*sumosupport*
user_name={{user_name}}
content_name={{content_name}}
query={{query}}

| ((query_end_time - query_start_time ) /1000 / 60 ) as time_range_m
//| sort execution_duration_ms
| json field=scanned_bytes_breakdown "Infrequent" as inf_bytes nodrop
| json field=scanned_bytes_breakdown "Flex" as flex_bytes nodrop
| if (isnull(inf_bytes),0,inf_bytes) as inf_bytes
| if (isnull(flex_bytes),0,flex_bytes) as flex_bytes

| round((data_scanned_bytes /1024/1024/1024) * 10 )/10 as scan_gbytes
| round((inf_bytes/1024/1024/1024) * 10) / 10 as inf_scan_gb
| round((flex_bytes/1024/1024/1024) * 10) / 10 as flex_scan_gb
| execution_duration_ms / ( 1000 * 60) as runtime_minutes

| time_range_m/60 as time_range_h
| count as searches, sum(scan_gbytes) as scan_gb, sum(inf_scan_gb) as inf_scan_gb, sum(flex_scan_gb) as flex_scan_gb, sum(retrieved_message_count) as results, avg(scanned_partition_count) as avg_partitions,
 avg(time_range_h) as avg_range_h, sum(runtime_minutes) as sum_runtime_minutes, avg(runtime_minutes) as avg_runtime_minutes by user_name, query, query_type,content_name, content_identifier | sort query asc
| where query matches /(?i){{query_regex}}/`;

/**
 * Run a search audit query and save results
 */
export async function runSearchAuditQuery(
    context: vscode.ExtensionContext,
    from: string = '-24h',
    to: string = 'now',
    type: string = '*',
    userName: string = '*',
    contentName: string = '*',
    queryFilter: string = '*',
    queryRegex: string = '.*'
): Promise<void> {
    const profileClient = await getActiveProfileClient(context);
    if (!profileClient) {
        return;
    }

    const { client, profileName } = profileClient;
    const profileManager = new ProfileManager(context);

    // Substitute parameters in the query
    let query = SEARCH_AUDIT_QUERY
        .replace('{{type}}', type)
        .replace('{{user_name}}', userName)
        .replace('{{content_name}}', contentName)
        .replace('{{query}}', queryFilter)
        .replace('{{query_regex}}', queryRegex);

    // Parse relative times to epoch milliseconds
    const fromTime = SearchJobClient.parseRelativeTime(from);
    const toTime = SearchJobClient.parseRelativeTime(to);

    // Show progress
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Running Search Audit Query',
            cancellable: false
        },
        async (progress) => {
            try {
                progress.report({ message: 'Creating search job...' });

                // Create search job
                const createResponse = await client.createSearchJob({
                    query,
                    from: fromTime,
                    to: toTime,
                    timeZone: 'UTC'
                });

                if (createResponse.error || !createResponse.data) {
                    vscode.window.showErrorMessage(`Failed to create search job: ${createResponse.error}`);
                    return;
                }

                const jobId = createResponse.data.id;
                progress.report({ message: `Waiting for job ${jobId}...` });

                // Poll for completion
                let statusResponse = await client.getSearchJobStatus(jobId);
                if (statusResponse.error || !statusResponse.data) {
                    vscode.window.showErrorMessage(`Failed to get job status: ${statusResponse.error}`);
                    return;
                }

                while (statusResponse.data.state !== 'DONE GATHERING RESULTS' && statusResponse.data.state !== 'CANCELLED') {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    statusResponse = await client.getSearchJobStatus(jobId);
                    if (statusResponse.error || !statusResponse.data) {
                        vscode.window.showErrorMessage(`Failed to get job status: ${statusResponse.error}`);
                        return;
                    }
                    const percent = statusResponse.data.recordCount ? Math.min(100, (statusResponse.data.recordCount / 1000) * 100) : 0;
                    progress.report({
                        message: `Processing... (${statusResponse.data.recordCount || 0} records)`,
                        increment: percent
                    });
                }

                if (statusResponse.data.state === 'CANCELLED') {
                    vscode.window.showWarningMessage('Search job was cancelled');
                    return;
                }

                progress.report({ message: 'Fetching results...' });

                // Get results
                const recordsResponse = await client.getRecords(jobId);
                if (recordsResponse.error || !recordsResponse.data) {
                    vscode.window.showErrorMessage(`Failed to fetch records: ${recordsResponse.error}`);
                    await client.deleteSearchJob(jobId);
                    return;
                }

                const records = recordsResponse.data.records;

                // Save results to file with special prefix
                const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, '').replace('T', '_');
                const timeRangeStr = `${from}_to_${to}`.replace(/[^a-zA-Z0-9_-]/g, '_');
                const fileName = `search_audit_${timeRangeStr}_${timestamp}.json`;

                const searchAuditDir = profileManager.getProfileSearchAuditDirectory(profileName);
                if (!fs.existsSync(searchAuditDir)) {
                    fs.mkdirSync(searchAuditDir, { recursive: true });
                }

                const filePath = path.join(searchAuditDir, fileName);
                fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');

                vscode.window.showInformationMessage(
                    `Search Audit completed: ${records.length} results saved`,
                    'Open Results'
                ).then(selection => {
                    if (selection === 'Open Results') {
                        showSearchAuditResults(filePath, context);
                    }
                });

                // Delete the job
                await client.deleteSearchJob(jobId);

            } catch (error) {
                vscode.window.showErrorMessage(`Search Audit failed: ${error}`);
                console.error('Search Audit error:', error);
            }
        }
    );
}

/**
 * Open a search audit result file in the results webview
 */
export async function openSearchAuditResult(
    context: vscode.ExtensionContext,
    filePath: string
): Promise<void> {
    await showSearchAuditResults(filePath, context);
}

/**
 * Show the search audit webview for a profile
 * This is just a placeholder - the actual implementation is handled by the command registration in extension.ts
 */
export async function viewSearchAudit(
    context: vscode.ExtensionContext,
    profileName?: string
): Promise<void> {
    // This function is called from extension.ts via the registered command
    // The actual show logic is in SearchAuditWebviewProvider.show()
}

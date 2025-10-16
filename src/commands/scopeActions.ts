import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager } from '../profileManager';
import { createScopesCacheDB } from '../database/scopesCache';
import { SearchJobClient, SearchJobRequest } from '../api/searchJob';

/**
 * Profile a scope using facets query
 * Executes: <scope> | limit 1000 | facets
 */
export async function profileScope(
    context: vscode.ExtensionContext,
    scopeId: string,
    profileName: string
): Promise<void> {
    const profileManager = new ProfileManager(context);
    const profileDir = profileManager.getProfileDirectory(profileName);
    const db = createScopesCacheDB(profileDir, profileName);

    try {
        const scope = db.getScopeById(scopeId);
        if (!scope) {
            vscode.window.showErrorMessage('Scope not found');
            return;
        }

        // Build facets query
        const query = `${scope.searchScope}\n| limit 1000 | facets`;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Profiling scope "${scope.name}"...`,
            cancellable: false
        }, async (progress) => {
            try {
                // Get profile and credentials
                const profiles = await profileManager.getProfiles();
                const profile = profiles.find(p => p.name === profileName);
                if (!profile) {
                    throw new Error('Profile not found');
                }

                const credentials = await profileManager.getProfileCredentials(profileName);
                if (!credentials) {
                    throw new Error('No credentials found');
                }

                // Create client
                const endpoint = profileManager.getProfileEndpoint(profile);
                const searchClient = new SearchJobClient({
                    accessId: credentials.accessId,
                    accessKey: credentials.accessKey,
                    endpoint
                });

                // Execute query
                progress.report({ message: 'Executing facets query...' });

                // Parse time ranges to epoch milliseconds
                const fromTime = SearchJobClient.parseRelativeTime('-3h');
                const toTime = SearchJobClient.parseRelativeTime('now');

                const request: SearchJobRequest = {
                    query,
                    from: fromTime,
                    to: toTime,
                    timeZone: 'UTC',
                    byReceiptTime: false,
                    autoParsingMode: 'Manual'
                };

                const jobResponse = await searchClient.createSearchJob(request);
                if (jobResponse.error || !jobResponse.data) {
                    throw new Error(jobResponse.error || 'Failed to create search job');
                }

                const jobId = jobResponse.data.id;

                // Poll for completion
                progress.report({ message: 'Waiting for query to complete...' });
                const result = await searchClient.pollForCompletion(jobId);

                if (result.error) {
                    throw new Error(result.error);
                }

                // Get records
                progress.report({ message: 'Fetching results...' });
                const recordsResponse = await searchClient.getRecords(jobId);

                if (recordsResponse.error || !recordsResponse.data) {
                    throw new Error(recordsResponse.error || 'Failed to fetch records');
                }

                // Save results to scope
                const now = new Date().toISOString();
                const resultsJson = JSON.stringify(recordsResponse.data);

                db.updateScope(scopeId, {
                    facetsResult: resultsJson,
                    facetsTimestamp: now
                });

                // Also save to file for reference
                const outputDir = path.join(profileDir, 'scopes');
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const fileName = `${scopeId}_facets_${now.replace(/[:.]/g, '-')}.json`;
                const filePath = path.join(outputDir, fileName);
                fs.writeFileSync(filePath, JSON.stringify(recordsResponse.data, null, 2), 'utf-8');

                // Count fields from records
                const fieldCount = recordsResponse.data.records && recordsResponse.data.records.length > 0
                    ? Object.keys(recordsResponse.data.records[0].map || {}).length
                    : 0;

                vscode.window.showInformationMessage(
                    `Scope profiling complete. Found ${fieldCount} fields in results.`
                );

            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to profile scope: ${error.message || error}`);
            }
        });
    } finally {
        db.close();
    }
}

/**
 * Sample logs from a scope
 * Executes: <scope> | limit 1000
 */
export async function sampleScopeLogs(
    context: vscode.ExtensionContext,
    scopeId: string,
    profileName: string
): Promise<void> {
    const profileManager = new ProfileManager(context);
    const profileDir = profileManager.getProfileDirectory(profileName);
    const db = createScopesCacheDB(profileDir, profileName);

    try {
        const scope = db.getScopeById(scopeId);
        if (!scope) {
            vscode.window.showErrorMessage('Scope not found');
            return;
        }

        // Build sample logs query
        const query = `${scope.searchScope}\n| limit 1000`;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Sampling logs from scope "${scope.name}"...`,
            cancellable: false
        }, async (progress) => {
            try {
                // Get profile and credentials
                const profiles = await profileManager.getProfiles();
                const profile = profiles.find(p => p.name === profileName);
                if (!profile) {
                    throw new Error('Profile not found');
                }

                const credentials = await profileManager.getProfileCredentials(profileName);
                if (!credentials) {
                    throw new Error('No credentials found');
                }

                // Create client
                const endpoint = profileManager.getProfileEndpoint(profile);
                const searchClient = new SearchJobClient({
                    accessId: credentials.accessId,
                    accessKey: credentials.accessKey,
                    endpoint
                });

                // Execute query
                progress.report({ message: 'Executing sample query...' });

                // Parse time ranges to epoch milliseconds
                const fromTime = SearchJobClient.parseRelativeTime('-3h');
                const toTime = SearchJobClient.parseRelativeTime('now');

                const request: SearchJobRequest = {
                    query,
                    from: fromTime,
                    to: toTime,
                    timeZone: 'UTC',
                    byReceiptTime: false,
                    autoParsingMode: 'Manual'
                };

                const jobResponse = await searchClient.createSearchJob(request);
                if (jobResponse.error || !jobResponse.data) {
                    throw new Error(jobResponse.error || 'Failed to create search job');
                }

                const jobId = jobResponse.data.id;

                // Poll for completion
                progress.report({ message: 'Waiting for query to complete...' });
                const result = await searchClient.pollForCompletion(jobId);

                if (result.error) {
                    throw new Error(result.error);
                }

                // Get messages
                progress.report({ message: 'Fetching results...' });
                const messagesResponse = await searchClient.getMessages(jobId);

                if (messagesResponse.error || !messagesResponse.data) {
                    throw new Error(messagesResponse.error || 'Failed to fetch messages');
                }

                // Save results to scope
                const now = new Date().toISOString();
                const resultsJson = JSON.stringify(messagesResponse.data);

                db.updateScope(scopeId, {
                    sampleLogsResult: resultsJson,
                    sampleLogsTimestamp: now
                });

                // Also save to file for reference
                const outputDir = path.join(profileDir, 'scopes');
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const fileName = `${scopeId}_sample_${now.replace(/[:.]/g, '-')}.json`;
                const filePath = path.join(outputDir, fileName);
                fs.writeFileSync(filePath, JSON.stringify(messagesResponse.data, null, 2), 'utf-8');

                vscode.window.showInformationMessage(
                    `Sample logs retrieved. Found ${messagesResponse.data.messages?.length || 0} messages.`
                );

            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to sample logs: ${error.message || error}`);
            }
        });
    } finally {
        db.close();
    }
}

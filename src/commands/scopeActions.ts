import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager } from '../profileManager';
import { createScopesCacheDB } from '../database/scopesCache';
import { executeMetadataQuery } from './cacheKeyMetadata';
import { getMetadataCompletionProvider } from '../extension';
import { executeQueryForRecords, executeQueryForMessages } from '../utils/queryExecutor';

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
                // Execute query using shared utility
                const recordsData = await executeQueryForRecords(context, {
                    query,
                    profileName,
                    from: scope.queryFrom || '-3h',
                    to: 'now',
                    onProgress: (msg) => progress.report({ message: msg })
                });

                // Save results to file
                const now = new Date().toISOString();
                const outputDir = path.join(profileDir, 'scopes');
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const fileName = `${scopeId}_facets_latest.json`;
                const filePath = path.join(outputDir, fileName);
                fs.writeFileSync(filePath, JSON.stringify(recordsData, null, 2), 'utf-8');

                // Update scope with file path
                db.updateScope(scopeId, {
                    facetsResultPath: filePath,
                    facetsTimestamp: now
                });

                // Count fields from records
                const fieldCount = recordsData.records && recordsData.records.length > 0
                    ? Object.keys(recordsData.records[0].map || {}).length
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
                // Execute query using shared utility
                const messagesData = await executeQueryForMessages(context, {
                    query,
                    profileName,
                    from: scope.queryFrom || '-3h',
                    to: 'now',
                    onProgress: (msg) => progress.report({ message: msg })
                });

                // Save results to file
                const now = new Date().toISOString();
                const outputDir = path.join(profileDir, 'scopes');
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const fileName = `${scopeId}_sample_latest.json`;
                const filePath = path.join(outputDir, fileName);
                fs.writeFileSync(filePath, JSON.stringify(messagesData, null, 2), 'utf-8');

                // Update scope with file path
                db.updateScope(scopeId, {
                    sampleLogsResultPath: filePath,
                    sampleLogsTimestamp: now
                });

                vscode.window.showInformationMessage(
                    `Sample logs retrieved. Found ${messagesData.messages?.length || 0} messages.`
                );

            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to sample logs: ${error.message || error}`);
            }
        });
    } finally {
        db.close();
    }
}

/**
 * Cache metadata for a scope
 * Executes key metadata query and updates autocomplete
 */
export async function cacheScopeMetadata(
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

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Caching metadata for scope "${scope.name}"...`,
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: 'Executing metadata query...' });

                // Get metadata completion provider
                const metadataProvider = getMetadataCompletionProvider();

                // Execute metadata query using the refactored function
                const records = await executeMetadataQuery(
                    context,
                    scope.searchScope,
                    profileName, // Use the specific profile for this scope
                    scope.queryFrom || '-3h',
                    'merge', // Always merge to append to existing metadata
                    metadataProvider
                );

                // Save results to file
                const now = new Date().toISOString();
                const outputDir = path.join(profileDir, 'scopes');
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const fileName = `${scopeId}_metadata_latest.json`;
                const filePath = path.join(outputDir, fileName);
                fs.writeFileSync(filePath, JSON.stringify({ records }, null, 2), 'utf-8');

                // Update scope with file path
                db.updateScope(scopeId, {
                    metadataResultPath: filePath,
                    metadataTimestamp: now
                });

                vscode.window.showInformationMessage(
                    `Metadata cached for scope. Found ${records.length} key combinations.`
                );

            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to cache metadata: ${error.message || error}`);
            }
        });
    } finally {
        db.close();
    }
}

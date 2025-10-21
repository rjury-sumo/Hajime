import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SearchJobClient, SearchJobRequest } from '../api/searchJob';
import { createClient } from './authenticate';
import { ProfileManager } from '../profileManager';
import { MetadataCompletionProvider } from '../metadataCompletions';
import { executeQueryForRecords } from '../utils/queryExecutor';

/**
 * Scope options for metadata query
 */
type MetadataScope =
    | { type: 'all' }
    | { type: 'custom'; expression: string }
    | { type: 'datatier'; tier: 'all' | 'continuous' | 'infrequent' | 'frequent' };

/**
 * Sampling options
 */
type SamplingOption =
    | { type: 'none' }
    | { type: '10percent' }
    | { type: '20percent' };

/**
 * Cache key metadata from Sumo Logic and populate autocomplete
 * @param context Extension context
 * @param metadataProvider Metadata completion provider
 * @param profileName Optional profile name. If not provided, uses active profile
 */
export async function cacheKeyMetadataCommand(
    context: vscode.ExtensionContext,
    metadataProvider?: MetadataCompletionProvider,
    profileName?: string
): Promise<void> {
    try {
        // Get profile manager and check for target profile
        const profileManager = new ProfileManager(context);

        let targetProfile;
        if (profileName) {
            const profiles = await profileManager.getProfiles();
            targetProfile = profiles.find(p => p.name === profileName);
            if (!targetProfile) {
                vscode.window.showErrorMessage(`Profile '${profileName}' not found.`);
                return;
            }
        } else {
            targetProfile = await profileManager.getActiveProfile();
            if (!targetProfile) {
                vscode.window.showWarningMessage('No active profile. Please create or select a profile first.');
                return;
            }
        }

        // Ask user for scope
        const scopeChoice = await vscode.window.showQuickPick([
            { label: 'All data (_sourceCategory = *)', value: { type: 'all' } as MetadataScope },
            { label: 'Data tier: All (_datatier=all)', value: { type: 'datatier', tier: 'all' } as MetadataScope },
            { label: 'Data tier: Continuous (_datatier=continuous)', value: { type: 'datatier', tier: 'continuous' } as MetadataScope },
            { label: 'Data tier: Frequent (_datatier=frequent)', value: { type: 'datatier', tier: 'frequent' } as MetadataScope },
            { label: 'Data tier: Infrequent (_datatier=infrequent)', value: { type: 'datatier', tier: 'infrequent' } as MetadataScope },
            { label: 'Custom scope...', value: { type: 'custom', expression: '' } as MetadataScope }
        ], {
            placeHolder: 'Select scope for metadata caching'
        });

        if (!scopeChoice) {
            return; // User cancelled
        }

        let scope = scopeChoice.value;

        // If custom, ask for expression
        if (scope.type === 'custom') {
            const customScope = await vscode.window.showInputBox({
                prompt: 'Enter custom scope expression',
                placeHolder: '_sourceCategory=foo/bar or _index=my_index',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Scope expression cannot be empty';
                    }
                    return null;
                }
            });

            if (!customScope) {
                return; // User cancelled
            }

            scope = { type: 'custom', expression: customScope };
        }

        // Ask user for sampling
        const samplingChoice = await vscode.window.showQuickPick([
            { label: 'No sampling (100% of data)', value: { type: 'none' } as SamplingOption },
            { label: '10% sampling (_messageid=*0)', value: { type: '10percent' } as SamplingOption },
            { label: '20% sampling (_messageid=*0 or _messageid=*5)', value: { type: '20percent' } as SamplingOption }
        ], {
            placeHolder: 'Select sampling option (sampling speeds up query but may miss some values)'
        });

        if (!samplingChoice) {
            return; // User cancelled
        }

        const sampling = samplingChoice.value;

        // Ask user for merge mode
        const mergeModeChoice = await vscode.window.showQuickPick([
            { label: 'Replace existing metadata', value: 'replace', description: 'Clear existing values and use only new results' },
            { label: 'Merge with existing metadata', value: 'merge', description: 'Combine new results with existing cached values' }
        ], {
            placeHolder: 'Choose how to handle existing metadata cache'
        });

        if (!mergeModeChoice) {
            return; // User cancelled
        }

        const mergeMode = mergeModeChoice.value;

        // Ask user for time range
        const timeRangeInput = await vscode.window.showInputBox({
            prompt: 'Enter relative time range (e.g., -15m, -1h, -24h, -7d)',
            placeHolder: '-15m',
            value: '-15m',
            validateInput: (value) => {
                if (!value || !value.match(/^-\d+[mhd]$/)) {
                    return 'Please enter a valid relative time (e.g., -15m, -1h, -24h, -7d)';
                }
                return null;
            }
        });

        if (!timeRangeInput) {
            return; // User cancelled
        }

        // Build query
        const query = buildMetadataQuery(scope, sampling);

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Caching metadata for profile '${targetProfile.name}'`,
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Creating search job...' });

            // Get profile credentials for SearchJobClient
            const credentials = await profileManager.getProfileCredentials(targetProfile.name);
            if (!credentials) {
                throw new Error('Failed to get profile credentials');
            }

            const config = {
                accessId: credentials.accessId,
                accessKey: credentials.accessKey,
                endpoint: profileManager.getProfileEndpoint(targetProfile)
            };

            const searchClient = new SearchJobClient(config);

            // Parse relative time using SearchJobClient's parser
            const fromTime = SearchJobClient.parseRelativeTime(timeRangeInput);
            const toTime = SearchJobClient.parseRelativeTime('now');

            const request: SearchJobRequest = {
                query,
                from: fromTime,
                to: toTime,
                timeZone: 'UTC'
            };

            const createResponse = await searchClient.createSearchJob(request);

            if (createResponse.error || !createResponse.data) {
                throw new Error(createResponse.error || 'Failed to create search job');
            }

            const jobId = createResponse.data.id;
            progress.report({ message: `Search job created: ${jobId}` });

            // Poll for completion
            progress.report({ message: 'Waiting for results...' });

            let status;
            const maxAttempts = 60; // 2 minutes max
            let attempts = 0;

            while (attempts < maxAttempts) {
                const statusResponse = await searchClient.getSearchJobStatus(jobId);

                if (statusResponse.error || !statusResponse.data) {
                    throw new Error(statusResponse.error || 'Failed to get job status');
                }

                status = statusResponse.data;

                if (status.state === 'DONE GATHERING RESULTS') {
                    break;
                }

                if (status.state === 'CANCELLED') {
                    throw new Error('Search job was cancelled');
                }

                await new Promise(resolve => setTimeout(resolve, 2000));
                attempts++;
            }

            if (status?.state !== 'DONE GATHERING RESULTS') {
                throw new Error('Search job did not complete in time');
            }

            progress.report({ message: 'Retrieving records...' });

            // Get records
            const recordsResponse = await searchClient.getRecords(jobId, 0, 10000);

            if (recordsResponse.error || !recordsResponse.data) {
                throw new Error(recordsResponse.error || 'Failed to get records');
            }

            const records = recordsResponse.data.records;

            progress.report({ message: `Processing ${records.length} records...` });

            // Save raw results to metadata directory with timestamp
            const metadataDir = profileManager.getProfileMetadataDirectory(targetProfile.name);
            const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '.');
            const resultsFile = path.join(metadataDir, `key_metadata_results.${timestamp}.json`);

            fs.writeFileSync(resultsFile, JSON.stringify(records, null, 2));

            // Update metadata completion provider
            if (metadataProvider) {
                await metadataProvider.updateCacheFromResults(records, mergeMode === 'merge');
            }

            // Delete search job
            await searchClient.deleteSearchJob(jobId);

            progress.report({ message: 'Complete!' });

            // Show stats
            if (metadataProvider) {
                const stats = metadataProvider.getStats();
                const statsMessage = stats
                    .map(s => `  ${s.field}: ${s.count} values`)
                    .join('\n');

                const modeText = mergeMode === 'merge' ? 'merged' : 'replaced';
                vscode.window.showInformationMessage(
                    `Metadata ${modeText} successfully!\n\n${statsMessage}\n\nResults saved to: metadata/${path.basename(resultsFile)}`,
                    'OK'
                );
            } else {
                vscode.window.showInformationMessage(
                    `Metadata cached successfully! ${records.length} records processed.`
                );
            }
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to cache metadata: ${message}`);
    }
}

/**
 * Build the metadata query based on scope and sampling options
 */
function buildMetadataQuery(scope: MetadataScope, sampling: SamplingOption): string {
    let query = '';

    // Add scope
    switch (scope.type) {
        case 'all':
            query = '_sourceCategory = *';
            break;
        case 'custom':
            query = scope.expression;
            break;
        case 'datatier':
            query = `_datatier=${scope.tier}`;
            break;
    }

    // Add sampling
    if (sampling.type === '10percent') {
        query += '\n| where _messageid=*0';
    } else if (sampling.type === '20percent') {
        query += '\n| where (_messageid=*0 or _messageid=*5)';
    }

    // Add aggregation
    query += '\n| sum(_size) as bytes, count by _sourcecategory,_view,_collector,_source,_sourcehost,_sourcename';

    // Handle _view -> _index conversion
    query += '\n| if (isEmpty(_view),"sumologic_default",_view) as _index';
    query += '\n| fields -_view';

    return query;
}

/**
 * Execute metadata query for a custom scope
 * Exported function for use by other modules (e.g., scope actions)
 */
export async function executeMetadataQuery(
    context: vscode.ExtensionContext,
    customScope: string,
    profileName: string,
    timeRange: string = '-3h',
    mergeMode: 'replace' | 'merge' = 'merge',
    metadataProvider?: MetadataCompletionProvider
): Promise<any[]> {
    const profileManager = new ProfileManager(context);

    // Get the specified profile
    const profiles = await profileManager.getProfiles();
    const profile = profiles.find(p => p.name === profileName);

    if (!profile) {
        throw new Error(`Profile '${profileName}' not found`);
    }

    // Build query - for custom scopes, use event-based aggregation
    // The scope expression should query actual events, not the summary view
    const query = `${customScope}
| sum(_size) as bytes, count by _sourcecategory, _collector, _source, _sourcehost, _sourcename`;

    // Execute query using shared utility
    const recordsData = await executeQueryForRecords(context, {
        query,
        profileName,
        from: timeRange,
        to: 'now',
        timeZone: 'UTC'
    });

    const records = recordsData.records;

    // Update metadata completion provider if provided
    if (metadataProvider) {
        await metadataProvider.updateCacheFromResults(records, mergeMode === 'merge');

        // Save results to metadata directory
        const metadataDir = profileManager.getProfileMetadataDirectory(profileName);
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '.');
        const resultsFile = path.join(metadataDir, `key_metadata_results.${timestamp}.json`);
        fs.writeFileSync(resultsFile, JSON.stringify(records, null, 2));
    }

    return records;
}

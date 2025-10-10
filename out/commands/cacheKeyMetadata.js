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
exports.cacheKeyMetadataCommand = cacheKeyMetadataCommand;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const searchJob_1 = require("../api/searchJob");
const authenticate_1 = require("./authenticate");
const profileManager_1 = require("../profileManager");
/**
 * Cache key metadata from Sumo Logic and populate autocomplete
 */
function cacheKeyMetadataCommand(context, metadataProvider) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get profile manager and check active profile
            const profileManager = new profileManager_1.ProfileManager(context);
            const activeProfile = yield profileManager.getActiveProfile();
            if (!activeProfile) {
                vscode.window.showWarningMessage('No active profile. Please create or select a profile first.');
                return;
            }
            // Ask user for scope
            const scopeChoice = yield vscode.window.showQuickPick([
                { label: 'All data (_sourceCategory = *)', value: { type: 'all' } },
                { label: 'Data tier: All (_datatier=all)', value: { type: 'datatier', tier: 'all' } },
                { label: 'Data tier: Continuous (_datatier=continuous)', value: { type: 'datatier', tier: 'continuous' } },
                { label: 'Data tier: Frequent (_datatier=frequent)', value: { type: 'datatier', tier: 'frequent' } },
                { label: 'Data tier: Infrequent (_datatier=infrequent)', value: { type: 'datatier', tier: 'infrequent' } },
                { label: 'Custom scope...', value: { type: 'custom', expression: '' } }
            ], {
                placeHolder: 'Select scope for metadata caching'
            });
            if (!scopeChoice) {
                return; // User cancelled
            }
            let scope = scopeChoice.value;
            // If custom, ask for expression
            if (scope.type === 'custom') {
                const customScope = yield vscode.window.showInputBox({
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
            const samplingChoice = yield vscode.window.showQuickPick([
                { label: 'No sampling (100% of data)', value: { type: 'none' } },
                { label: '10% sampling (_messageid=*0)', value: { type: '10percent' } },
                { label: '20% sampling (_messageid=*0 or _messageid=*5)', value: { type: '20percent' } }
            ], {
                placeHolder: 'Select sampling option (sampling speeds up query but may miss some values)'
            });
            if (!samplingChoice) {
                return; // User cancelled
            }
            const sampling = samplingChoice.value;
            // Ask user for merge mode
            const mergeModeChoice = yield vscode.window.showQuickPick([
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
            const timeRangeInput = yield vscode.window.showInputBox({
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
            yield vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Caching metadata for profile '${activeProfile.name}'`,
                cancellable: false
            }, (progress) => __awaiter(this, void 0, void 0, function* () {
                progress.report({ message: 'Creating search job...' });
                // Create client
                const client = yield (0, authenticate_1.createClient)(context);
                if (!client) {
                    throw new Error('Failed to create API client');
                }
                // Get profile credentials for SearchJobClient
                const credentials = yield profileManager.getProfileCredentials(activeProfile.name);
                if (!credentials) {
                    throw new Error('Failed to get profile credentials');
                }
                const config = {
                    accessId: credentials.accessId,
                    accessKey: credentials.accessKey,
                    endpoint: profileManager.getProfileEndpoint(activeProfile)
                };
                const searchClient = new searchJob_1.SearchJobClient(config);
                // Parse relative time using SearchJobClient's parser
                const fromTime = searchJob_1.SearchJobClient.parseRelativeTime(timeRangeInput);
                const toTime = searchJob_1.SearchJobClient.parseRelativeTime('now');
                const request = {
                    query,
                    from: fromTime,
                    to: toTime,
                    timeZone: 'UTC'
                };
                const createResponse = yield searchClient.createSearchJob(request);
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
                    const statusResponse = yield searchClient.getSearchJobStatus(jobId);
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
                    yield new Promise(resolve => setTimeout(resolve, 2000));
                    attempts++;
                }
                if ((status === null || status === void 0 ? void 0 : status.state) !== 'DONE GATHERING RESULTS') {
                    throw new Error('Search job did not complete in time');
                }
                progress.report({ message: 'Retrieving records...' });
                // Get records
                const recordsResponse = yield searchClient.getRecords(jobId, 0, 10000);
                if (recordsResponse.error || !recordsResponse.data) {
                    throw new Error(recordsResponse.error || 'Failed to get records');
                }
                const records = recordsResponse.data.records;
                progress.report({ message: `Processing ${records.length} records...` });
                // Save raw results to metadata directory with timestamp
                const metadataDir = profileManager.getProfileMetadataDirectory(activeProfile.name);
                const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '.');
                const resultsFile = path.join(metadataDir, `key_metadata_results.${timestamp}.json`);
                fs.writeFileSync(resultsFile, JSON.stringify(records, null, 2));
                // Update metadata completion provider
                if (metadataProvider) {
                    yield metadataProvider.updateCacheFromResults(records, mergeMode === 'merge');
                }
                // Delete search job
                yield searchClient.deleteSearchJob(jobId);
                progress.report({ message: 'Complete!' });
                // Show stats
                if (metadataProvider) {
                    const stats = metadataProvider.getStats();
                    const statsMessage = stats
                        .map(s => `  ${s.field}: ${s.count} values`)
                        .join('\n');
                    const modeText = mergeMode === 'merge' ? 'merged' : 'replaced';
                    vscode.window.showInformationMessage(`Metadata ${modeText} successfully!\n\n${statsMessage}\n\nResults saved to: metadata/${path.basename(resultsFile)}`, 'OK');
                }
                else {
                    vscode.window.showInformationMessage(`Metadata cached successfully! ${records.length} records processed.`);
                }
            }));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to cache metadata: ${message}`);
        }
    });
}
/**
 * Build the metadata query based on scope and sampling options
 */
function buildMetadataQuery(scope, sampling) {
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
    }
    else if (sampling.type === '20percent') {
        query += '\n| where (_messageid=*0 or _messageid=*5)';
    }
    // Add aggregation
    query += '\n| sum(_size) as bytes, count by _sourcecategory,_view,_collector,_source,_sourcehost,_sourcename';
    // Handle _view -> _index conversion
    query += '\n| if (isEmpty(_view),"sumologic_default",_view) as _index';
    query += '\n| fields -_view';
    return query;
}
//# sourceMappingURL=cacheKeyMetadata.js.map
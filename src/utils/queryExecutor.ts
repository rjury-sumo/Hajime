import * as vscode from 'vscode';
import { ProfileManager } from '../profileManager';
import { SearchJobClient, SearchJobRequest, RecordsResponse, MessagesResponse } from '../api/searchJob';

/**
 * Query execution options
 */
export interface QueryExecutionOptions {
    query: string;
    profileName: string;
    from?: string;          // Default: '-1h'
    to?: string;            // Default: 'now'
    timeZone?: string;      // Default: 'UTC'
    byReceiptTime?: boolean; // Default: false
    autoParsingMode?: 'AutoParse' | 'Manual'; // Default: 'Manual'
    onProgress?: (message: string) => void;
    debug?: boolean;        // Default: false - enables detailed logging
}

/**
 * Execute a Sumo Logic search query and return records
 * Reusable function for all query execution needs
 */
export async function executeQueryForRecords(
    context: vscode.ExtensionContext,
    options: QueryExecutionOptions
): Promise<RecordsResponse> {
    const {
        query,
        profileName,
        from = '-1h',
        to = 'now',
        timeZone = 'UTC',
        byReceiptTime = false,
        autoParsingMode = 'Manual',
        onProgress,
        debug = false
    } = options;

    const profileManager = new ProfileManager(context);

    // Get profile
    const profiles = await profileManager.getProfiles();
    const profile = profiles.find(p => p.name === profileName);
    if (!profile) {
        throw new Error(`Profile '${profileName}' not found`);
    }

    // Get credentials
    const credentials = await profileManager.getProfileCredentials(profileName);
    if (!credentials) {
        throw new Error('No credentials found for profile');
    }

    // Create search client
    const endpoint = profileManager.getProfileEndpoint(profile);
    const searchClient = new SearchJobClient({
        accessId: credentials.accessId,
        accessKey: credentials.accessKey,
        endpoint
    });

    if (debug && onProgress) {
        onProgress(`[DEBUG] Profile: ${profileName}`);
        onProgress(`[DEBUG] Endpoint: ${endpoint}`);
        onProgress(`[DEBUG] Region: ${profile.region}`);
    }

    // Parse time ranges
    const fromTime = SearchJobClient.parseRelativeTime(from);
    const toTime = SearchJobClient.parseRelativeTime(to);

    if (debug && onProgress) {
        onProgress(`[DEBUG] Time range: ${from} (${fromTime}) to ${to} (${toTime})`);
        onProgress(`[DEBUG] Time zone: ${timeZone}`);
        onProgress(`[DEBUG] By receipt time: ${byReceiptTime}`);
        onProgress(`[DEBUG] Auto parsing mode: ${autoParsingMode}`);
    }

    if (onProgress) {
        onProgress('Creating search job...');
    }

    // Create search job
    const request: SearchJobRequest = {
        query,
        from: fromTime,
        to: toTime,
        timeZone,
        byReceiptTime,
        autoParsingMode
    };

    if (debug && onProgress) {
        onProgress(`[DEBUG] Request payload: ${JSON.stringify(request, null, 2)}`);
    }

    const createResponse = await searchClient.createSearchJob(request);
    if (createResponse.error || !createResponse.data) {
        if (debug && onProgress) {
            onProgress(`[DEBUG] Create job error: ${createResponse.error}`);
            onProgress(`[DEBUG] Status code: ${createResponse.statusCode}`);
        }
        throw new Error(createResponse.error || 'Failed to create search job');
    }

    const jobId = createResponse.data.id;

    if (onProgress) {
        onProgress(`Job created: ${jobId}`);
    }

    if (debug && onProgress) {
        onProgress(`[DEBUG] Job link: ${JSON.stringify(createResponse.data.link)}`);
    }

    // Poll for completion
    if (onProgress) {
        onProgress('Waiting for query to complete...');
    }

    const pollResult = await searchClient.pollForCompletion(jobId, (status) => {
        if (debug && onProgress) {
            onProgress(`[DEBUG] Job status: ${status.state}, Records: ${status.recordCount}, Messages: ${status.messageCount}`);
            if (status.pendingErrors.length > 0) {
                onProgress(`[DEBUG] Pending errors: ${JSON.stringify(status.pendingErrors)}`);
            }
            if (status.pendingWarnings.length > 0) {
                onProgress(`[DEBUG] Pending warnings: ${JSON.stringify(status.pendingWarnings)}`);
            }
        }
    });

    if (pollResult.error) {
        if (debug && onProgress) {
            onProgress(`[DEBUG] Poll error: ${pollResult.error}`);
        }
        throw new Error(pollResult.error);
    }

    if (debug && onProgress && pollResult.data) {
        onProgress(`[DEBUG] Final status: ${pollResult.data.state}`);
        onProgress(`[DEBUG] Final record count: ${pollResult.data.recordCount}`);
        onProgress(`[DEBUG] Final message count: ${pollResult.data.messageCount}`);
    }

    // Get records
    if (onProgress) {
        onProgress('Fetching results...');
    }

    if (debug && onProgress) {
        onProgress(`[DEBUG] Fetching records from job ${jobId} (offset: 0, limit: 10000)`);
    }

    const recordsResponse = await searchClient.getRecords(jobId, 0, 10000);
    if (recordsResponse.error || !recordsResponse.data) {
        if (debug && onProgress) {
            onProgress(`[DEBUG] Get records error: ${recordsResponse.error}`);
            onProgress(`[DEBUG] Status code: ${recordsResponse.statusCode}`);
        }
        throw new Error(recordsResponse.error || 'Failed to fetch records');
    }

    if (debug && onProgress) {
        onProgress(`[DEBUG] Retrieved ${recordsResponse.data.records.length} records`);
    }

    // Cleanup - delete job
    await searchClient.deleteSearchJob(jobId);

    if (debug && onProgress) {
        onProgress(`[DEBUG] Job ${jobId} deleted`);
    }

    return recordsResponse.data;
}

/**
 * Execute a Sumo Logic search query and return messages
 * Reusable function for message-mode queries
 */
export async function executeQueryForMessages(
    context: vscode.ExtensionContext,
    options: QueryExecutionOptions
): Promise<MessagesResponse> {
    const {
        query,
        profileName,
        from = '-1h',
        to = 'now',
        timeZone = 'UTC',
        byReceiptTime = false,
        autoParsingMode = 'Manual',
        onProgress,
        debug = false
    } = options;

    const profileManager = new ProfileManager(context);

    // Get profile
    const profiles = await profileManager.getProfiles();
    const profile = profiles.find(p => p.name === profileName);
    if (!profile) {
        throw new Error(`Profile '${profileName}' not found`);
    }

    // Get credentials
    const credentials = await profileManager.getProfileCredentials(profileName);
    if (!credentials) {
        throw new Error('No credentials found for profile');
    }

    // Create search client
    const endpoint = profileManager.getProfileEndpoint(profile);
    const searchClient = new SearchJobClient({
        accessId: credentials.accessId,
        accessKey: credentials.accessKey,
        endpoint
    });

    if (debug && onProgress) {
        onProgress(`[DEBUG] Profile: ${profileName}`);
        onProgress(`[DEBUG] Endpoint: ${endpoint}`);
        onProgress(`[DEBUG] Region: ${profile.region}`);
    }

    // Parse time ranges
    const fromTime = SearchJobClient.parseRelativeTime(from);
    const toTime = SearchJobClient.parseRelativeTime(to);

    if (debug && onProgress) {
        onProgress(`[DEBUG] Time range: ${from} (${fromTime}) to ${to} (${toTime})`);
        onProgress(`[DEBUG] Time zone: ${timeZone}`);
        onProgress(`[DEBUG] By receipt time: ${byReceiptTime}`);
        onProgress(`[DEBUG] Auto parsing mode: ${autoParsingMode}`);
    }

    if (onProgress) {
        onProgress('Creating search job...');
    }

    // Create search job
    const request: SearchJobRequest = {
        query,
        from: fromTime,
        to: toTime,
        timeZone,
        byReceiptTime,
        autoParsingMode
    };

    if (debug && onProgress) {
        onProgress(`[DEBUG] Request payload: ${JSON.stringify(request, null, 2)}`);
    }

    const createResponse = await searchClient.createSearchJob(request);
    if (createResponse.error || !createResponse.data) {
        if (debug && onProgress) {
            onProgress(`[DEBUG] Create job error: ${createResponse.error}`);
            onProgress(`[DEBUG] Status code: ${createResponse.statusCode}`);
        }
        throw new Error(createResponse.error || 'Failed to create search job');
    }

    const jobId = createResponse.data.id;

    if (onProgress) {
        onProgress(`Job created: ${jobId}`);
    }

    if (debug && onProgress) {
        onProgress(`[DEBUG] Job link: ${JSON.stringify(createResponse.data.link)}`);
    }

    // Poll for completion
    if (onProgress) {
        onProgress('Waiting for query to complete...');
    }

    const pollResult = await searchClient.pollForCompletion(jobId, (status) => {
        if (debug && onProgress) {
            onProgress(`[DEBUG] Job status: ${status.state}, Records: ${status.recordCount}, Messages: ${status.messageCount}`);
            if (status.pendingErrors.length > 0) {
                onProgress(`[DEBUG] Pending errors: ${JSON.stringify(status.pendingErrors)}`);
            }
            if (status.pendingWarnings.length > 0) {
                onProgress(`[DEBUG] Pending warnings: ${JSON.stringify(status.pendingWarnings)}`);
            }
        }
    });

    if (pollResult.error) {
        if (debug && onProgress) {
            onProgress(`[DEBUG] Poll error: ${pollResult.error}`);
        }
        throw new Error(pollResult.error);
    }

    if (debug && onProgress && pollResult.data) {
        onProgress(`[DEBUG] Final status: ${pollResult.data.state}`);
        onProgress(`[DEBUG] Final record count: ${pollResult.data.recordCount}`);
        onProgress(`[DEBUG] Final message count: ${pollResult.data.messageCount}`);
    }

    // Get messages
    if (onProgress) {
        onProgress('Fetching results...');
    }

    if (debug && onProgress) {
        onProgress(`[DEBUG] Fetching messages from job ${jobId} (offset: 0, limit: 10000)`);
    }

    const messagesResponse = await searchClient.getMessages(jobId, 0, 10000);
    if (messagesResponse.error || !messagesResponse.data) {
        if (debug && onProgress) {
            onProgress(`[DEBUG] Get messages error: ${messagesResponse.error}`);
            onProgress(`[DEBUG] Status code: ${messagesResponse.statusCode}`);
        }
        throw new Error(messagesResponse.error || 'Failed to fetch messages');
    }

    if (debug && onProgress) {
        onProgress(`[DEBUG] Retrieved ${messagesResponse.data.messages.length} messages`);
    }

    // Cleanup - delete job
    await searchClient.deleteSearchJob(jobId);

    if (debug && onProgress) {
        onProgress(`[DEBUG] Job ${jobId} deleted`);
    }

    return messagesResponse.data;
}

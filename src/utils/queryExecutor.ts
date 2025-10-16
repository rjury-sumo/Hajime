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
        onProgress
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

    // Parse time ranges
    const fromTime = SearchJobClient.parseRelativeTime(from);
    const toTime = SearchJobClient.parseRelativeTime(to);

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

    const createResponse = await searchClient.createSearchJob(request);
    if (createResponse.error || !createResponse.data) {
        throw new Error(createResponse.error || 'Failed to create search job');
    }

    const jobId = createResponse.data.id;

    if (onProgress) {
        onProgress(`Job created: ${jobId}`);
    }

    // Poll for completion
    if (onProgress) {
        onProgress('Waiting for query to complete...');
    }

    const pollResult = await searchClient.pollForCompletion(jobId);
    if (pollResult.error) {
        throw new Error(pollResult.error);
    }

    // Get records
    if (onProgress) {
        onProgress('Fetching results...');
    }

    const recordsResponse = await searchClient.getRecords(jobId, 0, 10000);
    if (recordsResponse.error || !recordsResponse.data) {
        throw new Error(recordsResponse.error || 'Failed to fetch records');
    }

    // Cleanup - delete job
    await searchClient.deleteSearchJob(jobId);

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
        onProgress
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

    // Parse time ranges
    const fromTime = SearchJobClient.parseRelativeTime(from);
    const toTime = SearchJobClient.parseRelativeTime(to);

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

    const createResponse = await searchClient.createSearchJob(request);
    if (createResponse.error || !createResponse.data) {
        throw new Error(createResponse.error || 'Failed to create search job');
    }

    const jobId = createResponse.data.id;

    if (onProgress) {
        onProgress(`Job created: ${jobId}`);
    }

    // Poll for completion
    if (onProgress) {
        onProgress('Waiting for query to complete...');
    }

    const pollResult = await searchClient.pollForCompletion(jobId);
    if (pollResult.error) {
        throw new Error(pollResult.error);
    }

    // Get messages
    if (onProgress) {
        onProgress('Fetching results...');
    }

    const messagesResponse = await searchClient.getMessages(jobId, 0, 10000);
    if (messagesResponse.error || !messagesResponse.data) {
        throw new Error(messagesResponse.error || 'Failed to fetch messages');
    }

    // Cleanup - delete job
    await searchClient.deleteSearchJob(jobId);

    return messagesResponse.data;
}

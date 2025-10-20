import * as assert from 'assert';
import * as vscode from 'vscode';
import { SearchJobClient, SearchJobRequest } from '../../api/searchJob';
import {
    shouldRunIntegrationTests,
    getIntegrationTestConfig,
    setupIntegrationProfile,
    cleanupIntegrationProfile,
    respectRateLimit,
    skipIfNotConfigured
} from './testHelper';
import { ProfileManager } from '../../profileManager';
import {
    parseQueryMetadata,
    cleanQuery,
    extractQueryParams,
    substituteParams
} from '../../services/queryMetadata';

suite('Query Execution with Metadata Integration Tests', function() {
    // Longer timeout for API calls
    this.timeout(90000);

    let client: SearchJobClient;
    let context: vscode.ExtensionContext;
    let profileManager: ProfileManager;

    suiteSetup(async function() {
        if (!shouldRunIntegrationTests()) {
            this.skip();
            return;
        }

        // Get extension context
        const extension = vscode.extensions.getExtension('tba.sumo-query-language');
        if (!extension) {
            throw new Error('Extension not found');
        }
        if (!extension.isActive) {
            await extension.activate();
        }
        context = extension.exports?.context;
        if (!context) {
            throw new Error('Extension context not available');
        }

        // Setup integration profile
        profileManager = await setupIntegrationProfile(context);

        // Create client
        const config = getIntegrationTestConfig();
        client = new SearchJobClient({
            accessId: config.accessId,
            accessKey: config.accessKey,
            endpoint: config.endpoint
        });

        console.log('✅ Query execution integration test environment configured');
    });

    suiteTeardown(async function() {
        if (shouldRunIntegrationTests() && profileManager) {
            await cleanupIntegrationProfile(profileManager);
        }
    });

    test('should execute query with metadata directives and parameters', async () => {
        // Query with metadata and parameters - this is the test query from the requirement
        const queryWithMetadata = `// @name Source Category Analysis
// @from -24h
// @to now
// @param category=*
// @mode records

_sourcecategory = {{category}}
| sum(_size) as bytes, count by _sourcecategory, _sourcehost, _collector`;

        // Parse metadata
        const metadata = parseQueryMetadata(queryWithMetadata);

        // Verify metadata parsed correctly
        assert.strictEqual(metadata.name, 'Source Category Analysis');
        assert.strictEqual(metadata.from, '-24h');
        assert.strictEqual(metadata.to, 'now');
        assert.strictEqual(metadata.mode, 'records');
        assert.ok(metadata.params);
        assert.strictEqual(metadata.params!.get('category'), '*');

        // Clean query
        let cleanedQuery = cleanQuery(queryWithMetadata);

        // Verify cleaning worked
        assert.ok(!cleanedQuery.includes('@name'));
        assert.ok(!cleanedQuery.includes('@from'));
        assert.ok(!cleanedQuery.includes('@param'));
        assert.ok(cleanedQuery.includes('_sourcecategory'));

        // Extract and substitute parameters
        const queryParams = extractQueryParams(cleanedQuery);
        assert.strictEqual(queryParams.size, 1);
        assert.ok(queryParams.has('category'));

        cleanedQuery = substituteParams(cleanedQuery, metadata.params!);

        // Verify substitution worked
        assert.ok(cleanedQuery.includes('_sourcecategory = *'));
        assert.ok(!cleanedQuery.includes('{{category}}'));

        // Parse time ranges
        const fromTime = SearchJobClient.parseRelativeTime(metadata.from!);
        const toTime = SearchJobClient.parseRelativeTime(metadata.to!);

        // Create search job request
        const request: SearchJobRequest = {
            query: cleanedQuery,
            from: fromTime,
            to: toTime,
            timeZone: 'UTC'
        };

        console.log('📤 Creating search job with metadata-parsed query');

        // Execute the query
        const createResponse = await client.createSearchJob(request);
        await respectRateLimit();
        assert.ok(createResponse.data, 'Response should have data');
        assert.ok(createResponse.data!.id, 'Response should have job ID');

        const jobId = createResponse.data!.id;
        console.log(`✅ Created search job: ${jobId}`);

        // Poll for completion
        console.log('⏳ Waiting for job completion...');
        const pollResponse = await client.pollForCompletion(jobId, (status) => {
            console.log(`   State: ${status.state}, Records: ${status.recordCount}`);
        });
        await respectRateLimit();

        assert.ok(!pollResponse.error, 'Job should complete without errors');

        // Get results (records mode as specified in metadata)
        const recordsResponse = await client.getRecords(jobId);
        await respectRateLimit();
        assert.ok(recordsResponse.data, 'Should have records data');

        const results = recordsResponse.data!.records;
        console.log(`✅ Retrieved ${results.length} records`);

        // Verify results have expected structure for this query
        if (results.length > 0) {
            const firstRecord = results[0];
            assert.ok(firstRecord.map, 'Record should have map field');

            // Check that expected fields are present based on the query
            // Query groups by _sourcecategory, _sourcehost, _collector
            // and calculates sum(_size) as bytes and count
            const fields = Object.keys(firstRecord.map);
            console.log(`   Fields in results: ${fields.join(', ')}`);

            // Should have the group by fields and aggregation results
            assert.ok(fields.length > 0, 'Should have at least some fields');
        } else {
            console.log('⚠️  No results returned (this may be expected if no data in time range)');
        }

        // Cleanup
        await client.deleteSearchJob(jobId);
        await respectRateLimit();
        console.log('🧹 Cleaned up search job');
    });

    test('should handle query with multiple parameters', async () => {
        const queryWithParams = `// @name Multi-Param Query
// @from -1h
// @to now
// @param keyword=error
// @param limit=10

{{keyword}}
| limit {{limit}}`;

        const metadata = parseQueryMetadata(queryWithParams);
        let cleanedQuery = cleanQuery(queryWithParams);

        // Extract params and verify
        const queryParams = extractQueryParams(cleanedQuery);
        assert.strictEqual(queryParams.size, 2);
        assert.ok(queryParams.has('keyword'));
        assert.ok(queryParams.has('limit'));

        // Substitute params
        cleanedQuery = substituteParams(cleanedQuery, metadata.params!);
        assert.ok(cleanedQuery.includes('error'));
        assert.ok(cleanedQuery.includes('limit 10'));

        // Execute query
        const fromTime = SearchJobClient.parseRelativeTime(metadata.from!);
        const toTime = SearchJobClient.parseRelativeTime(metadata.to!);

        const request: SearchJobRequest = {
            query: cleanedQuery,
            from: fromTime,
            to: toTime,
            timeZone: 'UTC'
        };

        const createResponse = await client.createSearchJob(request);
        await respectRateLimit();
        assert.ok(createResponse.data?.id, 'Should create job successfully');

        const jobId = createResponse.data!.id;

        // Poll and verify it completes
        const pollResponse = await client.pollForCompletion(jobId);
        await respectRateLimit();
        assert.ok(!pollResponse.error, 'Job should complete');

        await client.deleteSearchJob(jobId);
        await respectRateLimit();
        console.log('✅ Multi-parameter query executed successfully');
    });

    test('should handle messages mode from metadata', async () => {
        const queryWithMessagesMode = `// @name Messages Query
// @from -15m
// @to now
// @mode messages

error OR exception
| limit 5`;

        const metadata = parseQueryMetadata(queryWithMessagesMode);
        assert.strictEqual(metadata.mode, 'messages');

        const cleanedQuery = cleanQuery(queryWithMessagesMode);
        const fromTime = SearchJobClient.parseRelativeTime(metadata.from!);
        const toTime = SearchJobClient.parseRelativeTime(metadata.to!);

        const request: SearchJobRequest = {
            query: cleanedQuery,
            from: fromTime,
            to: toTime,
            timeZone: 'UTC'
        };

        const createResponse = await client.createSearchJob(request);
        await respectRateLimit();
        assert.ok(createResponse.data?.id);

        const jobId = createResponse.data!.id;
        await client.pollForCompletion(jobId);
        await respectRateLimit();

        // Get messages based on mode
        const messagesResponse = await client.getMessages(jobId);
        await respectRateLimit();
        assert.ok(messagesResponse.data, 'Should have messages data');

        console.log(`✅ Retrieved ${messagesResponse.data!.messages.length} messages`);

        await client.deleteSearchJob(jobId);
        await respectRateLimit();
    });

    test('should respect active profile credentials', async () => {
        // Verify that the active profile is being used
        const activeProfile = await profileManager.getActiveProfile();
        assert.ok(activeProfile, 'Should have an active profile');

        const credentials = await profileManager.getProfileCredentials(activeProfile!.name);
        assert.ok(credentials, 'Should have credentials for active profile');
        assert.ok(credentials!.accessId, 'Should have access ID');
        assert.ok(credentials!.accessKey, 'Should have access key');

        // Verify client is using the correct endpoint
        const expectedEndpoint = `https://api.${activeProfile!.region}.sumologic.com/api`;
        assert.strictEqual(client.getEndpoint(), expectedEndpoint);

        console.log(`✅ Using profile: ${activeProfile!.name} (${activeProfile!.region})`);
    });

    test('should parse and execute query with all supported metadata directives', async () => {
        const comprehensiveQuery = `// @name Comprehensive Metadata Test
// @from -30m
// @to now
// @timezone UTC
// @mode records
// @output json
// @byReceiptTime false
// @autoParsingMode AutoParse
// @param search_term=*

_sourcecategory={{search_term}}
| limit 5
| count`;

        const metadata = parseQueryMetadata(comprehensiveQuery);

        // Verify all metadata fields
        assert.strictEqual(metadata.name, 'Comprehensive Metadata Test');
        assert.strictEqual(metadata.from, '-30m');
        assert.strictEqual(metadata.to, 'now');
        assert.strictEqual(metadata.timeZone, 'UTC');
        assert.strictEqual(metadata.mode, 'records');
        assert.strictEqual(metadata.output, 'json');
        assert.strictEqual(metadata.byReceiptTime, false);
        assert.strictEqual(metadata.autoParsingMode, 'AutoParse');
        assert.strictEqual(metadata.params!.get('search_term'), '*');

        let cleanedQuery = cleanQuery(comprehensiveQuery);
        cleanedQuery = substituteParams(cleanedQuery, metadata.params!);

        const fromTime = SearchJobClient.parseRelativeTime(metadata.from!);
        const toTime = SearchJobClient.parseRelativeTime(metadata.to!);

        const request: SearchJobRequest = {
            query: cleanedQuery,
            from: fromTime,
            to: toTime,
            timeZone: metadata.timeZone || 'UTC',
            byReceiptTime: metadata.byReceiptTime,
            autoParsingMode: metadata.autoParsingMode
        };

        const createResponse = await client.createSearchJob(request);
        await respectRateLimit();
        assert.ok(createResponse.data?.id);

        const jobId = createResponse.data!.id;
        await client.pollForCompletion(jobId);
        await respectRateLimit();

        const recordsResponse = await client.getRecords(jobId);
        await respectRateLimit();
        assert.ok(recordsResponse.data);

        await client.deleteSearchJob(jobId);
        await respectRateLimit();
        console.log('✅ Comprehensive metadata query executed successfully');
    });

    test('should handle time range parsing correctly', async () => {
        // Test various time range formats
        const timeRanges = [
            { from: '-1h', to: 'now', desc: 'relative hour' },
            { from: '-30m', to: '-15m', desc: 'relative minutes' },
            { from: '-1d', to: 'now', desc: 'relative day' }
        ];

        for (const range of timeRanges) {
            const fromTime = SearchJobClient.parseRelativeTime(range.from);
            const toTime = SearchJobClient.parseRelativeTime(range.to);

            // Verify from is before to
            assert.ok(fromTime < toTime, `From should be before to for ${range.desc}`);

            console.log(`✅ Time range parsing verified: ${range.from} to ${range.to}`);
        }
    });
});

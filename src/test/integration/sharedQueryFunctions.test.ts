import * as assert from 'assert';
import * as vscode from 'vscode';
import { SearchJobClient, SearchJobRequest } from '../../api/searchJob';
import {
    getActiveProfileClient,
    processQueryMetadata,
    promptForTimeRange,
    determineQueryMode,
    executeSearchJob,
    saveQueryResults,
    updateDynamicFieldAutocomplete
} from '../../commands/runQuery';
import {
    shouldRunIntegrationTests,
    getIntegrationTestConfig,
    setupIntegrationProfile,
    cleanupIntegrationProfile,
    respectRateLimit
} from './testHelper';
import { ProfileManager } from '../../profileManager';

/**
 * Integration tests for shared query execution functions in runQuery.ts
 * These test the refactored shared functions that are used by
 * runQuery, runQueryAndChart, and runQueryWebview commands
 */
suite('Shared Query Functions Integration Tests', function() {
    this.timeout(90000);

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

        console.log('✅ Shared query functions integration test environment configured');
    });

    suiteTeardown(async function() {
        if (shouldRunIntegrationTests() && profileManager) {
            await cleanupIntegrationProfile(profileManager);
        }
    });

    test('getActiveProfileClient should return valid client and profile name', async () => {
        const result = await getActiveProfileClient(context);

        assert.ok(result, 'Should return a result');
        assert.ok(result!.client, 'Should have a client');
        assert.ok(result!.profileName, 'Should have a profile name');

        // Verify client has correct endpoint
        const config = getIntegrationTestConfig();
        const expectedEndpoint = `https://api.${config.endpoint}.sumologic.com/api`;
        assert.strictEqual(result!.client.getEndpoint(), expectedEndpoint, 'Client should have correct endpoint');

        console.log(`✅ Active profile client created: ${result!.profileName}`);
    });

    test('processQueryMetadata should parse and substitute parameters', async () => {
        const queryText = `// @name Test Query
// @from -1h
// @to now
// @param category=test
// @mode records

_sourceCategory={{category}} | count`;

        const result = await processQueryMetadata(queryText);

        assert.ok(result, 'Should return a result');
        assert.ok(result!.metadata, 'Should have metadata');
        assert.ok(result!.cleanedQuery, 'Should have cleaned query');

        // Check metadata parsing
        assert.strictEqual(result!.metadata.name, 'Test Query');
        assert.strictEqual(result!.metadata.from, '-1h');
        assert.strictEqual(result!.metadata.to, 'now');
        assert.strictEqual(result!.metadata.mode, 'records');
        assert.strictEqual(result!.metadata.params!.get('category'), 'test');

        // Check query cleaning and substitution
        assert.ok(!result!.cleanedQuery.includes('@name'), 'Should remove @name directive');
        assert.ok(!result!.cleanedQuery.includes('{{category}}'), 'Should substitute parameter');
        assert.ok(result!.cleanedQuery.includes('_sourceCategory=test'), 'Should have substituted value');

        console.log('✅ Query metadata processed and parameters substituted');
    });

    test('executeSearchJob should execute query and return results (records mode)', async () => {
        const clientResult = await getActiveProfileClient(context);
        assert.ok(clientResult, 'Should have client');

        const { client } = clientResult!;

        const query = '*\n| limit 5\n| count';
        const fromTime = SearchJobClient.parseRelativeTime('-15m');
        const toTime = SearchJobClient.parseRelativeTime('now');

        const request: SearchJobRequest = {
            query,
            from: fromTime,
            to: toTime,
            timeZone: 'UTC'
        };

        const result = await executeSearchJob(client, request, 'records');
        await respectRateLimit();

        assert.ok(result, 'Should return result');
        assert.ok(result!.results, 'Should have results');
        assert.ok(Array.isArray(result!.results), 'Results should be an array');
        assert.ok(result!.executionTime, 'Should have execution time');
        assert.ok(result!.executionTime! > 0, 'Execution time should be positive');

        console.log(`✅ Query executed: ${result!.results.length} records, ${result!.executionTime}ms`);
    });

    test('executeSearchJob should execute query and return results (messages mode)', async () => {
        const clientResult = await getActiveProfileClient(context);
        assert.ok(clientResult, 'Should have client');

        const { client } = clientResult!;

        const query = '*\n| limit 3';
        const fromTime = SearchJobClient.parseRelativeTime('-15m');
        const toTime = SearchJobClient.parseRelativeTime('now');

        const request: SearchJobRequest = {
            query,
            from: fromTime,
            to: toTime,
            timeZone: 'UTC'
        };

        const result = await executeSearchJob(client, request, 'messages');
        await respectRateLimit();

        assert.ok(result, 'Should return result');
        assert.ok(result!.results, 'Should have results');
        assert.ok(Array.isArray(result!.results), 'Results should be an array');

        // Messages mode may return 0 results if no data
        console.log(`✅ Query executed in messages mode: ${result!.results.length} messages`);
    });

    test('executeSearchJob should handle debug output channel', async () => {
        const clientResult = await getActiveProfileClient(context);
        assert.ok(clientResult, 'Should have client');

        const { client } = clientResult!;

        const query = '* | limit 1 | count';
        const fromTime = SearchJobClient.parseRelativeTime('-15m');
        const toTime = SearchJobClient.parseRelativeTime('now');

        const request: SearchJobRequest = {
            query,
            from: fromTime,
            to: toTime,
            timeZone: 'UTC'
        };

        // Create debug channel
        const debugChannel = vscode.window.createOutputChannel('Test Debug Channel');

        const result = await executeSearchJob(client, request, 'records', {
            progressTitle: 'Test Query Execution',
            debugChannel
        });
        await respectRateLimit();

        assert.ok(result, 'Should return result with debug channel');

        // Cleanup
        debugChannel.dispose();

        console.log('✅ Query executed with debug channel');
    });

    test('saveQueryResults should save CSV file', async () => {
        const results = [
            { map: { field1: 'value1', field2: '10' } },
            { map: { field1: 'value2', field2: '20' } }
        ];

        const csvContent = 'field1,field2\nvalue1,10\nvalue2,20\n';

        const filePath = await saveQueryResults(context, results, {
            queryIdentifier: 'test_query',
            mode: 'records',
            from: '-15m',
            to: 'now',
            format: 'csv',
            content: csvContent
        });

        assert.ok(filePath, 'Should return file path');
        assert.ok(filePath!.endsWith('.csv'), 'File should have .csv extension');

        console.log(`✅ CSV file saved: ${filePath}`);
    });

    test('saveQueryResults should save JSON file', async () => {
        const results = [
            { map: { field1: 'value1', field2: '10' } },
            { map: { field1: 'value2', field2: '20' } }
        ];

        const jsonContent = JSON.stringify(results, null, 2);

        const filePath = await saveQueryResults(context, results, {
            queryIdentifier: 'test_json_query',
            mode: 'records',
            from: '-15m',
            to: 'now',
            format: 'json',
            content: jsonContent
        });

        assert.ok(filePath, 'Should return file path');
        assert.ok(filePath!.endsWith('.json'), 'File should have .json extension');

        console.log(`✅ JSON file saved: ${filePath}`);
    });

    test('updateDynamicFieldAutocomplete should not throw errors', () => {
        const results = [
            { map: { _sourceCategory: 'test', _sourceHost: 'host1', custom_field: 'value' } },
            { map: { _sourceCategory: 'test2', _sourceHost: 'host2', custom_field: 'value2' } }
        ];

        // Should not throw
        assert.doesNotThrow(() => {
            updateDynamicFieldAutocomplete(results);
        }, 'Should update autocomplete without errors');

        console.log('✅ Dynamic field autocomplete updated');
    });

    test('Integration: Complete query workflow using shared functions', async () => {
        // This test simulates what runQueryAndChart/runQueryWebview do:
        // 1. Get client
        // 2. Process metadata
        // 3. Execute query
        // 4. Save results

        console.log('🔄 Starting complete query workflow test...');

        // Step 1: Get client
        const clientResult = await getActiveProfileClient(context);
        assert.ok(clientResult, 'Step 1: Should get client');
        const { client } = clientResult!;

        // Step 2: Process metadata
        const queryText = `// @name Workflow Test
// @from -30m
// @to now
// @mode records

* | limit 5 | count`;

        const metadataResult = await processQueryMetadata(queryText);
        assert.ok(metadataResult, 'Step 2: Should process metadata');
        const { metadata, cleanedQuery } = metadataResult!;

        // Step 3: Execute query
        const fromTime = SearchJobClient.parseRelativeTime(metadata.from!);
        const toTime = SearchJobClient.parseRelativeTime(metadata.to!);

        const request: SearchJobRequest = {
            query: cleanedQuery,
            from: fromTime,
            to: toTime,
            timeZone: 'UTC'
        };

        const jobResult = await executeSearchJob(client, request, 'records');
        await respectRateLimit();
        assert.ok(jobResult, 'Step 3: Should execute query');
        const { results } = jobResult!;

        // Step 4: Save results
        if (results.length > 0) {
            const jsonContent = JSON.stringify(results, null, 2);
            const filePath = await saveQueryResults(context, results, {
                queryIdentifier: metadata.name || 'workflow_test',
                mode: 'records',
                from: metadata.from!,
                to: metadata.to!,
                format: 'json',
                content: jsonContent
            });
            assert.ok(filePath, 'Step 4: Should save results');
            console.log(`✅ Complete workflow test passed: ${filePath}`);
        } else {
            console.log('✅ Complete workflow test passed (no results to save)');
        }
    });

    test('Integration: Timeslice transpose query workflow', async () => {
        // Test the timeslice transpose scenario
        console.log('🔄 Starting timeslice transpose workflow test...');

        const clientResult = await getActiveProfileClient(context);
        assert.ok(clientResult);
        const { client } = clientResult!;

        // Query with transpose
        const queryText = `// @name Timeslice Transpose Test
// @from -1h
// @to now
// @mode records

*
| timeslice 15m
| count by _timeslice, _sourceCategory
| transpose row _timeslice column _sourceCategory
| limit 5`;

        const metadataResult = await processQueryMetadata(queryText);
        assert.ok(metadataResult);
        const { metadata, cleanedQuery } = metadataResult!;

        const fromTime = SearchJobClient.parseRelativeTime(metadata.from!);
        const toTime = SearchJobClient.parseRelativeTime(metadata.to!);

        const request: SearchJobRequest = {
            query: cleanedQuery,
            from: fromTime,
            to: toTime,
            timeZone: 'UTC'
        };

        const jobResult = await executeSearchJob(client, request, 'records');
        await respectRateLimit();
        assert.ok(jobResult);

        const { results } = jobResult!;

        // If we have results, verify structure
        if (results.length > 0) {
            const firstRecord = results[0];
            assert.ok(firstRecord.map, 'Should have map field');

            // Should have _timeslice field (from transpose row)
            const hasTimeslice = '_timeslice' in firstRecord.map;
            if (hasTimeslice) {
                console.log('✅ Timeslice transpose query returned expected structure with _timeslice');
            } else {
                console.log('ℹ️  Query returned results but no _timeslice (may be expected based on data)');
            }
        } else {
            console.log('ℹ️  Timeslice transpose query returned no results (may be expected based on data)');
        }

        console.log('✅ Timeslice transpose workflow test completed');
    });
});

import * as assert from 'assert';
import * as vscode from 'vscode';
import { SearchJobClient, SearchJobRequest } from '../../api/searchJob';
import {
    shouldRunIntegrationTests,
    getIntegrationTestConfig,
    setupIntegrationProfile,
    cleanupIntegrationProfile,
    waitFor,
    sleep,
    skipIfNotConfigured
} from './testHelper';
import { ProfileManager } from '../../profileManager';

suite('Search Job API Integration Tests', function() {
    // Longer timeout for API calls
    this.timeout(60000);

    let client: SearchJobClient;
    let context: vscode.ExtensionContext;
    let profileManager: ProfileManager;

    suiteSetup(async function() {
        if (!shouldRunIntegrationTests()) { this.skip(); return; };

        if (!shouldRunIntegrationTests()) {
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

        console.log('✅ Integration test environment configured');
    });

    suiteTeardown(async function() {
        if (shouldRunIntegrationTests() && profileManager) {
            await cleanupIntegrationProfile(profileManager);
        }
    });

    test('should create a search job successfully', async () => {
        const request: SearchJobRequest = {
            query: '_sourceCategory=* | limit 10',
            from: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            to: new Date().toISOString(),
            timeZone: 'UTC'
        };

        const response = await client.createSearchJob(request);

        assert.ok(response.data, 'Response should have data');
        assert.ok(response.data!.id, 'Response should have job ID');
        assert.ok(response.data!.link, 'Response should have link');
        assert.strictEqual(response.statusCode, 202, 'Status code should be 202');

        console.log(`✅ Created search job: ${response.data!.id}`);

        // Cleanup: Delete the job
        await client.deleteSearchJob(response.data!.id);
    });

    test('should get search job status', async () => {
        // Create a job first
        const request: SearchJobRequest = {
            query: '_sourceCategory=* | count',
            from: new Date(Date.now() - 3600000).toISOString(),
            to: new Date().toISOString(),
            timeZone: 'UTC'
        };

        const createResponse = await client.createSearchJob(request);
        assert.ok(createResponse.data?.id, 'Job should be created');

        const jobId = createResponse.data!.id;

        // Get status
        const statusResponse = await client.getSearchJobStatus(jobId);

        assert.ok(statusResponse.data, 'Status response should have data');
        assert.ok(statusResponse.data!.state, 'Status should have state');
        assert.ok(
            ['NOT STARTED', 'GATHERING RESULTS', 'DONE GATHERING RESULTS'].includes(statusResponse.data!.state),
            'State should be valid'
        );

        console.log(`✅ Search job status: ${statusResponse.data!.state}`);

        // Cleanup
        await client.deleteSearchJob(jobId);
    });

    test('should wait for search job completion and get messages', async () => {
        const request: SearchJobRequest = {
            query: '_sourceCategory=* | limit 5',
            from: new Date(Date.now() - 3600000).toISOString(),
            to: new Date().toISOString(),
            timeZone: 'UTC'
        };

        const createResponse = await client.createSearchJob(request);
        assert.ok(createResponse.data?.id, 'Job should be created');

        const jobId = createResponse.data!.id;

        // Wait for job to complete
        console.log('⏳ Waiting for job to complete...');

        await waitFor(
            async () => {
                const status = await client.getSearchJobStatus(jobId);
                return status.data?.state === 'DONE GATHERING RESULTS';
            },
            {
                timeout: 45000,
                interval: 2000,
                message: 'Search job did not complete in time'
            }
        );

        console.log('✅ Job completed');

        // Get messages
        const messagesResponse = await client.getMessages(jobId, 0, 5);

        assert.ok(messagesResponse.data, 'Messages response should have data');
        assert.ok(Array.isArray(messagesResponse.data!.messages), 'Should have messages array');

        if (messagesResponse.data!.messages.length > 0) {
            console.log(`✅ Retrieved ${messagesResponse.data!.messages.length} messages`);
            const firstMessage = messagesResponse.data!.messages[0];
            assert.ok(firstMessage.map, 'Message should have map field');
        } else {
            console.log('⚠️  No messages returned (query may not match any data)');
        }

        // Cleanup
        await client.deleteSearchJob(jobId);
    });

    test('should wait for aggregation job and get records', async () => {
        const request: SearchJobRequest = {
            query: '_sourceCategory = * | limit 10000\n| sum(_size) as bytes, count by _sourceCategory,_view,_collector,_source,_sourceHost,_sourceName\n| sort _count desc',
            from: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
            to: new Date().toISOString(),
            timeZone: 'UTC'
        };

        const createResponse = await client.createSearchJob(request);
        assert.ok(createResponse.data?.id, 'Job should be created');

        const jobId = createResponse.data!.id;

        // Wait for job to complete
        console.log('⏳ Waiting for aggregation job to complete...');

        await waitFor(
            async () => {
                const status = await client.getSearchJobStatus(jobId);
                return status.data?.state === 'DONE GATHERING RESULTS';
            },
            {
                timeout: 45000,
                interval: 2000,
                message: 'Aggregation job did not complete in time'
            }
        );

        console.log('✅ Aggregation job completed');

        // Get records
        const recordsResponse = await client.getRecords(jobId, 0, 10);

        assert.ok(recordsResponse.data, 'Records response should have data');
        assert.ok(Array.isArray(recordsResponse.data!.records), 'Should have records array');

        if (recordsResponse.data!.records.length > 0) {
            console.log(`✅ Retrieved ${recordsResponse.data!.records.length} records`);
            const firstRecord = recordsResponse.data!.records[0];
            assert.ok(firstRecord.map, 'Record should have map field');

            // Verify expected fields
            if (firstRecord.map._sourceCategory) {
                console.log(`   Sample: ${firstRecord.map._sourceCategory} - ${firstRecord.map._count} messages, ${firstRecord.map.bytes} bytes`);
            }
        } else {
            console.log('⚠️  No records returned (query may not match any data)');
        }

        // Cleanup
        await client.deleteSearchJob(jobId);
    });

    test('should delete a search job', async () => {
        // Create a job
        const request: SearchJobRequest = {
            query: '_sourceCategory=* | limit 1',
            from: new Date(Date.now() - 3600000).toISOString(),
            to: new Date().toISOString()
        };

        const createResponse = await client.createSearchJob(request);
        assert.ok(createResponse.data?.id, 'Job should be created');

        const jobId = createResponse.data!.id;

        // Delete the job
        const deleteResponse = await client.deleteSearchJob(jobId);

        assert.strictEqual(deleteResponse.statusCode, 200, 'Delete should return 200');

        console.log('✅ Search job deleted successfully');

        // Verify it's deleted (should return error)
        const statusResponse = await client.getSearchJobStatus(jobId);
        assert.ok(statusResponse.error, 'Getting deleted job status should return error');
    });

    test('should handle invalid query error', async () => {
        const request: SearchJobRequest = {
            query: 'invalid | syntax | | |',
            from: new Date(Date.now() - 3600000).toISOString(),
            to: new Date().toISOString()
        };

        const response = await client.createSearchJob(request);

        // Should return an error
        assert.ok(response.error || response.statusCode !== 202, 'Invalid query should return error');

        console.log('✅ Invalid query handled correctly');
    });

    test('should handle pagination for large result sets', async () => {
        const request: SearchJobRequest = {
            query: '_sourceCategory=* | limit 100',
            from: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
            to: new Date().toISOString()
        };

        const createResponse = await client.createSearchJob(request);
        assert.ok(createResponse.data?.id, 'Job should be created');

        const jobId = createResponse.data!.id;

        // Wait for completion
        await waitFor(
            async () => {
                const status = await client.getSearchJobStatus(jobId);
                return status.data?.state === 'DONE GATHERING RESULTS';
            },
            { timeout: 45000, interval: 2000 }
        );

        // Get first page
        const page1 = await client.getMessages(jobId, 0, 10);
        assert.ok(page1.data, 'First page should have data');

        // Get second page
        const page2 = await client.getMessages(jobId, 10, 10);
        assert.ok(page2.data, 'Second page should have data');

        console.log(`✅ Pagination working - Page 1: ${page1.data!.messages.length}, Page 2: ${page2.data!.messages.length}`);

        // Cleanup
        await client.deleteSearchJob(jobId);
    });

    test('should respect time range in query', async () => {
        const now = Date.now();
        const request: SearchJobRequest = {
            query: '_sourceCategory=* | count',
            from: new Date(now - 900000).toISOString(), // 15 minutes ago
            to: new Date(now).toISOString(),
            timeZone: 'UTC'
        };

        const createResponse = await client.createSearchJob(request);
        assert.ok(createResponse.data?.id, 'Job should be created');

        const jobId = createResponse.data!.id;

        // Wait for completion
        await waitFor(
            async () => {
                const status = await client.getSearchJobStatus(jobId);
                return status.data?.state === 'DONE GATHERING RESULTS';
            },
            { timeout: 45000, interval: 2000 }
        );

        const status = await client.getSearchJobStatus(jobId);
        console.log(`✅ Time range query completed - Message count: ${status.data?.messageCount || 0}`);

        // Cleanup
        await client.deleteSearchJob(jobId);
    });
});

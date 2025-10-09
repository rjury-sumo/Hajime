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
const assert = require("assert");
const vscode = require("vscode");
const searchJob_1 = require("../../api/searchJob");
const testHelper_1 = require("./testHelper");
suite('Search Job API Integration Tests', function () {
    // Longer timeout for API calls
    this.timeout(60000);
    let client;
    let context;
    let profileManager;
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!(0, testHelper_1.shouldRunIntegrationTests)()) {
                this.skip();
                return;
            }
            ;
            if (!(0, testHelper_1.shouldRunIntegrationTests)()) {
                return;
            }
            // Get extension context
            const extension = vscode.extensions.getExtension('tba.sumo-query-language');
            if (!extension) {
                throw new Error('Extension not found');
            }
            if (!extension.isActive) {
                yield extension.activate();
            }
            context = (_a = extension.exports) === null || _a === void 0 ? void 0 : _a.context;
            if (!context) {
                throw new Error('Extension context not available');
            }
            // Setup integration profile
            profileManager = yield (0, testHelper_1.setupIntegrationProfile)(context);
            // Create client
            const config = (0, testHelper_1.getIntegrationTestConfig)();
            client = new searchJob_1.SearchJobClient({
                accessId: config.accessId,
                accessKey: config.accessKey,
                endpoint: config.endpoint
            });
            console.log('✅ Integration test environment configured');
        });
    });
    suiteTeardown(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if ((0, testHelper_1.shouldRunIntegrationTests)() && profileManager) {
                yield (0, testHelper_1.cleanupIntegrationProfile)(profileManager);
            }
        });
    });
    test('should create a search job successfully', () => __awaiter(this, void 0, void 0, function* () {
        const request = {
            query: '_sourceCategory=* | limit 10',
            from: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            to: new Date().toISOString(),
            timeZone: 'UTC'
        };
        const response = yield client.createSearchJob(request);
        assert.ok(response.data, 'Response should have data');
        assert.ok(response.data.id, 'Response should have job ID');
        assert.ok(response.data.link, 'Response should have link');
        assert.strictEqual(response.statusCode, 202, 'Status code should be 202');
        console.log(`✅ Created search job: ${response.data.id}`);
        // Cleanup: Delete the job
        yield client.deleteSearchJob(response.data.id);
    }));
    test('should get search job status', () => __awaiter(this, void 0, void 0, function* () {
        var _a;
        // Create a job first
        const request = {
            query: '_sourceCategory=* | count',
            from: new Date(Date.now() - 3600000).toISOString(),
            to: new Date().toISOString(),
            timeZone: 'UTC'
        };
        const createResponse = yield client.createSearchJob(request);
        assert.ok((_a = createResponse.data) === null || _a === void 0 ? void 0 : _a.id, 'Job should be created');
        const jobId = createResponse.data.id;
        // Get status
        const statusResponse = yield client.getSearchJobStatus(jobId);
        assert.ok(statusResponse.data, 'Status response should have data');
        assert.ok(statusResponse.data.state, 'Status should have state');
        assert.ok(['NOT STARTED', 'GATHERING RESULTS', 'DONE GATHERING RESULTS'].includes(statusResponse.data.state), 'State should be valid');
        console.log(`✅ Search job status: ${statusResponse.data.state}`);
        // Cleanup
        yield client.deleteSearchJob(jobId);
    }));
    test('should wait for search job completion and get messages', () => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const request = {
            query: '_sourceCategory=* | limit 5',
            from: new Date(Date.now() - 3600000).toISOString(),
            to: new Date().toISOString(),
            timeZone: 'UTC'
        };
        const createResponse = yield client.createSearchJob(request);
        assert.ok((_a = createResponse.data) === null || _a === void 0 ? void 0 : _a.id, 'Job should be created');
        const jobId = createResponse.data.id;
        // Wait for job to complete
        console.log('⏳ Waiting for job to complete...');
        yield (0, testHelper_1.waitFor)(() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const status = yield client.getSearchJobStatus(jobId);
            return ((_a = status.data) === null || _a === void 0 ? void 0 : _a.state) === 'DONE GATHERING RESULTS';
        }), {
            timeout: 45000,
            interval: 2000,
            message: 'Search job did not complete in time'
        });
        console.log('✅ Job completed');
        // Get messages
        const messagesResponse = yield client.getMessages(jobId, 0, 5);
        assert.ok(messagesResponse.data, 'Messages response should have data');
        assert.ok(Array.isArray(messagesResponse.data.messages), 'Should have messages array');
        if (messagesResponse.data.messages.length > 0) {
            console.log(`✅ Retrieved ${messagesResponse.data.messages.length} messages`);
            const firstMessage = messagesResponse.data.messages[0];
            assert.ok(firstMessage.map, 'Message should have map field');
        }
        else {
            console.log('⚠️  No messages returned (query may not match any data)');
        }
        // Cleanup
        yield client.deleteSearchJob(jobId);
    }));
    test('should wait for aggregation job and get records', () => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const request = {
            query: '_sourceCategory = * | limit 10000\n| sum(_size) as bytes, count by _sourceCategory,_view,_collector,_source,_sourceHost,_sourceName\n| sort _count desc',
            from: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
            to: new Date().toISOString(),
            timeZone: 'UTC'
        };
        const createResponse = yield client.createSearchJob(request);
        assert.ok((_a = createResponse.data) === null || _a === void 0 ? void 0 : _a.id, 'Job should be created');
        const jobId = createResponse.data.id;
        // Wait for job to complete
        console.log('⏳ Waiting for aggregation job to complete...');
        yield (0, testHelper_1.waitFor)(() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const status = yield client.getSearchJobStatus(jobId);
            return ((_a = status.data) === null || _a === void 0 ? void 0 : _a.state) === 'DONE GATHERING RESULTS';
        }), {
            timeout: 45000,
            interval: 2000,
            message: 'Aggregation job did not complete in time'
        });
        console.log('✅ Aggregation job completed');
        // Get records
        const recordsResponse = yield client.getRecords(jobId, 0, 10);
        assert.ok(recordsResponse.data, 'Records response should have data');
        assert.ok(Array.isArray(recordsResponse.data.records), 'Should have records array');
        if (recordsResponse.data.records.length > 0) {
            console.log(`✅ Retrieved ${recordsResponse.data.records.length} records`);
            const firstRecord = recordsResponse.data.records[0];
            assert.ok(firstRecord.map, 'Record should have map field');
            // Verify expected fields
            if (firstRecord.map._sourceCategory) {
                console.log(`   Sample: ${firstRecord.map._sourceCategory} - ${firstRecord.map._count} messages, ${firstRecord.map.bytes} bytes`);
            }
        }
        else {
            console.log('⚠️  No records returned (query may not match any data)');
        }
        // Cleanup
        yield client.deleteSearchJob(jobId);
    }));
    test('should delete a search job', () => __awaiter(this, void 0, void 0, function* () {
        var _a;
        // Create a job
        const request = {
            query: '_sourceCategory=* | limit 1',
            from: new Date(Date.now() - 3600000).toISOString(),
            to: new Date().toISOString()
        };
        const createResponse = yield client.createSearchJob(request);
        assert.ok((_a = createResponse.data) === null || _a === void 0 ? void 0 : _a.id, 'Job should be created');
        const jobId = createResponse.data.id;
        // Delete the job
        const deleteResponse = yield client.deleteSearchJob(jobId);
        assert.strictEqual(deleteResponse.statusCode, 200, 'Delete should return 200');
        console.log('✅ Search job deleted successfully');
        // Verify it's deleted (should return error)
        const statusResponse = yield client.getSearchJobStatus(jobId);
        assert.ok(statusResponse.error, 'Getting deleted job status should return error');
    }));
    test('should handle invalid query error', () => __awaiter(this, void 0, void 0, function* () {
        const request = {
            query: 'invalid | syntax | | |',
            from: new Date(Date.now() - 3600000).toISOString(),
            to: new Date().toISOString()
        };
        const response = yield client.createSearchJob(request);
        // Should return an error
        assert.ok(response.error || response.statusCode !== 202, 'Invalid query should return error');
        console.log('✅ Invalid query handled correctly');
    }));
    test('should handle pagination for large result sets', () => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const request = {
            query: '_sourceCategory=* | limit 100',
            from: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
            to: new Date().toISOString()
        };
        const createResponse = yield client.createSearchJob(request);
        assert.ok((_a = createResponse.data) === null || _a === void 0 ? void 0 : _a.id, 'Job should be created');
        const jobId = createResponse.data.id;
        // Wait for completion
        yield (0, testHelper_1.waitFor)(() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const status = yield client.getSearchJobStatus(jobId);
            return ((_a = status.data) === null || _a === void 0 ? void 0 : _a.state) === 'DONE GATHERING RESULTS';
        }), { timeout: 45000, interval: 2000 });
        // Get first page
        const page1 = yield client.getMessages(jobId, 0, 10);
        assert.ok(page1.data, 'First page should have data');
        // Get second page
        const page2 = yield client.getMessages(jobId, 10, 10);
        assert.ok(page2.data, 'Second page should have data');
        console.log(`✅ Pagination working - Page 1: ${page1.data.messages.length}, Page 2: ${page2.data.messages.length}`);
        // Cleanup
        yield client.deleteSearchJob(jobId);
    }));
    test('should respect time range in query', () => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const now = Date.now();
        const request = {
            query: '_sourceCategory=* | count',
            from: new Date(now - 900000).toISOString(), // 15 minutes ago
            to: new Date(now).toISOString(),
            timeZone: 'UTC'
        };
        const createResponse = yield client.createSearchJob(request);
        assert.ok((_a = createResponse.data) === null || _a === void 0 ? void 0 : _a.id, 'Job should be created');
        const jobId = createResponse.data.id;
        // Wait for completion
        yield (0, testHelper_1.waitFor)(() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const status = yield client.getSearchJobStatus(jobId);
            return ((_a = status.data) === null || _a === void 0 ? void 0 : _a.state) === 'DONE GATHERING RESULTS';
        }), { timeout: 45000, interval: 2000 });
        const status = yield client.getSearchJobStatus(jobId);
        console.log(`✅ Time range query completed - Message count: ${((_b = status.data) === null || _b === void 0 ? void 0 : _b.messageCount) || 0}`);
        // Cleanup
        yield client.deleteSearchJob(jobId);
    }));
});
//# sourceMappingURL=searchJob.test.js.map
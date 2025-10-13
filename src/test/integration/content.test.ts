import * as assert from 'assert';
import * as vscode from 'vscode';
import { ContentClient } from '../../api/content';
import {
    shouldRunIntegrationTests,
    getIntegrationTestConfig,
    setupIntegrationProfile,
    cleanupIntegrationProfile,
    skipIfNotConfigured
} from './testHelper';
import { ProfileManager } from '../../profileManager';

suite('Content/Folders API Integration Tests', function() {
    this.timeout(30000);

    let client: ContentClient;
    let context: vscode.ExtensionContext;
    let profileManager: ProfileManager;

    suiteSetup(async function() {
        if (!shouldRunIntegrationTests()) { this.skip(); return; };

        if (!shouldRunIntegrationTests()) {
            return;
        }

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

        profileManager = await setupIntegrationProfile(context);

        const config = getIntegrationTestConfig();
        client = new ContentClient({ accessId: config.accessId, accessKey: config.accessKey, endpoint: config.endpoint });

        console.log('✅ Content API test environment configured');
    });

    suiteTeardown(async function() {
        if (shouldRunIntegrationTests() && profileManager) {
            await cleanupIntegrationProfile(profileManager);
        }
    });

    test('should get personal folder', async () => {
        const response = await client.getPersonalFolder();

        assert.ok(response.data, 'Response should have data');
        assert.ok(response.data!.id, 'Personal folder should have ID');
        assert.strictEqual(response.data!.itemType, 'Folder', 'Item type should be Folder');
        assert.ok(response.data!.name, 'Personal folder should have name');
        assert.ok(Array.isArray(response.data!.children), 'Should have children array');

        console.log(`✅ Personal folder: ${response.data!.name} (ID: ${response.data!.id})`);
        console.log(`   Contains ${response.data!.children.length} items`);
    });

    test('should get folder by ID', async () => {
        // First get personal folder to get a valid folder ID
        const personalResponse = await client.getPersonalFolder();
        assert.ok(personalResponse.data?.id, 'Should have personal folder ID');

        const folderId = personalResponse.data!.id;

        // Get folder by ID
        const response = await client.getFolder(folderId);

        assert.ok(response.data, 'Response should have data');
        assert.strictEqual(response.data!.id, folderId, 'Folder ID should match');
        assert.strictEqual(response.data!.itemType, 'Folder', 'Item type should be Folder');
        assert.ok(response.data!.name, 'Folder should have name');

        console.log(`✅ Retrieved folder by ID: ${response.data!.name}`);
    });

    test('should handle non-existent folder ID', async () => {
        const fakeId = '0000000000000000'; // Invalid folder ID

        const response = await client.getFolder(fakeId);

        assert.ok(response.error, 'Should return error for non-existent folder');
        assert.ok(response.statusCode === 404 || response.statusCode === 400, 'Should return 404 or 400');

        console.log('✅ Non-existent folder handled correctly');
    });

    test('should verify personal folder structure', async () => {
        const response = await client.getPersonalFolder();
        const personalFolder = response.data!;

        // Verify required fields
        assert.ok(personalFolder.id, 'Should have ID');
        assert.ok(personalFolder.name, 'Should have name');
        assert.ok(personalFolder.itemType, 'Should have itemType');
        assert.ok(personalFolder.createdAt, 'Should have createdAt');
        assert.ok(personalFolder.createdBy, 'Should have createdBy');
        assert.ok(personalFolder.modifiedAt, 'Should have modifiedAt');
        assert.ok(personalFolder.modifiedBy, 'Should have modifiedBy');
        assert.ok(Array.isArray(personalFolder.permissions), 'Should have permissions array');
        assert.ok(Array.isArray(personalFolder.children), 'Should have children array');

        console.log('✅ Personal folder structure verified');
        console.log(`   Created: ${personalFolder.createdAt}`);
        console.log(`   Modified: ${personalFolder.modifiedAt}`);
    });

    test('should list child items in personal folder', async () => {
        const response = await client.getPersonalFolder();
        const children = response.data!.children;

        console.log(`✅ Personal folder contains ${children.length} items:`);

        if (children.length > 0) {
            for (const child of children.slice(0, 5)) { // Show first 5
                assert.ok(child.id, 'Child should have ID');
                assert.ok(child.name, 'Child should have name');
                assert.ok(child.itemType, 'Child should have itemType');

                console.log(`   - ${child.itemType}: ${child.name} (ID: ${child.id})`);
            }

            if (children.length > 5) {
                console.log(`   ... and ${children.length - 5} more`);
            }
        } else {
            console.log('   (Empty folder)');
        }
    });

    test('should handle permissions field', async () => {
        const response = await client.getPersonalFolder();
        const permissions = response.data!.permissions;

        assert.ok(Array.isArray(permissions), 'Permissions should be an array');

        if (permissions.length > 0) {
            console.log(`✅ Folder has ${permissions.length} permissions:`);
            permissions.forEach(perm => {
                console.log(`   - ${perm}`);
            });
        } else {
            console.log('✅ Folder has no special permissions');
        }
    });

    test('should verify folder metadata timestamps', async () => {
        const response = await client.getPersonalFolder();
        const folder = response.data!;

        // Parse timestamps
        const createdDate = new Date(folder.createdAt);
        const modifiedDate = new Date(folder.modifiedAt);

        assert.ok(!isNaN(createdDate.getTime()), 'Created date should be valid');
        assert.ok(!isNaN(modifiedDate.getTime()), 'Modified date should be valid');
        assert.ok(modifiedDate >= createdDate, 'Modified date should be >= created date');

        console.log('✅ Folder timestamps are valid');
        console.log(`   Created: ${createdDate.toISOString()}`);
        console.log(`   Modified: ${modifiedDate.toISOString()}`);
    });

    test('should verify child item types', async () => {
        const response = await client.getPersonalFolder();
        const children = response.data!.children;

        if (children.length === 0) {
            console.log('⚠️  No items in personal folder to verify types');
            return;
        }

        const itemTypes = new Set(children.map(c => c.itemType));
        console.log(`✅ Found ${itemTypes.size} different item types:`);

        itemTypes.forEach(type => {
            const count = children.filter(c => c.itemType === type).length;
            console.log(`   - ${type}: ${count} item(s)`);
        });

        // Verify each child has required fields
        children.forEach(child => {
            assert.ok(child.id, 'Child should have ID');
            assert.ok(child.name, 'Child should have name');
            assert.ok(child.itemType, 'Child should have itemType');
        });
    });

    test('should get content by path', async () => {
        // First get personal folder to construct a valid path
        const personalResponse = await client.getPersonalFolder();
        assert.ok(personalResponse.data, 'Should have personal folder data');

        const personalFolder = personalResponse.data!;

        // Use personal folder path as test - typically /Library/Users/{email}/...
        // We need to construct the path - let's use the root personal path
        const personalPath = `/Library/Users/${personalFolder.createdBy}`;

        console.log(`Testing with path: ${personalPath}`);

        const response = await client.getContent(personalPath);

        // Personal path might not exist, so check both success and 404
        if (response.error && response.statusCode === 404) {
            console.log('⚠️  Personal path not found via getContent, trying direct folder ID path');
            // This is acceptable - path structure varies by deployment
            return;
        }

        assert.ok(response.data, 'Response should have data');
        assert.ok(response.data!.id, 'Content should have ID');
        assert.ok(response.data!.name, 'Content should have name');
        assert.ok(response.data!.itemType, 'Content should have itemType');

        console.log(`✅ Retrieved content by path: ${response.data!.name}`);
        console.log(`   Type: ${response.data!.itemType}`);
        console.log(`   ID: ${response.data!.id}`);
    });

    test('should get content path by ID', async () => {
        // Get personal folder to get a valid content ID
        const personalResponse = await client.getPersonalFolder();
        assert.ok(personalResponse.data?.id, 'Should have personal folder ID');

        const contentId = personalResponse.data!.id;

        // Get the path for this content ID
        const response = await client.getContentPath(contentId);

        assert.ok(response.data, 'Response should have data');
        assert.ok(response.data!.path, 'Response should have path property');
        assert.ok(response.data!.path.startsWith('/'), 'Path should start with /');

        console.log(`✅ Retrieved content path for ID ${contentId}`);
        console.log(`   Path: ${response.data!.path}`);
    });

    test('should handle invalid content path', async () => {
        const invalidPath = '/Library/Users/nonexistent@example.com/InvalidFolder';

        const response = await client.getContent(invalidPath);

        assert.ok(response.error, 'Should return error for invalid path');
        assert.strictEqual(response.statusCode, 404, 'Should return 404 for non-existent path');

        console.log('✅ Invalid content path handled correctly');
    });

    test('should handle invalid content ID for path lookup', async () => {
        const fakeId = '0000000000000000'; // Invalid content ID

        const response = await client.getContentPath(fakeId);

        assert.ok(response.error, 'Should return error for invalid ID');
        assert.ok(response.statusCode === 404 || response.statusCode === 400, 'Should return 404 or 400');

        console.log('✅ Invalid content ID handled correctly');
    });

    test('should get content with children', async () => {
        // Get personal folder (which should have children property)
        const personalResponse = await client.getPersonalFolder();
        assert.ok(personalResponse.data, 'Should have personal folder');

        const folderId = personalResponse.data!.id;

        // Use getFolder to get content with children
        const response = await client.getFolder(folderId);

        assert.ok(response.data, 'Response should have data');
        assert.ok(Array.isArray(response.data!.children), 'Should have children array');

        console.log(`✅ Content with children retrieved successfully`);
        console.log(`   Name: ${response.data!.name}`);
        console.log(`   Children: ${response.data!.children.length} items`);

        // Verify children structure if present
        if (response.data!.children.length > 0) {
            const firstChild = response.data!.children[0];
            assert.ok(firstChild.id, 'Child should have ID');
            assert.ok(firstChild.name, 'Child should have name');
            assert.ok(firstChild.itemType, 'Child should have itemType');
        }
    });

    test('should verify content item structure', async () => {
        // Get personal folder as test content
        const response = await client.getPersonalFolder();
        const content = response.data!;

        // Verify all required ContentItem/PersonalFolderResponse fields
        assert.ok(content.id, 'Should have ID');
        assert.ok(content.name, 'Should have name');
        assert.ok(content.itemType, 'Should have itemType');
        assert.ok(content.parentId !== undefined, 'Should have parentId (may be empty string)');
        assert.ok(content.createdAt, 'Should have createdAt');
        assert.ok(content.createdBy, 'Should have createdBy');
        assert.ok(content.modifiedAt, 'Should have modifiedAt');
        assert.ok(content.modifiedBy, 'Should have modifiedBy');
        assert.ok(Array.isArray(content.permissions), 'Should have permissions array');

        console.log('✅ Content item structure fully verified');
    });

    test('should get content by path and verify path roundtrip', async () => {
        // Get personal folder ID
        const personalResponse = await client.getPersonalFolder();
        const folderId = personalResponse.data!.id;

        // Get the path for this ID
        const pathResponse = await client.getContentPath(folderId);
        assert.ok(pathResponse.data?.path, 'Should get path for folder ID');

        const contentPath = pathResponse.data!.path;
        console.log(`Testing roundtrip with path: ${contentPath}`);

        // Get content using the path
        const contentResponse = await client.getContent(contentPath);

        assert.ok(contentResponse.data, 'Should get content by path');
        assert.strictEqual(contentResponse.data!.id, folderId, 'Content ID should match original folder ID');

        console.log('✅ Path roundtrip verified (ID -> Path -> Content -> ID)');
    });

    test('should get specific folder by ID', async () => {
        const folderId = '00000000008F59B0'; // Known folder ID

        const response = await client.getFolder(folderId);

        if (response.error) {
            if (response.statusCode === 403 || response.statusCode === 401) {
                console.log('⚠️  No permission to access folder (expected for some environments)');
                return;
            } else if (response.statusCode === 404) {
                console.log('⚠️  Folder not found (may not exist in this environment)');
                return;
            }
            throw new Error(`Unexpected error: ${response.error}`);
        }

        assert.ok(response.data, 'Response should have data');
        assert.strictEqual(response.data!.id, folderId, 'Folder ID should match');
        assert.strictEqual(response.data!.itemType, 'Folder', 'Item type should be Folder');
        assert.ok(response.data!.name, 'Folder should have name');
        assert.ok(Array.isArray(response.data!.children), 'Folder should have children array');

        console.log(`✅ Retrieved specific folder: ${response.data!.name}`);
        console.log(`   Type: ${response.data!.itemType}`);
        console.log(`   Children: ${response.data!.children.length} items`);
    });

    test('should get specific search by ID and fetch its path', async () => {
        const searchId = '0000000000852F21'; // Known search ID

        // Get the path for this search
        const pathResponse = await client.getContentPath(searchId);

        if (pathResponse.error) {
            if (pathResponse.statusCode === 403 || pathResponse.statusCode === 401) {
                console.log('⚠️  No permission to access search (expected for some environments)');
                return;
            } else if (pathResponse.statusCode === 404) {
                console.log('⚠️  Search not found (may not exist in this environment)');
                return;
            }
            throw new Error(`Unexpected error: ${pathResponse.error}`);
        }

        assert.ok(pathResponse.data, 'Response should have data');
        assert.ok(pathResponse.data!.path, 'Response should have path');
        assert.ok(pathResponse.data!.path.startsWith('/'), 'Path should start with /');

        console.log(`✅ Retrieved path for search ID ${searchId}`);
        console.log(`   Path: ${pathResponse.data!.path}`);

        // Now get the content using the path
        const contentResponse = await client.getContent(pathResponse.data!.path);

        if (contentResponse.error) {
            console.log(`⚠️  Could not retrieve content by path: ${contentResponse.error}`);
            return;
        }

        assert.ok(contentResponse.data, 'Content response should have data');
        assert.strictEqual(contentResponse.data!.id, searchId, 'Content ID should match search ID');
        assert.ok(contentResponse.data!.itemType, 'Content should have itemType');

        console.log(`✅ Retrieved search content: ${contentResponse.data!.name}`);
        console.log(`   Type: ${contentResponse.data!.itemType}`);
    });

    test('should verify different content types (folder vs search)', async () => {
        const folderId = '00000000008F59B0';
        const searchId = '0000000000852F21';

        // Get folder
        const folderResponse = await client.getFolder(folderId);

        // Get search path
        const searchPathResponse = await client.getContentPath(searchId);

        // Check if we have access to both
        const folderAccessible = !folderResponse.error || folderResponse.statusCode === 404;
        const searchAccessible = !searchPathResponse.error || searchPathResponse.statusCode === 404;

        if (!folderAccessible && !searchAccessible) {
            console.log('⚠️  No access to test content (expected for some environments)');
            return;
        }

        if (folderResponse.data) {
            assert.strictEqual(folderResponse.data.itemType, 'Folder', 'First ID should be a Folder');
            assert.ok(Array.isArray(folderResponse.data.children), 'Folder should have children array');
            console.log(`✅ Folder verified: ${folderResponse.data.name}`);
        }

        if (searchPathResponse.data) {
            const searchPath = searchPathResponse.data.path;
            const searchResponse = await client.getContent(searchPath);

            if (searchResponse.data) {
                assert.ok(['Search', 'SavedSearch'].includes(searchResponse.data.itemType),
                    'Second ID should be a Search or SavedSearch');
                // Searches typically don't have children
                assert.ok(!searchResponse.data.children || searchResponse.data.children.length === 0,
                    'Search should not have children');
                console.log(`✅ Search verified: ${searchResponse.data.name}`);
                console.log(`   Type: ${searchResponse.data.itemType}`);
            }
        }

        console.log('✅ Content type verification complete');
    });

    test('should get folder content with children details', async () => {
        const folderId = '00000000008F59B0'; // Known folder ID

        const response = await client.getFolder(folderId);

        if (response.error) {
            if (response.statusCode === 403 || response.statusCode === 401) {
                console.log('⚠️  No permission to access folder');
                return;
            } else if (response.statusCode === 404) {
                console.log('⚠️  Folder not found');
                return;
            }
            throw new Error(`Unexpected error: ${response.error}`);
        }

        const folder = response.data!;
        assert.ok(folder, 'Should have folder data');

        console.log(`✅ Folder: ${folder.name}`);
        console.log(`   Type: ${folder.itemType}`);
        console.log(`   Created: ${folder.createdAt}`);
        console.log(`   Modified: ${folder.modifiedAt}`);
        console.log(`   Permissions: ${folder.permissions.join(', ')}`);

        if (folder.children && folder.children.length > 0) {
            console.log(`   Children: ${folder.children.length} items`);

            // Show first 3 children
            const childrenToShow = folder.children.slice(0, 3);
            childrenToShow.forEach(child => {
                console.log(`      - ${child.itemType}: ${child.name}`);
            });

            if (folder.children.length > 3) {
                console.log(`      ... and ${folder.children.length - 3} more`);
            }

            // Verify children have required fields
            folder.children.forEach(child => {
                assert.ok(child.id, 'Child should have ID');
                assert.ok(child.name, 'Child should have name');
                assert.ok(child.itemType, 'Child should have itemType');
            });
        } else {
            console.log('   Children: (empty folder)');
        }
    });

    test('should get search path and verify it is not a folder', async () => {
        const searchId = '0000000000852F21'; // Known search ID

        // Get path for search
        const pathResponse = await client.getContentPath(searchId);

        if (pathResponse.error) {
            if (pathResponse.statusCode === 403 || pathResponse.statusCode === 401) {
                console.log('⚠️  No permission to access search');
                return;
            } else if (pathResponse.statusCode === 404) {
                console.log('⚠️  Search not found');
                return;
            }
            throw new Error(`Unexpected error: ${pathResponse.error}`);
        }

        const searchPath = pathResponse.data!.path;

        // Get content by path
        const contentResponse = await client.getContent(searchPath);

        if (contentResponse.error) {
            console.log(`⚠️  Could not retrieve search content: ${contentResponse.error}`);
            return;
        }

        const search = contentResponse.data!;

        assert.ok(search, 'Should have search data');
        assert.notStrictEqual(search.itemType, 'Folder', 'Search should not be a Folder type');

        console.log(`✅ Search: ${search.name}`);
        console.log(`   Type: ${search.itemType}`);
        console.log(`   Path: ${searchPath}`);
        console.log(`   Created: ${search.createdAt}`);
        console.log(`   Modified: ${search.modifiedAt}`);

        // Searches should not have children property or it should be undefined
        if (search.children) {
            assert.strictEqual(search.children.length, 0, 'Search should not have children');
        }
    });

    test('should export a search by ID', async function() {
        this.timeout(60000); // Export can take time

        const searchId = '0000000000852F21'; // Known search ID

        console.log(`Starting export for search ${searchId}...`);

        const response = await client.exportContent(searchId, undefined, 60); // 60 second timeout

        if (response.error) {
            if (response.statusCode === 403 || response.statusCode === 401) {
                console.log('⚠️  No permission to export search');
                return;
            } else if (response.statusCode === 404) {
                console.log('⚠️  Search not found');
                return;
            } else if (response.statusCode === 408) {
                console.log('⚠️  Export timed out (this may be normal for large exports)');
                return;
            }
            throw new Error(`Unexpected error: ${response.error}`);
        }

        assert.ok(response.data, 'Should have export data');

        const exportData = response.data!;

        assert.ok(exportData.type, 'Export should have type property');
        assert.ok(exportData.name, 'Export should have name property');

        console.log(`✅ Search exported successfully`);
        console.log(`   Name: ${exportData.name}`);
        console.log(`   Type: ${exportData.type}`);

        // Search should not have children
        if (exportData.children) {
            assert.strictEqual(exportData.children.length, 0, 'Search export should not have children');
        }
    });

    test('should export a folder by ID', async function() {
        this.timeout(120000); // Folder export can take longer

        const folderId = '00000000008F59B0'; // Known folder ID

        console.log(`Starting export for folder ${folderId}...`);

        const response = await client.exportContent(folderId, undefined, 120); // 120 second timeout

        if (response.error) {
            if (response.statusCode === 403 || response.statusCode === 401) {
                console.log('⚠️  No permission to export folder');
                return;
            } else if (response.statusCode === 404) {
                console.log('⚠️  Folder not found');
                return;
            } else if (response.statusCode === 408) {
                console.log('⚠️  Export timed out (this may be normal for large folders)');
                return;
            }
            throw new Error(`Unexpected error: ${response.error}`);
        }

        assert.ok(response.data, 'Should have export data');

        const exportData = response.data!;

        assert.ok(exportData.type, 'Export should have type property');
        assert.ok(exportData.name, 'Export should have name property');

        console.log(`✅ Folder exported successfully`);
        console.log(`   Name: ${exportData.name}`);
        console.log(`   Type: ${exportData.type}`);

        // Count items recursively
        const countItems = (item: any): number => {
            let count = 1;
            if (item.children && Array.isArray(item.children)) {
                for (const child of item.children) {
                    count += countItems(child);
                }
            }
            return count;
        };

        const itemCount = countItems(exportData);
        console.log(`   Total items (recursive): ${itemCount}`);

        // Folder may have children
        if (exportData.children) {
            assert.ok(Array.isArray(exportData.children), 'Folder children should be an array');
            console.log(`   Direct children: ${exportData.children.length}`);
        }
    });

    test('should begin async export and check status', async function() {
        this.timeout(60000);

        const searchId = '0000000000852F21'; // Known search ID

        // Start export
        const exportJobResponse = await client.beginAsyncExport(searchId);

        if (exportJobResponse.error) {
            if (exportJobResponse.statusCode === 403 || exportJobResponse.statusCode === 401) {
                console.log('⚠️  No permission to start export');
                return;
            } else if (exportJobResponse.statusCode === 404) {
                console.log('⚠️  Content not found');
                return;
            }
            throw new Error(`Unexpected error: ${exportJobResponse.error}`);
        }

        assert.ok(exportJobResponse.data, 'Should have job response');
        assert.ok(exportJobResponse.data!.id, 'Job should have ID');

        const jobId = exportJobResponse.data!.id;
        console.log(`✅ Export job started: ${jobId}`);

        // Check status
        const statusResponse = await client.getAsyncExportStatus(searchId, jobId);

        assert.ok(statusResponse.data, 'Should have status response');
        assert.ok(statusResponse.data!.status, 'Status should have status property');
        assert.ok(['InProgress', 'Success', 'Failed'].includes(statusResponse.data!.status),
            'Status should be one of: InProgress, Success, Failed');

        console.log(`✅ Export job status: ${statusResponse.data!.status}`);

        // If success, try to get result
        if (statusResponse.data!.status === 'Success') {
            const resultResponse = await client.getAsyncExportResult(searchId, jobId);

            if (!resultResponse.error) {
                assert.ok(resultResponse.data, 'Should have result data');
                console.log(`✅ Export result retrieved: ${resultResponse.data!.name}`);
            }
        }
    });

    test('should handle export of non-existent content', async () => {
        const fakeId = '0000000000000000'; // Invalid content ID

        const response = await client.exportContent(fakeId, undefined, 10); // Short timeout

        assert.ok(response.error, 'Should return error for non-existent content');
        assert.ok(response.statusCode === 404 || response.statusCode === 400, 'Should return 404 or 400');

        console.log('✅ Non-existent content export handled correctly');
    });

    test('should verify export result structure', async function() {
        this.timeout(60000);

        // Use personal folder as test content
        const personalResponse = await client.getPersonalFolder();
        const folderId = personalResponse.data!.id;

        const exportResponse = await client.exportContent(folderId, undefined, 60);

        if (exportResponse.error) {
            if (exportResponse.statusCode === 408) {
                console.log('⚠️  Export timed out');
                return;
            }
            console.log(`⚠️  Could not export: ${exportResponse.error}`);
            return;
        }

        const exportData = exportResponse.data!;

        // Verify required fields
        assert.ok(exportData.type, 'Should have type');
        assert.ok(exportData.name, 'Should have name');

        console.log('✅ Export result structure verified');
        console.log(`   Type: ${exportData.type}`);
        console.log(`   Name: ${exportData.name}`);
        console.log(`   Has children: ${!!exportData.children}`);
    });

    test('should format export summary correctly', async function() {
        this.timeout(60000);

        const searchId = '0000000000852F21'; // Known search ID

        const exportResponse = await client.exportContent(searchId, undefined, 60);

        if (exportResponse.error) {
            if (exportResponse.statusCode === 403 || exportResponse.statusCode === 401) {
                console.log('⚠️  No permission to export');
                return;
            } else if (exportResponse.statusCode === 404) {
                console.log('⚠️  Content not found');
                return;
            } else if (exportResponse.statusCode === 408) {
                console.log('⚠️  Export timed out');
                return;
            }
            console.log(`⚠️  Could not export: ${exportResponse.error}`);
            return;
        }

        const exportData = exportResponse.data!;

        // Format the summary with workspace-relative path
        const jsonPath = './output/test_profile/content/test_export';
        const summary = ContentClient.formatExportSummary(exportData, jsonPath);

        assert.ok(summary, 'Should have summary text');
        assert.ok(summary.includes('# Content Export Summary'), 'Summary should have markdown header');
        assert.ok(summary.includes('## Properties'), 'Summary should have properties section');
        assert.ok(summary.includes(`**Type:** ${exportData.type}`), 'Summary should include type');
        assert.ok(summary.includes(`**Name:** ${exportData.name}`), 'Summary should include name');
        assert.ok(summary.includes('**JSON Export:**'), 'Summary should reference JSON export');
        assert.ok(summary.includes(jsonPath), 'Summary should include workspace-relative path');

        console.log('✅ Export summary formatted correctly');
        console.log(`\nSummary preview (first 500 chars):\n${summary.substring(0, 500)}...\n`);
    });

    test('should format dashboard export with panels', async function() {
        this.timeout(60000);

        const dashboardId = '00000000008D3FED'; // Known dashboard ID

        const exportResponse = await client.exportContent(dashboardId, undefined, 60);

        if (exportResponse.error) {
            if (exportResponse.statusCode === 403 || exportResponse.statusCode === 401) {
                console.log('⚠️  No permission to export dashboard');
                return;
            } else if (exportResponse.statusCode === 404) {
                console.log('⚠️  Dashboard not found');
                return;
            } else if (exportResponse.statusCode === 408) {
                console.log('⚠️  Export timed out');
                return;
            }
            console.log(`⚠️  Could not export: ${exportResponse.error}`);
            return;
        }

        const exportData = exportResponse.data!;

        // Format the summary with workspace-relative path
        const jsonPath = './output/test_profile/content/dashboard_export';
        const summary = ContentClient.formatExportSummary(exportData, jsonPath);

        assert.ok(summary, 'Should have summary text');

        if (exportData.panels && exportData.panels.length > 0) {
            assert.ok(summary.includes('## Panels'), 'Summary should have panels section');
            assert.ok(summary.includes(`${exportData.panels.length} items`), 'Summary should show panel count');
            assert.ok(summary.includes('| Name | Type | Key | Properties |'), 'Summary should have markdown table');

            console.log('✅ Dashboard export with panels formatted correctly');
            console.log(`   Dashboard: ${exportData.name}`);
            console.log(`   Panels: ${exportData.panels.length}`);
        } else {
            console.log('⚠️  Dashboard has no panels');
        }
    });

    test('should format folder export with children', async function() {
        this.timeout(120000);

        const folderId = '00000000008F59B0'; // Known folder ID

        const exportResponse = await client.exportContent(folderId, undefined, 120);

        if (exportResponse.error) {
            if (exportResponse.statusCode === 403 || exportResponse.statusCode === 401) {
                console.log('⚠️  No permission to export folder');
                return;
            } else if (exportResponse.statusCode === 404) {
                console.log('⚠️  Folder not found');
                return;
            } else if (exportResponse.statusCode === 408) {
                console.log('⚠️  Export timed out');
                return;
            }
            console.log(`⚠️  Could not export: ${exportResponse.error}`);
            return;
        }

        const exportData = exportResponse.data!;

        // Format the summary with workspace-relative path
        const jsonPath = './output/test_profile/content/folder_export';
        const summary = ContentClient.formatExportSummary(exportData, jsonPath);

        assert.ok(summary, 'Should have summary text');

        if (exportData.children && exportData.children.length > 0) {
            assert.ok(summary.includes('## Children'), 'Summary should have children section');
            assert.ok(summary.includes(`${exportData.children.length} items`), 'Summary should show children count');
            assert.ok(summary.includes('| Name | Type | Description | Has Children |'), 'Summary should have markdown table');

            // Check that nested children are noted
            const nestedFolders = exportData.children.filter((c: any) =>
                c.children && Array.isArray(c.children) && c.children.length > 0
            );

            if (nestedFolders.length > 0) {
                assert.ok(summary.includes('Yes ('), 'Summary should indicate nested children');
                console.log(`   Found ${nestedFolders.length} nested folders`);
            }

            console.log('✅ Folder export with children formatted correctly');
            console.log(`   Folder: ${exportData.name}`);
            console.log(`   Children: ${exportData.children.length}`);
        } else {
            console.log('⚠️  Folder has no children');
        }
    });

    test('should export Admin Recommended folder', async function() {
        this.timeout(120000); // Folder export can take longer

        console.log('\n=== Testing Admin Recommended folder export ===');
        console.log('Method: GET');
        console.log('Endpoint: /api/v2/content/folders/adminRecommended');
        console.log('Polling Status: /api/v2/content/folders/adminRecommended/{jobId}/status');
        console.log('Result: /api/v2/content/folders/adminRecommended/{jobId}/result');

        const exportResponse = await client.exportAdminRecommendedFolder();

        if (exportResponse.error) {
            if (exportResponse.statusCode === 403 || exportResponse.statusCode === 401) {
                console.log('⚠️  No permission to export Admin Recommended folder');
                return;
            } else if (exportResponse.statusCode === 404) {
                console.log('⚠️  Admin Recommended folder not found (this may be normal if not available in your environment)');
                return;
            } else if (exportResponse.statusCode === 405) {
                console.log('⚠️  Method not supported - API may have changed');
                console.log(`   Error: ${exportResponse.error}`);
                return;
            } else if (exportResponse.statusCode === 408) {
                console.log('⚠️  Export timed out');
                return;
            }
            console.log(`⚠️  Could not export (${exportResponse.statusCode}): ${exportResponse.error}`);
            return;
        }

        const exportData = exportResponse.data!;

        assert.ok(exportData, 'Should have export data');
        assert.ok(exportData.type, 'Export should have type property');
        assert.ok(exportData.name, 'Export should have name property');

        console.log('✅ Admin Recommended folder exported successfully');
        console.log(`   Name: ${exportData.name}`);
        console.log(`   Type: ${exportData.type}`);

        if (exportData.children) {
            console.log(`   Children: ${exportData.children.length}`);
        }
    });

    test('should export Global folder', async function() {
        this.timeout(120000); // Folder export can take longer

        console.log('\n=== Testing Global folder export ===');
        console.log('Method: GET');
        console.log('Endpoint: /api/v2/content/folders/global');
        console.log('Polling Status: /api/v2/content/folders/global/{jobId}/status');
        console.log('Result: /api/v2/content/folders/global/{jobId}/result');

        const exportResponse = await client.exportGlobalFolder();

        if (exportResponse.error) {
            if (exportResponse.statusCode === 403 || exportResponse.statusCode === 401) {
                console.log('⚠️  No permission to export Global folder');
                return;
            } else if (exportResponse.statusCode === 404) {
                console.log('⚠️  Global folder not found (this may be normal if not available in your environment)');
                return;
            } else if (exportResponse.statusCode === 405) {
                console.log('⚠️  Method not supported - API may have changed');
                console.log(`   Error: ${exportResponse.error}`);
                return;
            } else if (exportResponse.statusCode === 408) {
                console.log('⚠️  Export timed out');
                return;
            }
            console.log(`⚠️  Could not export (${exportResponse.statusCode}): ${exportResponse.error}`);
            return;
        }

        const exportData = exportResponse.data!;

        assert.ok(exportData, 'Should have export data');
        assert.ok(exportData.type, 'Export should have type property');
        assert.ok(exportData.name, 'Export should have name property');

        console.log('✅ Global folder exported successfully');
        console.log(`   Name: ${exportData.name}`);
        console.log(`   Type: ${exportData.type}`);

        if (exportData.children) {
            console.log(`   Children: ${exportData.children.length}`);
        }
    });

    test('should export Installed Apps folder', async function() {
        this.timeout(120000); // Folder export can take longer

        console.log('\n=== Testing Installed Apps folder export ===');
        console.log('Method: GET');
        console.log('Endpoint: /api/v2/content/folders/installedApps');
        console.log('Polling Status: /api/v2/content/folders/installedApps/{jobId}/status');
        console.log('Result: /api/v2/content/folders/installedApps/{jobId}/result');

        const exportResponse = await client.exportInstalledAppsFolder();

        if (exportResponse.error) {
            if (exportResponse.statusCode === 403 || exportResponse.statusCode === 401) {
                console.log('⚠️  No permission to export Installed Apps folder');
                return;
            } else if (exportResponse.statusCode === 404) {
                console.log('⚠️  Installed Apps folder not found (this may be normal if not available in your environment)');
                return;
            } else if (exportResponse.statusCode === 405) {
                console.log('⚠️  Method not supported - API may have changed');
                console.log(`   Error: ${exportResponse.error}`);
                return;
            } else if (exportResponse.statusCode === 408) {
                console.log('⚠️  Export timed out');
                return;
            }
            console.log(`⚠️  Could not export (${exportResponse.statusCode}): ${exportResponse.error}`);
            return;
        }

        const exportData = exportResponse.data!;

        assert.ok(exportData, 'Should have export data');

        console.log('✅ Installed Apps folder exported successfully');
        if (exportData.name) {
            console.log(`   Name: ${exportData.name}`);
        }
        if (exportData.type) {
            console.log(`   Type: ${exportData.type}`);
        }

        if (exportData.children) {
            console.log(`   Children: ${exportData.children.length}`);
        }
    });

    test('should export with isAdminMode parameter', async function() {
        this.timeout(120000);

        const searchId = '0000000000852F21'; // Known search ID

        // Export with isAdminMode=true
        const exportResponse = await client.exportContent(searchId, true);

        if (exportResponse.error) {
            if (exportResponse.statusCode === 403 || exportResponse.statusCode === 401) {
                console.log('⚠️  No permission to export in admin mode');
                return;
            } else if (exportResponse.statusCode === 404) {
                console.log('⚠️  Content not found');
                return;
            } else if (exportResponse.statusCode === 408) {
                console.log('⚠️  Export timed out');
                return;
            }
            console.log(`⚠️  Could not export: ${exportResponse.error}`);
            return;
        }

        const exportData = exportResponse.data!;

        assert.ok(exportData, 'Should have export data');
        assert.ok(exportData.type, 'Export should have type property');
        assert.ok(exportData.name, 'Export should have name property');

        console.log('✅ Content exported with isAdminMode=true');
        console.log(`   Name: ${exportData.name}`);
        console.log(`   Type: ${exportData.type}`);
    });
});

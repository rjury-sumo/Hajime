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
});

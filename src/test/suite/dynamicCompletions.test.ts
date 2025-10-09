import * as assert from 'assert';
import * as vscode from 'vscode';
import { DynamicCompletionProvider } from '../../dynamicCompletions';

suite('DynamicCompletionProvider Test Suite', () => {
    let context: vscode.ExtensionContext;
    let provider: DynamicCompletionProvider;
    const testProfileName = 'test-completion-profile-' + Date.now();

    suiteSetup(async () => {
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
        provider = new DynamicCompletionProvider(context);
    });

    suiteTeardown(async () => {
        // Cleanup
        await provider.clearProfileData(testProfileName);
    });

    test('should start with empty completion items', () => {
        const items = provider.getCompletionItems();
        assert.strictEqual(items.length, 0, 'Should start with no items');
    });

    test('should add custom field', async () => {
        await provider.loadProfileData(testProfileName);
        await provider.addCustomField('custom_field_1');

        const items = provider.getCompletionItems();
        const customField = items.find(item => item.label === 'custom_field_1');

        assert.ok(customField, 'Custom field should be added');
        assert.strictEqual(customField?.detail, 'Custom field (from API)');
        assert.strictEqual(customField?.kind, vscode.CompletionItemKind.Field);
    });

    test('should add partition', async () => {
        await provider.addPartition('test_partition');

        const items = provider.getCompletionItems();
        const partition = items.find(item => item.label === 'test_partition');

        assert.ok(partition, 'Partition should be added');
        assert.strictEqual(partition?.detail, 'Partition (for _index or _view)');
        assert.strictEqual(partition?.kind, vscode.CompletionItemKind.Value);
    });

    test('should add fields from query results', async () => {
        const mockResults = [
            {
                map: {
                    field1: 'value1',
                    field2: 'value2',
                    _messagetime: '123456'
                }
            },
            {
                map: {
                    field1: 'value3',
                    field3: 'value4'
                }
            }
        ];

        await provider.addFieldsFromResults(mockResults);

        const fieldNames = provider.getFieldNames();
        assert.ok(fieldNames.includes('field1'), 'Should include field1');
        assert.ok(fieldNames.includes('field2'), 'Should include field2');
        assert.ok(fieldNames.includes('field3'), 'Should include field3');
        assert.ok(fieldNames.includes('_messagetime'), 'Should include _messagetime');
    });

    test('should not add duplicate fields', async () => {
        const initialCount = provider.getFieldCount();

        await provider.addCustomField('custom_field_1'); // Already added in previous test

        const finalCount = provider.getFieldCount();
        assert.strictEqual(initialCount, finalCount, 'Should not add duplicate custom field');
    });

    test('should get custom field count', () => {
        const count = provider.getCustomFieldCount();
        assert.ok(count >= 1, 'Should have at least one custom field');
    });

    test('should get partition count', () => {
        const count = provider.getPartitionCount();
        assert.ok(count >= 1, 'Should have at least one partition');
    });

    test('should check if field exists', async () => {
        await provider.addCustomField('check_field');

        assert.strictEqual(provider.hasField('check_field'), true, 'Should find existing field');
        assert.strictEqual(provider.hasField('non_existent_field'), false, 'Should not find non-existent field');
    });

    test('should get current profile name', () => {
        const profileName = provider.getCurrentProfile();
        assert.strictEqual(profileName, testProfileName, 'Should return correct profile name');
    });

    test('should clear all data', () => {
        provider.clear();

        const items = provider.getCompletionItems();
        assert.strictEqual(items.length, 0, 'Should clear all items');
        assert.strictEqual(provider.getFieldCount(), 0, 'Field count should be zero');
        assert.strictEqual(provider.getCustomFieldCount(), 0, 'Custom field count should be zero');
        assert.strictEqual(provider.getPartitionCount(), 0, 'Partition count should be zero');
    });

    test('should persist and load profile data', async () => {
        const newProfileName = 'persist-test-' + Date.now();

        await provider.loadProfileData(newProfileName);
        await provider.addCustomField('persisted_field');
        await provider.addPartition('persisted_partition');

        // Create new provider instance and load same profile
        const newProvider = new DynamicCompletionProvider(context);
        await newProvider.loadProfileData(newProfileName);

        const fieldNames = newProvider.getCustomFieldNames();
        const partitionNames = newProvider.getPartitionNames();

        assert.ok(fieldNames.includes('persisted_field'), 'Should load persisted custom field');
        assert.ok(partitionNames.includes('persisted_partition'), 'Should load persisted partition');

        // Cleanup
        await newProvider.clearProfileData(newProfileName);
    });

    test('should have correct sortText for priority ordering', async () => {
        await provider.loadProfileData('sort-test-' + Date.now());
        await provider.addCustomField('zzz_custom');

        const mockResults = [{
            map: { aaa_discovered: 'value' }
        }];
        await provider.addFieldsFromResults(mockResults);

        const items = provider.getCompletionItems();
        const customField = items.find(item => item.label === 'zzz_custom');
        const discoveredField = items.find(item => item.label === 'aaa_discovered');

        // Custom fields should have 'ccc_' prefix for sorting
        assert.ok(customField?.sortText?.startsWith('ccc_'), 'Custom field should have ccc_ sort prefix');

        // Discovered fields should have 'bbb_' prefix for sorting
        assert.ok(discoveredField?.sortText?.startsWith('bbb_'), 'Discovered field should have bbb_ sort prefix');
    });
});

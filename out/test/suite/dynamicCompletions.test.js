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
const dynamicCompletions_1 = require("../../dynamicCompletions");
suite('DynamicCompletionProvider Test Suite', () => {
    let context;
    let provider;
    const testProfileName = 'test-completion-profile-' + Date.now();
    suiteSetup(() => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
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
        provider = new dynamicCompletions_1.DynamicCompletionProvider(context);
    }));
    suiteTeardown(() => __awaiter(void 0, void 0, void 0, function* () {
        // Cleanup
        yield provider.clearProfileData(testProfileName);
    }));
    test('should start with empty completion items', () => {
        const items = provider.getCompletionItems();
        assert.strictEqual(items.length, 0, 'Should start with no items');
    });
    test('should add custom field', () => __awaiter(void 0, void 0, void 0, function* () {
        yield provider.loadProfileData(testProfileName);
        yield provider.addCustomField('custom_field_1');
        const items = provider.getCompletionItems();
        const customField = items.find(item => item.label === 'custom_field_1');
        assert.ok(customField, 'Custom field should be added');
        assert.strictEqual(customField === null || customField === void 0 ? void 0 : customField.detail, 'Custom field (from API)');
        assert.strictEqual(customField === null || customField === void 0 ? void 0 : customField.kind, vscode.CompletionItemKind.Field);
    }));
    test('should add partition', () => __awaiter(void 0, void 0, void 0, function* () {
        yield provider.addPartition('test_partition');
        const items = provider.getCompletionItems();
        const partition = items.find(item => item.label === 'test_partition');
        assert.ok(partition, 'Partition should be added');
        assert.strictEqual(partition === null || partition === void 0 ? void 0 : partition.detail, 'Partition (for _index or _view)');
        assert.strictEqual(partition === null || partition === void 0 ? void 0 : partition.kind, vscode.CompletionItemKind.Value);
    }));
    test('should add fields from query results', () => __awaiter(void 0, void 0, void 0, function* () {
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
        yield provider.addFieldsFromResults(mockResults);
        const fieldNames = provider.getFieldNames();
        assert.ok(fieldNames.includes('field1'), 'Should include field1');
        assert.ok(fieldNames.includes('field2'), 'Should include field2');
        assert.ok(fieldNames.includes('field3'), 'Should include field3');
        assert.ok(fieldNames.includes('_messagetime'), 'Should include _messagetime');
    }));
    test('should not add duplicate fields', () => __awaiter(void 0, void 0, void 0, function* () {
        const initialCount = provider.getFieldCount();
        yield provider.addCustomField('custom_field_1'); // Already added in previous test
        const finalCount = provider.getFieldCount();
        assert.strictEqual(initialCount, finalCount, 'Should not add duplicate custom field');
    }));
    test('should get custom field count', () => {
        const count = provider.getCustomFieldCount();
        assert.ok(count >= 1, 'Should have at least one custom field');
    });
    test('should get partition count', () => {
        const count = provider.getPartitionCount();
        assert.ok(count >= 1, 'Should have at least one partition');
    });
    test('should check if field exists', () => __awaiter(void 0, void 0, void 0, function* () {
        yield provider.addCustomField('check_field');
        assert.strictEqual(provider.hasField('check_field'), true, 'Should find existing field');
        assert.strictEqual(provider.hasField('non_existent_field'), false, 'Should not find non-existent field');
    }));
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
    test('should persist and load profile data', () => __awaiter(void 0, void 0, void 0, function* () {
        const newProfileName = 'persist-test-' + Date.now();
        yield provider.loadProfileData(newProfileName);
        yield provider.addCustomField('persisted_field');
        yield provider.addPartition('persisted_partition');
        // Create new provider instance and load same profile
        const newProvider = new dynamicCompletions_1.DynamicCompletionProvider(context);
        yield newProvider.loadProfileData(newProfileName);
        const fieldNames = newProvider.getCustomFieldNames();
        const partitionNames = newProvider.getPartitionNames();
        assert.ok(fieldNames.includes('persisted_field'), 'Should load persisted custom field');
        assert.ok(partitionNames.includes('persisted_partition'), 'Should load persisted partition');
        // Cleanup
        yield newProvider.clearProfileData(newProfileName);
    }));
    test('should have correct sortText for priority ordering', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        yield provider.loadProfileData('sort-test-' + Date.now());
        yield provider.addCustomField('zzz_custom');
        const mockResults = [{
                map: { aaa_discovered: 'value' }
            }];
        yield provider.addFieldsFromResults(mockResults);
        const items = provider.getCompletionItems();
        const customField = items.find(item => item.label === 'zzz_custom');
        const discoveredField = items.find(item => item.label === 'aaa_discovered');
        // Custom fields should have 'ccc_' prefix for sorting
        assert.ok((_a = customField === null || customField === void 0 ? void 0 : customField.sortText) === null || _a === void 0 ? void 0 : _a.startsWith('ccc_'), 'Custom field should have ccc_ sort prefix');
        // Discovered fields should have 'bbb_' prefix for sorting
        assert.ok((_b = discoveredField === null || discoveredField === void 0 ? void 0 : discoveredField.sortText) === null || _b === void 0 ? void 0 : _b.startsWith('bbb_'), 'Discovered field should have bbb_ sort prefix');
    }));
});
//# sourceMappingURL=dynamicCompletions.test.js.map
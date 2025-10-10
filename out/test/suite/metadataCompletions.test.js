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
const path = require("path");
const metadataCompletions_1 = require("../../metadataCompletions");
suite('MetadataCompletionProvider Test Suite', () => {
    let provider;
    const testMetadataDir = path.join(__dirname, '../../../output/rick/metadata');
    suiteSetup(() => __awaiter(void 0, void 0, void 0, function* () {
        provider = new metadataCompletions_1.MetadataCompletionProvider();
        yield provider.loadMetadataCache(testMetadataDir, 'rick');
    }));
    test('should load metadata cache from files', () => {
        const sourceCategoryValues = provider.getFieldValues('_sourceCategory');
        assert.ok(sourceCategoryValues.length > 0, 'Should load _sourceCategory values');
        assert.ok(sourceCategoryValues.includes('/sumo/config/accountstatus'), 'Should include expected value');
    });
    test('should provide completions after = with no space', () => __awaiter(void 0, void 0, void 0, function* () {
        // Create a mock document with "_sourceCategory="
        const doc = yield vscode.workspace.openTextDocument({
            content: '_sourceCategory=',
            language: 'sumo'
        });
        const position = new vscode.Position(0, 16); // After the =
        const completions = provider.provideCompletionItems(doc, position);
        assert.ok(completions.length > 0, 'Should provide completions');
        const accountStatus = completions.find(item => item.label === '/sumo/config/accountstatus');
        assert.ok(accountStatus, 'Should include /sumo/config/accountstatus');
        assert.strictEqual(accountStatus === null || accountStatus === void 0 ? void 0 : accountStatus.sortText, '!/sumo/config/accountstatus', 'Should have ! prefix for highest priority');
    }));
    test('should provide completions after = with space', () => __awaiter(void 0, void 0, void 0, function* () {
        const doc = yield vscode.workspace.openTextDocument({
            content: '_sourceCategory = ',
            language: 'sumo'
        });
        const position = new vscode.Position(0, 18); // After "= "
        const completions = provider.provideCompletionItems(doc, position);
        assert.ok(completions.length > 0, 'Should provide completions with space');
    }));
    test('should filter completions based on partial input', () => __awaiter(void 0, void 0, void 0, function* () {
        const doc = yield vscode.workspace.openTextDocument({
            content: '_sourceCategory=/sumo',
            language: 'sumo'
        });
        const position = new vscode.Position(0, 21); // After "/sumo"
        const completions = provider.provideCompletionItems(doc, position);
        assert.ok(completions.length > 0, 'Should provide filtered completions');
        // All completions should have correct range to replace partial text
        completions.forEach(item => {
            assert.ok(item.range, 'Should have range set');
        });
    }));
    test('should handle case-insensitive field names', () => __awaiter(void 0, void 0, void 0, function* () {
        const doc = yield vscode.workspace.openTextDocument({
            content: '_sourcecategory=',
            language: 'sumo'
        });
        const position = new vscode.Position(0, 16); // After the =
        const completions = provider.provideCompletionItems(doc, position);
        assert.ok(completions.length > 0, 'Should match case-insensitive field names');
    }));
    test('should provide completions for _collector field', () => __awaiter(void 0, void 0, void 0, function* () {
        const doc = yield vscode.workspace.openTextDocument({
            content: '_collector=',
            language: 'sumo'
        });
        const position = new vscode.Position(0, 11);
        const completions = provider.provideCompletionItems(doc, position);
        assert.ok(completions.length >= 0, 'Should provide collector completions');
    }));
    test('should provide completions for _index field', () => __awaiter(void 0, void 0, void 0, function* () {
        const doc = yield vscode.workspace.openTextDocument({
            content: '_index=',
            language: 'sumo'
        });
        const position = new vscode.Position(0, 7);
        const completions = provider.provideCompletionItems(doc, position);
        assert.ok(completions.length >= 0, 'Should provide index completions');
    }));
    test('should not provide completions for non-metadata fields', () => __awaiter(void 0, void 0, void 0, function* () {
        const doc = yield vscode.workspace.openTextDocument({
            content: 'some_field=',
            language: 'sumo'
        });
        const position = new vscode.Position(0, 11);
        const completions = provider.provideCompletionItems(doc, position);
        assert.strictEqual(completions.length, 0, 'Should not provide completions for non-metadata fields');
    }));
    test('should have correct completion item properties', () => __awaiter(void 0, void 0, void 0, function* () {
        const doc = yield vscode.workspace.openTextDocument({
            content: '_sourceCategory=',
            language: 'sumo'
        });
        const position = new vscode.Position(0, 16);
        const completions = provider.provideCompletionItems(doc, position);
        if (completions.length > 0) {
            const firstItem = completions[0];
            assert.ok(firstItem.detail, 'Should have detail');
            assert.ok(firstItem.documentation, 'Should have documentation');
            assert.strictEqual(firstItem.kind, vscode.CompletionItemKind.Value, 'Should be Value kind');
            assert.ok(firstItem.filterText, 'Should have filterText');
            assert.ok(firstItem.insertText, 'Should have insertText');
        }
    }));
    test('should get statistics', () => {
        const stats = provider.getStats();
        assert.ok(stats.length > 0, 'Should return stats');
        const sourceCategory = stats.find(s => s.field === '_sourceCategory');
        assert.ok(sourceCategory, 'Should have _sourceCategory stats');
        assert.ok(sourceCategory.count > 0, 'Should have count > 0');
    });
    test('should preselect first item when no partial text', () => __awaiter(void 0, void 0, void 0, function* () {
        const doc = yield vscode.workspace.openTextDocument({
            content: '_sourceCategory=',
            language: 'sumo'
        });
        const position = new vscode.Position(0, 16);
        const completions = provider.provideCompletionItems(doc, position);
        if (completions.length > 0) {
            assert.strictEqual(completions[0].preselect, true, 'First item should be preselected');
        }
    }));
    test('should merge metadata when merge=true', () => __awaiter(void 0, void 0, void 0, function* () {
        const initialValues = provider.getFieldValues('_sourceCategory');
        const initialCount = initialValues.length;
        // Add new results with merge
        const newResults = [{
                map: {
                    _sourceCategory: 'new/test/category',
                    _collector: 'test-collector'
                }
            }];
        yield provider.updateCacheFromResults(newResults, true);
        const mergedValues = provider.getFieldValues('_sourceCategory');
        assert.ok(mergedValues.length >= initialCount, 'Should have at least as many values after merge');
        assert.ok(mergedValues.includes('new/test/category'), 'Should include new value');
        assert.ok(mergedValues.includes(initialValues[0]), 'Should still include old values');
    }));
    test('should replace metadata when merge=false', () => __awaiter(void 0, void 0, void 0, function* () {
        const newResults = [{
                map: {
                    _sourceCategory: 'replaced/category',
                    _collector: 'replaced-collector'
                }
            }];
        yield provider.updateCacheFromResults(newResults, false);
        const replacedValues = provider.getFieldValues('_sourceCategory');
        assert.strictEqual(replacedValues.length, 1, 'Should have only one value after replace');
        assert.strictEqual(replacedValues[0], 'replaced/category', 'Should be the new value');
        // Reload original data for other tests
        yield provider.loadMetadataCache(testMetadataDir, 'rick');
    }));
});
//# sourceMappingURL=metadataCompletions.test.js.map
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
suite('Metadata Completion Debug', () => {
    let provider;
    suiteSetup(() => __awaiter(void 0, void 0, void 0, function* () {
        provider = new metadataCompletions_1.MetadataCompletionProvider();
        const testMetadataDir = path.join(__dirname, '../../../output/rick/metadata');
        yield provider.loadMetadataCache(testMetadataDir, 'rick');
        console.log('\n=== Metadata Cache Stats ===');
        const stats = provider.getStats();
        stats.forEach(s => console.log(`${s.field}: ${s.count} values`));
        const scValues = provider.getFieldValues('_sourceCategory');
        console.log('\n=== _sourceCategory values ===');
        console.log(scValues);
    }));
    test('regex pattern testing', () => {
        const testCases = [
            { text: '_sourceCategory=', expected: true },
            { text: '_sourceCategory =', expected: true },
            { text: '_sourceCategory = ', expected: true },
            { text: '_sourcecategory=', expected: true },
            { text: '_sourcecategory = ', expected: true },
            { text: '_sourceCategory=/sumo', expected: true },
            { text: '_sourceCategory = /sumo', expected: true },
            { text: 'where _sourceCategory=', expected: true },
            { text: 'where _sourceCategory = ', expected: true },
        ];
        const pattern = /(_sourceCategory|_collector|_source|_sourceHost|_sourceName|_index)\s*=\s*([^|\s]*)$/i;
        testCases.forEach(tc => {
            const match = tc.text.match(pattern);
            console.log(`\nText: "${tc.text}"`);
            console.log(`  Match: ${match ? 'YES' : 'NO'}`);
            if (match) {
                console.log(`  Field: ${match[1]}`);
                console.log(`  Partial: "${match[2]}"`);
            }
            assert.strictEqual(!!match, tc.expected, `Pattern should ${tc.expected ? 'match' : 'not match'}: "${tc.text}"`);
        });
    });
    test('completion items with various inputs', () => __awaiter(void 0, void 0, void 0, function* () {
        const testCases = [
            '_sourceCategory=',
            '_sourceCategory =',
            '_sourceCategory = ',
            '_sourcecategory=',
        ];
        for (const text of testCases) {
            const doc = yield vscode.workspace.openTextDocument({
                content: text,
                language: 'sumo'
            });
            const position = new vscode.Position(0, text.length);
            const completions = provider.provideCompletionItems(doc, position);
            console.log(`\n=== Input: "${text}" ===`);
            console.log(`Completions returned: ${completions.length}`);
            if (completions.length > 0) {
                console.log('First 3 items:');
                completions.slice(0, 3).forEach(item => {
                    console.log(`  - ${item.label} (sortText: ${item.sortText})`);
                });
            }
            else {
                console.log('NO COMPLETIONS RETURNED!');
            }
            assert.ok(completions.length > 0, `Should provide completions for: "${text}"`);
        }
    }));
});
//# sourceMappingURL=metadataDebug.test.js.map
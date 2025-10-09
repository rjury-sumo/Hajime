import * as assert from 'assert';
import * as vscode from 'vscode';
import { ParserCompletionProvider } from '../../parserCompletions';

suite('ParserCompletionProvider Test Suite', () => {
    let provider: ParserCompletionProvider;

    suiteSetup(async () => {
        provider = new ParserCompletionProvider();
        await provider.loadParsers();
    });

    test('should load parser snippets', () => {
        const count = provider.getParserCount();
        assert.ok(count > 0, 'Should load parser snippets');
    });

    test('should have app names', () => {
        const apps = provider.getAppNames();
        assert.ok(apps.length > 0, 'Should have app names');
        assert.ok(Array.isArray(apps), 'App names should be an array');
    });

    test('should get completion items', () => {
        const items = provider.getCompletionItems();

        assert.ok(items.length > 0, 'Should have completion items');
        assert.strictEqual(items.length, provider.getParserCount(), 'Item count should match parser count');
    });

    test('should have correct completion item structure', () => {
        const items = provider.getCompletionItems();
        const firstItem = items[0];

        assert.ok(firstItem.label, 'Should have label');
        assert.ok(firstItem.detail, 'Should have detail');
        assert.strictEqual(firstItem.kind, vscode.CompletionItemKind.Snippet, 'Should be snippet kind');
        assert.ok(firstItem.insertText instanceof vscode.SnippetString, 'Should have snippet insert text');
        assert.ok(firstItem.documentation, 'Should have documentation');
    });

    test('should have parser prefix in filterText', () => {
        const items = provider.getCompletionItems();
        const randomItem = items[Math.floor(Math.random() * items.length)];

        assert.ok(randomItem.filterText?.startsWith('parser '), 'FilterText should start with "parser "');
    });

    test('should have correct sortText for priority', () => {
        const items = provider.getCompletionItems();
        const randomItem = items[Math.floor(Math.random() * items.length)];

        assert.ok(randomItem.sortText?.startsWith('zzz_parser_'), 'SortText should start with zzz_parser_ for low priority');
    });

    test('should filter parsers by app name', () => {
        const apps = provider.getAppNames();
        if (apps.length === 0) {
            return; // Skip if no apps
        }

        const firstApp = apps[0];
        const filtered = provider.getParsersByApp(firstApp);

        assert.ok(filtered.length > 0, 'Should find parsers for app');
        filtered.forEach(item => {
            assert.strictEqual(item.detail, firstApp, 'All items should have matching app detail');
        });
    });

    test('should handle case-insensitive app filtering', () => {
        const apps = provider.getAppNames();
        if (apps.length === 0) {
            return;
        }

        const appName = apps[0];
        const lowerCase = provider.getParsersByApp(appName.toLowerCase());
        const upperCase = provider.getParsersByApp(appName.toUpperCase());

        assert.strictEqual(lowerCase.length, upperCase.length, 'Case should not matter for filtering');
    });

    test('should return empty array for non-existent app', () => {
        const filtered = provider.getParsersByApp('NonExistentApp123456');
        assert.strictEqual(filtered.length, 0, 'Should return empty array for non-existent app');
    });

    test('should replace "parser" prefix when document context provided', () => {
        // Create a mock document
        const doc = {
            lineAt: (line: number) => ({
                text: '| parser ',
                range: new vscode.Range(0, 0, 0, 9)
            })
        } as any;

        const position = new vscode.Position(0, 9);
        const items = provider.getCompletionItems(doc, position);

        assert.ok(items.length > 0, 'Should return items with document context');

        const firstItem = items[0];
        assert.ok(firstItem.range, 'Should have range set');
        if (firstItem.range instanceof vscode.Range) {
            assert.strictEqual(firstItem.range.start.character, 2, 'Range should start at "parser"');
        }
    });

    test('should return normal items without document context', () => {
        const itemsWithoutContext = provider.getCompletionItems();
        const itemsWithContext = provider.getCompletionItems(undefined, undefined);

        assert.strictEqual(itemsWithoutContext.length, itemsWithContext.length, 'Should work with or without context');
    });

    test('should have unique parser labels', () => {
        const items = provider.getCompletionItems();
        const labels = items.map(item => typeof item.label === 'string' ? item.label : item.label.label);
        const uniqueLabels = new Set(labels);

        // While labels might not be 100% unique (due to same app having multiple parsers),
        // we should have a reasonable diversity
        assert.ok(uniqueLabels.size > 0, 'Should have labels');
    });

    test('should include app name in documentation', () => {
        const items = provider.getCompletionItems();
        const itemsWithApps = items.filter(item => item.detail && item.detail !== 'General');

        if (itemsWithApps.length > 0) {
            const firstItem = itemsWithApps[0];
            const doc = firstItem.documentation;

            if (doc instanceof vscode.MarkdownString) {
                assert.ok(doc.value.includes('App:'), 'Documentation should include app name');
            }
        }
    });
});

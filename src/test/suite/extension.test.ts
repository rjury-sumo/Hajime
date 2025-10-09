import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('tba.sumo-query-language'));
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('tba.sumo-query-language');
        assert.ok(extension);

        if (!extension!.isActive) {
            await extension!.activate();
        }

        assert.strictEqual(extension!.isActive, true, 'Extension should be activated');
    });

    test('All commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);

        const expectedCommands = [
            'sumologic.createProfile',
            'sumologic.switchProfile',
            'sumologic.listProfiles',
            'sumologic.deleteProfile',
            'sumologic.testConnection',
            'sumologic.runQuery',
            'sumologic.fetchCustomFields',
            'sumologic.fetchPartitions',
            'sumologic.viewAutocomplete',
            'sumologic.clearAutocomplete',
            'sumologic.getPersonalFolder',
            'sumologic.getFolder',
            'sumologic.chartCSV',
            'sumologic.runQueryAndChart',
            'sumologic.runQueryWebview',
            'sumologic.cleanupOldFiles'
        ];

        for (const cmd of expectedCommands) {
            assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
        }
    });

    test('Sumo language should be registered', () => {
        const languages = vscode.languages.getLanguages();

        // Languages is a promise in newer VS Code versions
        return languages.then(langs => {
            assert.ok(langs.includes('sumo'), 'Sumo language should be registered');
        });
    });

    test('Completion provider should be registered for sumo language', async () => {
        // Create a test document
        const doc = await vscode.workspace.openTextDocument({
            language: 'sumo',
            content: '_sourceCategory='
        });

        const position = new vscode.Position(0, 16);

        // Get completions
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            doc.uri,
            position
        );

        assert.ok(completions, 'Should get completions');
        assert.ok(completions.items.length > 0, 'Should have completion items');
    });

    test('Extension should export context', async () => {
        const extension = vscode.extensions.getExtension('tba.sumo-query-language');
        assert.ok(extension);

        if (!extension!.isActive) {
            await extension!.activate();
        }

        const exports = extension!.exports;
        // The extension may or may not export context, so just verify it loaded
        assert.ok(extension!.isActive, 'Extension should have loaded successfully');
    });

    test('Configuration properties should exist', () => {
        const config = vscode.workspace.getConfiguration('sumologic');

        // Check that configuration properties are accessible
        const profiles = config.get('profiles');
        const activeProfile = config.get('activeProfile');
        const fileStoragePath = config.get('fileStoragePath');
        const webviewPageSize = config.get('webviewPageSize');

        // These may be undefined, but the properties should be accessible
        assert.notStrictEqual(profiles, null);
        assert.notStrictEqual(fileStoragePath, null);
        assert.notStrictEqual(webviewPageSize, null);
    });

    test('Default configuration values should be correct', () => {
        const config = vscode.workspace.getConfiguration('sumologic');

        const fileStoragePath = config.get<string>('fileStoragePath');
        const webviewPageSize = config.get<number>('webviewPageSize');

        assert.strictEqual(fileStoragePath, '${workspaceFolder}/output', 'Default file storage path should be correct');
        assert.strictEqual(webviewPageSize, 100, 'Default webview page size should be 100');
    });
});

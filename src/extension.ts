import * as vscode from 'vscode';
import { authenticateCommand, testConnectionCommand, switchProfileCommand, listProfilesCommand, deleteProfileCommand } from './commands/authenticate';
import { runQueryCommand } from './commands/runQuery';
import { fetchCustomFieldsCommand } from './commands/customFields';
import { fetchPartitionsCommand } from './commands/partitions';
import { viewAutocompleteCommand, clearAutocompleteCommand } from './commands/viewAutocomplete';
import { getPersonalFolderCommand, getFolderCommand } from './commands/personalFolder';
import { StatusBarManager } from './statusBar';
import { DynamicCompletionProvider } from './dynamicCompletions';
import { ParserCompletionProvider } from './parserCompletions';

// Global dynamic completion provider
let dynamicCompletionProvider: DynamicCompletionProvider;
let parserCompletionProvider: ParserCompletionProvider;

export function getDynamicCompletionProvider(): DynamicCompletionProvider {
    return dynamicCompletionProvider;
}

// Build completion items once at activation
function createCompletionItems(): vscode.CompletionItem[] {
    const aggregating = ['avg', 'count', 'count_distinct', 'count_frequent', 'fillmissing', 'first', 'min', 'max', 'last', 'most_recent', 'pct', 'least_recent', 'stddev', 'sum'];
    const maths = ['abs', 'acos', 'asin', 'atan', 'atan2', 'cbrt', 'ceil', 'cos', 'cosh', 'exp', 'expm1', 'floor', 'hypot', 'log', 'log10', 'log1p', 'max', 'min', 'round', 'sin', 'sinh', 'sqrt', 'tan', 'tanh', 'toDegrees', 'toRadians'];
    const parse = ['csv', 'JSON', 'keyvalue', 'parse', 'parse regex', 'split', 'xml'];
    const search = ['accum', 'backshift', 'base64Decode', 'base64Encode', 'bin', 'CIDR', 'concat', 'contains', 'decToHex', 'diff', 'fields', 'filter', 'format', 'formatDate', 'lookup', 'haversine', 'hexToDec', 'if', 'in', 'ipv4ToNumber', 'isBlank', 'isEmpty', 'isNull', 'isNumeric', 'isPrivateIP', 'isPublicIP', 'isValidIP', 'join', 'length', 'limit', 'logcompare', 'logreduce', 'lookup', 'luhn', 'matches', 'median', 'merge', 'now', 'num', 'outlier', 'parseHex', 'predict', 'replace', 'rollingstd', 'save', 'sessionize', 'smooth', 'sort', 'substring', 'timeslice', 'toUpperCase', 'toLowerCase', 'top', 'total', 'trace', 'transaction', 'transactionize', 'transpose', 'urldecode', 'urlencode', 'where'];
    const metadata = ['_index', '_view', '_collector', '_messageCount', '_messageTime', '_raw', '_receiptTime', '_size', '_source', '_sourceCategory', '_sourceHost', '_sourceName', '_format', '_timeslice'];
    const operators = ['and', 'or', 'not', 'in', '!', 'nodrop'];
    const recent = ['geoip', 'threatip', 'values', 'threatlookup'];

    const completionItems: vscode.CompletionItem[] = [];

    // Add aggregating functions
    aggregating.forEach(item => {
        const completionItem = new vscode.CompletionItem(item, vscode.CompletionItemKind.Function);
        completionItem.detail = 'Aggregating function';
        completionItems.push(completionItem);
    });

    // Add math functions
    maths.forEach(item => {
        const completionItem = new vscode.CompletionItem(item, vscode.CompletionItemKind.Function);
        completionItem.detail = 'Math function';
        completionItems.push(completionItem);
    });

    // Add parse functions
    parse.forEach(item => {
        const completionItem = new vscode.CompletionItem(item, vscode.CompletionItemKind.Function);
        completionItem.detail = 'Parse function';
        completionItems.push(completionItem);
    });

    // Add search operators
    search.forEach(item => {
        const completionItem = new vscode.CompletionItem(item, vscode.CompletionItemKind.Function);
        completionItem.detail = 'Search operator';
        completionItems.push(completionItem);
    });

    // Add metadata fields
    metadata.forEach(item => {
        const completionItem = new vscode.CompletionItem(item, vscode.CompletionItemKind.Field);
        completionItem.detail = 'Metadata field';
        completionItems.push(completionItem);
    });

    // Add logical operators
    operators.forEach(item => {
        const completionItem = new vscode.CompletionItem(item, vscode.CompletionItemKind.Keyword);
        completionItem.detail = 'Operator';
        completionItems.push(completionItem);
    });

    // Add recent additions
    recent.forEach(item => {
        const completionItem = new vscode.CompletionItem(item, vscode.CompletionItemKind.Function);
        completionItem.detail = 'Function';
        completionItems.push(completionItem);
    });

    return completionItems;
}

export function activate(context: vscode.ExtensionContext) {
    // Create static completion items once
    const staticCompletionItems = createCompletionItems();

    // Initialize dynamic completion provider
    dynamicCompletionProvider = new DynamicCompletionProvider(context);

    // Initialize profile directories and load autocomplete data for active profile if exists
    (async () => {
        const profileManager = await import('./profileManager');
        const pm = new profileManager.ProfileManager(context);

        // Ensure all profile directories exist
        await pm.ensureProfileDirectoriesExist();

        const activeProfile = await pm.getActiveProfile();
        if (activeProfile) {
            await dynamicCompletionProvider.loadProfileData(activeProfile.name);
        }
    })();

    // Initialize parser completion provider
    parserCompletionProvider = new ParserCompletionProvider();
    parserCompletionProvider.loadParsers().then(() => {
        console.log(`Loaded ${parserCompletionProvider.getParserCount()} parser snippets from ${parserCompletionProvider.getAppNames().length} apps`);
    });

    // Combined completion provider that returns both static and dynamic items
    const provider = vscode.languages.registerCompletionItemProvider('sumo', {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
            // Combine static items with dynamically discovered fields and parser snippets
            const dynamicItems = dynamicCompletionProvider.getCompletionItems();
            const parserItems = parserCompletionProvider.getCompletionItems();
            return [...staticCompletionItems, ...dynamicItems, ...parserItems];
        }
    });

    // Initialize status bar
    const statusBar = new StatusBarManager(context);

    // Register commands
    const createProfileCmd = vscode.commands.registerCommand('sumologic.createProfile', async () => {
        await authenticateCommand(context);
        await statusBar.refresh();
    });

    const switchProfileCmd = vscode.commands.registerCommand('sumologic.switchProfile', async () => {
        await switchProfileCommand(context);
        await statusBar.refresh();
    });

    const listProfilesCmd = vscode.commands.registerCommand('sumologic.listProfiles', () => {
        return listProfilesCommand(context);
    });

    const deleteProfileCmd = vscode.commands.registerCommand('sumologic.deleteProfile', async () => {
        await deleteProfileCommand(context);
        await statusBar.refresh();
    });

    const testConnectionCmd = vscode.commands.registerCommand('sumologic.testConnection', () => {
        return testConnectionCommand(context);
    });

    const runQueryCmd = vscode.commands.registerCommand('sumologic.runQuery', () => {
        return runQueryCommand(context);
    });

    const fetchCustomFieldsCmd = vscode.commands.registerCommand('sumologic.fetchCustomFields', () => {
        return fetchCustomFieldsCommand(context);
    });

    const fetchPartitionsCmd = vscode.commands.registerCommand('sumologic.fetchPartitions', () => {
        return fetchPartitionsCommand(context);
    });

    const viewAutocompleteCmd = vscode.commands.registerCommand('sumologic.viewAutocomplete', () => {
        return viewAutocompleteCommand(context);
    });

    const clearAutocompleteCmd = vscode.commands.registerCommand('sumologic.clearAutocomplete', () => {
        return clearAutocompleteCommand(context);
    });

    const getPersonalFolderCmd = vscode.commands.registerCommand('sumologic.getPersonalFolder', () => {
        return getPersonalFolderCommand(context);
    });

    const getFolderCmd = vscode.commands.registerCommand('sumologic.getFolder', () => {
        return getFolderCommand(context);
    });

    context.subscriptions.push(
        provider,
        createProfileCmd,
        switchProfileCmd,
        listProfilesCmd,
        deleteProfileCmd,
        testConnectionCmd,
        runQueryCmd,
        fetchCustomFieldsCmd,
        fetchPartitionsCmd,
        viewAutocompleteCmd,
        clearAutocompleteCmd,
        getPersonalFolderCmd,
        getFolderCmd
    );
}

export function deactivate() {
    // Cleanup if needed
}
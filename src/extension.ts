import * as vscode from 'vscode';
import { authenticateCommand, testConnectionCommand, switchProfileCommand, listProfilesCommand, deleteProfileCommand, editProfileCommand } from './commands/authenticate';
import { runQueryCommand } from './commands/runQuery';
import { fetchCustomFieldsCommand } from './commands/customFields';
import { fetchPartitionsCommand } from './commands/partitions';
import { fetchCollectorsCommand, getCollectorCommand, getSourcesCommand } from './commands/collectors';
import { viewAutocompleteCommand, clearAutocompleteCommand } from './commands/viewAutocomplete';
import { getPersonalFolderCommand, getFolderCommand, getContentByPathCommand, getContentByIdCommand, exportContentCommand, exportAdminRecommendedCommand, exportGlobalFolderCommand, exportInstalledAppsCommand } from './commands/personalFolder';
import { chartCSVCommand } from './commands/chartCSV';
import { runQueryAndChartCommand } from './commands/runQueryAndChart';
import { runQueryWebviewCommand } from './commands/runQueryWebview';
import { cleanupOldFilesCommand } from './commands/cleanupOldFiles';
import { cacheKeyMetadataCommand } from './commands/cacheKeyMetadata';
import { newSumoFileCommand } from './commands/newSumoFile';
import { openSearchInWebCommand } from './commands/openSearchInWeb';
import { revealStorageInExplorerCommand, deleteStorageItemCommand, copyStoragePathCommand, openStorageInTerminalCommand, openQueryResultAsWebviewCommand } from './commands/storageExplorer';
import { viewLibraryContentCommand } from './commands/viewLibraryContent';
import {
    copyLibraryNodeIdCommand,
    copyLibraryNodePathCommand,
    openLibraryNodeInWebCommand,
    refreshLibraryNodeCommand,
    viewLibraryNodeDetailsCommand,
    openLibraryNodeJsonCommand,
    exportLibraryNodeToFileCommand,
    fetchRecursiveFolderCommand
} from './commands/libraryCommands';
import { StatusBarManager } from './statusBar';
import { DynamicCompletionProvider } from './dynamicCompletions';
import { ParserCompletionProvider } from './parserCompletions';
import { ProfileManager } from './profileManager';
import { MetadataCompletionProvider } from './metadataCompletions';
import { SumoExplorerProvider } from './views/sumoExplorer';
import { SumoCodeLensProvider } from './providers/codeLensProvider';
import { DatabaseWebviewProvider } from './views/databaseWebviewProvider';
import { UsersWebviewProvider } from './views/usersWebviewProvider';
import { RolesWebviewProvider } from './views/rolesWebviewProvider';
import { registerUsersRolesCommands } from './commands/usersRoles';

// Global completion providers
let dynamicCompletionProvider: DynamicCompletionProvider;
let parserCompletionProvider: ParserCompletionProvider;
let metadataCompletionProvider: MetadataCompletionProvider;
let statusBarManager: StatusBarManager;

export function getDynamicCompletionProvider(): DynamicCompletionProvider {
    return dynamicCompletionProvider;
}

export function getMetadataCompletionProvider(): MetadataCompletionProvider {
    return metadataCompletionProvider;
}

export function getStatusBarManager(): StatusBarManager | undefined {
    return statusBarManager;
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

    // Add metadata fields with highest priority (aaa prefix)
    metadata.forEach(item => {
        const completionItem = new vscode.CompletionItem(item, vscode.CompletionItemKind.Field);
        completionItem.detail = 'Metadata field';
        completionItem.sortText = `aaa_${item}`; // Ensure metadata appears first
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

    // Initialize metadata completion provider
    metadataCompletionProvider = new MetadataCompletionProvider();

    // Link the dynamic completion provider so metadata can access partitions
    metadataCompletionProvider.setDynamicCompletionProvider(dynamicCompletionProvider);

    // Load metadata cache for active profile
    (async () => {
        const profileManager = await import('./profileManager');
        const pm = new profileManager.ProfileManager(context);
        const activeProfile = await pm.getActiveProfile();
        if (activeProfile) {
            const metadataDir = pm.getProfileMetadataDirectory(activeProfile.name);
            await metadataCompletionProvider.loadMetadataCache(metadataDir, activeProfile.name);
        }
    })();

    // Metadata completion provider - triggers on '='
    const metadataProvider = vscode.languages.registerCompletionItemProvider('sumo', {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
            return metadataCompletionProvider.provideCompletionItems(document, position);
        }
    }, '=');

    // Combined completion provider that returns both static and dynamic items
    const provider = vscode.languages.registerCompletionItemProvider('sumo', {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
            // Get the text before the cursor to check if user is typing "parser"
            const linePrefix = document.lineAt(position).text.substring(0, position.character);
            const words = linePrefix.trim().toLowerCase().split(/\s+/);
            const lastWord = words[words.length - 1];

            // Only include parser snippets if user has typed "parser"
            const includeParserSnippets = lastWord.startsWith('parser') || words.includes('parser');

            // Combine static items with dynamically discovered fields
            const dynamicItems = dynamicCompletionProvider.getCompletionItems();
            const items = [...staticCompletionItems, ...dynamicItems];

            // Add parser snippets only if user typed "parser"
            if (includeParserSnippets) {
                const parserItems = parserCompletionProvider.getCompletionItems(document, position);
                items.push(...parserItems);
            }

            return items;
        }
    });

    // Initialize status bar
    statusBarManager = new StatusBarManager(context);
    const statusBar = statusBarManager;

    // Initialize tree view
    const sumoExplorerProvider = new SumoExplorerProvider(context);
    const treeView = vscode.window.registerTreeDataProvider('sumoExplorer', sumoExplorerProvider);

    // Initialize CodeLens provider
    const codeLensProvider = new SumoCodeLensProvider();
    const codeLensDisposable = vscode.languages.registerCodeLensProvider('sumo', codeLensProvider);

    // Initialize Database Webview Provider
    const databaseWebviewProvider = new DatabaseWebviewProvider(context.extensionUri, context);

    // Register event handler for opening .sumo files
    const recentQueriesManager = sumoExplorerProvider.getRecentQueriesManager();
    const profileManager = new ProfileManager(context);

    vscode.workspace.onDidOpenTextDocument(async (document) => {
        if (document.languageId === 'sumo' || document.fileName.endsWith('.sumo')) {
            const activeProfile = await profileManager.getActiveProfile();
            recentQueriesManager.addQuery(document.fileName, activeProfile?.name);
            // Refresh tree view to show updated recent queries
            sumoExplorerProvider.refresh();
        }
    }, null, context.subscriptions);

    // Register commands
    const createProfileCmd = vscode.commands.registerCommand('sumologic.createProfile', async () => {
        await authenticateCommand(context);
        await statusBar.refresh();
        sumoExplorerProvider.refresh();
    });

    const switchProfileCmd = vscode.commands.registerCommand('sumologic.switchProfile', async () => {
        await switchProfileCommand(context);
        await statusBar.refresh();
        sumoExplorerProvider.refresh();
    });

    const listProfilesCmd = vscode.commands.registerCommand('sumologic.listProfiles', () => {
        return listProfilesCommand(context);
    });

    const deleteProfileCmd = vscode.commands.registerCommand('sumologic.deleteProfile', async () => {
        await deleteProfileCommand(context);
        await statusBar.refresh();
        sumoExplorerProvider.refresh();
    });

    const editProfileCmd = vscode.commands.registerCommand('sumologic.editProfile', async (treeItem?: any) => {
        // Extract profile name from tree item if available
        const profileName = treeItem?.profile?.name || treeItem;
        await editProfileCommand(context, profileName);
        await statusBar.refresh();
        sumoExplorerProvider.refresh();
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

    const fetchCollectorsCmd = vscode.commands.registerCommand('sumologic.fetchCollectors', () => {
        return fetchCollectorsCommand(context);
    });

    const getCollectorCmd = vscode.commands.registerCommand('sumologic.getCollector', () => {
        return getCollectorCommand(context);
    });

    const getSourcesCmd = vscode.commands.registerCommand('sumologic.getSources', () => {
        return getSourcesCommand(context);
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

    const getContentByPathCmd = vscode.commands.registerCommand('sumologic.getContentByPath', () => {
        return getContentByPathCommand(context);
    });

    const getContentByIdCmd = vscode.commands.registerCommand('sumologic.getContentById', () => {
        return getContentByIdCommand(context);
    });

    const exportContentCmd = vscode.commands.registerCommand('sumologic.exportContent', () => {
        return exportContentCommand(context);
    });

    const exportAdminRecommendedCmd = vscode.commands.registerCommand('sumologic.exportAdminRecommended', () => {
        return exportAdminRecommendedCommand(context);
    });

    const exportGlobalFolderCmd = vscode.commands.registerCommand('sumologic.exportGlobalFolder', () => {
        return exportGlobalFolderCommand(context);
    });

    const exportInstalledAppsCmd = vscode.commands.registerCommand('sumologic.exportInstalledApps', () => {
        return exportInstalledAppsCommand(context);
    });

    const chartCSVCmd = vscode.commands.registerCommand('sumologic.chartCSV', (uri?: vscode.Uri) => {
        return chartCSVCommand(context, uri);
    });

    const runQueryAndChartCmd = vscode.commands.registerCommand('sumologic.runQueryAndChart', () => {
        return runQueryAndChartCommand(context);
    });

    const runQueryWebviewCmd = vscode.commands.registerCommand('sumologic.runQueryWebview', () => {
        return runQueryWebviewCommand(context);
    });

    const cleanupOldFilesCmd = vscode.commands.registerCommand('sumologic.cleanupOldFiles', () => {
        return cleanupOldFilesCommand(context);
    });

    const cacheKeyMetadataCmd = vscode.commands.registerCommand('sumologic.cacheKeyMetadata', () => {
        return cacheKeyMetadataCommand(context, metadataCompletionProvider);
    });

    const newSumoFileCmd = vscode.commands.registerCommand('sumologic.newSumoFile', () => {
        return newSumoFileCommand(context);
    });

    const refreshExplorerCmd = vscode.commands.registerCommand('sumologic.refreshExplorer', () => {
        sumoExplorerProvider.refresh();
    });

    const openSearchInWebCmd = vscode.commands.registerCommand('sumologic.openSearchInWeb', () => {
        return openSearchInWebCommand(context);
    });

    const revealStorageCmd = vscode.commands.registerCommand('sumologic.revealStorageInExplorer', (treeItem?: any) => {
        return revealStorageInExplorerCommand(treeItem);
    });

    const deleteStorageCmd = vscode.commands.registerCommand('sumologic.deleteStorageItem', (treeItem?: any) => {
        return deleteStorageItemCommand(context, treeItem);
    });

    const copyStoragePathCmd = vscode.commands.registerCommand('sumologic.copyStoragePath', (treeItem?: any) => {
        return copyStoragePathCommand(treeItem);
    });

    const openStorageInTerminalCmd = vscode.commands.registerCommand('sumologic.openStorageInTerminal', (treeItem?: any) => {
        return openStorageInTerminalCommand(treeItem);
    });

    const openQueryResultAsWebviewCmd = vscode.commands.registerCommand('sumologic.openQueryResultAsWebview', (treeItem?: any) => {
        return openQueryResultAsWebviewCommand(context, treeItem);
    });

    const viewLibraryContentCmd = vscode.commands.registerCommand('sumologic.viewLibraryContent', (profileName: string, contentId: string, contentName: string) => {
        return viewLibraryContentCommand(context, profileName, contentId, contentName);
    });

    const copyLibraryNodeIdCmd = vscode.commands.registerCommand('sumologic.copyLibraryNodeId', (treeItem: any) => {
        return copyLibraryNodeIdCommand(treeItem);
    });

    const copyLibraryNodePathCmd = vscode.commands.registerCommand('sumologic.copyLibraryNodePath', (treeItem: any) => {
        return copyLibraryNodePathCommand(context, treeItem);
    });

    const openLibraryNodeInWebCmd = vscode.commands.registerCommand('sumologic.openLibraryNodeInWeb', (treeItem: any) => {
        return openLibraryNodeInWebCommand(context, treeItem);
    });

    const refreshLibraryNodeCmd = vscode.commands.registerCommand('sumologic.refreshLibraryNode', (treeItem: any) => {
        return refreshLibraryNodeCommand(context, treeItem);
    });

    const viewLibraryNodeDetailsCmd = vscode.commands.registerCommand('sumologic.viewLibraryNodeDetails', (treeItem: any) => {
        return viewLibraryNodeDetailsCommand(context, treeItem);
    });

    const openLibraryNodeJsonCmd = vscode.commands.registerCommand('sumologic.openLibraryNodeJson', (treeItem: any) => {
        return openLibraryNodeJsonCommand(context, treeItem);
    });

    const exportLibraryNodeToFileCmd = vscode.commands.registerCommand('sumologic.exportLibraryNodeToFile', (treeItem: any) => {
        return exportLibraryNodeToFileCommand(context, treeItem);
    });

    const openDatabaseViewerCmd = vscode.commands.registerCommand('sumologic.openDatabaseViewer', async (profileName?: string) => {
        await databaseWebviewProvider.show(profileName);
    });

    const fetchRecursiveFolderCmd = vscode.commands.registerCommand('sumologic.fetchRecursiveFolder', (treeItem: any) => {
        return fetchRecursiveFolderCommand(context, treeItem);
    });

    const extractSearchToFileCmd = vscode.commands.registerCommand('sumologic.extractSearchToFile', (profileName: string, contentId: string, contentName: string, searchContent: any) => {
        const { extractSearchToFileCommand } = require('./commands/extractSearchToFile');
        return extractSearchToFileCommand(context, profileName, contentId, contentName, searchContent);
    });

    // Register users and roles commands
    registerUsersRolesCommands(context);

    // Create webview providers for users and roles
    const usersWebviewProvider = new UsersWebviewProvider(context.extensionUri, context);
    const rolesWebviewProvider = new RolesWebviewProvider(context.extensionUri, context);

    const viewUsersCmd = vscode.commands.registerCommand('sumologic.viewUsers', async (profileName?: string) => {
        return usersWebviewProvider.show(profileName);
    });

    const viewRolesCmd = vscode.commands.registerCommand('sumologic.viewRoles', async (profileName?: string) => {
        return rolesWebviewProvider.show(profileName);
    });

    const openExportedContentCmd = vscode.commands.registerCommand('sumologic.openExportedContent', async () => {
        const { openExportedContentCommand } = require('./commands/openExportedContent');
        return openExportedContentCommand(context);
    });

    const openExportedContentFromPathCmd = vscode.commands.registerCommand('sumologic.openExportedContentFromPath', async (filePath: string) => {
        const { openExportedContentFromPathCommand } = require('./commands/openExportedContent');
        return openExportedContentFromPathCommand(context, filePath);
    });

    // Register scope commands
    const createScopeCmd = vscode.commands.registerCommand('sumologic.createScope', async () => {
        const { createScope } = require('./commands/scopes');
        return createScope(context);
    });

    const editScopeCmd = vscode.commands.registerCommand('sumologic.editScope', async (scopeId: string, profileName: string) => {
        const { editScope } = require('./commands/scopes');
        return editScope(context, scopeId, profileName);
    });

    const deleteScopeCmd = vscode.commands.registerCommand('sumologic.deleteScope', async (scopeId: string, profileName: string) => {
        const { deleteScope } = require('./commands/scopes');
        return deleteScope(context, scopeId, profileName);
    });

    const listScopesCmd = vscode.commands.registerCommand('sumologic.listScopes', async () => {
        const { listScopes } = require('./commands/scopes');
        return listScopes(context);
    });

    const viewScopeCmd = vscode.commands.registerCommand('sumologic.viewScope', async (scopeId: string, profileName: string) => {
        const { ScopeWebviewProvider } = require('./views/scopeWebview');
        return ScopeWebviewProvider.showScope(context, scopeId, profileName);
    });

    const profileScopeCmd = vscode.commands.registerCommand('sumologic.profileScope', async (scopeIdOrTreeItem: string | any, profileName?: string) => {
        const { profileScope } = require('./commands/scopeActions');
        // Handle both direct call (scopeId, profileName) and context menu call (treeItem)
        if (typeof scopeIdOrTreeItem === 'string') {
            return profileScope(context, scopeIdOrTreeItem, profileName!);
        } else {
            return profileScope(context, scopeIdOrTreeItem.data.scopeId, scopeIdOrTreeItem.data.profileName);
        }
    });

    const sampleScopeLogsCmd = vscode.commands.registerCommand('sumologic.sampleScopeLogs', async (scopeIdOrTreeItem: string | any, profileName?: string) => {
        const { sampleScopeLogs } = require('./commands/scopeActions');
        // Handle both direct call (scopeId, profileName) and context menu call (treeItem)
        if (typeof scopeIdOrTreeItem === 'string') {
            return sampleScopeLogs(context, scopeIdOrTreeItem, profileName!);
        } else {
            return sampleScopeLogs(context, scopeIdOrTreeItem.data.scopeId, scopeIdOrTreeItem.data.profileName);
        }
    });

    const cacheScopeMetadataCmd = vscode.commands.registerCommand('sumologic.cacheScopeMetadata', async (scopeIdOrTreeItem: string | any, profileName?: string) => {
        const { cacheScopeMetadata } = require('./commands/scopeActions');
        // Handle both direct call (scopeId, profileName) and context menu call (treeItem)
        if (typeof scopeIdOrTreeItem === 'string') {
            return cacheScopeMetadata(context, scopeIdOrTreeItem, profileName!);
        } else {
            return cacheScopeMetadata(context, scopeIdOrTreeItem.data.scopeId, scopeIdOrTreeItem.data.profileName);
        }
    });

    context.subscriptions.push(
        treeView,
        codeLensDisposable,
        metadataProvider,
        provider,
        createProfileCmd,
        switchProfileCmd,
        listProfilesCmd,
        deleteProfileCmd,
        editProfileCmd,
        testConnectionCmd,
        runQueryCmd,
        fetchCustomFieldsCmd,
        fetchPartitionsCmd,
        fetchCollectorsCmd,
        getCollectorCmd,
        getSourcesCmd,
        viewAutocompleteCmd,
        clearAutocompleteCmd,
        getPersonalFolderCmd,
        getFolderCmd,
        getContentByPathCmd,
        getContentByIdCmd,
        exportContentCmd,
        exportAdminRecommendedCmd,
        exportGlobalFolderCmd,
        exportInstalledAppsCmd,
        chartCSVCmd,
        runQueryAndChartCmd,
        runQueryWebviewCmd,
        cleanupOldFilesCmd,
        cacheKeyMetadataCmd,
        newSumoFileCmd,
        refreshExplorerCmd,
        openSearchInWebCmd,
        revealStorageCmd,
        deleteStorageCmd,
        copyStoragePathCmd,
        openStorageInTerminalCmd,
        openQueryResultAsWebviewCmd,
        viewLibraryContentCmd,
        copyLibraryNodeIdCmd,
        copyLibraryNodePathCmd,
        openLibraryNodeInWebCmd,
        refreshLibraryNodeCmd,
        viewLibraryNodeDetailsCmd,
        openLibraryNodeJsonCmd,
        exportLibraryNodeToFileCmd,
        openDatabaseViewerCmd,
        fetchRecursiveFolderCmd,
        extractSearchToFileCmd,
        viewUsersCmd,
        viewRolesCmd,
        openExportedContentCmd,
        openExportedContentFromPathCmd,
        createScopeCmd,
        editScopeCmd,
        deleteScopeCmd,
        listScopesCmd,
        viewScopeCmd,
        profileScopeCmd,
        sampleScopeLogsCmd,
        cacheScopeMetadataCmd
    );

    // Export context for tests
    return {
        context,
        dynamicCompletionProvider,
        parserCompletionProvider,
        metadataCompletionProvider
    };
}

export function deactivate() {
    // Cleanup if needed
}
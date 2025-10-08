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
exports.getDynamicCompletionProvider = getDynamicCompletionProvider;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const authenticate_1 = require("./commands/authenticate");
const runQuery_1 = require("./commands/runQuery");
const customFields_1 = require("./commands/customFields");
const partitions_1 = require("./commands/partitions");
const viewAutocomplete_1 = require("./commands/viewAutocomplete");
const personalFolder_1 = require("./commands/personalFolder");
const statusBar_1 = require("./statusBar");
const dynamicCompletions_1 = require("./dynamicCompletions");
const parserCompletions_1 = require("./parserCompletions");
// Global dynamic completion provider
let dynamicCompletionProvider;
let parserCompletionProvider;
function getDynamicCompletionProvider() {
    return dynamicCompletionProvider;
}
// Build completion items once at activation
function createCompletionItems() {
    const aggregating = ['avg', 'count', 'count_distinct', 'count_frequent', 'fillmissing', 'first', 'min', 'max', 'last', 'most_recent', 'pct', 'least_recent', 'stddev', 'sum'];
    const maths = ['abs', 'acos', 'asin', 'atan', 'atan2', 'cbrt', 'ceil', 'cos', 'cosh', 'exp', 'expm1', 'floor', 'hypot', 'log', 'log10', 'log1p', 'max', 'min', 'round', 'sin', 'sinh', 'sqrt', 'tan', 'tanh', 'toDegrees', 'toRadians'];
    const parse = ['csv', 'JSON', 'keyvalue', 'parse', 'parse regex', 'split', 'xml'];
    const search = ['accum', 'backshift', 'base64Decode', 'base64Encode', 'bin', 'CIDR', 'concat', 'contains', 'decToHex', 'diff', 'fields', 'filter', 'format', 'formatDate', 'lookup', 'haversine', 'hexToDec', 'if', 'in', 'ipv4ToNumber', 'isBlank', 'isEmpty', 'isNull', 'isNumeric', 'isPrivateIP', 'isPublicIP', 'isValidIP', 'join', 'length', 'limit', 'logcompare', 'logreduce', 'lookup', 'luhn', 'matches', 'median', 'merge', 'now', 'num', 'outlier', 'parseHex', 'predict', 'replace', 'rollingstd', 'save', 'sessionize', 'smooth', 'sort', 'substring', 'timeslice', 'toUpperCase', 'toLowerCase', 'top', 'total', 'trace', 'transaction', 'transactionize', 'transpose', 'urldecode', 'urlencode', 'where'];
    const metadata = ['_index', '_view', '_collector', '_messageCount', '_messageTime', '_raw', '_receiptTime', '_size', '_source', '_sourceCategory', '_sourceHost', '_sourceName', '_format', '_timeslice'];
    const operators = ['and', 'or', 'not', 'in', '!', 'nodrop'];
    const recent = ['geoip', 'threatip', 'values', 'threatlookup'];
    const completionItems = [];
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
function activate(context) {
    // Create static completion items once
    const staticCompletionItems = createCompletionItems();
    // Initialize dynamic completion provider
    dynamicCompletionProvider = new dynamicCompletions_1.DynamicCompletionProvider(context);
    // Load autocomplete data for active profile if exists
    (() => __awaiter(this, void 0, void 0, function* () {
        const profileManager = yield Promise.resolve().then(() => require('./profileManager'));
        const pm = new profileManager.ProfileManager(context);
        const activeProfile = yield pm.getActiveProfile();
        if (activeProfile) {
            yield dynamicCompletionProvider.loadProfileData(activeProfile.name);
        }
    }))();
    // Initialize parser completion provider
    parserCompletionProvider = new parserCompletions_1.ParserCompletionProvider();
    parserCompletionProvider.loadParsers().then(() => {
        console.log(`Loaded ${parserCompletionProvider.getParserCount()} parser snippets from ${parserCompletionProvider.getAppNames().length} apps`);
    });
    // Combined completion provider that returns both static and dynamic items
    const provider = vscode.languages.registerCompletionItemProvider('sumo', {
        provideCompletionItems(document, position, token, context) {
            // Combine static items with dynamically discovered fields and parser snippets
            const dynamicItems = dynamicCompletionProvider.getCompletionItems();
            const parserItems = parserCompletionProvider.getCompletionItems();
            return [...staticCompletionItems, ...dynamicItems, ...parserItems];
        }
    });
    // Initialize status bar
    const statusBar = new statusBar_1.StatusBarManager(context);
    // Register commands
    const createProfileCmd = vscode.commands.registerCommand('sumologic.createProfile', () => __awaiter(this, void 0, void 0, function* () {
        yield (0, authenticate_1.authenticateCommand)(context);
        yield statusBar.refresh();
    }));
    const switchProfileCmd = vscode.commands.registerCommand('sumologic.switchProfile', () => __awaiter(this, void 0, void 0, function* () {
        yield (0, authenticate_1.switchProfileCommand)(context);
        yield statusBar.refresh();
    }));
    const listProfilesCmd = vscode.commands.registerCommand('sumologic.listProfiles', () => {
        return (0, authenticate_1.listProfilesCommand)(context);
    });
    const deleteProfileCmd = vscode.commands.registerCommand('sumologic.deleteProfile', () => __awaiter(this, void 0, void 0, function* () {
        yield (0, authenticate_1.deleteProfileCommand)(context);
        yield statusBar.refresh();
    }));
    const testConnectionCmd = vscode.commands.registerCommand('sumologic.testConnection', () => {
        return (0, authenticate_1.testConnectionCommand)(context);
    });
    const runQueryCmd = vscode.commands.registerCommand('sumologic.runQuery', () => {
        return (0, runQuery_1.runQueryCommand)(context);
    });
    const fetchCustomFieldsCmd = vscode.commands.registerCommand('sumologic.fetchCustomFields', () => {
        return (0, customFields_1.fetchCustomFieldsCommand)(context);
    });
    const fetchPartitionsCmd = vscode.commands.registerCommand('sumologic.fetchPartitions', () => {
        return (0, partitions_1.fetchPartitionsCommand)(context);
    });
    const viewAutocompleteCmd = vscode.commands.registerCommand('sumologic.viewAutocomplete', () => {
        return (0, viewAutocomplete_1.viewAutocompleteCommand)(context);
    });
    const clearAutocompleteCmd = vscode.commands.registerCommand('sumologic.clearAutocomplete', () => {
        return (0, viewAutocomplete_1.clearAutocompleteCommand)(context);
    });
    const getPersonalFolderCmd = vscode.commands.registerCommand('sumologic.getPersonalFolder', () => {
        return (0, personalFolder_1.getPersonalFolderCommand)(context);
    });
    const getFolderCmd = vscode.commands.registerCommand('sumologic.getFolder', () => {
        return (0, personalFolder_1.getFolderCommand)(context);
    });
    context.subscriptions.push(provider, createProfileCmd, switchProfileCmd, listProfilesCmd, deleteProfileCmd, testConnectionCmd, runQueryCmd, fetchCustomFieldsCmd, fetchPartitionsCmd, viewAutocompleteCmd, clearAutocompleteCmd, getPersonalFolderCmd, getFolderCmd);
}
function deactivate() {
    // Cleanup if needed
}
//# sourceMappingURL=extension.js.map
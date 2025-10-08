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
exports.ParserCompletionProvider = void 0;
const vscode = require("vscode");
const parserSnippets_1 = require("./parserSnippets");
/**
 * Manages parser snippet autocomplete from static configuration
 */
class ParserCompletionProvider {
    constructor() {
        this.parsers = [];
        this.completionItems = [];
        this.loaded = false;
    }
    /**
     * Load parser snippets from static configuration
     */
    loadParsers() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.loaded) {
                return;
            }
            try {
                // Use static parser snippets
                this.parsers = parserSnippets_1.PARSER_SNIPPETS;
                // Create completion items
                this.completionItems = this.parsers.map(parserSnippet => {
                    const item = new vscode.CompletionItem(this.createLabel(parserSnippet), vscode.CompletionItemKind.Snippet);
                    // Use the parser as the insert text
                    item.insertText = new vscode.SnippetString(parserSnippet.parser);
                    // Set detail to show the app name
                    item.detail = parserSnippet.app || 'General';
                    // Add documentation with preview of the parser
                    const preview = parserSnippet.parser.length > 200
                        ? parserSnippet.parser.substring(0, 200) + '...'
                        : parserSnippet.parser;
                    item.documentation = new vscode.MarkdownString(`**App**: ${parserSnippet.app || 'General'}\n\n\`\`\`sumo\n${preview}\n\`\`\``);
                    // Use filterText to enable searching by app name or parser content
                    item.filterText = `parser ${parserSnippet.app} ${parserSnippet.parser}`;
                    // Sort by app name, then parser length (shorter first)
                    item.sortText = `${parserSnippet.app || 'zzz'}_${String(parserSnippet.parser.length).padStart(10, '0')}`;
                    return item;
                });
                this.loaded = true;
                console.log(`Loaded ${this.completionItems.length} parser snippets (one per app)`);
            }
            catch (error) {
                console.error('Failed to load parser snippets:', error);
            }
        });
    }
    /**
     * Create a readable label for the completion item
     */
    createLabel(parserSnippet) {
        // Extract first operation from parser for the label
        const firstLine = parserSnippet.parser.split('\n')[0].trim();
        const match = firstLine.match(/^\|\s*(\w+)/);
        const operation = match ? match[1] : 'parser';
        const appPrefix = parserSnippet.app ? `[${parserSnippet.app}] ` : '';
        return `${appPrefix}${operation} snippet`;
    }
    /**
     * Get all parser completion items
     */
    getCompletionItems() {
        return this.completionItems;
    }
    /**
     * Get parsers filtered by app name
     */
    getParsersByApp(appName) {
        return this.completionItems.filter(item => { var _a; return ((_a = item.detail) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === appName.toLowerCase(); });
    }
    /**
     * Get count of loaded parsers
     */
    getParserCount() {
        return this.parsers.length;
    }
    /**
     * Get unique app names
     */
    getAppNames() {
        const apps = new Set();
        this.parsers.forEach(p => {
            if (p.app) {
                apps.add(p.app);
            }
        });
        return Array.from(apps).sort();
    }
}
exports.ParserCompletionProvider = ParserCompletionProvider;
//# sourceMappingURL=parserCompletions.js.map
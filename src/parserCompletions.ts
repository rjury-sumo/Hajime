import * as vscode from 'vscode';
import { PARSER_SNIPPETS, ParserSnippet } from './parserSnippets';

/**
 * Manages parser snippet autocomplete from static configuration
 */
export class ParserCompletionProvider {
    private parsers: ParserSnippet[] = [];
    private completionItems: vscode.CompletionItem[] = [];
    private loaded: boolean = false;

    constructor() {}

    /**
     * Load parser snippets from static configuration
     */
    async loadParsers(): Promise<void> {
        if (this.loaded) {
            return;
        }

        try {
            // Use static parser snippets
            this.parsers = PARSER_SNIPPETS;

            // Create completion items
            this.completionItems = this.parsers.map(parserSnippet => {
                const item = new vscode.CompletionItem(
                    this.createLabel(parserSnippet),
                    vscode.CompletionItemKind.Snippet
                );

                // Use the parser as the insert text
                item.insertText = new vscode.SnippetString(parserSnippet.parser);

                // Set detail to show the app name
                item.detail = parserSnippet.app || 'General';

                // Add documentation with preview of the parser
                const preview = parserSnippet.parser.length > 200
                    ? parserSnippet.parser.substring(0, 200) + '...'
                    : parserSnippet.parser;
                item.documentation = new vscode.MarkdownString(
                    `**App**: ${parserSnippet.app || 'General'}\n\n\`\`\`sumo\n${preview}\n\`\`\``
                );

                // Require "parser" prefix for filtering to prevent accidental matches
                item.filterText = `parser ${parserSnippet.app} ${parserSnippet.parser}`;

                // Sort after built-in language items by using 'zzz' prefix
                // This ensures parser snippets appear after keywords, functions, etc.
                item.sortText = `zzz_parser_${parserSnippet.app || 'zzz'}_${String(parserSnippet.parser.length).padStart(10, '0')}`;

                return item;
            });

            this.loaded = true;
            console.log(`Loaded ${this.completionItems.length} parser snippets (one per app)`);

        } catch (error) {
            console.error('Failed to load parser snippets:', error);
        }
    }

    /**
     * Create a readable label for the completion item
     */
    private createLabel(parserSnippet: ParserSnippet): string {
        // Extract first operation from parser for the label
        const firstLine = parserSnippet.parser.split('\n')[0].trim();
        const match = firstLine.match(/^\|\s*(\w+)/);
        const operation = match ? match[1] : 'parser';

        const appPrefix = parserSnippet.app ? `[${parserSnippet.app}] ` : '';
        return `${appPrefix}${operation} snippet`;
    }

    /**
     * Get all parser completion items with proper range to replace "parser" prefix
     */
    getCompletionItems(document?: vscode.TextDocument, position?: vscode.Position): vscode.CompletionItem[] {
        // If document and position are provided, set range to replace "parser" word
        if (document && position) {
            const linePrefix = document.lineAt(position).text.substring(0, position.character);
            const match = linePrefix.match(/\bparser\b/i);

            if (match && match.index !== undefined) {
                // Found "parser" word - create range to replace it
                const startPos = new vscode.Position(position.line, match.index);
                const endPos = position;
                const range = new vscode.Range(startPos, endPos);

                // Clone completion items with the range set
                return this.completionItems.map(item => {
                    const newItem = new vscode.CompletionItem(item.label, item.kind);
                    newItem.insertText = item.insertText;
                    newItem.detail = item.detail;
                    newItem.documentation = item.documentation;
                    newItem.filterText = item.filterText;
                    newItem.sortText = item.sortText;
                    newItem.range = range; // Replace "parser" with the snippet
                    return newItem;
                });
            }
        }

        return this.completionItems;
    }

    /**
     * Get parsers filtered by app name
     */
    getParsersByApp(appName: string): vscode.CompletionItem[] {
        return this.completionItems.filter(item =>
            item.detail?.toLowerCase() === appName.toLowerCase()
        );
    }

    /**
     * Get count of loaded parsers
     */
    getParserCount(): number {
        return this.parsers.length;
    }

    /**
     * Get unique app names
     */
    getAppNames(): string[] {
        const apps = new Set<string>();
        this.parsers.forEach(p => {
            if (p.app) {
                apps.add(p.app);
            }
        });
        return Array.from(apps).sort();
    }
}

import * as vscode from 'vscode';

/**
 * CodeLens provider for Sumo Logic query files
 * Provides inline actions like Run, Chart, etc.
 */
export class SumoCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        // Refresh code lenses when configuration changes
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    /**
     * Provide code lenses for a document
     */
    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        if (document.languageId !== 'sumo') {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();

        // If document is empty, don't show any code lenses
        if (text.trim().length === 0) {
            return codeLenses;
        }

        // Find query boundaries (queries are typically separated by blank lines or comments)
        const queries = this.parseQueries(document);

        for (const query of queries) {
            const range = new vscode.Range(
                new vscode.Position(query.startLine, 0),
                new vscode.Position(query.endLine, 0)
            );

            // Run Query
            codeLenses.push(new vscode.CodeLens(range, {
                title: "▶ Run Query",
                command: "sumologic.runQuery",
                tooltip: "Execute this query and save results to CSV"
            }));

            // Run in Webview
            codeLenses.push(new vscode.CodeLens(range, {
                title: "📊 Run in Webview",
                command: "sumologic.runQueryWebview",
                tooltip: "Execute this query and display results in interactive table"
            }));

            // Run and Chart
            codeLenses.push(new vscode.CodeLens(range, {
                title: "📈 Run and Chart",
                command: "sumologic.runQueryAndChart",
                tooltip: "Execute this query and visualize results"
            }));
        }

        return codeLenses;
    }

    /**
     * Parse document to identify individual queries
     * For now, we treat the entire document as one query
     * Future enhancement: support multiple queries separated by comments or blank lines
     */
    private parseQueries(document: vscode.TextDocument): Array<{ startLine: number; endLine: number; text: string }> {
        const queries: Array<{ startLine: number; endLine: number; text: string }> = [];
        let currentQueryStart = -1;
        let currentQueryLines: string[] = [];
        let blankLineCount = 0;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const trimmedText = line.text.trim();

            // Skip comment-only lines at the start
            if (currentQueryStart === -1 && trimmedText.startsWith('//')) {
                continue;
            }

            // Non-empty, non-comment line starts a query
            if (trimmedText.length > 0 && !trimmedText.startsWith('//')) {
                if (currentQueryStart === -1) {
                    currentQueryStart = i;
                }
                currentQueryLines.push(line.text);
                blankLineCount = 0;
            }
            // Blank lines might separate queries
            else if (trimmedText.length === 0 && currentQueryStart !== -1) {
                blankLineCount++;
                // If we have 2 or more consecutive blank lines, consider it a query separator
                if (blankLineCount >= 2) {
                    if (currentQueryLines.length > 0) {
                        queries.push({
                            startLine: currentQueryStart,
                            endLine: i - blankLineCount,
                            text: currentQueryLines.join('\n')
                        });
                    }
                    currentQueryStart = -1;
                    currentQueryLines = [];
                    blankLineCount = 0;
                }
            }
            // Comment lines within a query
            else if (trimmedText.startsWith('//') && currentQueryStart !== -1) {
                // Keep the query going
                blankLineCount = 0;
            }
        }

        // Add the last query if any
        if (currentQueryStart !== -1 && currentQueryLines.length > 0) {
            queries.push({
                startLine: currentQueryStart,
                endLine: document.lineCount - 1,
                text: currentQueryLines.join('\n')
            });
        }

        // If no queries found, treat entire document as one query
        if (queries.length === 0 && document.getText().trim().length > 0) {
            queries.push({
                startLine: 0,
                endLine: document.lineCount - 1,
                text: document.getText()
            });
        }

        return queries;
    }

    /**
     * Resolve a code lens (optional, for lazy loading)
     */
    public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        return codeLens;
    }
}

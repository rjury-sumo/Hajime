import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Open a query result JSON file as a webview
 */
export async function openQueryResultAsWebviewCommand(context: vscode.ExtensionContext, treeItem: any): Promise<void> {
    const filePath = treeItem?.data?.path || treeItem?.data?.filePath;

    if (!filePath) {
        vscode.window.showErrorMessage('No file path available');
        return;
    }

    // Check if it's a JSON file
    if (!filePath.endsWith('.json')) {
        vscode.window.showErrorMessage('Only JSON files can be opened as webviews');
        return;
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`File does not exist: ${filePath}`);
        return;
    }

    try {
        // Read and parse the JSON file
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        let results: any[];

        try {
            results = JSON.parse(fileContent);
        } catch (parseError) {
            vscode.window.showErrorMessage(`Failed to parse JSON file: ${parseError}`);
            return;
        }

        // Validate that it's an array of results
        if (!Array.isArray(results)) {
            vscode.window.showErrorMessage('JSON file must contain an array of query results');
            return;
        }

        if (results.length === 0) {
            vscode.window.showInformationMessage('Query results file is empty');
            return;
        }

        // Extract metadata from filename if possible
        // Expected format: query_{name}_{mode}_{from}_to_{to}_{timestamp}.json
        const fileName = path.basename(filePath, '.json');
        const queryName = fileName.replace(/_\d{8}_\d{6}$/, ''); // Remove timestamp

        // Determine mode from data structure
        const mode = results[0].map ? 'records' : 'messages';

        // Import formatRecordsAsHTML from runQuery
        const { formatRecordsAsHTML } = await import('./runQuery');

        // Create webview panel
        const panel = vscode.window.createWebviewPanel(
            'sumoQueryResults',
            `Saved Query Results: ${queryName}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Get page size from settings
        const config = vscode.workspace.getConfiguration('sumologic');
        const pageSize = config.get<number>('webviewPageSize') || 200;

        // Get file stats for metadata
        const stats = fs.statSync(filePath);

        const htmlContent = formatRecordsAsHTML(results, {
            query: queryName,
            from: 'N/A (from file)',
            to: 'N/A (from file)',
            mode: mode,
            count: results.length,
            pageSize: pageSize,
            jsonFilePath: filePath
        });

        panel.webview.html = htmlContent;

        // Handle messages from webview (for field analysis, charting, etc.)
        panel.webview.onDidReceiveMessage(
            async (message) => {
                if (message.command === 'exportCSV') {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    const defaultUri = workspaceFolder
                        ? vscode.Uri.file(workspaceFolder.uri.fsPath)
                        : undefined;

                    const uri = await vscode.window.showSaveDialog({
                        defaultUri: defaultUri,
                        filters: {
                            'CSV Files': ['csv'],
                            'All Files': ['*']
                        },
                        saveLabel: 'Export CSV'
                    });

                    if (uri) {
                        fs.writeFileSync(uri.fsPath, message.csvData, 'utf-8');
                        vscode.window.showInformationMessage(`CSV exported to ${uri.fsPath}`);
                    }
                } else if (message.command === 'exportJSON') {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    const defaultUri = workspaceFolder
                        ? vscode.Uri.file(workspaceFolder.uri.fsPath)
                        : undefined;

                    const uri = await vscode.window.showSaveDialog({
                        defaultUri: defaultUri,
                        filters: {
                            'JSON Files': ['json'],
                            'All Files': ['*']
                        },
                        saveLabel: 'Export JSON'
                    });

                    if (uri) {
                        fs.writeFileSync(uri.fsPath, message.jsonData, 'utf-8');
                        vscode.window.showInformationMessage(`JSON exported to ${uri.fsPath}`);
                    }
                } else if (message.command === 'showFieldValues') {
                    const { FieldAnalyzer } = await import('../services/fieldAnalyzer');
                    const { generateFieldValuesHTML } = await import('./runQuery');
                    const fieldName = message.fieldName;
                    const distribution = FieldAnalyzer.getValueDistribution(fieldName, results, 1000);

                    const valuesPanel = vscode.window.createWebviewPanel(
                        'fieldValues',
                        `Field Values: ${fieldName}`,
                        vscode.ViewColumn.Beside,
                        {
                            enableScripts: true,
                            retainContextWhenHidden: false
                        }
                    );

                    valuesPanel.webview.html = generateFieldValuesHTML(fieldName, distribution, results.length);
                } else if (message.command === 'chartField') {
                    const { FieldAnalyzer } = await import('../services/fieldAnalyzer');
                    const { handleChartFieldExternal } = await import('./runQuery');
                    const fieldAnalysis = FieldAnalyzer.analyze(results, mode as 'records' | 'messages');
                    await handleChartFieldExternal(message.fieldName, results, fieldAnalysis);
                }
            },
            undefined,
            context.subscriptions
        );

        vscode.window.showInformationMessage(`Opened query results: ${results.length} ${mode}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open query result as webview: ${error}`);
    }
}

/**
 * Reveal a storage item (file or folder) in the system file explorer
 */
export async function revealStorageInExplorerCommand(treeItem: any): Promise<void> {
    // Try to get file path from different possible locations
    const filePath = treeItem?.data?.path || treeItem?.data?.filePath;

    if (!filePath) {
        console.error('No file path available. TreeItem:', JSON.stringify(treeItem, null, 2));
        vscode.window.showErrorMessage('No file path available');
        return;
    }

    // Check if path exists
    if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`Path does not exist: ${filePath}`);
        return;
    }

    try {
        // Use VSCode's built-in command to reveal in system explorer
        const uri = vscode.Uri.file(filePath);
        await vscode.commands.executeCommand('revealFileInOS', uri);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to reveal in explorer: ${error}`);
    }
}

/**
 * Copy path to clipboard
 */
export async function copyStoragePathCommand(treeItem: any): Promise<void> {
    // Try to get file path from different possible locations
    const filePath = treeItem?.data?.path || treeItem?.data?.filePath;

    if (!filePath) {
        console.error('No file path available. TreeItem:', JSON.stringify(treeItem, null, 2));
        vscode.window.showErrorMessage('No file path available');
        return;
    }

    try {
        await vscode.env.clipboard.writeText(filePath);
        vscode.window.showInformationMessage(`Path copied to clipboard: ${filePath}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to copy path: ${error}`);
    }
}

/**
 * Open path in integrated terminal
 */
export async function openStorageInTerminalCommand(treeItem: any): Promise<void> {
    // Try to get file path from different possible locations
    const filePath = treeItem?.data?.path || treeItem?.data?.filePath;

    if (!filePath) {
        console.error('No file path available. TreeItem:', JSON.stringify(treeItem, null, 2));
        vscode.window.showErrorMessage('No file path available');
        return;
    }

    // Check if path exists
    if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`Path does not exist: ${filePath}`);
        return;
    }

    try {
        // Determine the directory to open
        let dirPath: string;
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            dirPath = filePath;
        } else {
            // If it's a file, get the parent directory
            const pathSeparator = filePath.includes('/') ? '/' : '\\';
            const parts = filePath.split(pathSeparator);
            parts.pop(); // Remove the file name
            dirPath = parts.join(pathSeparator);
        }

        // Create and show a terminal with the directory as cwd
        const terminal = vscode.window.createTerminal({
            name: 'Storage Explorer',
            cwd: dirPath
        });
        terminal.show();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open terminal: ${error}`);
    }
}

/**
 * Delete a storage file
 */
export async function deleteStorageItemCommand(
    context: vscode.ExtensionContext,
    treeItem: any
): Promise<void> {
    const filePath = treeItem?.data?.path;

    if (!filePath) {
        vscode.window.showErrorMessage('No file path available');
        return;
    }

    // Check if path exists
    if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`File does not exist: ${filePath}`);
        return;
    }

    // Confirm deletion
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'file';
    const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to delete "${fileName}"?`,
        { modal: true },
        'Delete'
    );

    if (confirmation !== 'Delete') {
        return;
    }

    try {
        // Delete the file
        fs.unlinkSync(filePath);
        vscode.window.showInformationMessage(`Deleted: ${fileName}`);

        // Refresh the tree
        vscode.commands.executeCommand('sumologic.refreshExplorer');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete file: ${error}`);
    }
}

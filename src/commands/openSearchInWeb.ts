import * as vscode from 'vscode';
import { ProfileManager } from '../profileManager';

/**
 * Parse query metadata from comments to extract @from and @to
 */
function parseTimeMetadata(queryText: string): {
    from?: string;
    to?: string;
} {
    const metadata: {
        from?: string;
        to?: string;
    } = {};

    const lines = queryText.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();

        // Match @from directive
        const fromMatch = trimmed.match(/^\/\/\s*@from\s+(.+)$/i);
        if (fromMatch) {
            metadata.from = fromMatch[1].trim();
            continue;
        }

        // Match @to directive
        const toMatch = trimmed.match(/^\/\/\s*@to\s+(.+)$/i);
        if (toMatch) {
            metadata.to = toMatch[1].trim();
            continue;
        }
    }

    return metadata;
}

/**
 * Remove metadata comments from query
 */
function cleanQuery(queryText: string): string {
    const lines = queryText.split('\n');
    const cleanedLines = lines.filter(line => {
        const trimmed = line.trim();
        return !trimmed.match(/^\/\/\s*@(name|from|to|timezone|mode|output)\s+/i);
    });
    return cleanedLines.join('\n').trim();
}

/**
 * Build the web UI URL for opening a log search
 */
export function buildWebSearchUrl(instanceName: string, query: string, startTime?: string, endTime?: string): string {
    // Encode the query
    const encodedQuery = encodeURIComponent(query);

    // Default time range if not provided
    const start = startTime || '-1h';
    const end = endTime || '-1s';

    // Build the URL
    return `https://${instanceName}/log-search/create?query=${encodedQuery}&startTime=${start}&endTime=${end}`;
}

/**
 * Command to open the current .sumo file search in the web UI
 */
export async function openSearchInWebCommand(context: vscode.ExtensionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    if (editor.document.languageId !== 'sumo') {
        vscode.window.showErrorMessage('Current file is not a Sumo Logic query (.sumo)');
        return;
    }

    // Get profile manager
    const profileManager = new ProfileManager(context);
    const activeProfile = await profileManager.getActiveProfile();

    if (!activeProfile) {
        vscode.window.showErrorMessage('No active Sumo Logic profile. Please create and select a profile first.');
        return;
    }

    // Get query text
    const queryText = editor.document.getText();
    if (!queryText.trim()) {
        vscode.window.showErrorMessage('Query is empty');
        return;
    }

    // Parse metadata and clean query
    const metadata = parseTimeMetadata(queryText);
    const cleanedQuery = cleanQuery(queryText);

    // Get instance name
    const instanceName = profileManager.getInstanceName(activeProfile);

    // Build URL with time range from metadata or defaults
    const url = buildWebSearchUrl(
        instanceName,
        cleanedQuery,
        metadata.from,
        metadata.to
    );

    // Open URL in browser
    const uri = vscode.Uri.parse(url);
    await vscode.env.openExternal(uri);

    vscode.window.showInformationMessage(`Opening search in Sumo Logic web UI: ${instanceName}`);
}

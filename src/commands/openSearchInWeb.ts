import * as vscode from 'vscode';
import { ProfileManager } from '../profileManager';
import { parseQueryMetadata, cleanQuery } from '../services/queryMetadata';

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
    const metadata = parseQueryMetadata(queryText);
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

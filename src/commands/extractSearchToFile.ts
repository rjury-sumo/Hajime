import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager } from '../profileManager';

/**
 * Sanitize a string to be safe for filenames
 */
function sanitizeFilename(name: string): string {
    // Replace invalid filename characters with underscore
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
               .replace(/\s+/g, '_')
               .substring(0, 100); // Limit length
}

/**
 * Extract search content to a .sumo file
 */
export async function extractSearchToFileCommand(
    context: vscode.ExtensionContext,
    profileName: string,
    contentId: string,
    contentName: string,
    searchContent: any
): Promise<void> {
    const profileManager = new ProfileManager(context);

    // Create searches directory
    const outputDir = profileManager.getProfileOutputDirectory(profileName);
    const searchesDir = path.join(outputDir, 'searches');

    if (!fs.existsSync(searchesDir)) {
        fs.mkdirSync(searchesDir, { recursive: true });
    }

    // Generate filename
    const sanitizedName = sanitizeFilename(contentName);
    const sanitizedId = contentId.replace(/[^a-zA-Z0-9]/g, '');
    const filename = `${sanitizedName}_${sanitizedId}.sumo`;
    const filePath = path.join(searchesDir, filename);

    // Generate file content with metadata directives
    const fileContent = generateSumoFileContent(searchContent, contentName, contentId);

    // Write file
    fs.writeFileSync(filePath, fileContent, 'utf-8');

    // Open the file in editor
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage(`Search extracted to: ${filename}`);
}

/**
 * Generate .sumo file content with metadata directives
 */
function generateSumoFileContent(searchContent: any, contentName: string, contentId: string): string {
    const lines: string[] = [];

    // Add header comment
    lines.push(`// Sumo Logic Search: ${contentName}`);
    lines.push(`// Content ID: ${contentId}`);

    if (searchContent.description) {
        lines.push(`// Description: ${searchContent.description}`);
    }

    lines.push('');

    // Add Query Metadata Directives from search properties
    lines.push('// Query Metadata Directives:');

    // Add name directive
    lines.push(`// @name ${contentName}`);

    // Add time range if available from defaultTimeRange
    if (searchContent.search && searchContent.search.defaultTimeRange) {
        lines.push(`// @from ${searchContent.search.defaultTimeRange}`);
        lines.push('// @to now');
    } else {
        lines.push('// @from -15m');
        lines.push('// @to now');
    }

    // Add timezone
    lines.push('// @timezone UTC');

    // Add byReceiptTime if available
    if (searchContent.search && searchContent.search.byReceiptTime !== undefined) {
        lines.push(`// @byReceiptTime ${searchContent.search.byReceiptTime}`);
    }

    // Add autoParsingMode if available from parsingMode
    if (searchContent.search && searchContent.search.parsingMode) {
        const autoParsingMode = searchContent.search.parsingMode === 'Manual' ? 'Manual' : 'AutoParse';
        lines.push(`// @autoParsingMode ${autoParsingMode}`);
    }

    // Add mode directive (detect from query)
    const queryText = searchContent.search?.queryText || '';
    const hasAggregation = detectAggregation(queryText);
    lines.push(`// @mode ${hasAggregation ? 'records' : 'messages'}`);

    // Add output directive
    lines.push('// @output webview');

    lines.push('');
    lines.push('// ---- Query Start ----');
    lines.push('');

    // Add the query text
    if (queryText) {
        lines.push(queryText);
    } else {
        lines.push('// No query text found');
    }

    return lines.join('\n');
}

/**
 * Detect if query has aggregation operators
 */
function detectAggregation(query: string): boolean {
    const aggregationOperators = [
        'count', 'sum', 'avg', 'min', 'max', 'stddev', 'pct',
        'first', 'last', 'most_recent', 'least_recent',
        'count_distinct', 'count_frequent', 'fillmissing',
        'transpose', 'timeslice', 'rollingstd'
    ];

    const lowerQuery = query.toLowerCase();
    return aggregationOperators.some(op =>
        lowerQuery.includes(`| ${op}`) ||
        lowerQuery.includes(`|${op}`)
    );
}

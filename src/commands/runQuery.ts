import * as vscode from 'vscode';
import { SearchJobClient, SearchJobRequest, SearchJobStatus } from '../api/searchJob';
import { createClient } from './authenticate';
import { getDynamicCompletionProvider, getSumoExplorerProvider } from '../extension';
import { OutputWriter } from '../outputWriter';
import { FieldAnalyzer, FieldMetadata } from '../services/fieldAnalyzer';
import { ChartRegistry, ChartType, ChartConfig, initializeChartRegistry } from '../charts';
import { ProfileManager } from '../profileManager';

/**
 * Parse query metadata from comments
 * Looks for special comments like:
 * // @name my-query-name
 * // @from -1h
 * // @to now
 * // @timezone UTC
 * // @mode messages
 * // @output webview
 * // @byReceiptTime true
 * // @autoParsingMode AutoParse
 * // @debug true
 * // @param query_type=copilot
 * // @param user_name=*
 */
function parseQueryMetadata(queryText: string): {
    name?: string;
    from?: string;
    to?: string;
    timeZone?: string;
    mode?: 'records' | 'messages';
    output?: 'table' | 'json' | 'csv' | 'webview';
    byReceiptTime?: boolean;
    autoParsingMode?: 'AutoParse' | 'Manual';
    debug?: boolean;
    params?: Map<string, string>;
} {
    const metadata: {
        name?: string;
        from?: string;
        to?: string;
        timeZone?: string;
        mode?: 'records' | 'messages';
        output?: 'table' | 'json' | 'csv' | 'webview';
        byReceiptTime?: boolean;
        autoParsingMode?: 'AutoParse' | 'Manual';
        debug?: boolean;
        params?: Map<string, string>;
    } = {};

    const lines = queryText.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();

        // Match @name directive
        const nameMatch = trimmed.match(/^\/\/\s*@name\s+(.+)$/i);
        if (nameMatch) {
            metadata.name = nameMatch[1].trim();
            continue;
        }

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

        // Match @timezone directive
        const tzMatch = trimmed.match(/^\/\/\s*@timezone\s+(.+)$/i);
        if (tzMatch) {
            metadata.timeZone = tzMatch[1].trim();
            continue;
        }

        // Match @mode directive
        const modeMatch = trimmed.match(/^\/\/\s*@mode\s+(records|messages)$/i);
        if (modeMatch) {
            metadata.mode = modeMatch[1].toLowerCase() as 'records' | 'messages';
            continue;
        }

        // Match @output directive
        const outputMatch = trimmed.match(/^\/\/\s*@output\s+(table|json|csv|webview)$/i);
        if (outputMatch) {
            metadata.output = outputMatch[1].toLowerCase() as 'table' | 'json' | 'csv' | 'webview';
            continue;
        }

        // Match @byReceiptTime directive
        const byReceiptTimeMatch = trimmed.match(/^\/\/\s*@byReceiptTime\s+(true|false)$/i);
        if (byReceiptTimeMatch) {
            metadata.byReceiptTime = byReceiptTimeMatch[1].toLowerCase() === 'true';
            continue;
        }

        // Match @autoParsingMode directive
        const autoParsingModeMatch = trimmed.match(/^\/\/\s*@autoParsingMode\s+(AutoParse|Manual)$/i);
        if (autoParsingModeMatch) {
            metadata.autoParsingMode = autoParsingModeMatch[1] as 'AutoParse' | 'Manual';
            continue;
        }

        // Match @debug directive
        const debugMatch = trimmed.match(/^\/\/\s*@debug\s+(true|false)$/i);
        if (debugMatch) {
            metadata.debug = debugMatch[1].toLowerCase() === 'true';
            continue;
        }

        // Match @param directive
        const paramMatch = trimmed.match(/^\/\/\s*@param\s+(\w+)=(.+)$/i);
        if (paramMatch) {
            if (!metadata.params) {
                metadata.params = new Map<string, string>();
            }
            metadata.params.set(paramMatch[1], paramMatch[2].trim());
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
        return !trimmed.match(/^\/\/\s*@(name|from|to|timezone|mode|output|byReceiptTime|autoParsingMode|debug|param)\s+/i);
    });
    return cleanedLines.join('\n').trim();
}

/**
 * Extract parameter placeholders from query text
 * Looks for {{paramName}} patterns
 */
function extractQueryParams(queryText: string): Set<string> {
    const params = new Set<string>();
    const regex = /\{\{(\w+)\}\}/g;
    let match;

    while ((match = regex.exec(queryText)) !== null) {
        params.add(match[1]);
    }

    return params;
}

/**
 * Substitute parameter values in query text
 * Replaces {{paramName}} with actual values
 */
function substituteParams(queryText: string, paramValues: Map<string, string>): string {
    let result = queryText;

    for (const [key, value] of paramValues) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(regex, value);
    }

    return result;
}

/**
 * Detect if query is an aggregation (has aggregation operators)
 */
function isAggregationQuery(query: string): boolean {
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

/**
 * Format records as a table string
 */
function formatRecordsAsTable(records: any[]): string {
    if (records.length === 0) {
        return 'No results found';
    }

    // Get all unique keys from all records
    const allKeys = new Set<string>();
    records.forEach(record => {
        Object.keys(record.map).forEach(key => allKeys.add(key));
    });

    const keys = Array.from(allKeys);
    const columnWidths = keys.map(key => {
        const maxValueLength = Math.max(
            key.length,
            ...records.map(r => String(r.map[key] || '').length)
        );
        return Math.min(maxValueLength, 50); // Cap at 50 chars
    });

    // Create header
    let table = keys.map((key, i) => key.padEnd(columnWidths[i])).join(' | ') + '\n';
    table += columnWidths.map(w => '-'.repeat(w)).join('-+-') + '\n';

    // Create rows
    records.forEach(record => {
        const row = keys.map((key, i) => {
            const value = String(record.map[key] || '');
            return value.substring(0, 50).padEnd(columnWidths[i]);
        }).join(' | ');
        table += row + '\n';
    });

    return table;
}

/**
 * Format records as CSV
 */
function formatRecordsAsCSV(records: any[]): string {
    if (records.length === 0) {
        return 'No results found';
    }

    // Get all unique keys from all records
    const allKeys = new Set<string>();
    records.forEach(record => {
        Object.keys(record.map).forEach(key => allKeys.add(key));
    });

    const keys = Array.from(allKeys);

    // Helper to escape CSV values
    const escapeCSV = (value: any): string => {
        const str = String(value || '');
        // If contains comma, quote, or newline, wrap in quotes and escape quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    // Create header
    let csv = keys.map(escapeCSV).join(',') + '\n';

    // Create rows
    records.forEach(record => {
        const row = keys.map(key => escapeCSV(record.map[key])).join(',');
        csv += row + '\n';
    });

    return csv;
}

/**
 * Format results as JSON
 */
function formatResultsAsJSON(results: any[]): string {
    return JSON.stringify(results, null, 2);
}

/**
 * Format records as HTML for webview display with sorting, filtering, and pagination
 */
export function formatRecordsAsHTML(records: any[], queryInfo: { query: string; from: string; to: string; mode: string; count: number; pageSize: number; executionTime?: number; jobStats?: any; jsonFilePath?: string }): string {
    if (records.length === 0) {
        return '<p>No results found</p>';
    }

    // Analyze fields
    const fieldAnalysis = FieldAnalyzer.analyze(records, queryInfo.mode as 'records' | 'messages');

    // Get all unique keys from all records
    const allKeys = new Set<string>();
    records.forEach(record => {
        Object.keys(record.map).forEach(key => allKeys.add(key));
    });

    const keys = Array.from(allKeys);

    // Serialize data for JavaScript
    const recordsJson = JSON.stringify(records.map(r => r.map));
    const keysJson = JSON.stringify(keys);
    const fieldMetadataJson = JSON.stringify(fieldAnalysis.fields);

    // Build HTML table
    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .header {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 18px;
            font-weight: 600;
        }
        .query-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin: 5px 0;
        }
        .query-code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 8px 12px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            margin: 10px 0;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .table-container {
            overflow-x: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            font-size: 13px;
        }
        /* Set default minimum width for _raw column */
        th.raw-column,
        td.raw-column {
            min-width: 500px;
        }
        th {
            background-color: var(--vscode-editor-lineHighlightBackground);
            color: var(--vscode-foreground);
            font-weight: 600;
            text-align: left;
            padding: 6px 12px;
            border-bottom: 2px solid var(--vscode-panel-border);
            position: sticky;
            top: 0;
            z-index: 10;
            cursor: pointer;
            user-select: none;
            position: relative;
            min-width: 100px;
        }
        th:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .resize-handle {
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            width: 5px;
            cursor: col-resize;
            user-select: none;
            z-index: 11;
        }
        .resize-handle:hover {
            background-color: var(--vscode-focusBorder);
        }
        .resizing {
            background-color: var(--vscode-focusBorder);
        }
        .sort-indicator {
            font-size: 10px;
            margin-left: 4px;
            opacity: 0.6;
        }
        .filter-row th {
            padding: 4px 8px;
            cursor: default;
        }
        .filter-row th:hover {
            background-color: var(--vscode-editor-lineHighlightBackground);
        }
        .filter-input {
            width: 100%;
            padding: 4px 6px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 12px;
            box-sizing: border-box;
        }
        .filter-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        td {
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            vertical-align: top;
            word-break: break-word;
        }
        tbody tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        tbody tr:last-child td {
            border-bottom: none;
        }
        .result-count {
            margin-top: 15px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .hidden {
            display: none;
        }
        .pagination {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 15px;
            padding: 10px 0;
            border-top: 1px solid var(--vscode-panel-border);
        }
        .pagination-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .pagination-controls {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .pagination-button {
            padding: 4px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .pagination-button:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }
        .pagination-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .page-input {
            width: 60px;
            padding: 4px 6px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 12px;
            text-align: center;
        }
        .toolbar {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 15px;
            padding: 10px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border-radius: 3px;
            flex-wrap: wrap;
        }
        .toolbar-section {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .toolbar-button {
            padding: 4px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .toolbar-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .toolbar-button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .toolbar-button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .global-search {
            flex: 1;
            min-width: 200px;
            padding: 4px 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 12px;
        }
        .column-toggle {
            position: relative;
        }
        .column-menu {
            display: none;
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 4px;
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 3px;
            padding: 8px;
            z-index: 1000;
            max-height: 300px;
            overflow-y: auto;
            min-width: 200px;
        }
        .column-menu.show {
            display: block;
        }
        .column-menu-item {
            display: flex;
            align-items: center;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
        }
        .column-menu-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .column-menu-item input[type="checkbox"] {
            margin-right: 8px;
        }
        /* Field Browser Styles */
        .field-browser {
            margin-bottom: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            background-color: var(--vscode-editor-background);
        }
        .field-browser-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 15px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            user-select: none;
        }
        .field-browser-header:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .field-browser-title {
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .field-browser-toggle {
            font-size: 12px;
            transition: transform 0.2s;
        }
        .field-browser-toggle.collapsed {
            transform: rotate(-90deg);
        }
        .field-browser-content {
            max-height: 400px;
            overflow-y: auto;
        }
        .field-browser-content.collapsed {
            display: none;
        }
        .field-filter-container {
            padding: 10px 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
        }
        .field-filter-input {
            width: 300px;
            max-width: 100%;
            padding: 6px 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 12px;
        }
        .field-filter-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }
        .field-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        .field-table th {
            position: sticky;
            top: 0;
            background-color: var(--vscode-editor-lineHighlightBackground);
            padding: 8px 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid var(--vscode-panel-border);
            cursor: pointer;
            user-select: none;
        }
        .field-table th:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .field-table td {
            padding: 6px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .field-table tbody tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .field-name {
            font-family: var(--vscode-editor-font-family);
            font-weight: 500;
        }
        .field-type {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .field-type.string {
            background-color: rgba(33, 150, 243, 0.2);
            color: #2196F3;
        }
        .field-type.number {
            background-color: rgba(76, 175, 80, 0.2);
            color: #4CAF50;
        }
        .field-type.timestamp {
            background-color: rgba(255, 152, 0, 0.2);
            color: #FF9800;
        }
        .field-type.boolean {
            background-color: rgba(156, 39, 176, 0.2);
            color: #9C27B0;
        }
        .field-type.mixed {
            background-color: rgba(158, 158, 158, 0.2);
            color: #9E9E9E;
        }
        .field-actions {
            display: flex;
            gap: 4px;
        }
        .field-action-btn {
            padding: 2px 8px;
            font-size: 11px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }
        .field-action-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .field-action-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        .time-field-indicator {
            color: var(--vscode-charts-orange);
            font-size: 10px;
            margin-left: 4px;
        }
        /* JSON Viewer Styles */
        .json-cell {
            display: flex;
            align-items: flex-start;
            gap: 6px;
        }
        .json-preview {
            color: var(--vscode-foreground);
            font-size: 11px;
            flex: 1;
            word-wrap: break-word;
            word-break: break-word;
            overflow-wrap: break-word;
            white-space: pre-wrap;
        }
        .json-expand-btn {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 2px;
            padding: 2px 6px;
            font-size: 11px;
            cursor: pointer;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            gap: 3px;
        }
        .json-expand-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .json-badge {
            background-color: rgba(0, 122, 204, 0.2);
            color: #007acc;
            padding: 1px 4px;
            border-radius: 2px;
            font-size: 9px;
            font-weight: 600;
            flex-shrink: 0;
        }
        .json-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.6);
            z-index: 10000;
            align-items: center;
            justify-content: center;
        }
        .json-modal.show {
            display: flex;
        }
        .json-modal-content {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            width: 90%;
            max-width: 1000px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        .json-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-lineHighlightBackground);
        }
        .json-modal-title {
            font-size: 14px;
            font-weight: 600;
        }
        .json-modal-actions {
            display: flex;
            gap: 8px;
        }
        .json-modal-btn {
            padding: 4px 10px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .json-modal-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .json-modal-btn.primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .json-modal-btn.primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .json-modal-close {
            background: none;
            border: none;
            color: var(--vscode-foreground);
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 2px;
        }
        .json-modal-close:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .json-modal-tabs {
            display: flex;
            gap: 2px;
            padding: 8px 16px 0 16px;
            background-color: var(--vscode-editor-background);
        }
        .json-modal-tab {
            padding: 6px 16px;
            background-color: transparent;
            color: var(--vscode-descriptionForeground);
            border: none;
            border-bottom: 2px solid transparent;
            cursor: pointer;
            font-size: 12px;
        }
        .json-modal-tab:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .json-modal-tab.active {
            color: var(--vscode-foreground);
            border-bottom-color: var(--vscode-focusBorder);
        }
        .json-modal-body {
            flex: 1;
            overflow: auto;
            padding: 16px;
        }
        .json-view {
            display: none;
        }
        .json-view.active {
            display: block;
        }
        .json-formatted {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 4px;
            overflow: auto;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            line-height: 1.5;
        }
        .json-raw {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 4px;
            overflow: auto;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .json-tree {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }
        .json-tree-node {
            margin-left: 20px;
        }
        .json-tree-key {
            color: #9cdcfe;
            font-weight: 500;
        }
        .json-tree-string {
            color: #ce9178;
        }
        .json-tree-number {
            color: #b5cea8;
        }
        .json-tree-boolean {
            color: #569cd6;
        }
        .json-tree-null {
            color: #569cd6;
        }
        .json-tree-toggle {
            cursor: pointer;
            user-select: none;
            display: inline-block;
            width: 12px;
        }
        /* Syntax highlighting for formatted JSON */
        .json-key {
            color: #9cdcfe;
        }
        .json-string {
            color: #ce9178;
        }
        .json-number {
            color: #b5cea8;
        }
        .json-boolean {
            color: #569cd6;
        }
        .json-null {
            color: #569cd6;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Sumo Logic Query Results</h1>
        <div class="query-info"><strong>Mode:</strong> ${queryInfo.mode}</div>
        <div class="query-info"><strong>Time Range:</strong> ${queryInfo.from} to ${queryInfo.to}</div>
        <div class="query-info"><strong>Results:</strong> ${queryInfo.count} ${queryInfo.mode}</div>
        ${queryInfo.executionTime ? `<div class="query-info"><strong>Execution Time:</strong> ${(queryInfo.executionTime / 1000).toFixed(2)}s</div>` : ''}
        ${queryInfo.jobStats ? `<div class="query-info"><strong>Job Stats:</strong> Records: ${queryInfo.jobStats.recordCount || 0}, Messages: ${queryInfo.jobStats.messageCount || 0}</div>` : ''}
        ${queryInfo.jsonFilePath ? `<div class="query-info"><strong>JSON File:</strong> <code>${escapeHtml(queryInfo.jsonFilePath)}</code></div>` : ''}
        <div class="query-code">${escapeHtml(queryInfo.query)}</div>
    </div>

    <!-- Field Browser -->
    <div class="field-browser">
        <div class="field-browser-header" onclick="toggleFieldBrowser()">
            <div class="field-browser-title">
                <span class="field-browser-toggle" id="fieldBrowserToggle">▼</span>
                <span>Field Browser (<span id="fieldCount">${fieldAnalysis.fields.length}</span> fields)</span>
            </div>
        </div>
        <div class="field-browser-content" id="fieldBrowserContent">
            <div class="field-filter-container">
                <input type="text" class="field-filter-input" id="fieldFilterInput" placeholder="Filter fields by name..." oninput="filterFields()">
            </div>
            <table class="field-table">
                <thead>
                    <tr>
                        <th onclick="sortFieldTable('name')">Field Name <span id="field-sort-name"></span></th>
                        <th onclick="sortFieldTable('type')">Type <span id="field-sort-type"></span></th>
                        <th onclick="sortFieldTable('nonNull')">Non-Null <span id="field-sort-nonNull"></span></th>
                        <th onclick="sortFieldTable('distinct')">Distinct <span id="field-sort-distinct"></span></th>
                        <th onclick="sortFieldTable('fill')">Fill % <span id="field-sort-fill"></span></th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="fieldTableBody">
                    ${fieldAnalysis.fields.map((field, idx) => `
                        <tr data-field-idx="${idx}">
                            <td>
                                <span class="field-name">${escapeHtml(field.name)}</span>
                                ${field.isTimeField ? '<span class="time-field-indicator" title="Time Field">🕐</span>' : ''}
                            </td>
                            <td><span class="field-type ${field.dataType}">${field.dataType}</span></td>
                            <td>${field.nonNullCount.toLocaleString()}</td>
                            <td>${field.distinctCount.toLocaleString()}</td>
                            <td>${field.fillPercentage.toFixed(1)}%</td>
                            <td>
                                <div class="field-actions">
                                    <button class="field-action-btn" onclick="showFieldValues('${escapeHtml(field.name)}')">Show Values</button>
                                    <button class="field-action-btn" onclick="chartField('${escapeHtml(field.name)}')">Chart Field</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <div class="toolbar">
        <div class="toolbar-section">
            <input type="text" class="global-search" id="globalSearch" placeholder="Search all columns..." oninput="globalSearch()">
            <button class="toolbar-button secondary" onclick="clearAllFilters()">Clear Filters</button>
        </div>
        <div class="toolbar-section">
            <div class="column-toggle">
                <button class="toolbar-button secondary" onclick="toggleColumnMenu()">Columns ▾</button>
                <div class="column-menu" id="columnMenu">
                    ${keys.map((key, idx) => `
                        <div class="column-menu-item">
                            <input type="checkbox" id="col-toggle-${idx}" checked onchange="toggleColumn(${idx})">
                            <label for="col-toggle-${idx}">${escapeHtml(key)}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
            <button class="toolbar-button" onclick="exportToCSV()">Export CSV</button>
            <button class="toolbar-button" onclick="exportToJSON()">Export JSON</button>
            <button class="toolbar-button secondary" onclick="copyVisible()">Copy Visible</button>
        </div>
    </div>
    <div class="table-container">
        <table id="resultsTable">
            <thead>
                <tr class="header-row">
                    ${keys.map((key, idx) => `<th data-column="${idx}" class="${key === '_raw' ? 'raw-column' : ''}"><span onclick="sortTable(${idx})">${escapeHtml(key)}<span class="sort-indicator" id="sort-${idx}"></span></span><div class="resize-handle" onmousedown="startResize(event, ${idx})"></div></th>`).join('')}
                </tr>
                <tr class="filter-row">
                    ${keys.map((key, idx) => `<th class="${key === '_raw' ? 'raw-column' : ''}"><input type="text" class="filter-input" placeholder="Filter..." oninput="filterTable()" data-column="${idx}"></th>`).join('')}
                </tr>
            </thead>
            <tbody id="tableBody">
                ${records.map((record, rowIdx) => `
                    <tr data-row="${rowIdx}">
                        ${keys.map((key, colIdx) => {
                            const value = String(record.map[key] || '');
                            const className = key === '_raw' ? 'raw-column' : '';
                            // Try to detect JSON
                            let isJson = false;
                            let jsonPreview = '';
                            try {
                                if ((value.startsWith('{') && value.endsWith('}')) ||
                                    (value.startsWith('[') && value.endsWith(']'))) {
                                    JSON.parse(value);
                                    isJson = true;
                                    // Create preview
                                    if (value.startsWith('{')) {
                                        jsonPreview = '{...}';
                                    } else {
                                        jsonPreview = '[...]';
                                    }
                                    jsonPreview += ` (${value.length} chars)`;
                                }
                            } catch (e) {
                                isJson = false;
                            }

                            if (isJson) {
                                return `<td class="${className}"><div class="json-cell"><span class="json-badge">JSON</span><span class="json-preview">${escapeHtml(value)}</span><button class="json-expand-btn" onclick="showJsonModal(${rowIdx}, ${colIdx}, '${escapeHtml(key).replace(/'/g, "\\'")}')">⤢ View</button></div></td>`;
                            } else {
                                return `<td class="${className}">${escapeHtml(value)}</td>`;
                            }
                        }).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    <div class="pagination">
        <div class="pagination-info">
            Showing <span id="pageStart">1</span>-<span id="pageEnd">${Math.min(queryInfo.pageSize, records.length)}</span> of <span id="visibleCount">${records.length}</span> results
        </div>
        <div class="pagination-controls">
            <button class="pagination-button" id="firstPageBtn" onclick="goToPage(1)">First</button>
            <button class="pagination-button" id="prevPageBtn" onclick="goToPage(currentPage - 1)">Previous</button>
            <span style="font-size: 12px;">Page <input type="number" class="page-input" id="pageInput" value="1" min="1" onchange="goToPageInput()"> of <span id="totalPages">1</span></span>
            <button class="pagination-button" id="nextPageBtn" onclick="goToPage(currentPage + 1)">Next</button>
            <button class="pagination-button" id="lastPageBtn" onclick="goToPage(totalPages)">Last</button>
        </div>
    </div>

    <!-- JSON Modal -->
    <div class="json-modal" id="jsonModal">
        <div class="json-modal-content">
            <div class="json-modal-header">
                <div class="json-modal-title" id="jsonModalTitle">JSON Viewer</div>
                <div class="json-modal-actions">
                    <button class="json-modal-btn primary" onclick="copyJsonContent()">Copy</button>
                    <button class="json-modal-close" onclick="closeJsonModal()">&times;</button>
                </div>
            </div>
            <div class="json-modal-tabs">
                <button class="json-modal-tab active" id="tab-formatted" onclick="switchJsonTab('formatted')">Formatted</button>
                <button class="json-modal-tab" id="tab-raw" onclick="switchJsonTab('raw')">Raw</button>
                <button class="json-modal-tab" id="tab-tree" onclick="switchJsonTab('tree')">Tree</button>
            </div>
            <div class="json-modal-body">
                <div class="json-view active" id="view-formatted">
                    <pre class="json-formatted" id="jsonFormatted"></pre>
                </div>
                <div class="json-view" id="view-raw">
                    <div class="json-raw" id="jsonRaw"></div>
                </div>
                <div class="json-view" id="view-tree">
                    <div class="json-tree" id="jsonTree"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Acquire VS Code API first
        const vscode = acquireVsCodeApi();

        const allData = ${recordsJson};
        const pageSize = ${queryInfo.pageSize};
        const columns = ${keysJson};
        const fieldMetadata = ${fieldMetadataJson};
        let sortColumn = -1;
        let sortAscending = true;
        let currentPage = 1;
        let totalPages = 1;
        let filteredData = [];
        let hiddenColumns = new Set();

        // Field browser state
        let fieldSortColumn = 'name';
        let fieldSortAscending = true;
        let fieldFilterText = '';

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // JSON Modal state
        let currentJsonData = null;
        let currentJsonFieldName = '';
        let currentJsonTab = 'formatted';

        // Show JSON in modal
        function showJsonModal(rowIdx, colIdx, fieldName) {
            const value = allData[rowIdx][columns[colIdx]];

            try {
                const jsonData = JSON.parse(value);
                currentJsonData = value;
                currentJsonFieldName = fieldName;

                // Update modal title
                document.getElementById('jsonModalTitle').textContent = 'JSON Viewer - ' + fieldName;

                // Populate all views
                populateFormattedView(jsonData);
                populateRawView(value);
                populateTreeView(jsonData);

                // Show modal
                document.getElementById('jsonModal').classList.add('show');

                // Add escape key listener
                document.addEventListener('keydown', handleJsonModalEscape);
            } catch (e) {
                console.error('Failed to parse JSON:', e);
            }
        }

        // Close JSON modal
        function closeJsonModal() {
            document.getElementById('jsonModal').classList.remove('show');
            document.removeEventListener('keydown', handleJsonModalEscape);
        }

        // Handle escape key to close modal
        function handleJsonModalEscape(e) {
            if (e.key === 'Escape') {
                closeJsonModal();
            }
        }

        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('jsonModal');
            if (e.target === modal) {
                closeJsonModal();
            }
        });

        // Switch between JSON tabs
        function switchJsonTab(tabName) {
            // Update tab buttons
            document.querySelectorAll('.json-modal-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.getElementById('tab-' + tabName).classList.add('active');

            // Update views
            document.querySelectorAll('.json-view').forEach(view => {
                view.classList.remove('active');
            });
            document.getElementById('view-' + tabName).classList.add('active');

            currentJsonTab = tabName;
        }

        // Populate formatted view with syntax highlighting
        function populateFormattedView(jsonData) {
            const formatted = JSON.stringify(jsonData, null, 2);
            const highlighted = syntaxHighlightJson(formatted);
            document.getElementById('jsonFormatted').innerHTML = highlighted;
        }

        // Populate raw view
        function populateRawView(rawString) {
            document.getElementById('jsonRaw').textContent = rawString;
        }

        // Populate tree view
        function populateTreeView(jsonData) {
            const treeHtml = buildJsonTree(jsonData, 0);
            document.getElementById('jsonTree').innerHTML = treeHtml;
        }

        // Syntax highlighting for JSON
        function syntaxHighlightJson(json) {
            json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'json-key';
                    } else {
                        cls = 'json-string';
                    }
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return '<span class="' + cls + '">' + match + '</span>';
            });
        }

        // Build interactive tree view
        function buildJsonTree(data, depth = 0) {
            const indent = '  '.repeat(depth);
            let html = '';

            if (Array.isArray(data)) {
                html += '<div class="json-tree-node">';
                html += '<span class="json-tree-toggle" onclick="toggleTreeNode(this)">▼</span>';
                html += '<span class="json-tree-bracket">[</span>';
                html += '<div class="json-tree-children">';
                data.forEach((item, idx) => {
                    html += '<div style="margin-left: 20px;">';
                    if (typeof item === 'object' && item !== null) {
                        html += buildJsonTree(item, depth + 1);
                    } else {
                        html += formatJsonValue(item);
                    }
                    if (idx < data.length - 1) html += '<span>,</span>';
                    html += '</div>';
                });
                html += '</div>';
                html += '<span class="json-tree-bracket">]</span>';
                html += '</div>';
            } else if (typeof data === 'object' && data !== null) {
                html += '<div class="json-tree-node">';
                html += '<span class="json-tree-toggle" onclick="toggleTreeNode(this)">▼</span>';
                html += '<span class="json-tree-bracket">{</span>';
                html += '<div class="json-tree-children">';
                const keys = Object.keys(data);
                keys.forEach((key, idx) => {
                    html += '<div style="margin-left: 20px;">';
                    html += '<span class="json-tree-key">"' + escapeHtml(key) + '"</span>: ';
                    const value = data[key];
                    if (typeof value === 'object' && value !== null) {
                        html += buildJsonTree(value, depth + 1);
                    } else {
                        html += formatJsonValue(value);
                    }
                    if (idx < keys.length - 1) html += '<span>,</span>';
                    html += '</div>';
                });
                html += '</div>';
                html += '<span class="json-tree-bracket">}</span>';
                html += '</div>';
            } else {
                html += formatJsonValue(data);
            }

            return html;
        }

        // Format JSON value with appropriate styling
        function formatJsonValue(value) {
            if (typeof value === 'string') {
                return '<span class="json-tree-string">"' + escapeHtml(value) + '"</span>';
            } else if (typeof value === 'number') {
                return '<span class="json-tree-number">' + value + '</span>';
            } else if (typeof value === 'boolean') {
                return '<span class="json-tree-boolean">' + value + '</span>';
            } else if (value === null) {
                return '<span class="json-tree-null">null</span>';
            }
            return String(value);
        }

        // Toggle tree node collapse/expand
        function toggleTreeNode(toggle) {
            const node = toggle.parentElement;
            const children = node.querySelector('.json-tree-children');
            if (children) {
                if (children.style.display === 'none') {
                    children.style.display = 'block';
                    toggle.textContent = '▼';
                } else {
                    children.style.display = 'none';
                    toggle.textContent = '▶';
                }
            }
        }

        // Copy JSON content to clipboard
        function copyJsonContent() {
            let textToCopy = '';

            if (currentJsonTab === 'formatted') {
                const jsonData = JSON.parse(currentJsonData);
                textToCopy = JSON.stringify(jsonData, null, 2);
            } else {
                textToCopy = currentJsonData;
            }

            navigator.clipboard.writeText(textToCopy).then(() => {
                // Visual feedback
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 1500);
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        }

        function sortTable(columnIndex) {
            const tbody = document.getElementById('tableBody');
            const rows = Array.from(tbody.querySelectorAll('tr'));

            // Toggle sort direction if clicking same column
            if (sortColumn === columnIndex) {
                sortAscending = !sortAscending;
            } else {
                sortColumn = columnIndex;
                sortAscending = true;
            }

            // Clear all sort indicators
            columns.forEach((_, idx) => {
                document.getElementById('sort-' + idx).textContent = '';
            });

            // Set current sort indicator
            document.getElementById('sort-' + columnIndex).textContent = sortAscending ? '▲' : '▼';

            // Sort rows
            rows.sort((a, b) => {
                const aRowIdx = parseInt(a.dataset.row);
                const bRowIdx = parseInt(b.dataset.row);
                const aValue = String(allData[aRowIdx][columns[columnIndex]] || '');
                const bValue = String(allData[bRowIdx][columns[columnIndex]] || '');

                // Try numeric comparison first
                const aNum = parseFloat(aValue);
                const bNum = parseFloat(bValue);
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return sortAscending ? aNum - bNum : bNum - aNum;
                }

                // Fall back to string comparison
                const comparison = aValue.localeCompare(bValue);
                return sortAscending ? comparison : -comparison;
            });

            // Re-append sorted rows
            rows.forEach(row => tbody.appendChild(row));
        }

        function filterTable() {
            const filters = Array.from(document.querySelectorAll('.filter-input'));

            // Build filtered data array
            filteredData = [];
            allData.forEach((row, idx) => {
                let visible = true;

                filters.forEach((filter, colIdx) => {
                    const filterValue = filter.value.toLowerCase();
                    if (filterValue) {
                        const cellValue = String(row[columns[colIdx]] || '').toLowerCase();
                        if (!cellValue.includes(filterValue)) {
                            visible = false;
                        }
                    }
                });

                if (visible) {
                    filteredData.push(idx);
                }
            });

            // Reset to page 1 when filtering
            currentPage = 1;
            updatePagination();
            renderPage();
        }

        function renderPage() {
            const tbody = document.getElementById('tableBody');
            const rows = tbody.querySelectorAll('tr');

            const startIdx = (currentPage - 1) * pageSize;
            const endIdx = startIdx + pageSize;

            rows.forEach((row, idx) => {
                const rowIdx = parseInt(row.dataset.row);
                const filteredIdx = filteredData.indexOf(rowIdx);

                if (filteredIdx >= startIdx && filteredIdx < endIdx) {
                    row.classList.remove('hidden');
                } else {
                    row.classList.add('hidden');
                }
            });
        }

        function updatePagination() {
            totalPages = Math.ceil(filteredData.length / pageSize);

            document.getElementById('visibleCount').textContent = filteredData.length;
            document.getElementById('totalPages').textContent = totalPages;
            document.getElementById('pageInput').value = currentPage;

            const startIdx = (currentPage - 1) * pageSize + 1;
            const endIdx = Math.min(currentPage * pageSize, filteredData.length);

            document.getElementById('pageStart').textContent = filteredData.length > 0 ? startIdx : 0;
            document.getElementById('pageEnd').textContent = endIdx;

            // Update button states
            document.getElementById('firstPageBtn').disabled = currentPage === 1;
            document.getElementById('prevPageBtn').disabled = currentPage === 1;
            document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
            document.getElementById('lastPageBtn').disabled = currentPage === totalPages;
        }

        function goToPage(page) {
            if (page < 1 || page > totalPages) return;
            currentPage = page;
            updatePagination();
            renderPage();
        }

        function goToPageInput() {
            const input = document.getElementById('pageInput');
            const page = parseInt(input.value);
            if (!isNaN(page)) {
                goToPage(page);
            }
        }

        // Initialize pagination
        filteredData = allData.map((_, idx) => idx);
        updatePagination();
        renderPage();

        // Global search functionality
        function globalSearch() {
            const searchValue = document.getElementById('globalSearch').value.toLowerCase();

            if (!searchValue) {
                // If search is empty, apply column filters
                filterTable();
                return;
            }

            // Build filtered data array
            filteredData = [];
            allData.forEach((row, idx) => {
                // Check if any column contains the search value
                const matchesSearch = columns.some(col => {
                    const cellValue = String(row[col] || '').toLowerCase();
                    return cellValue.includes(searchValue);
                });

                // Also check column filters
                const filters = Array.from(document.querySelectorAll('.filter-input'));
                let matchesFilters = true;
                filters.forEach((filter, colIdx) => {
                    const filterValue = filter.value.toLowerCase();
                    if (filterValue) {
                        const cellValue = String(row[columns[colIdx]] || '').toLowerCase();
                        if (!cellValue.includes(filterValue)) {
                            matchesFilters = false;
                        }
                    }
                });

                if (matchesSearch && matchesFilters) {
                    filteredData.push(idx);
                }
            });

            currentPage = 1;
            updatePagination();
            renderPage();
        }

        // Clear all filters
        function clearAllFilters() {
            // Clear global search
            document.getElementById('globalSearch').value = '';

            // Clear column filters
            document.querySelectorAll('.filter-input').forEach(input => {
                input.value = '';
            });

            // Reset filtered data
            filteredData = allData.map((_, idx) => idx);
            currentPage = 1;
            updatePagination();
            renderPage();
        }

        // Column visibility toggle
        function toggleColumnMenu() {
            const menu = document.getElementById('columnMenu');
            menu.classList.toggle('show');
        }

        // Close column menu when clicking outside
        document.addEventListener('click', (event) => {
            const menu = document.getElementById('columnMenu');
            const toggle = event.target.closest('.column-toggle');
            if (!toggle && menu.classList.contains('show')) {
                menu.classList.remove('show');
            }
        });

        function toggleColumn(columnIndex) {
            if (hiddenColumns.has(columnIndex)) {
                hiddenColumns.delete(columnIndex);
            } else {
                hiddenColumns.add(columnIndex);
            }

            // Update header cells
            const headerCells = document.querySelectorAll(\`th[data-column="\${columnIndex}"]\`);
            headerCells.forEach(cell => {
                if (hiddenColumns.has(columnIndex)) {
                    cell.style.display = 'none';
                } else {
                    cell.style.display = '';
                }
            });

            // Update filter row cells
            const filterCells = document.querySelectorAll(\`.filter-row th:nth-child(\${columnIndex + 1})\`);
            filterCells.forEach(cell => {
                if (hiddenColumns.has(columnIndex)) {
                    cell.style.display = 'none';
                } else {
                    cell.style.display = '';
                }
            });

            // Update data cells
            const dataCells = document.querySelectorAll(\`td:nth-child(\${columnIndex + 1})\`);
            dataCells.forEach(cell => {
                if (hiddenColumns.has(columnIndex)) {
                    cell.style.display = 'none';
                } else {
                    cell.style.display = '';
                }
            });
        }

        // Export to CSV
        function exportToCSV() {
            // Get visible columns
            const visibleColumns = columns.filter((_, idx) => !hiddenColumns.has(idx));

            // Build CSV content
            let csv = '';

            // Header row
            csv += visibleColumns.map(col => {
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                const escaped = String(col).replace(/"/g, '""');
                return escaped.includes(',') || escaped.includes('"') || escaped.includes('\\n')
                    ? \`"\${escaped}"\`
                    : escaped;
            }).join(',') + '\\n';

            // Data rows (only filtered data)
            filteredData.forEach(rowIdx => {
                const row = allData[rowIdx];
                csv += visibleColumns.map(col => {
                    const value = String(row[col] || '');
                    const escaped = value.replace(/"/g, '""');
                    return escaped.includes(',') || escaped.includes('"') || escaped.includes('\\n')
                        ? \`"\${escaped}"\`
                        : escaped;
                }).join(',') + '\\n';
            });

            // Send CSV data to extension host for file save
            vscode.postMessage({
                command: 'exportCSV',
                csvData: csv
            });
        }

        // Export to JSON
        function exportToJSON() {
            // Get visible columns
            const visibleColumns = columns.filter((_, idx) => !hiddenColumns.has(idx));

            // Build JSON array with only visible columns and filtered data
            const jsonData = filteredData.map(rowIdx => {
                const row = allData[rowIdx];
                const obj = {};
                visibleColumns.forEach(col => {
                    obj[col] = row[col];
                });
                return obj;
            });

            const jsonString = JSON.stringify(jsonData, null, 2);

            // Send JSON data to extension host for file save
            vscode.postMessage({
                command: 'exportJSON',
                jsonData: jsonString
            });
        }

        // Copy visible data to clipboard
        function copyVisible() {
            // Get visible columns
            const visibleColumns = columns.filter((_, idx) => !hiddenColumns.has(idx));

            // Build tab-separated content
            let tsv = '';

            // Header row
            tsv += visibleColumns.join('\\t') + '\\n';

            // Data rows (only filtered data)
            filteredData.forEach(rowIdx => {
                const row = allData[rowIdx];
                tsv += visibleColumns.map(col => String(row[col] || '')).join('\\t') + '\\n';
            });

            // Copy to clipboard
            navigator.clipboard.writeText(tsv).then(() => {
                showNotification('Copied ' + filteredData.length + ' rows to clipboard');
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        }

        // Show temporary notification
        function showNotification(message) {
            const notification = document.createElement('div');
            notification.textContent = message;
            notification.style.cssText = \`
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: var(--vscode-notifications-background);
                color: var(--vscode-notifications-foreground);
                border: 1px solid var(--vscode-notifications-border);
                padding: 12px 16px;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
            \`;
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }

        // Column resizing functionality
        let resizingColumn = null;
        let startX = 0;
        let startWidth = 0;

        function startResize(event, columnIndex) {
            event.stopPropagation(); // Prevent sorting when clicking resize handle
            resizingColumn = columnIndex;
            const th = event.target.parentElement;
            startX = event.pageX;
            startWidth = th.offsetWidth;

            // Add class to show visual feedback
            event.target.classList.add('resizing');

            document.addEventListener('mousemove', doResize);
            document.addEventListener('mouseup', stopResize);

            // Prevent text selection during resize
            document.body.style.userSelect = 'none';
        }

        function doResize(event) {
            if (resizingColumn === null) return;

            const diff = event.pageX - startX;
            const newWidth = Math.max(50, startWidth + diff); // Min width of 50px

            // Get all cells in this column (header and data)
            const headerCells = document.querySelectorAll(\`th[data-column="\${resizingColumn}"]\`);
            const dataCells = document.querySelectorAll(\`td:nth-child(\${resizingColumn + 1})\`);

            headerCells.forEach(cell => {
                cell.style.width = newWidth + 'px';
                cell.style.minWidth = newWidth + 'px';
                cell.style.maxWidth = newWidth + 'px';
            });

            dataCells.forEach(cell => {
                cell.style.width = newWidth + 'px';
                cell.style.minWidth = newWidth + 'px';
                cell.style.maxWidth = newWidth + 'px';
            });
        }

        function stopResize(event) {
            if (resizingColumn === null) return;

            // Remove visual feedback
            const resizeHandles = document.querySelectorAll('.resize-handle');
            resizeHandles.forEach(handle => handle.classList.remove('resizing'));

            resizingColumn = null;
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);

            // Re-enable text selection
            document.body.style.userSelect = '';
        }

        // ============================================
        // Field Browser Functions
        // ============================================

        /**
         * Toggle field browser collapsed/expanded
         */
        function toggleFieldBrowser() {
            const content = document.getElementById('fieldBrowserContent');
            const toggle = document.getElementById('fieldBrowserToggle');

            content.classList.toggle('collapsed');
            toggle.classList.toggle('collapsed');
        }

        /**
         * Sort field table by column
         */
        function sortFieldTable(column) {
            // Toggle sort direction if clicking same column
            if (fieldSortColumn === column) {
                fieldSortAscending = !fieldSortAscending;
            } else {
                fieldSortColumn = column;
                fieldSortAscending = true;
            }

            // Clear all sort indicators
            ['name', 'type', 'nonNull', 'distinct', 'fill'].forEach(col => {
                const indicator = document.getElementById('field-sort-' + col);
                if (indicator) {
                    indicator.textContent = '';
                }
            });

            // Set current sort indicator
            const indicator = document.getElementById('field-sort-' + column);
            if (indicator) {
                indicator.textContent = fieldSortAscending ? '▲' : '▼';
            }

            // Filter and sort field metadata
            let fieldsToSort = [...fieldMetadata];

            // Apply filter if active
            if (fieldFilterText) {
                fieldsToSort = fieldsToSort.filter(field =>
                    field.name.toLowerCase().includes(fieldFilterText)
                );
            }

            const sortedFields = fieldsToSort.sort((a, b) => {
                let aValue, bValue;

                switch (column) {
                    case 'name':
                        aValue = a.name.toLowerCase();
                        bValue = b.name.toLowerCase();
                        break;
                    case 'type':
                        aValue = a.dataType;
                        bValue = b.dataType;
                        break;
                    case 'nonNull':
                        aValue = a.nonNullCount;
                        bValue = b.nonNullCount;
                        break;
                    case 'distinct':
                        aValue = a.distinctCount;
                        bValue = b.distinctCount;
                        break;
                    case 'fill':
                        aValue = a.fillPercentage;
                        bValue = b.fillPercentage;
                        break;
                    default:
                        return 0;
                }

                let comparison = 0;
                if (typeof aValue === 'string') {
                    comparison = aValue.localeCompare(bValue);
                } else {
                    comparison = aValue - bValue;
                }

                return fieldSortAscending ? comparison : -comparison;
            });

            // Update count display
            document.getElementById('fieldCount').textContent = sortedFields.length;

            // Re-render field table body
            const tbody = document.getElementById('fieldTableBody');
            tbody.innerHTML = sortedFields.map((field, idx) => \`
                <tr data-field-idx="\${idx}">
                    <td>
                        <span class="field-name">\${escapeHtml(field.name)}</span>
                        \${field.isTimeField ? '<span class="time-field-indicator" title="Time Field">🕐</span>' : ''}
                    </td>
                    <td><span class="field-type \${field.dataType}">\${field.dataType}</span></td>
                    <td>\${field.nonNullCount.toLocaleString()}</td>
                    <td>\${field.distinctCount.toLocaleString()}</td>
                    <td>\${field.fillPercentage.toFixed(1)}%</td>
                    <td>
                        <div class="field-actions">
                            <button class="field-action-btn" onclick="showFieldValues('\${escapeHtml(field.name)}')">Show Values</button>
                            <button class="field-action-btn" onclick="chartField('\${escapeHtml(field.name)}')">Chart Field</button>
                        </div>
                    </td>
                </tr>
            \`).join('');
        }

        /**
         * Filter fields in the field browser
         */
        function filterFields() {
            const filterInput = document.getElementById('fieldFilterInput');
            fieldFilterText = filterInput.value.toLowerCase();

            // Get fields and filter by name
            let fieldsToDisplay = [...fieldMetadata];

            if (fieldFilterText) {
                fieldsToDisplay = fieldsToDisplay.filter(field =>
                    field.name.toLowerCase().includes(fieldFilterText)
                );
            }

            // Apply current sort
            if (fieldSortColumn) {
                fieldsToDisplay.sort((a, b) => {
                    let aValue, bValue;

                    switch (fieldSortColumn) {
                        case 'name':
                            aValue = a.name.toLowerCase();
                            bValue = b.name.toLowerCase();
                            break;
                        case 'type':
                            aValue = a.dataType;
                            bValue = b.dataType;
                            break;
                        case 'nonNull':
                            aValue = a.nonNullCount;
                            bValue = b.nonNullCount;
                            break;
                        case 'distinct':
                            aValue = a.distinctCount;
                            bValue = b.distinctCount;
                            break;
                        case 'fill':
                            aValue = a.fillPercentage;
                            bValue = b.fillPercentage;
                            break;
                        default:
                            return 0;
                    }

                    let comparison = 0;
                    if (typeof aValue === 'string') {
                        comparison = aValue.localeCompare(bValue);
                    } else {
                        comparison = aValue - bValue;
                    }

                    return fieldSortAscending ? comparison : -comparison;
                });
            }

            // Update count display
            document.getElementById('fieldCount').textContent = fieldsToDisplay.length;

            // Re-render field table body
            const tbody = document.getElementById('fieldTableBody');
            tbody.innerHTML = fieldsToDisplay.map((field, idx) => \`
                <tr data-field-idx="\${idx}">
                    <td>
                        <span class="field-name">\${escapeHtml(field.name)}</span>
                        \${field.isTimeField ? '<span class="time-field-indicator" title="Time Field">🕐</span>' : ''}
                    </td>
                    <td><span class="field-type \${field.dataType}">\${field.dataType}</span></td>
                    <td>\${field.nonNullCount.toLocaleString()}</td>
                    <td>\${field.distinctCount.toLocaleString()}</td>
                    <td>\${field.fillPercentage.toFixed(1)}%</td>
                    <td>
                        <div class="field-actions">
                            <button class="field-action-btn" onclick="showFieldValues('\${escapeHtml(field.name)}')">Show Values</button>
                            <button class="field-action-btn" onclick="chartField('\${escapeHtml(field.name)}')">Chart Field</button>
                        </div>
                    </td>
                </tr>
            \`).join('');
        }

        /**
         * Show field values distribution (placeholder - will send message to extension)
         */
        function showFieldValues(fieldName) {
            vscode.postMessage({
                command: 'showFieldValues',
                fieldName: fieldName
            });
        }

        /**
         * Chart field (placeholder for Phase 2)
         */
        function chartField(fieldName) {
            vscode.postMessage({
                command: 'chartField',
                fieldName: fieldName
            });
        }
    </script>
</body>
</html>`;

    return html;
}

/**
 * Generate HTML for field values distribution display
 */
export function generateFieldValuesHTML(
    fieldName: string,
    distribution: Array<{ value: any; count: number; percentage: number }>,
    totalRecords: number
): string {
    const distributionJson = JSON.stringify(distribution);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Field Values: ${escapeHtml(fieldName)}</title>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .header {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 18px;
            font-weight: 600;
        }
        .field-name {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-textLink-foreground);
            font-size: 16px;
        }
        .stats {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 8px;
        }
        .toolbar {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            padding: 10px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border-radius: 3px;
        }
        .toolbar-button {
            padding: 4px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .toolbar-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .search-box {
            flex: 1;
            padding: 4px 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 12px;
        }
        .values-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        .values-table th {
            background-color: var(--vscode-editor-lineHighlightBackground);
            padding: 8px 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid var(--vscode-panel-border);
            position: sticky;
            top: 0;
            z-index: 10;
        }
        .values-table td {
            padding: 6px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .values-table tbody tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .value-cell {
            font-family: var(--vscode-editor-font-family);
            word-break: break-all;
            max-width: 500px;
        }
        .count-cell {
            text-align: right;
            font-family: var(--vscode-editor-font-family);
        }
        .percentage-cell {
            text-align: right;
        }
        .bar-container {
            width: 100px;
            height: 20px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 2px;
            overflow: hidden;
        }
        .bar-fill {
            height: 100%;
            background-color: var(--vscode-charts-blue);
            transition: width 0.3s ease;
        }
        .hidden {
            display: none;
        }
        .no-results {
            padding: 20px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Field Values Distribution</h1>
        <div class="field-name">${escapeHtml(fieldName)}</div>
        <div class="stats">
            Total Records: ${totalRecords.toLocaleString()} |
            Unique Values: ${distribution.length.toLocaleString()}
        </div>
    </div>

    <!-- Mini chart visualization -->
    <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px;">Top ${Math.min(20, distribution.length)} Values</h3>
        <div id="miniChart" style="width: 100%; height: 300px;"></div>
    </div>

    <div class="toolbar">
        <input type="text" class="search-box" id="searchBox" placeholder="Filter values..." oninput="filterValues()">
        <button class="toolbar-button" onclick="sortBy('count')">Sort by Count</button>
        <button class="toolbar-button" onclick="sortBy('value')">Sort by Value</button>
        <button class="toolbar-button" onclick="exportToCSV()">Export CSV</button>
        <button class="toolbar-button" onclick="copyToClipboard()">Copy All</button>
        <span style="margin-left: auto; font-size: 12px; color: var(--vscode-descriptionForeground);" id="displayCount">
            Showing all ${distribution.length} values
        </span>
    </div>

    <table class="values-table">
        <thead>
            <tr>
                <th style="width: 50px;">#</th>
                <th>Value</th>
                <th style="width: 120px; text-align: right;">Count</th>
                <th style="width: 100px; text-align: right;">Percentage</th>
                <th style="width: 120px;">Distribution</th>
            </tr>
        </thead>
        <tbody id="valuesTableBody">
            ${distribution.map((item, idx) => `
                <tr data-idx="${idx}">
                    <td style="color: var(--vscode-descriptionForeground);">${idx + 1}</td>
                    <td class="value-cell">${escapeHtml(String(item.value))}</td>
                    <td class="count-cell">${item.count.toLocaleString()}</td>
                    <td class="percentage-cell">${item.percentage.toFixed(2)}%</td>
                    <td>
                        <div class="bar-container">
                            <div class="bar-fill" style="width: ${item.percentage}%"></div>
                        </div>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div id="noResults" class="no-results hidden">
        No values match your filter
    </div>

    <script>
        let allDistribution = ${distributionJson};
        let currentSort = 'count';

        // Initialize mini chart
        function initMiniChart() {
            const chartDom = document.getElementById('miniChart');
            if (!chartDom) return;

            const chart = echarts.init(chartDom, 'dark');

            // Get top 20 values for chart
            const top20 = allDistribution.slice(0, 20);

            const option = {
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'shadow'
                    },
                    formatter: function(params) {
                        const item = params[0];
                        return item.name + '<br/>' +
                               'Count: ' + item.value + '<br/>' +
                               'Percentage: ' + allDistribution[item.dataIndex].percentage.toFixed(2) + '%';
                    }
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '3%',
                    top: '3%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: top20.map(d => d.value),
                    axisLabel: {
                        interval: 0,
                        rotate: 45,
                        overflow: 'truncate',
                        width: 80
                    }
                },
                yAxis: {
                    type: 'value'
                },
                series: [{
                    type: 'bar',
                    data: top20.map(d => d.count),
                    itemStyle: {
                        color: '#4CAF50'
                    }
                }]
            };

            chart.setOption(option);

            // Resize on window resize
            window.addEventListener('resize', () => {
                chart.resize();
            });
        }

        // Sort distribution
        function sortBy(type) {
            currentSort = type;

            if (type === 'count') {
                allDistribution.sort((a, b) => b.count - a.count);
            } else if (type === 'value') {
                allDistribution.sort((a, b) => String(a.value).localeCompare(String(b.value)));
            }

            renderTable();
        }

        // Render table
        function renderTable() {
            const tbody = document.getElementById('valuesTableBody');
            tbody.innerHTML = allDistribution.map((item, idx) => \`
                <tr data-idx="\${idx}">
                    <td style="color: var(--vscode-descriptionForeground);">\${idx + 1}</td>
                    <td class="value-cell">\${escapeHtmlJS(String(item.value))}</td>
                    <td class="count-cell">\${item.count.toLocaleString()}</td>
                    <td class="percentage-cell">\${item.percentage.toFixed(2)}%</td>
                    <td>
                        <div class="bar-container">
                            <div class="bar-fill" style="width: \${item.percentage}%"></div>
                        </div>
                    </td>
                </tr>
            \`).join('');
        }

        function escapeHtmlJS(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Initialize on load
        document.addEventListener('DOMContentLoaded', function() {
            initMiniChart();
        });

        function filterValues() {
            const searchTerm = document.getElementById('searchBox').value.toLowerCase();
            const rows = document.querySelectorAll('#valuesTableBody tr');
            let visibleCount = 0;

            rows.forEach(row => {
                const valueCell = row.querySelector('.value-cell');
                const value = valueCell.textContent.toLowerCase();

                if (value.includes(searchTerm)) {
                    row.classList.remove('hidden');
                    visibleCount++;
                } else {
                    row.classList.add('hidden');
                }
            });

            // Show/hide no results message
            const noResults = document.getElementById('noResults');
            if (visibleCount === 0) {
                noResults.classList.remove('hidden');
            } else {
                noResults.classList.add('hidden');
            }
        }

        function exportToCSV() {
            let csv = 'Value,Count,Percentage\\n';

            allDistribution.forEach(item => {
                const value = String(item.value).replace(/"/g, '""');
                const needsQuotes = value.includes(',') || value.includes('"') || value.includes('\\n');
                const csvValue = needsQuotes ? '"' + value + '"' : value;
                csv += csvValue + ',' + item.count + ',' + item.percentage.toFixed(2) + '%\\n';
            });

            // Create blob and download
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'field_values_${escapeHtml(fieldName)}.csv';
            link.click();
            URL.revokeObjectURL(url);
        }

        function copyToClipboard() {
            let text = 'Value\\tCount\\tPercentage\\n';

            allDistribution.forEach(item => {
                text += String(item.value) + '\\t' + item.count + '\\t' + item.percentage.toFixed(2) + '%\\n';
            });

            navigator.clipboard.writeText(text).then(() => {
                showNotification('Copied ' + allDistribution.length + ' values to clipboard');
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        }

        function showNotification(message) {
            const notification = document.createElement('div');
            notification.textContent = message;
            notification.style.cssText = \`
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: var(--vscode-notifications-background);
                color: var(--vscode-notifications-foreground);
                border: 1px solid var(--vscode-notifications-border);
                padding: 12px 16px;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                z-index: 10000;
            \`;
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    </script>
</body>
</html>`;
}

/**
 * Generate HTML for chart configuration editor
 */
function generateConfigEditorHTML(config: any): string {
    const configJson = JSON.stringify(config, null, 2);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chart Configuration Editor</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .editor-toolbar {
            padding: 10px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .editor-toolbar button {
            padding: 6px 14px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        .editor-toolbar button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .editor-toolbar .status {
            margin-left: auto;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .editor-toolbar .error {
            color: var(--vscode-errorForeground);
        }
        .editor-toolbar .success {
            color: var(--vscode-testing-iconPassed);
        }
        #editor-container {
            flex: 1;
            overflow: hidden;
        }
    </style>
</head>
<body>
    <div class="editor-toolbar">
        <button onclick="runChart()">▶ Run</button>
        <button onclick="formatConfig()">Format JSON</button>
        <button onclick="copyConfig()">Copy to Clipboard</button>
        <span class="status" id="status"></span>
    </div>
    <div id="editor-container"></div>

    <script>
        const vscode = acquireVsCodeApi();
        let editor;

        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
        require(['vs/editor/editor.main'], function() {
            editor = monaco.editor.create(document.getElementById('editor-container'), {
                value: ${JSON.stringify(configJson)},
                language: 'json',
                theme: 'vs-dark',
                automaticLayout: true,
                minimap: { enabled: true },
                fontSize: 13,
                tabSize: 2,
                formatOnPaste: true,
                formatOnType: true
            });
        });

        function runChart() {
            try {
                const configText = editor.getValue();
                const config = JSON.parse(configText);

                vscode.postMessage({
                    command: 'runChart',
                    config: config
                });

                showStatus('Chart updated', 'success');
            } catch (error) {
                showStatus('Invalid JSON: ' + error.message, 'error');
            }
        }

        function formatConfig() {
            try {
                const configText = editor.getValue();
                const config = JSON.parse(configText);
                const formatted = JSON.stringify(config, null, 2);
                editor.setValue(formatted);
                showStatus('Formatted', 'success');
            } catch (error) {
                showStatus('Cannot format invalid JSON', 'error');
            }
        }

        function copyConfig() {
            const configText = editor.getValue();
            navigator.clipboard.writeText(configText).then(() => {
                showStatus('Copied to clipboard', 'success');
            }).catch(() => {
                showStatus('Failed to copy', 'error');
            });
        }

        function showStatus(message, type) {
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            statusEl.className = 'status ' + type;
            setTimeout(() => {
                statusEl.textContent = '';
                statusEl.className = 'status';
            }, 3000);
        }

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                runChart();
            }
        });
    </script>
</body>
</html>`;
}

/**
 * Generate HTML for chart display
 */
export function generateChartHTML(
    chartConfig: ChartConfig,
    chartData: any[],
    fieldMetadata: FieldMetadata[]
): string {
    // Initialize chart registry
    const registry = initializeChartRegistry();
    const chartType = registry.getChartType(chartConfig.chartTypeId);

    if (!chartType) {
        return '<html><body><h1>Error: Unknown chart type</h1></body></html>';
    }

    // Transform data to ECharts format
    const echartsOption = chartType.transformer(chartData, chartConfig, fieldMetadata);
    const optionJson = JSON.stringify(echartsOption);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chart: ${chartType.name}</title>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
        }
        #chart {
            width: 100%;
            height: calc(100vh - 120px);
            min-height: 400px;
        }
        .toolbar {
            margin-bottom: 15px;
            padding: 10px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border-radius: 3px;
            display: flex;
            gap: 8px;
        }
        .toolbar button {
            padding: 4px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .toolbar button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .chart-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="chart-info">
        <strong>${escapeHtml(chartType.name)}</strong> -
        Fields: ${chartConfig.fields.map(f => escapeHtml(f)).join(', ')}
    </div>
    <div class="toolbar">
        <button onclick="chart.dispatchAction({type: 'restore'})">Reset Zoom</button>
        <button onclick="downloadChart()">Download PNG</button>
        <button onclick="toggleConfigEditor()">Show Configuration</button>
    </div>
    <div id="chart"></div>

    <script>
        const vscode = acquireVsCodeApi();
        const chartDom = document.getElementById('chart');
        const chart = echarts.init(chartDom, 'dark');
        let option = ${optionJson};

        chart.setOption(option);

        // Resize chart on window resize
        window.addEventListener('resize', () => {
            chart.resize();
        });

        function downloadChart() {
            const url = chart.getDataURL({
                type: 'png',
                pixelRatio: 2,
                backgroundColor: getComputedStyle(document.body).getPropertyValue('--vscode-editor-background')
            });
            const link = document.createElement('a');
            link.download = 'chart_${chartType.id}_${Date.now()}.png';
            link.href = url;
            link.click();
        }

        function toggleConfigEditor() {
            vscode.postMessage({
                command: 'toggleConfigEditor',
                config: option
            });
        }

        // Listen for configuration updates from the editor
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateChart') {
                try {
                    option = message.config;
                    chart.setOption(option, true);
                } catch (error) {
                    console.error('Failed to update chart:', error);
                }
            }
        });
    </script>
</body>
</html>`;
}

/**
 * Handle chart field request
 */
export async function handleChartFieldExternal(
    fieldName: string,
    results: any[],
    fieldAnalysis: { fields: FieldMetadata[]; totalRecords: number; mode: string }
): Promise<void> {
    return handleChartField(fieldName, results, fieldAnalysis);
}

/**
 * Generate chart configuration dialog HTML
 */
function generateChartConfigDialogHTML(
    fieldName: string,
    chartType: ChartType,
    fieldAnalysis: { fields: FieldMetadata[]; totalRecords: number; mode: string }
): string {
    const timeFields = fieldAnalysis.fields.filter(f => f.isTimeField);
    const numericFields = fieldAnalysis.fields.filter(f => f.dataType === 'number' && !f.isTimeField);
    const allFields = fieldAnalysis.fields;

    // Build options HTML
    const optionsHTML = chartType.configOptions.map(opt => {
        if (opt.id === 'timeField' && timeFields.length > 0) {
            return `
                <div class="form-group">
                    <label for="${opt.id}">${opt.label}</label>
                    ${opt.description ? `<div class="description">${opt.description}</div>` : ''}
                    <select id="${opt.id}" name="${opt.id}">
                        ${timeFields.map(tf => `
                            <option value="${escapeHtml(tf.name)}" ${tf.name === timeFields[0].name ? 'selected' : ''}>
                                ${escapeHtml(tf.name)} (${tf.dataType})
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        } else if (opt.id === 'seriesField' && opt.type === 'field-select') {
            // For series field, show all string fields (or all fields if no string fields)
            let candidateFields = allFields.filter(f => f.dataType === 'string' && !f.isTimeField);
            if (candidateFields.length === 0) {
                candidateFields = allFields.filter(f => !f.isTimeField);
            }

            // Pre-select the clicked field if it's in the list, otherwise first field
            let preSelected = '';
            if (candidateFields.some(f => f.name === fieldName)) {
                preSelected = fieldName;
            } else if (candidateFields.length > 0) {
                preSelected = candidateFields[0].name;
            }

            return `
                <div class="form-group">
                    <label for="${opt.id}">${opt.label}${opt.required ? ' *' : ''}</label>
                    ${opt.description ? `<div class="description">${opt.description}</div>` : ''}
                    <select id="${opt.id}" name="${opt.id}" ${opt.required ? 'required' : ''}>
                        ${candidateFields.length === 0 ? '<option value="">No fields available</option>' : ''}
                        ${candidateFields.map(f => `
                            <option value="${escapeHtml(f.name)}" ${f.name === preSelected ? 'selected' : ''}>
                                ${escapeHtml(f.name)} (${f.distinctCount} distinct)
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        } else if (opt.id === 'valueField' && opt.type === 'field-select') {
            // For value field, show numeric fields AND numeric strings (Sumo Logic often returns aggregated numbers as strings)
            const valueFields = allFields.filter(f =>
                (f.dataType === 'number' || f.isNumericString) && !f.isTimeField
            );

            // Pre-select the clicked field if it's numeric or numeric string, otherwise leave as (None)
            const preSelected = valueFields.some(f => f.name === fieldName) ? fieldName : '';

            return `
                <div class="form-group">
                    <label for="${opt.id}">${opt.label}${opt.required ? ' *' : ''}</label>
                    ${opt.description ? `<div class="description">${opt.description}</div>` : ''}
                    <select id="${opt.id}" name="${opt.id}" ${opt.required ? 'required' : ''}>
                        <option value="" ${preSelected === '' ? 'selected' : ''}>(None - use count)</option>
                        ${valueFields.map(f => `
                            <option value="${escapeHtml(f.name)}" ${f.name === preSelected ? 'selected' : ''}>
                                ${escapeHtml(f.name)} (${f.dataType}${f.isNumericString ? ', numeric' : ''})
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        } else if (opt.id === 'valueFields' && opt.type === 'multi-field-select') {
            // For value fields in timeseries, show numeric fields AND numeric strings (Sumo Logic often returns aggregated numbers as strings)
            const valueFields = allFields.filter(f =>
                (f.dataType === 'number' || f.isNumericString) && !f.isTimeField
            );

            // Check if the clicked field is numeric and should be pre-selected
            const preSelectedField = valueFields.some(f => f.name === fieldName) ? fieldName : '';
            const preSelectedAgg = preSelectedField ? 'sum' : 'count';
            const preSelectedKey = preSelectedField ? `${preSelectedAgg}(${preSelectedField})` : '__count__';
            const preSelectedDisplay = preSelectedField ? `${preSelectedAgg}(${preSelectedField})` : 'count';

            return `
                <div class="form-group">
                    <label for="${opt.id}">${opt.label}${opt.required ? ' *' : ''}</label>
                    ${opt.description ? `<div class="description">${opt.description}</div>` : ''}
                    <div id="${opt.id}_container" class="multi-field-container">
                        <div class="field-item" data-field="${escapeHtml(preSelectedKey)}">
                            <span>${escapeHtml(preSelectedDisplay)}</span>
                            <button type="button" class="remove-field-btn" onclick="removeValueField('${escapeHtml(preSelectedKey).replace(/'/g, "\\'")}')">×</button>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <select id="${opt.id}_aggregation" style="width: 100px;">
                            <option value="sum">sum</option>
                            <option value="avg">avg</option>
                            <option value="min">min</option>
                            <option value="max">max</option>
                            <option value="count">count</option>
                        </select>
                        <select id="${opt.id}_selector" style="flex: 1;">
                            <option value="">-- Select a field to add --</option>
                            <option value="__count__">count (record count)</option>
                            ${valueFields.map(f => `
                                <option value="${escapeHtml(f.name)}">
                                    ${escapeHtml(f.name)} (${f.dataType}${f.isNumericString ? ', numeric' : ''})
                                </option>
                            `).join('')}
                        </select>
                        <button type="button" class="secondary-button" onclick="addValueField()">Add Field</button>
                    </div>
                    <input type="hidden" id="${opt.id}" name="${opt.id}" value="${JSON.stringify([preSelectedKey])}">
                </div>
            `;
        } else if (opt.type === 'select') {
            return `
                <div class="form-group">
                    <label for="${opt.id}">${opt.label}</label>
                    ${opt.description ? `<div class="description">${opt.description}</div>` : ''}
                    <select id="${opt.id}" name="${opt.id}">
                        ${opt.options?.map(option => `
                            <option value="${option.value}" ${option.value === opt.defaultValue ? 'selected' : ''}>
                                ${option.label}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        } else if (opt.type === 'checkbox') {
            return `
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="${opt.id}" name="${opt.id}" ${opt.defaultValue ? 'checked' : ''}>
                        ${opt.label}
                    </label>
                    ${opt.description ? `<div class="description">${opt.description}</div>` : ''}
                </div>
            `;
        } else if (opt.type === 'number') {
            return `
                <div class="form-group">
                    <label for="${opt.id}">${opt.label}</label>
                    ${opt.description ? `<div class="description">${opt.description}</div>` : ''}
                    <input type="number" id="${opt.id}" name="${opt.id}" value="${opt.defaultValue}" min="1">
                </div>
            `;
        } else if (opt.type === 'time-bucket') {
            return `
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="${opt.id}_enabled" name="${opt.id}_enabled">
                        ${opt.label}
                    </label>
                    ${opt.description ? `<div class="description">${opt.description}</div>` : ''}
                    <div id="${opt.id}_settings" class="time-bucket-settings" style="display: none; margin-top: 8px;">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="number" id="${opt.id}_value" name="${opt.id}_value" value="1" min="1" style="width: 80px;">
                            <select id="${opt.id}_unit" name="${opt.id}_unit" style="width: 120px;">
                                <option value="minute">Minute(s)</option>
                                <option value="hour">Hour(s)</option>
                                <option value="day">Day(s)</option>
                                <option value="week">Week(s)</option>
                                <option value="month">Month(s)</option>
                            </select>
                        </div>
                    </div>
                    <input type="hidden" id="${opt.id}" name="${opt.id}" value="">
                </div>
            `;
        } else if (opt.type === 'advanced-settings') {
            return `
                <div class="form-group advanced-settings-group">
                    <button type="button" class="advanced-settings-toggle" onclick="toggleAdvancedSettings()">
                        <span class="toggle-icon">▶</span> ${opt.label}
                    </button>
                    ${opt.description ? `<div class="description">${opt.description}</div>` : ''}
                    <div id="advancedSettingsPanel" class="advanced-settings-panel" style="display: none;">
                        <div class="settings-section">
                            <label>Title Text</label>
                            <input type="text" id="setting_title_text" placeholder="Chart Title">
                        </div>
                        <div class="settings-section">
                            <label>Title Position</label>
                            <select id="setting_title_position">
                                <option value="center">Center</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                            </select>
                        </div>
                        <div class="settings-section">
                            <label>Legend Position</label>
                            <select id="setting_legend_position">
                                <option value="bottom">Bottom</option>
                                <option value="top">Top</option>
                                <option value="left">Left</option>
                                <option value="right" selected>Right</option>
                            </select>
                        </div>
                        <div class="settings-section">
                            <label>Legend Type</label>
                            <select id="setting_legend_type">
                                <option value="plain">Plain</option>
                                <option value="scroll" selected>Scroll</option>
                            </select>
                        </div>
                        <div class="settings-section">
                            <label class="checkbox-label">
                                <input type="checkbox" id="setting_legend_show" checked>
                                Show Legend
                            </label>
                        </div>
                        <div class="settings-section">
                            <label>X-Axis Label</label>
                            <input type="text" id="setting_xaxis_name" placeholder="X-Axis Name">
                        </div>
                        <div class="settings-section">
                            <label>Y-Axis Label</label>
                            <input type="text" id="setting_yaxis_name" placeholder="Y-Axis Name">
                        </div>
                        <div class="settings-section">
                            <label class="checkbox-label">
                                <input type="checkbox" id="setting_xaxis_show" checked>
                                Show X-Axis
                            </label>
                        </div>
                        <div class="settings-section">
                            <label class="checkbox-label">
                                <input type="checkbox" id="setting_yaxis_show" checked>
                                Show Y-Axis
                            </label>
                        </div>
                        <div class="settings-section">
                            <label class="checkbox-label">
                                <input type="checkbox" id="setting_yaxis_log">
                                Y-Axis Log Scale
                            </label>
                        </div>
                        <div class="settings-section">
                            <label>Y-Axis Min Value</label>
                            <input type="number" id="setting_yaxis_min" placeholder="Auto" step="any">
                        </div>
                        <div class="settings-section">
                            <label>Y-Axis Max Value</label>
                            <input type="number" id="setting_yaxis_max" placeholder="Auto" step="any">
                        </div>
                    </div>
                    <input type="hidden" id="${opt.id}" name="${opt.id}" value="{}">
                </div>
            `;
        }
        return '';
    }).join('\n');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configure Chart</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .header {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 18px;
            font-weight: 600;
        }
        .field-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 6px;
        }
        .checkbox-label {
            display: flex;
            align-items: center;
            cursor: pointer;
        }
        .checkbox-label input[type="checkbox"] {
            margin-right: 8px;
        }
        .description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
            margin-bottom: 6px;
        }
        select, input[type="number"] {
            width: 100%;
            padding: 6px 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 13px;
        }
        select:focus, input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        button {
            padding: 8px 16px;
            font-size: 13px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }
        .primary-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .primary-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .secondary-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .secondary-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .advanced-settings-toggle {
            width: 100%;
            padding: 8px 12px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
            text-align: left;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .advanced-settings-toggle:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .toggle-icon {
            display: inline-block;
            transition: transform 0.2s;
        }
        .toggle-icon.expanded {
            transform: rotate(90deg);
        }
        .advanced-settings-panel {
            margin-top: 12px;
            padding: 12px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
        }
        .settings-section {
            margin-bottom: 12px;
        }
        .settings-section:last-child {
            margin-bottom: 0;
        }
        .settings-section label {
            font-size: 12px;
            font-weight: normal;
        }
        .settings-section input[type="text"] {
            width: 100%;
        }
        .multi-field-container {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            min-height: 32px;
            padding: 8px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
        }
        .field-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 3px;
            font-size: 12px;
        }
        .remove-field-btn {
            background: none;
            border: none;
            color: var(--vscode-badge-foreground);
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            padding: 0;
            margin-left: 4px;
        }
        .remove-field-btn:hover {
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Configure ${escapeHtml(chartType.name)}</h1>
        <div class="field-info">
            Field: <strong>${escapeHtml(fieldName)}</strong> |
            Chart Type: ${escapeHtml(chartType.name)}
        </div>
    </div>

    <form id="chartConfigForm">
        ${optionsHTML}
    </form>

    <div class="button-group">
        <button type="button" class="primary-button" onclick="createChart()">Create Chart</button>
        <button type="button" class="primary-button" onclick="viewChart()">View Chart</button>
        <button type="button" class="secondary-button" onclick="cancel()">Cancel</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Initialize time bucket toggle
        document.addEventListener('DOMContentLoaded', function() {
            const timeBucketEnabled = document.getElementById('timeBucket_enabled');
            const timeBucketSettings = document.getElementById('timeBucket_settings');

            if (timeBucketEnabled && timeBucketSettings) {
                timeBucketEnabled.addEventListener('change', function() {
                    timeBucketSettings.style.display = this.checked ? 'block' : 'none';
                });
            }
        });

        function collectTimeBucketSettings() {
            const enabled = document.getElementById('timeBucket_enabled')?.checked || false;
            const value = parseInt(document.getElementById('timeBucket_value')?.value || '1', 10);
            const unit = document.getElementById('timeBucket_unit')?.value || 'minute';

            return {
                enabled: enabled,
                value: value,
                unit: unit
            };
        }

        function addValueField() {
            const selector = document.getElementById('valueFields_selector');
            const aggSelector = document.getElementById('valueFields_aggregation');
            const container = document.getElementById('valueFields_container');
            const hiddenInput = document.getElementById('valueFields');

            if (!selector || !aggSelector || !container || !hiddenInput) return;

            const fieldName = selector.value;
            const aggregation = aggSelector.value;
            if (!fieldName) return;

            // Build the field key based on aggregation and field
            let fieldKey;
            let displayName;

            if (fieldName === '__count__') {
                fieldKey = '__count__';
                displayName = 'count';
            } else {
                fieldKey = aggregation + '(' + fieldName + ')';
                displayName = aggregation + '(' + fieldName + ')';
            }

            // Get current fields
            let currentFields = [];
            try {
                currentFields = JSON.parse(hiddenInput.value || '[]');
            } catch (e) {
                currentFields = [];
            }

            // Check if field already exists
            if (currentFields.includes(fieldKey)) {
                return;
            }

            // Add field
            currentFields.push(fieldKey);
            hiddenInput.value = JSON.stringify(currentFields);

            // Create field item
            const fieldItem = document.createElement('div');
            fieldItem.className = 'field-item';
            fieldItem.setAttribute('data-field', fieldKey);
            fieldItem.innerHTML = \`
                <span>\${displayName}</span>
                <button type="button" class="remove-field-btn" onclick="removeValueField('\${fieldKey.replace(/'/g, "\\\\'")}')">×</button>
            \`;

            container.appendChild(fieldItem);

            // Reset selector
            selector.value = '';
        }

        function removeValueField(fieldName) {
            const container = document.getElementById('valueFields_container');
            const hiddenInput = document.getElementById('valueFields');

            if (!container || !hiddenInput) return;

            // Get current fields
            let currentFields = [];
            try {
                currentFields = JSON.parse(hiddenInput.value || '[]');
            } catch (e) {
                currentFields = [];
            }

            // Remove field
            currentFields = currentFields.filter(f => f !== fieldName);
            hiddenInput.value = JSON.stringify(currentFields);

            // Remove field item from DOM
            const fieldItems = container.querySelectorAll('.field-item');
            fieldItems.forEach(item => {
                if (item.getAttribute('data-field') === fieldName) {
                    item.remove();
                }
            });
        }

        function toggleAdvancedSettings() {
            const panel = document.getElementById('advancedSettingsPanel');
            const icon = document.querySelector('.toggle-icon');
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                icon.classList.add('expanded');
            } else {
                panel.style.display = 'none';
                icon.classList.remove('expanded');
            }
        }

        function collectAdvancedSettings() {
            const settings = {};

            // Title settings
            const titleText = document.getElementById('setting_title_text')?.value;
            const titlePosition = document.getElementById('setting_title_position')?.value;
            if (titleText || titlePosition !== 'center') {
                settings.title = {};
                if (titleText) settings.title.text = titleText;
                if (titlePosition) settings.title.left = titlePosition;
            }

            // Legend settings
            const legendShow = document.getElementById('setting_legend_show')?.checked;
            const legendPosition = document.getElementById('setting_legend_position')?.value;
            const legendType = document.getElementById('setting_legend_type')?.value;
            if (legendShow !== undefined || legendPosition || legendType) {
                settings.legend = {};
                if (legendShow !== undefined) settings.legend.show = legendShow;
                if (legendType) settings.legend.type = legendType;

                // Set position - only set the chosen position
                if (legendPosition) {
                    if (legendPosition === 'left') {
                        settings.legend.orient = 'vertical';
                        settings.legend.left = 0;
                        settings.legend.top = 'middle';
                    } else if (legendPosition === 'right') {
                        settings.legend.orient = 'vertical';
                        settings.legend.right = 0;
                        settings.legend.top = 'middle';
                    } else if (legendPosition === 'top') {
                        settings.legend.top = 0;
                        settings.legend.orient = 'horizontal';
                    } else if (legendPosition === 'bottom') {
                        settings.legend.bottom = 0;
                        settings.legend.orient = 'horizontal';
                    }
                }
            }

            // X-Axis settings
            const xAxisName = document.getElementById('setting_xaxis_name')?.value;
            const xAxisShow = document.getElementById('setting_xaxis_show')?.checked;
            if (xAxisName || xAxisShow !== undefined) {
                settings.xAxis = {};
                if (xAxisName) settings.xAxis.name = xAxisName;
                if (xAxisShow !== undefined) settings.xAxis.show = xAxisShow;
            }

            // Y-Axis settings
            const yAxisName = document.getElementById('setting_yaxis_name')?.value;
            const yAxisShow = document.getElementById('setting_yaxis_show')?.checked;
            const yAxisLog = document.getElementById('setting_yaxis_log')?.checked;
            const yAxisMin = document.getElementById('setting_yaxis_min')?.value;
            const yAxisMax = document.getElementById('setting_yaxis_max')?.value;
            if (yAxisName || yAxisShow !== undefined || yAxisLog || yAxisMin || yAxisMax) {
                settings.yAxis = {};
                if (yAxisName) settings.yAxis.name = yAxisName;
                if (yAxisShow !== undefined) settings.yAxis.show = yAxisShow;
                if (yAxisLog) settings.yAxis.type = 'log';
                if (yAxisMin !== undefined && yAxisMin !== '') settings.yAxis.min = parseFloat(yAxisMin);
                if (yAxisMax !== undefined && yAxisMax !== '') settings.yAxis.max = parseFloat(yAxisMax);
            }

            return settings;
        }

        function createChart() {
            const form = document.getElementById('chartConfigForm');
            const formData = new FormData(form);
            const config = {};

            // Collect all form values
            for (const [key, value] of formData.entries()) {
                const element = document.getElementById(key);
                if (element.type === 'checkbox') {
                    config[key] = element.checked;
                } else if (element.type === 'number') {
                    config[key] = parseInt(value, 10);
                } else if (key === 'advancedSettings') {
                    // Collect advanced settings from the panel
                    config[key] = collectAdvancedSettings();
                } else if (key === 'timeBucket') {
                    // Collect time bucket settings
                    config[key] = collectTimeBucketSettings();
                } else if (key === 'valueFields') {
                    // Parse JSON array for multi-field select
                    try {
                        config[key] = JSON.parse(value || '[]');
                    } catch (e) {
                        config[key] = [];
                    }
                } else {
                    config[key] = value;
                }
            }

            // Send configuration back
            vscode.postMessage({
                command: 'createChart',
                config: config
            });
        }

        function viewChart() {
            const form = document.getElementById('chartConfigForm');
            const formData = new FormData(form);
            const config = {};

            // Collect all form values
            for (const [key, value] of formData.entries()) {
                const element = document.getElementById(key);
                if (element.type === 'checkbox') {
                    config[key] = element.checked;
                } else if (element.type === 'number') {
                    config[key] = parseInt(value, 10);
                } else if (key === 'advancedSettings') {
                    // Collect advanced settings from the panel
                    config[key] = collectAdvancedSettings();
                } else if (key === 'timeBucket') {
                    // Collect time bucket settings
                    config[key] = collectTimeBucketSettings();
                } else if (key === 'valueFields') {
                    // Parse JSON array for multi-field select
                    try {
                        config[key] = JSON.parse(value || '[]');
                    } catch (e) {
                        config[key] = [];
                    }
                } else {
                    config[key] = value;
                }
            }

            // Send configuration back without closing dialog
            vscode.postMessage({
                command: 'viewChart',
                config: config
            });
        }

        function cancel() {
            vscode.postMessage({
                command: 'cancel'
            });
        }

        // Submit on Enter in input fields
        document.querySelectorAll('input').forEach(input => {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    createChart();
                }
            });
        });
    </script>
</body>
</html>`;
}

/**
 * Handle chart field request (internal)
 */
async function handleChartField(
    fieldName: string,
    results: any[],
    fieldAnalysis: { fields: FieldMetadata[]; totalRecords: number; mode: string }
): Promise<void> {
    // Initialize chart registry
    const registry = initializeChartRegistry();

    // Find the field metadata
    const field = fieldAnalysis.fields.find(f => f.name === fieldName);
    if (!field) {
        vscode.window.showErrorMessage(`Field "${fieldName}" not found`);
        return;
    }

    // Get compatible chart types for this field
    const compatibleCharts = registry.getCompatibleChartTypesForField(field, fieldAnalysis.fields);

    if (compatibleCharts.length === 0) {
        vscode.window.showWarningMessage(`No compatible chart types found for field "${fieldName}" (${field.dataType})`);
        return;
    }

    // Let user select chart type first (single quick pick)
    const chartTypeChoice = await vscode.window.showQuickPick(
        compatibleCharts.map(ct => ({
            label: ct.name,
            description: ct.description,
            chartType: ct
        })),
        {
            placeHolder: `Select chart type for field: ${fieldName}`,
            ignoreFocusOut: true
        }
    );

    if (!chartTypeChoice) {
        return;
    }

    const chartType = chartTypeChoice.chartType;

    // Create configuration dialog webview
    const configPanel = vscode.window.createWebviewPanel(
        'chartConfig',
        `Configure ${chartType.name}`,
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: false
        }
    );

    configPanel.webview.html = generateChartConfigDialogHTML(fieldName, chartType, fieldAnalysis);

    // Handle messages from config dialog
    return new Promise<void>((resolve) => {
        configPanel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'cancel') {
                configPanel.dispose();
                resolve();
                return;
            }

            if (message.command === 'createChart') {
                const userConfig = message.config;

                // Build chart configuration
                const config: ChartConfig = {
                    chartTypeId: chartType.id,
                    fields: [fieldName],
                    options: {}
                };

                // Set all options from form
                chartType.configOptions.forEach(opt => {
                    if (userConfig[opt.id] !== undefined) {
                        config.options[opt.id] = userConfig[opt.id];
                    } else {
                        config.options[opt.id] = opt.defaultValue;
                    }
                });

                // Validate configuration
                if (chartType.validate) {
                    const validation = chartType.validate(config, fieldAnalysis.fields);
                    if (!validation.valid) {
                        vscode.window.showErrorMessage(validation.error || 'Invalid chart configuration');
                        configPanel.dispose();
                        resolve();
                        return;
                    }
                }

                // Close config dialog
                configPanel.dispose();

                // Create chart
                const chartPanel = vscode.window.createWebviewPanel(
                    'sumoChart',
                    `Chart: ${fieldName}`,
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );

                const chartData = results.map(r => r.map);
                chartPanel.webview.html = generateChartHTML(config, chartData, fieldAnalysis.fields);

                // Track config editor panel for this chart
                let configEditorPanel: vscode.WebviewPanel | undefined;

                // Handle messages from chart webview
                chartPanel.webview.onDidReceiveMessage(async (message) => {
                    if (message.command === 'toggleConfigEditor') {
                        if (configEditorPanel) {
                            // Close existing editor
                            configEditorPanel.dispose();
                            configEditorPanel = undefined;
                        } else {
                            // Create new config editor panel below the chart
                            configEditorPanel = vscode.window.createWebviewPanel(
                                'chartConfigEditor',
                                `Config: ${fieldName}`,
                                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
                                {
                                    enableScripts: true,
                                    retainContextWhenHidden: true
                                }
                            );

                            configEditorPanel.webview.html = generateConfigEditorHTML(message.config);

                            // Handle messages from config editor
                            configEditorPanel.webview.onDidReceiveMessage((editorMessage) => {
                                if (editorMessage.command === 'runChart') {
                                    // Update the chart with new configuration
                                    chartPanel.webview.postMessage({
                                        command: 'updateChart',
                                        config: editorMessage.config
                                    });
                                }
                            });

                            // Clean up reference when editor is disposed
                            configEditorPanel.onDidDispose(() => {
                                configEditorPanel = undefined;
                            });
                        }
                    }
                });

                // Close config editor when chart is closed
                chartPanel.onDidDispose(() => {
                    if (configEditorPanel) {
                        configEditorPanel.dispose();
                    }
                });

                resolve();
            }

            if (message.command === 'viewChart') {
                const userConfig = message.config;

                // Build chart configuration
                const config: ChartConfig = {
                    chartTypeId: chartType.id,
                    fields: [fieldName],
                    options: {}
                };

                // Set all options from form
                chartType.configOptions.forEach(opt => {
                    if (userConfig[opt.id] !== undefined) {
                        config.options[opt.id] = userConfig[opt.id];
                    } else {
                        config.options[opt.id] = opt.defaultValue;
                    }
                });

                // Validate configuration
                if (chartType.validate) {
                    const validation = chartType.validate(config, fieldAnalysis.fields);
                    if (!validation.valid) {
                        vscode.window.showErrorMessage(validation.error || 'Invalid chart configuration');
                        return;
                    }
                }

                // DO NOT close config dialog - keep it open for further editing

                // Create chart in new window
                const chartPanel = vscode.window.createWebviewPanel(
                    'sumoChart',
                    `Chart: ${fieldName}`,
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );

                const chartData = results.map(r => r.map);
                chartPanel.webview.html = generateChartHTML(config, chartData, fieldAnalysis.fields);

                // Track config editor panel for this chart
                let configEditorPanel: vscode.WebviewPanel | undefined;

                // Handle messages from chart webview
                chartPanel.webview.onDidReceiveMessage(async (message) => {
                    if (message.command === 'toggleConfigEditor') {
                        if (configEditorPanel) {
                            // Close existing editor
                            configEditorPanel.dispose();
                            configEditorPanel = undefined;
                        } else {
                            // Create new config editor panel below the chart
                            configEditorPanel = vscode.window.createWebviewPanel(
                                'chartConfigEditor',
                                `Config: ${fieldName}`,
                                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
                                {
                                    enableScripts: true,
                                    retainContextWhenHidden: true
                                }
                            );

                            configEditorPanel.webview.html = generateConfigEditorHTML(message.config);

                            // Handle messages from config editor
                            configEditorPanel.webview.onDidReceiveMessage((editorMessage) => {
                                if (editorMessage.command === 'runChart') {
                                    // Update the chart with new configuration
                                    chartPanel.webview.postMessage({
                                        command: 'updateChart',
                                        config: editorMessage.config
                                    });
                                }
                            });

                            // Clean up reference when editor is disposed
                            configEditorPanel.onDidDispose(() => {
                                configEditorPanel = undefined;
                            });
                        }
                    }
                });

                // Close config editor when chart is closed
                chartPanel.onDidDispose(() => {
                    if (configEditorPanel) {
                        configEditorPanel.dispose();
                    }
                });

                // Don't resolve - keep the promise open so the config panel stays
            }
        });

        // Handle panel disposal
        configPanel.onDidDispose(() => {
            resolve();
        });
    });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    const div = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return text.replace(/[&<>"']/g, (char) => div[char as keyof typeof div]);
}

/**
 * Command to run the current query
 */
export async function runQueryCommand(context: vscode.ExtensionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    if (editor.document.languageId !== 'sumo') {
        vscode.window.showErrorMessage('Current file is not a Sumo Logic query (.sumo)');
        return;
    }

    // Get client for active profile
    const baseClient = await createClient(context);
    if (!baseClient) {
        vscode.window.showErrorMessage('No credentials configured. Please run "Sumo Logic: Configure Credentials" first.');
        return;
    }

    // Get active profile credentials
    const profileManager = new ProfileManager(context);
    const activeProfile = await profileManager.getActiveProfile();
    if (!activeProfile) {
        vscode.window.showErrorMessage('No active profile found. Please select a profile first.');
        return;
    }

    const credentials = await profileManager.getProfileCredentials(activeProfile.name);
    if (!credentials) {
        vscode.window.showErrorMessage(`No credentials found for profile '${activeProfile.name}'`);
        return;
    }

    const client = new SearchJobClient({
        accessId: credentials.accessId,
        accessKey: credentials.accessKey,
        endpoint: baseClient.getEndpoint()
    });

    // Get query text
    const queryText = editor.document.getText();
    if (!queryText.trim()) {
        vscode.window.showErrorMessage('Query is empty');
        return;
    }

    // Parse metadata from comments
    const metadata = parseQueryMetadata(queryText);
    let cleanedQuery = cleanQuery(queryText);

    // Extract and resolve query parameters
    const queryParams = extractQueryParams(cleanedQuery);
    const paramValues = new Map<string, string>();

    if (queryParams.size > 0) {
        // For each parameter, get value from metadata directive or prompt user
        for (const paramName of queryParams) {
            let paramValue: string | undefined;

            // Check if there's a metadata directive for this param
            if (metadata.params && metadata.params.has(paramName)) {
                paramValue = metadata.params.get(paramName);
            } else {
                // Prompt user for value
                paramValue = await vscode.window.showInputBox({
                    prompt: `Enter value for parameter: {{${paramName}}}`,
                    value: '*',
                    ignoreFocusOut: true
                });

                if (paramValue === undefined) {
                    return; // User cancelled
                }
            }

            paramValues.set(paramName, paramValue!);
        }

        // Substitute parameters in query
        cleanedQuery = substituteParams(cleanedQuery, paramValues);
    }

    // Prompt for time range if not specified
    let from = metadata.from;
    let to = metadata.to;

    if (!from) {
        from = await vscode.window.showInputBox({
            prompt: 'Enter start time (e.g., -1h, -30m, -1d, or ISO timestamp)',
            value: '-1h',
            ignoreFocusOut: true
        });

        if (!from) {
            return; // User cancelled
        }
    }

    if (!to) {
        to = await vscode.window.showInputBox({
            prompt: 'Enter end time (e.g., now, -30m, or ISO timestamp)',
            value: 'now',
            ignoreFocusOut: true
        });

        if (!to) {
            return; // User cancelled
        }
    }

    // Parse relative times
    const fromTime = SearchJobClient.parseRelativeTime(from);
    const toTime = SearchJobClient.parseRelativeTime(to);

    // Determine mode: explicit from metadata, user choice, or auto-detect
    let mode: 'records' | 'messages' = metadata.mode || 'records';

    // If no explicit mode and query doesn't look like aggregation, prompt user
    if (!metadata.mode && !isAggregationQuery(cleanedQuery)) {
        const modeChoice = await vscode.window.showQuickPick(
            [
                { label: 'Messages (Raw Events)', value: 'messages', description: 'Return raw log messages' },
                { label: 'Records (Aggregated)', value: 'records', description: 'Return aggregated results' }
            ],
            {
                placeHolder: 'This appears to be a raw search. Select result type:',
                ignoreFocusOut: true
            }
        );

        if (!modeChoice) {
            return; // User cancelled
        }
        mode = modeChoice.value as 'records' | 'messages';
    }

    // Determine output format: explicit from metadata or prompt user
    let outputFormat: 'table' | 'json' | 'csv' | 'webview' = metadata.output || 'webview';

    // If no explicit output format, prompt user
    if (!metadata.output) {
        const formatOptions = mode === 'records'
            ? [
                { label: 'Webview', value: 'webview', description: 'Interactive HTML table view' },
                { label: 'Table', value: 'table', description: 'Text table (file)' },
                { label: 'JSON', value: 'json', description: 'JSON format (file)' },
                { label: 'CSV', value: 'csv', description: 'CSV format (file, records only)' }
              ]
            : [
                { label: 'Webview', value: 'webview', description: 'Interactive HTML table view' },
                { label: 'Table', value: 'table', description: 'Text table (file)' },
                { label: 'JSON', value: 'json', description: 'JSON format (file)' }
              ];

        const formatChoice = await vscode.window.showQuickPick(formatOptions, {
            placeHolder: 'Select output format:',
            ignoreFocusOut: true
        });

        if (!formatChoice) {
            return; // User cancelled
        }
        outputFormat = formatChoice.value as 'table' | 'json' | 'csv' | 'webview';
    } else {
        // Validate that CSV is only used with records mode
        if (outputFormat === 'csv' && mode === 'messages') {
            vscode.window.showWarningMessage('CSV format is only available for records mode. Using table format instead.');
            outputFormat = 'table';
        }
    }

    const request: SearchJobRequest = {
        query: cleanedQuery,
        from: fromTime,
        to: toTime,
        timeZone: metadata.timeZone || 'UTC',
        byReceiptTime: metadata.byReceiptTime,
        autoParsingMode: metadata.autoParsingMode
    };

    // Execute search with progress
    let jobId: string | undefined;
    const startTime = Date.now();
    let finalJobStats: any;
    const debugMode = metadata.debug || false;

    // Create debug output channel if debug mode is enabled
    let debugChannel: vscode.OutputChannel | undefined;
    if (debugMode) {
        debugChannel = vscode.window.createOutputChannel('Sumo Logic Query Debug');
        debugChannel.show(true); // Show but don't focus
        debugChannel.appendLine('=== Sumo Logic Query Debug Log ===');
        debugChannel.appendLine(`Time: ${new Date().toISOString()}`);
        debugChannel.appendLine('');

        // Get active profile name for debug output
        const profileManager = new ProfileManager(context);
        const activeProfile = await profileManager.getActiveProfile();
        const profileName = activeProfile?.name || 'unknown';

        debugChannel.appendLine(`Profile: ${profileName}`);
        debugChannel.appendLine(`Endpoint: ${client.getEndpoint()}`);
        debugChannel.appendLine(`Mode: ${mode}`);
        debugChannel.appendLine(`Output Format: ${outputFormat}`);
        debugChannel.appendLine('');
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Running Sumo Logic query...',
        cancellable: false
    }, async (progress) => {
        progress.report({ message: 'Creating search job...' });

        if (debugChannel) {
            debugChannel.appendLine('--- Request Payload ---');
            debugChannel.appendLine(JSON.stringify(request, null, 2));
            debugChannel.appendLine('');
        }

        // Create job
        const createResponse = await client.createSearchJob(request);
        if (createResponse.error || !createResponse.data) {
            if (debugChannel) {
                debugChannel.appendLine('--- Create Job Error ---');
                debugChannel.appendLine(`Error: ${createResponse.error}`);
                debugChannel.appendLine(`Status Code: ${createResponse.statusCode}`);
                debugChannel.appendLine('');
            }
            vscode.window.showErrorMessage(`Failed to create search job: ${createResponse.error}`);
            return;
        }

        jobId = createResponse.data.id;
        progress.report({ message: `Job created: ${jobId}` });

        if (debugChannel) {
            debugChannel.appendLine('--- Job Created ---');
            debugChannel.appendLine(`Job ID: ${jobId}`);
            debugChannel.appendLine(`Job Link: ${JSON.stringify(createResponse.data.link)}`);
            debugChannel.appendLine('');
        }

        // Poll for completion
        if (debugChannel) {
            debugChannel.appendLine('--- Polling for Completion ---');
        }

        const pollResponse = await client.pollForCompletion(jobId, (status: SearchJobStatus) => {
            finalJobStats = status;
            progress.report({
                message: `State: ${status.state}, Records: ${status.recordCount}, Messages: ${status.messageCount}`
            });
            if (debugChannel) {
                debugChannel.appendLine(`Status: ${status.state}`);
                debugChannel.appendLine(`  Records: ${status.recordCount}`);
                debugChannel.appendLine(`  Messages: ${status.messageCount}`);
                if (status.pendingErrors.length > 0) {
                    debugChannel.appendLine(`  Errors: ${JSON.stringify(status.pendingErrors)}`);
                }
                if (status.pendingWarnings.length > 0) {
                    debugChannel.appendLine(`  Warnings: ${JSON.stringify(status.pendingWarnings)}`);
                }
            }
        });

        if (pollResponse.error) {
            if (debugChannel) {
                debugChannel.appendLine('');
                debugChannel.appendLine('--- Poll Error ---');
                debugChannel.appendLine(`Error: ${pollResponse.error}`);
                debugChannel.appendLine('');
            }
            vscode.window.showErrorMessage(`Search job failed: ${pollResponse.error}`);
            return;
        }

        if (debugChannel && pollResponse.data) {
            debugChannel.appendLine('');
            debugChannel.appendLine('--- Final Job Status ---');
            debugChannel.appendLine(`State: ${pollResponse.data.state}`);
            debugChannel.appendLine(`Record Count: ${pollResponse.data.recordCount}`);
            debugChannel.appendLine(`Message Count: ${pollResponse.data.messageCount}`);
            debugChannel.appendLine('');
        }

        progress.report({ message: 'Fetching results...' });

        // Fetch results based on mode
        let results: any[];
        let resultCount: number;

        if (mode === 'messages') {
            if (debugChannel) {
                debugChannel.appendLine('--- Fetching Messages ---');
                debugChannel.appendLine(`Job ID: ${jobId}`);
            }
            const messagesResponse = await client.getMessages(jobId);
            if (messagesResponse.error || !messagesResponse.data) {
                if (debugChannel) {
                    debugChannel.appendLine('');
                    debugChannel.appendLine('--- Get Messages Error ---');
                    debugChannel.appendLine(`Error: ${messagesResponse.error}`);
                    debugChannel.appendLine(`Status Code: ${messagesResponse.statusCode}`);
                    debugChannel.appendLine('');
                }
                vscode.window.showErrorMessage(`Failed to fetch messages: ${messagesResponse.error}`);
                await client.deleteSearchJob(jobId);
                return;
            }
            results = messagesResponse.data.messages;
            resultCount = results.length;
            if (debugChannel) {
                debugChannel.appendLine(`Retrieved: ${resultCount} messages`);
                debugChannel.appendLine('');
            }
        } else {
            if (debugChannel) {
                debugChannel.appendLine('--- Fetching Records ---');
                debugChannel.appendLine(`Job ID: ${jobId}`);
            }
            const recordsResponse = await client.getRecords(jobId);
            if (recordsResponse.error || !recordsResponse.data) {
                if (debugChannel) {
                    debugChannel.appendLine('');
                    debugChannel.appendLine('--- Get Records Error ---');
                    debugChannel.appendLine(`Error: ${recordsResponse.error}`);
                    debugChannel.appendLine(`Status Code: ${recordsResponse.statusCode}`);
                    debugChannel.appendLine('');
                }
                vscode.window.showErrorMessage(`Failed to fetch records: ${recordsResponse.error}`);
                await client.deleteSearchJob(jobId);
                return;
            }
            results = recordsResponse.data.records;
            resultCount = results.length;
            if (debugChannel) {
                debugChannel.appendLine(`Retrieved: ${resultCount} records`);
                debugChannel.appendLine('');
            }
        }

        // Clean up job
        await client.deleteSearchJob(jobId);
        if (debugChannel) {
            debugChannel.appendLine('--- Cleanup ---');
            debugChannel.appendLine(`Job ${jobId} deleted`);
            debugChannel.appendLine('');
        }

        // Display results
        if (results.length === 0) {
            if (debugChannel) {
                debugChannel.appendLine('=== NO RESULTS ===');
                debugChannel.appendLine('Final job stats:');
                debugChannel.appendLine(JSON.stringify(finalJobStats, null, 2));
                debugChannel.appendLine('');
            }
            vscode.window.showInformationMessage('Query completed: No results found');
            return;
        }

        if (debugChannel) {
            debugChannel.appendLine('=== SUCCESS ===');
            debugChannel.appendLine(`Total results: ${results.length}`);
            debugChannel.appendLine('');
        }

        // Update status bar with last query time
        const { getStatusBarManager } = await import('../extension');
        const statusBar = getStatusBarManager();
        if (statusBar) {
            statusBar.setLastQueryTime(new Date());
            statusBar.setConnectionStatus('connected');
        }

        // Add discovered fields to autocomplete
        const dynamicProvider = getDynamicCompletionProvider();
        if (dynamicProvider) {
            dynamicProvider.addFieldsFromResults(results);
            const fieldCount = dynamicProvider.getFieldCount();
            console.log(`Dynamic autocomplete now has ${fieldCount} discovered fields`);
        }

        // Handle webview output separately
        if (outputFormat === 'webview') {
            // Save JSON file to queries subfolder
            const outputWriter = new OutputWriter(context);
            const queryIdentifier = metadata.name || cleanedQuery.split('\n')[0].substring(0, 50);
            const filename = `query_${queryIdentifier}_${mode}_${from}_to_${to}`;
            let jsonFilePath: string | undefined;

            try {
                const jsonContent = formatResultsAsJSON(results);
                jsonFilePath = await outputWriter.writeOutput('queries', filename, jsonContent, 'json');
            } catch (error) {
                console.error('Failed to write JSON file:', error);
            }

            const panel = vscode.window.createWebviewPanel(
                'sumoQueryResults',
                `Query Results: ${metadata.name || cleanedQuery.split('\n')[0].substring(0, 30)}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            // Get page size from settings
            const config = vscode.workspace.getConfiguration('sumologic');
            const pageSize = config.get<number>('webviewPageSize') || 200;
            const executionTime = Date.now() - startTime;

            // Analyze fields for charting
            const fieldAnalysis = FieldAnalyzer.analyze(results, mode);

            const htmlContent = formatRecordsAsHTML(results, {
                query: cleanedQuery,
                from: from,
                to: to,
                mode: mode,
                count: resultCount,
                pageSize: pageSize,
                executionTime: executionTime,
                jobStats: finalJobStats,
                jsonFilePath: jsonFilePath
            });

            panel.webview.html = htmlContent;

            // Handle messages from webview
            panel.webview.onDidReceiveMessage(
                async (message) => {
                    const fs = await import('fs');
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    const defaultUri = workspaceFolder
                        ? vscode.Uri.file(workspaceFolder.uri.fsPath)
                        : undefined;

                    if (message.command === 'exportCSV') {
                        // Prompt user for save location
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
                        // Prompt user for save location
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
                        // Show field values in a modal
                        const fieldName = message.fieldName;
                        // Get more values for better distribution visibility
                        const distribution = FieldAnalyzer.getValueDistribution(fieldName, results, 1000);

                        // Create a new webview panel for field values
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
                        // Show chart configuration and create chart
                        const fieldName = message.fieldName;
                        await handleChartField(fieldName, results, fieldAnalysis);
                    }
                },
                undefined,
                context.subscriptions
            );

            vscode.window.showInformationMessage(`Query completed: ${resultCount} ${mode} found (webview)${jsonFilePath ? ` - JSON saved to ${jsonFilePath}` : ''}`);
        } else {
            // Format results based on selected format for file output
            let resultText: string;
            let fileExtension: string;

            switch (outputFormat) {
                case 'json':
                    resultText = formatResultsAsJSON(results);
                    fileExtension = 'json';
                    break;
                case 'csv':
                    resultText = formatRecordsAsCSV(results);
                    fileExtension = 'csv';
                    break;
                case 'table':
                default:
                    resultText = `Sumo Logic Query Results (${mode} - ${outputFormat})\n` +
                                 `====================================\n` +
                                 `Query: ${cleanedQuery.split('\n')[0]}...\n` +
                                 `From: ${from} (${fromTime})\n` +
                                 `To: ${to} (${toTime})\n` +
                                 `Results: ${resultCount} ${mode}\n` +
                                 `\n` +
                                 formatRecordsAsTable(results);
                    fileExtension = 'txt';
                    break;
            }

            // Write results to file
            const outputWriter = new OutputWriter(context);
            const queryIdentifier = metadata.name || cleanedQuery.split('\n')[0].substring(0, 50);
            const filename = `query_${queryIdentifier}_${mode}_${from}_to_${to}`;

            try {
                const filePath = await outputWriter.writeAndOpen('queries', filename, resultText, fileExtension);

                // Track the result file in recent results
                const explorerProvider = getSumoExplorerProvider();
                if (explorerProvider && filePath) {
                    const recentResultsManager = explorerProvider.getRecentResultsManager();
                    recentResultsManager.addResult(filePath);
                }

                // Also save JSON file for table output
                let jsonFilePath: string | undefined;
                if (outputFormat === 'table') {
                    try {
                        const jsonContent = formatResultsAsJSON(results);
                        jsonFilePath = await outputWriter.writeOutput('queries', filename, jsonContent, 'json');

                        // Track JSON file as well
                        if (explorerProvider && jsonFilePath) {
                            const recentResultsManager = explorerProvider.getRecentResultsManager();
                            recentResultsManager.addResult(jsonFilePath);
                        }
                    } catch (error) {
                        console.error('Failed to write JSON file:', error);
                    }
                }

                // Refresh explorer to show new results
                if (explorerProvider) {
                    explorerProvider.refresh();
                }

                vscode.window.showInformationMessage(`Query completed: ${resultCount} ${mode} found (${outputFormat} format)${jsonFilePath ? ` - JSON saved to ${jsonFilePath}` : ''}`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to write results: ${error}`);
            }
        }
    });
}

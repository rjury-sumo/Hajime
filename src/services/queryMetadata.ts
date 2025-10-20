/**
 * Shared utilities for parsing query metadata and handling parameters
 * Used by all query execution commands to ensure consistent behavior
 */

export interface QueryMetadata {
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
}

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
export function parseQueryMetadata(queryText: string): QueryMetadata {
    const metadata: QueryMetadata = {};

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
export function cleanQuery(queryText: string): string {
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
export function extractQueryParams(queryText: string): Set<string> {
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
export function substituteParams(queryText: string, paramValues: Map<string, string>): string {
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
export function isAggregationQuery(query: string): boolean {
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

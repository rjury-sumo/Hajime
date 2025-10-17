import * as assert from 'assert';

/**
 * Tests for query metadata parsing
 * These functions are exported from runQuery.ts for testing
 */

/**
 * Parse query metadata from comments
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
        return !trimmed.match(/^\/\/\s*@(name|from|to|timezone|mode|output|byReceiptTime|autoParsingMode|param)\s+/i);
    });
    return cleanedLines.join('\n').trim();
}

/**
 * Extract parameter placeholders from query text
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
 */
function substituteParams(queryText: string, params: Map<string, string>): string {
    let result = queryText;
    params.forEach((value, key) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(regex, value);
    });
    return result;
}

suite('Query Metadata Parsing Test Suite', () => {
    test('should parse query name from @name directive', () => {
        const query = `// @name My Test Query
_sourceCategory=prod | count`;

        const metadata = parseQueryMetadata(query);

        assert.strictEqual(metadata.name, 'My Test Query');
    });

    test('should parse time range from @from and @to directives', () => {
        const query = `// @from -7d
// @to now
_sourceCategory=prod | count`;

        const metadata = parseQueryMetadata(query);

        assert.strictEqual(metadata.from, '-7d');
        assert.strictEqual(metadata.to, 'now');
    });

    test('should parse timezone from @timezone directive', () => {
        const query = `// @timezone America/New_York
_sourceCategory=prod | count`;

        const metadata = parseQueryMetadata(query);

        assert.strictEqual(metadata.timeZone, 'America/New_York');
    });

    test('should parse mode from @mode directive', () => {
        const query = `// @mode messages
_sourceCategory=prod`;

        const metadata = parseQueryMetadata(query);

        assert.strictEqual(metadata.mode, 'messages');
    });

    test('should parse output format from @output directive', () => {
        const query = `// @output json
_sourceCategory=prod | count`;

        const metadata = parseQueryMetadata(query);

        assert.strictEqual(metadata.output, 'json');
    });

    test('should parse byReceiptTime from @byReceiptTime directive', () => {
        const query = `// @byReceiptTime true
_sourceCategory=prod | count`;

        const metadata = parseQueryMetadata(query);

        assert.strictEqual(metadata.byReceiptTime, true);
    });

    test('should parse autoParsingMode from @autoParsingMode directive', () => {
        const query = `// @autoParsingMode AutoParse
_sourceCategory=prod | count`;

        const metadata = parseQueryMetadata(query);

        assert.strictEqual(metadata.autoParsingMode, 'AutoParse');
    });

    test('should parse multiple parameters from @param directives', () => {
        const query = `// @param type=copilot
// @param user_name=admin
// @param limit=100
_sourceCategory=prod | where type="{{type}}"`;

        const metadata = parseQueryMetadata(query);

        assert.ok(metadata.params);
        assert.strictEqual(metadata.params!.get('type'), 'copilot');
        assert.strictEqual(metadata.params!.get('user_name'), 'admin');
        assert.strictEqual(metadata.params!.get('limit'), '100');
    });

    test('should parse complete query with all metadata directives', () => {
        const query = `// @name Complete Test Query
// @from -24h
// @to now
// @timezone UTC
// @mode records
// @output webview
// @byReceiptTime false
// @autoParsingMode Manual
// @param env=production

_sourceCategory={{env}}/application error
| count by _sourceHost`;

        const metadata = parseQueryMetadata(query);

        assert.strictEqual(metadata.name, 'Complete Test Query');
        assert.strictEqual(metadata.from, '-24h');
        assert.strictEqual(metadata.to, 'now');
        assert.strictEqual(metadata.timeZone, 'UTC');
        assert.strictEqual(metadata.mode, 'records');
        assert.strictEqual(metadata.output, 'webview');
        assert.strictEqual(metadata.byReceiptTime, false);
        assert.strictEqual(metadata.autoParsingMode, 'Manual');
        assert.ok(metadata.params);
        assert.strictEqual(metadata.params!.get('env'), 'production');
    });

    test('should handle query with no metadata directives', () => {
        const query = `_sourceCategory=prod | count`;

        const metadata = parseQueryMetadata(query);

        assert.strictEqual(metadata.name, undefined);
        assert.strictEqual(metadata.from, undefined);
        assert.strictEqual(metadata.to, undefined);
        assert.strictEqual(metadata.params, undefined);
    });

    test('should ignore regular comments', () => {
        const query = `// This is a regular comment
// @name Test Query
// Another regular comment
_sourceCategory=prod | count`;

        const metadata = parseQueryMetadata(query);

        assert.strictEqual(metadata.name, 'Test Query');
    });

    test('should handle case-insensitive directives', () => {
        const query = `// @NAME Test Query
// @FROM -1h
// @OUTPUT table`;

        const metadata = parseQueryMetadata(query);

        assert.strictEqual(metadata.name, 'Test Query');
        assert.strictEqual(metadata.from, '-1h');
        assert.strictEqual(metadata.output, 'table');
    });
});

suite('Query Cleaning Test Suite', () => {
    test('should remove metadata directives from query', () => {
        const query = `// @name Test Query
// @from -1h
// @to now
_sourceCategory=prod | count`;

        const cleaned = cleanQuery(query);

        assert.strictEqual(cleaned, '_sourceCategory=prod | count');
    });

    test('should keep regular comments', () => {
        const query = `// This is a regular comment
// @name Test Query
_sourceCategory=prod | count
// Another comment`;

        const cleaned = cleanQuery(query);

        assert.ok(cleaned.includes('// This is a regular comment'));
        assert.ok(cleaned.includes('// Another comment'));
        assert.ok(!cleaned.includes('@name'));
    });

    test('should handle query with no metadata', () => {
        const query = `_sourceCategory=prod | count`;

        const cleaned = cleanQuery(query);

        assert.strictEqual(cleaned, '_sourceCategory=prod | count');
    });

    test('should preserve multi-line queries', () => {
        const query = `// @name Test
_sourceCategory=prod
| parse "status=*" as status
| count by status`;

        const cleaned = cleanQuery(query);
        const lines = cleaned.split('\n');

        assert.strictEqual(lines.length, 3);
        assert.ok(cleaned.includes('_sourceCategory=prod'));
        assert.ok(cleaned.includes('| parse'));
        assert.ok(cleaned.includes('| count'));
    });
});

suite('Parameter Extraction Test Suite', () => {
    test('should extract single parameter placeholder', () => {
        const query = `_sourceCategory={{env}} | count`;

        const params = extractQueryParams(query);

        assert.strictEqual(params.size, 1);
        assert.ok(params.has('env'));
    });

    test('should extract multiple parameter placeholders', () => {
        const query = `_sourceCategory={{env}}/{{app}}
| where user_name="{{user}}"
| where status={{status}}`;

        const params = extractQueryParams(query);

        assert.strictEqual(params.size, 4);
        assert.ok(params.has('env'));
        assert.ok(params.has('app'));
        assert.ok(params.has('user'));
        assert.ok(params.has('status'));
    });

    test('should handle query with no parameters', () => {
        const query = `_sourceCategory=prod | count`;

        const params = extractQueryParams(query);

        assert.strictEqual(params.size, 0);
    });

    test('should extract duplicate parameters only once', () => {
        const query = `_sourceCategory={{env}}
| where field1="{{env}}"
| where field2="{{env}}"`;

        const params = extractQueryParams(query);

        assert.strictEqual(params.size, 1);
        assert.ok(params.has('env'));
    });

    test('should handle parameters with underscores and numbers', () => {
        const query = `where field_1="{{param_name_1}}" and field2="{{param2}}"`;

        const params = extractQueryParams(query);

        assert.strictEqual(params.size, 2);
        assert.ok(params.has('param_name_1'));
        assert.ok(params.has('param2'));
    });
});

suite('Parameter Substitution Test Suite', () => {
    test('should substitute single parameter', () => {
        const query = `_sourceCategory={{env}} | count`;
        const params = new Map([['env', 'production']]);

        const result = substituteParams(query, params);

        assert.strictEqual(result, '_sourceCategory=production | count');
    });

    test('should substitute multiple parameters', () => {
        const query = `_sourceCategory={{env}}/{{app}}
| where user="{{user}}"`;
        const params = new Map([
            ['env', 'production'],
            ['app', 'web'],
            ['user', 'admin']
        ]);

        const result = substituteParams(query, params);

        assert.ok(result.includes('_sourceCategory=production/web'));
        assert.ok(result.includes('where user="admin"'));
    });

    test('should substitute duplicate parameters', () => {
        const query = `_sourceCategory={{env}} | where field="{{env}}"`;
        const params = new Map([['env', 'staging']]);

        const result = substituteParams(query, params);

        assert.strictEqual(result, '_sourceCategory=staging | where field="staging"');
    });

    test('should leave unmatched placeholders unchanged', () => {
        const query = `_sourceCategory={{env}} | where user="{{user}}"`;
        const params = new Map([['env', 'production']]);

        const result = substituteParams(query, params);

        assert.ok(result.includes('_sourceCategory=production'));
        assert.ok(result.includes('{{user}}'));
    });

    test('should handle empty params map', () => {
        const query = `_sourceCategory={{env}} | count`;
        const params = new Map<string, string>();

        const result = substituteParams(query, params);

        assert.strictEqual(result, query);
    });

    test('should handle special characters in values', () => {
        const query = `_sourceCategory={{category}}`;
        const params = new Map([['category', 'prod/app/*']]);

        const result = substituteParams(query, params);

        assert.strictEqual(result, '_sourceCategory=prod/app/*');
    });
});

suite('Query Metadata Integration Tests', () => {
    test('should parse, clean, and substitute complete query', () => {
        const originalQuery = `// @name Production Error Analysis
// @from -24h
// @to now
// @param env=production
// @param severity=error

_sourceCategory={{env}}/application
| where severity="{{severity}}"
| count by _sourceHost`;

        // Parse metadata
        const metadata = parseQueryMetadata(originalQuery);
        assert.strictEqual(metadata.name, 'Production Error Analysis');
        assert.ok(metadata.params);

        // Clean query
        const cleanedQuery = cleanQuery(originalQuery);
        assert.ok(!cleanedQuery.includes('@name'));
        assert.ok(!cleanedQuery.includes('@param'));

        // Extract params
        const params = extractQueryParams(cleanedQuery);
        assert.strictEqual(params.size, 2);

        // Substitute params
        const finalQuery = substituteParams(cleanedQuery, metadata.params!);
        assert.ok(finalQuery.includes('_sourceCategory=production/application'));
        assert.ok(finalQuery.includes('where severity="error"'));
    });

    test('should handle absolute time ranges', () => {
        const query = `// @from 2024-01-01T00:00:00
// @to 2024-01-02T00:00:00
_sourceCategory=prod | count`;

        const metadata = parseQueryMetadata(query);

        assert.strictEqual(metadata.from, '2024-01-01T00:00:00');
        assert.strictEqual(metadata.to, '2024-01-02T00:00:00');
    });

    test('should handle mixed relative and absolute times', () => {
        const query = `// @from -1d
// @to 2024-01-15T23:59:59
_sourceCategory=prod | count`;

        const metadata = parseQueryMetadata(query);

        assert.strictEqual(metadata.from, '-1d');
        assert.strictEqual(metadata.to, '2024-01-15T23:59:59');
    });
});

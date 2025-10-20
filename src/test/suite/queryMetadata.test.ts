import * as assert from 'assert';
import {
    parseQueryMetadata,
    cleanQuery,
    extractQueryParams,
    substituteParams,
    isAggregationQuery
} from '../../services/queryMetadata';

/**
 * Tests for query metadata parsing
 * Tests the shared query metadata module used by all query execution commands
 */

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

suite('Aggregation Query Detection Test Suite', () => {
    test('should detect count aggregation', () => {
        const query = `_sourceCategory=* | count`;
        assert.strictEqual(isAggregationQuery(query), true);
    });

    test('should detect sum aggregation', () => {
        const query = `_sourceCategory=* | sum(_size) as total_bytes`;
        assert.strictEqual(isAggregationQuery(query), true);
    });

    test('should detect multiple aggregations', () => {
        const query = `_sourceCategory=* | count by _sourceHost | avg(count)`;
        assert.strictEqual(isAggregationQuery(query), true);
    });

    test('should detect timeslice aggregation', () => {
        const query = `_sourceCategory=* | timeslice 1m | count by _timeslice`;
        assert.strictEqual(isAggregationQuery(query), true);
    });

    test('should not detect aggregation in raw search', () => {
        const query = `_sourceCategory=* | where status=500`;
        assert.strictEqual(isAggregationQuery(query), false);
    });

    test('should handle aggregation without spaces', () => {
        const query = `_sourceCategory=*|count`;
        assert.strictEqual(isAggregationQuery(query), true);
    });

    test('should detect count_distinct', () => {
        const query = `_sourceCategory=* | count_distinct(user_id)`;
        assert.strictEqual(isAggregationQuery(query), true);
    });

    test('should be case-insensitive', () => {
        const query = `_sourceCategory=* | COUNT by status`;
        assert.strictEqual(isAggregationQuery(query), true);
    });
});

suite('Query Metadata Debug Directive Tests', () => {
    test('should parse debug directive as true', () => {
        const query = `// @debug true
_sourceCategory=* | count`;
        const metadata = parseQueryMetadata(query);
        assert.strictEqual(metadata.debug, true);
    });

    test('should parse debug directive as false', () => {
        const query = `// @debug false
_sourceCategory=* | count`;
        const metadata = parseQueryMetadata(query);
        assert.strictEqual(metadata.debug, false);
    });

    test('should handle case-insensitive debug values', () => {
        const query = `// @debug TRUE
_sourceCategory=* | count`;
        const metadata = parseQueryMetadata(query);
        assert.strictEqual(metadata.debug, true);
    });
});

suite('Parameter Edge Cases Tests', () => {
    test('should handle parameters with special regex characters in values', () => {
        const query = `_sourceCategory={{category}}`;
        const params = new Map([['category', 'prod/app*[test]']]);
        const result = substituteParams(query, params);
        assert.strictEqual(result, '_sourceCategory=prod/app*[test]');
    });

    test('should handle empty parameter values', () => {
        const query = `_sourceCategory={{category}}`;
        const params = new Map([['category', '']]);
        const result = substituteParams(query, params);
        assert.strictEqual(result, '_sourceCategory=');
    });

    test('should handle parameter values with quotes', () => {
        const query = `where field="{{value}}"`;
        const params = new Map([['value', 'test "quoted" value']]);
        const result = substituteParams(query, params);
        assert.strictEqual(result, 'where field="test "quoted" value"');
    });

    test('should handle whitespace in parameter names', () => {
        const query = `{{ param }}`;
        const params = extractQueryParams(query);
        // Should not match due to spaces
        assert.strictEqual(params.size, 0);
    });

    test('should extract parameters from metadata comments', () => {
        const query = `// @param category=production/logs
// @param time_range=-24h
_sourceCategory={{category}}`;

        const metadata = parseQueryMetadata(query);
        assert.ok(metadata.params);
        assert.strictEqual(metadata.params!.get('category'), 'production/logs');
        assert.strictEqual(metadata.params!.get('time_range'), '-24h');
    });
});

suite('Real-World Query Tests', () => {
    test('should handle production analytics query with params', () => {
        const query = `// @name Source Category Analysis
// @from -24h
// @to now
// @param category=*
// @mode records
// @output webview

_sourcecategory = {{category}}
| sum(_size) as bytes, count by _sourcecategory, _sourcehost, _collector`;

        const metadata = parseQueryMetadata(query);
        assert.strictEqual(metadata.name, 'Source Category Analysis');
        assert.strictEqual(metadata.from, '-24h');
        assert.strictEqual(metadata.to, 'now');
        assert.strictEqual(metadata.mode, 'records');
        assert.strictEqual(metadata.output, 'webview');
        assert.ok(metadata.params);
        assert.strictEqual(metadata.params!.get('category'), '*');

        const cleanedQuery = cleanQuery(query);
        assert.ok(!cleanedQuery.includes('@name'));
        assert.ok(cleanedQuery.includes('_sourcecategory'));

        const params = extractQueryParams(cleanedQuery);
        assert.strictEqual(params.size, 1);
        assert.ok(params.has('category'));

        const finalQuery = substituteParams(cleanedQuery, metadata.params!);
        assert.ok(finalQuery.includes('_sourcecategory = *'));
    });

    test('should handle error analysis query with multiple params', () => {
        const query = `// @name Error Analysis
// @from -1h
// @to now
// @param env=production
// @param severity=error
// @param app=webapp

_sourceCategory={{env}}/{{app}}
| where severity="{{severity}}"
| parse "error=*" as error_msg
| count by error_msg, _sourceHost`;

        const metadata = parseQueryMetadata(query);
        assert.strictEqual(metadata.params!.size, 3);

        const cleanedQuery = cleanQuery(query);
        const params = extractQueryParams(cleanedQuery);
        assert.strictEqual(params.size, 3);

        const finalQuery = substituteParams(cleanedQuery, metadata.params!);
        assert.ok(finalQuery.includes('_sourceCategory=production/webapp'));
        assert.ok(finalQuery.includes('where severity="error"'));
    });

    test('should handle raw message search without aggregation', () => {
        const query = `// @name Raw Error Logs
// @from -15m
// @to now
// @mode messages
// @output webview

error OR exception
| fields _raw, _messagetime, _sourcehost`;

        const metadata = parseQueryMetadata(query);
        assert.strictEqual(metadata.mode, 'messages');
        assert.strictEqual(metadata.output, 'webview');

        const cleanedQuery = cleanQuery(query);
        assert.strictEqual(isAggregationQuery(cleanedQuery), false);
    });
});

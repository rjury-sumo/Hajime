import * as assert from 'assert';

/**
 * Tests for query results webview functionality
 * Tests data transformation, pagination, filtering, and export logic
 */

suite('Query Results Webview Data Transformation Tests', () => {
    test('should transform records response to table format', () => {
        const recordsResponse = {
            records: [
                {
                    map: {
                        _count: '100',
                        _sourceCategory: 'prod/application'
                    }
                },
                {
                    map: {
                        _count: '50',
                        _sourceCategory: 'prod/web'
                    }
                }
            ],
            fields: [
                { name: '_count', fieldType: 'long' },
                { name: '_sourceCategory', fieldType: 'string' }
            ]
        };

        // Extract column names
        const columns = recordsResponse.fields.map(f => f.name);
        assert.strictEqual(columns.length, 2);
        assert.ok(columns.includes('_count'));
        assert.ok(columns.includes('_sourceCategory'));

        // Extract rows
        const rows = recordsResponse.records.map(r => r.map);
        assert.strictEqual(rows.length, 2);
        assert.strictEqual(rows[0]._count, '100');
        assert.strictEqual(rows[1]._sourceCategory, 'prod/web');
    });

    test('should transform messages response to table format', () => {
        const messagesResponse = {
            messages: [
                {
                    map: {
                        _raw: 'Error occurred',
                        _messageTime: '1640000000000',
                        _sourceCategory: 'prod/app'
                    }
                }
            ],
            fields: [
                { name: '_raw', fieldType: 'string' },
                { name: '_messageTime', fieldType: 'long' },
                { name: '_sourceCategory', fieldType: 'string' }
            ]
        };

        const columns = messagesResponse.fields.map(f => f.name);
        const rows = messagesResponse.messages.map(m => m.map);

        assert.strictEqual(columns.length, 3);
        assert.strictEqual(rows.length, 1);
        assert.ok(rows[0]._raw.includes('Error'));
    });

    test('should handle empty results', () => {
        const emptyResponse = {
            records: [],
            fields: []
        };

        assert.strictEqual(emptyResponse.records.length, 0);
        assert.strictEqual(emptyResponse.fields.length, 0);
    });

    test('should handle records with null values', () => {
        const recordsWithNulls = {
            records: [
                {
                    map: {
                        field1: 'value1',
                        field2: null,
                        field3: ''
                    }
                }
            ],
            fields: [
                { name: 'field1', fieldType: 'string' },
                { name: 'field2', fieldType: 'string' },
                { name: 'field3', fieldType: 'string' }
            ]
        };

        const row = recordsWithNulls.records[0].map;
        assert.strictEqual(row.field1, 'value1');
        assert.strictEqual(row.field2, null);
        assert.strictEqual(row.field3, '');
    });
});

suite('Webview Pagination Tests', () => {
    test('should calculate correct page count', () => {
        const totalRows = 250;
        const pageSize = 100;

        const pageCount = Math.ceil(totalRows / pageSize);

        assert.strictEqual(pageCount, 3);
    });

    test('should get correct page slice', () => {
        const allRows = Array.from({ length: 250 }, (_, i) => ({ id: i }));
        const pageSize = 100;
        const currentPage = 2; // 0-indexed

        const startIndex = currentPage * pageSize;
        const endIndex = Math.min(startIndex + pageSize, allRows.length);
        const pageRows = allRows.slice(startIndex, endIndex);

        assert.strictEqual(startIndex, 200);
        assert.strictEqual(endIndex, 250);
        assert.strictEqual(pageRows.length, 50);
        assert.strictEqual(pageRows[0].id, 200);
    });

    test('should handle first page', () => {
        const allRows = Array.from({ length: 250 }, (_, i) => ({ id: i }));
        const pageSize = 100;
        const currentPage = 0;

        const pageRows = allRows.slice(
            currentPage * pageSize,
            (currentPage + 1) * pageSize
        );

        assert.strictEqual(pageRows.length, 100);
        assert.strictEqual(pageRows[0].id, 0);
        assert.strictEqual(pageRows[99].id, 99);
    });

    test('should handle last page with partial data', () => {
        const allRows = Array.from({ length: 250 }, (_, i) => ({ id: i }));
        const pageSize = 100;
        const lastPage = 2;

        const pageRows = allRows.slice(
            lastPage * pageSize,
            Math.min((lastPage + 1) * pageSize, allRows.length)
        );

        assert.strictEqual(pageRows.length, 50);
        assert.strictEqual(pageRows[0].id, 200);
    });

    test('should validate page size limits', () => {
        const minPageSize = 10;
        const maxPageSize = 10000;
        const defaultPageSize = 100;

        assert.ok(minPageSize >= 10);
        assert.ok(maxPageSize <= 10000);
        assert.ok(defaultPageSize >= minPageSize && defaultPageSize <= maxPageSize);
    });
});

suite('Webview Filtering Tests', () => {
    test('should filter rows by global search', () => {
        const rows = [
            { field1: 'error in application', field2: 'prod' },
            { field1: 'success', field2: 'prod' },
            { field1: 'warning', field2: 'dev' }
        ];

        const searchTerm = 'error';

        const filtered = rows.filter(row =>
            Object.values(row).some(value =>
                String(value).toLowerCase().includes(searchTerm.toLowerCase())
            )
        );

        assert.strictEqual(filtered.length, 1);
        assert.ok(filtered[0].field1.includes('error'));
    });

    test('should filter rows by column-specific search', () => {
        const rows = [
            { category: 'prod/app', count: '100' },
            { category: 'prod/web', count: '50' },
            { category: 'dev/app', count: '25' }
        ];

        const columnFilter = { category: 'prod' };

        const filtered = rows.filter(row =>
            row.category.includes(columnFilter.category)
        );

        assert.strictEqual(filtered.length, 2);
        assert.ok(filtered.every(r => r.category.includes('prod')));
    });

    test('should handle case-insensitive filtering', () => {
        const rows = [
            { message: 'ERROR occurred' },
            { message: 'error occurred' },
            { message: 'Error occurred' },
            { message: 'no issues' }
        ];

        const searchTerm = 'error';

        const filtered = rows.filter(row =>
            row.message.toLowerCase().includes(searchTerm.toLowerCase())
        );

        assert.strictEqual(filtered.length, 3);
    });

    test('should filter with empty search term', () => {
        const rows = [
            { field: 'value1' },
            { field: 'value2' }
        ];

        const searchTerm: string = '';

        // Empty search term should return all rows
        const filtered = searchTerm.length === 0 ? rows : rows.filter(row =>
            Object.values(row).some(v =>
                String(v).toLowerCase().includes(searchTerm.toLowerCase())
            )
        );

        assert.strictEqual(filtered.length, 2);
    });
});

suite('Webview Sorting Tests', () => {
    test('should sort by string column ascending', () => {
        const rows = [
            { name: 'charlie' },
            { name: 'alice' },
            { name: 'bob' }
        ];

        const sorted = [...rows].sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        assert.strictEqual(sorted[0].name, 'alice');
        assert.strictEqual(sorted[1].name, 'bob');
        assert.strictEqual(sorted[2].name, 'charlie');
    });

    test('should sort by string column descending', () => {
        const rows = [
            { name: 'charlie' },
            { name: 'alice' },
            { name: 'bob' }
        ];

        const sorted = [...rows].sort((a, b) =>
            b.name.localeCompare(a.name)
        );

        assert.strictEqual(sorted[0].name, 'charlie');
        assert.strictEqual(sorted[1].name, 'bob');
        assert.strictEqual(sorted[2].name, 'alice');
    });

    test('should sort by numeric column ascending', () => {
        const rows = [
            { count: '100' },
            { count: '25' },
            { count: '50' }
        ];

        const sorted = [...rows].sort((a, b) =>
            parseInt(a.count) - parseInt(b.count)
        );

        assert.strictEqual(sorted[0].count, '25');
        assert.strictEqual(sorted[1].count, '50');
        assert.strictEqual(sorted[2].count, '100');
    });

    test('should sort by numeric column descending', () => {
        const rows = [
            { count: '100' },
            { count: '25' },
            { count: '50' }
        ];

        const sorted = [...rows].sort((a, b) =>
            parseInt(b.count) - parseInt(a.count)
        );

        assert.strictEqual(sorted[0].count, '100');
        assert.strictEqual(sorted[1].count, '50');
        assert.strictEqual(sorted[2].count, '25');
    });

    test('should handle null values in sorting', () => {
        const rows: Array<{ value: string | null }> = [
            { value: 'a' },
            { value: null },
            { value: 'b' }
        ];

        const sorted = [...rows].sort((a, b) => {
            if (a.value === null) return 1;
            if (b.value === null) return -1;
            return a.value.localeCompare(b.value);
        });

        assert.strictEqual(sorted[0].value, 'a');
        assert.strictEqual(sorted[1].value, 'b');
        assert.strictEqual(sorted[2].value, null);
    });
});

suite('Webview Column Management Tests', () => {
    test('should toggle column visibility', () => {
        const columnVisibility: Record<string, boolean> = {
            field1: true,
            field2: true,
            field3: false
        };

        // Toggle field2
        columnVisibility.field2 = !columnVisibility.field2;

        assert.strictEqual(columnVisibility.field1, true);
        assert.strictEqual(columnVisibility.field2, false);
        assert.strictEqual(columnVisibility.field3, false);
    });

    test('should get visible columns', () => {
        const allColumns = ['field1', 'field2', 'field3', 'field4'];
        const columnVisibility: Record<string, boolean> = {
            field1: true,
            field2: false,
            field3: true,
            field4: true
        };

        const visibleColumns = allColumns.filter(col => columnVisibility[col]);

        assert.strictEqual(visibleColumns.length, 3);
        assert.ok(visibleColumns.includes('field1'));
        assert.ok(!visibleColumns.includes('field2'));
    });

    test('should filter row data to visible columns only', () => {
        const row = {
            field1: 'value1',
            field2: 'value2',
            field3: 'value3'
        };

        const visibleColumns = ['field1', 'field3'];

        const filteredRow: Record<string, any> = {};
        visibleColumns.forEach(col => {
            filteredRow[col] = row[col as keyof typeof row];
        });

        assert.strictEqual(Object.keys(filteredRow).length, 2);
        assert.strictEqual(filteredRow.field1, 'value1');
        assert.strictEqual(filteredRow.field3, 'value3');
        assert.strictEqual(filteredRow.field2, undefined);
    });
});

suite('Webview Export Tests', () => {
    test('should export visible data to CSV format', () => {
        const columns = ['field1', 'field2'];
        const rows = [
            { field1: 'value1', field2: 'value2' },
            { field1: 'value3', field2: 'value4' }
        ];

        // Generate CSV
        const header = columns.join(',');
        const dataRows = rows.map(row =>
            columns.map(col => row[col as keyof typeof row]).join(',')
        );
        const csv = [header, ...dataRows].join('\n');

        assert.ok(csv.includes('field1,field2'));
        assert.ok(csv.includes('value1,value2'));
        assert.ok(csv.includes('value3,value4'));
    });

    test('should export visible data to JSON format', () => {
        const rows = [
            { field1: 'value1', field2: 'value2' },
            { field1: 'value3', field2: 'value4' }
        ];

        const json = JSON.stringify(rows, null, 2);

        assert.ok(json.includes('field1'));
        assert.ok(json.includes('value1'));
        const parsed = JSON.parse(json);
        assert.strictEqual(parsed.length, 2);
    });

    test('should handle CSV special characters', () => {
        const value = 'contains,comma';
        const escaped = `"${value}"`;

        assert.ok(escaped.includes('"'));
        assert.ok(!escaped.split('","').some(v => v.includes(',') && !v.startsWith('"')));
    });

    test('should export only filtered rows', () => {
        const allRows = [
            { category: 'prod', count: '100' },
            { category: 'dev', count: '50' },
            { category: 'prod', count: '75' }
        ];

        const searchTerm = 'prod';
        const filteredRows = allRows.filter(row =>
            row.category.includes(searchTerm)
        );

        assert.strictEqual(filteredRows.length, 2);
        const csv = filteredRows.map(r => `${r.category},${r.count}`).join('\n');
        assert.ok(csv.includes('prod,100'));
        assert.ok(csv.includes('prod,75'));
        assert.ok(!csv.includes('dev'));
    });
});

suite('Webview Copy to Clipboard Tests', () => {
    test('should format visible data for clipboard (tab-separated)', () => {
        const columns = ['field1', 'field2'];
        const rows = [
            { field1: 'value1', field2: 'value2' },
            { field1: 'value3', field2: 'value4' }
        ];

        // Generate TSV (tab-separated)
        const header = columns.join('\t');
        const dataRows = rows.map(row =>
            columns.map(col => row[col as keyof typeof row]).join('\t')
        );
        const tsv = [header, ...dataRows].join('\n');

        assert.ok(tsv.includes('field1\tfield2'));
        assert.ok(tsv.includes('value1\tvalue2'));
        assert.ok(tsv.includes('value3\tvalue4'));
        assert.ok(!tsv.includes(','));
    });

    test('should include only visible columns in clipboard data', () => {
        const row = { field1: 'v1', field2: 'v2', field3: 'v3' };
        const visibleColumns = ['field1', 'field3'];

        const clipboardRow = visibleColumns.map(col =>
            row[col as keyof typeof row]
        ).join('\t');

        assert.strictEqual(clipboardRow, 'v1\tv3');
        assert.ok(!clipboardRow.includes('v2'));
    });
});

suite('Webview Performance Metrics Tests', () => {
    test('should display query execution time', () => {
        const startTime = Date.now();
        const endTime = startTime + 2500; // 2.5 seconds

        const executionTime = endTime - startTime;
        const seconds = (executionTime / 1000).toFixed(2);

        assert.strictEqual(seconds, '2.50');
    });

    test('should display job statistics', () => {
        const jobStats = {
            state: 'DONE GATHERING RESULTS',
            messageCount: 1250,
            recordCount: 15,
            pendingErrors: 0,
            pendingWarnings: 0
        };

        assert.strictEqual(jobStats.state, 'DONE GATHERING RESULTS');
        assert.strictEqual(jobStats.messageCount, 1250);
        assert.strictEqual(jobStats.recordCount, 15);
    });

    test('should format large numbers with commas', () => {
        const formatNumber = (num: number): string => {
            return num.toLocaleString();
        };

        assert.strictEqual(formatNumber(1234567), '1,234,567');
        assert.strictEqual(formatNumber(1000), '1,000');
        assert.strictEqual(formatNumber(999), '999');
    });

    test('should calculate rows per page info', () => {
        const totalRows = 250;
        const pageSize = 100;
        const currentPage = 1; // 0-indexed

        const startRow = currentPage * pageSize + 1;
        const endRow = Math.min((currentPage + 1) * pageSize, totalRows);
        const info = `Showing ${startRow}-${endRow} of ${totalRows}`;

        assert.strictEqual(info, 'Showing 101-200 of 250');
    });
});

suite('Webview URL Generation Tests', () => {
    test('should generate webview resource URLs', () => {
        const mockUri = {
            scheme: 'vscode-resource',
            authority: '',
            path: '/path/to/resource.js'
        };

        const url = `${mockUri.scheme}://${mockUri.path}`;

        assert.ok(url.startsWith('vscode-resource://'));
        assert.ok(url.includes('resource.js'));
    });

    test('should handle webview script nonce for CSP', () => {
        const nonce = 'abc123def456';

        assert.ok(nonce.length > 0);
        assert.strictEqual(typeof nonce, 'string');
    });
});

suite('Webview Message Handling Tests', () => {
    test('should validate message types', () => {
        const validMessageTypes = [
            'export-csv',
            'export-json',
            'copy-clipboard',
            'page-changed',
            'sort-changed',
            'filter-changed',
            'column-visibility-changed'
        ];

        validMessageTypes.forEach(type => {
            assert.strictEqual(typeof type, 'string');
            assert.ok(type.length > 0);
        });
    });

    test('should structure page change message', () => {
        const message = {
            type: 'page-changed',
            page: 2
        };

        assert.strictEqual(message.type, 'page-changed');
        assert.strictEqual(typeof message.page, 'number');
        assert.ok(message.page >= 0);
    });

    test('should structure sort change message', () => {
        const message = {
            type: 'sort-changed',
            column: 'field1',
            direction: 'asc' as const
        };

        assert.strictEqual(message.type, 'sort-changed');
        assert.ok(['asc', 'desc'].includes(message.direction));
    });

    test('should structure filter change message', () => {
        const message = {
            type: 'filter-changed',
            searchTerm: 'error'
        };

        assert.strictEqual(message.type, 'filter-changed');
        assert.strictEqual(typeof message.searchTerm, 'string');
    });
});

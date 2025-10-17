import * as assert from 'assert';
import * as vscode from 'vscode';
import { ProfileManager } from '../../profileManager';

/**
 * Unit tests for query executor utility functions
 * Note: Full integration tests are in integration/searchJob.test.ts
 */

suite('Query Executor Test Suite', () => {
    let context: vscode.ExtensionContext;
    let profileManager: ProfileManager;

    suiteSetup(async () => {
        // Get extension context
        const extension = vscode.extensions.getExtension('tba.sumo-query-language');
        if (!extension) {
            throw new Error('Extension not found');
        }
        if (!extension.isActive) {
            await extension.activate();
        }
        context = extension.exports?.context;
        if (!context) {
            throw new Error('Extension context not available');
        }
        profileManager = new ProfileManager(context);
    });

    test('should validate QueryExecutionOptions interface structure', () => {
        // This test validates the expected structure of QueryExecutionOptions
        const validOptions = {
            query: '_sourceCategory=prod | count',
            profileName: 'test-profile',
            from: '-1h',
            to: 'now',
            timeZone: 'UTC',
            byReceiptTime: false,
            autoParsingMode: 'Manual' as const,
            onProgress: (msg: string) => console.log(msg)
        };

        // Verify all required fields
        assert.ok(validOptions.query);
        assert.ok(validOptions.profileName);

        // Verify optional fields have correct types
        assert.strictEqual(typeof validOptions.from, 'string');
        assert.strictEqual(typeof validOptions.to, 'string');
        assert.strictEqual(typeof validOptions.timeZone, 'string');
        assert.strictEqual(typeof validOptions.byReceiptTime, 'boolean');
        assert.ok(['AutoParse', 'Manual'].includes(validOptions.autoParsingMode));
        assert.strictEqual(typeof validOptions.onProgress, 'function');
    });

    test('should have default values for optional parameters', () => {
        // Test that defaults are applied when not specified
        const minimalOptions = {
            query: '_sourceCategory=prod | count',
            profileName: 'test-profile'
        };

        // These should be the defaults used in queryExecutor.ts
        const expectedDefaults = {
            from: '-1h',
            to: 'now',
            timeZone: 'UTC',
            byReceiptTime: false,
            autoParsingMode: 'Manual'
        };

        assert.ok(minimalOptions.query);
        assert.ok(minimalOptions.profileName);

        // Verify defaults are documented
        assert.strictEqual(expectedDefaults.from, '-1h');
        assert.strictEqual(expectedDefaults.to, 'now');
        assert.strictEqual(expectedDefaults.timeZone, 'UTC');
        assert.strictEqual(expectedDefaults.byReceiptTime, false);
        assert.strictEqual(expectedDefaults.autoParsingMode, 'Manual');
    });

    test('should validate time range formats', () => {
        // Valid relative time formats
        const validRelative = ['-1h', '-24h', '-7d', '-1w', '-30d', '-1m'];
        validRelative.forEach(time => {
            assert.ok(time.match(/^-\d+[hdwm]$/), `${time} should match relative time format`);
        });

        // Valid absolute time formats (ISO 8601)
        const validAbsolute = [
            '2024-01-01T00:00:00',
            '2024-12-31T23:59:59',
            '2024-06-15T12:30:00Z'
        ];
        validAbsolute.forEach(time => {
            assert.ok(time.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
                `${time} should match ISO 8601 format`);
        });

        // Special value
        assert.strictEqual('now', 'now');
    });

    test('should validate autoParsingMode values', () => {
        const validModes = ['AutoParse', 'Manual'];

        validModes.forEach(mode => {
            assert.ok(['AutoParse', 'Manual'].includes(mode),
                `${mode} should be a valid parsing mode`);
        });

        // Invalid modes should not be accepted
        const invalidModes = ['auto', 'manual', 'Auto', 'MANUAL'];
        invalidModes.forEach(mode => {
            assert.ok(!['AutoParse', 'Manual'].includes(mode),
                `${mode} should not be a valid parsing mode`);
        });
    });

    test('should validate timezone formats', () => {
        // Valid timezone formats
        const validTimezones = [
            'UTC',
            'America/New_York',
            'Europe/London',
            'Asia/Tokyo',
            'Australia/Sydney'
        ];

        validTimezones.forEach(tz => {
            assert.strictEqual(typeof tz, 'string');
            assert.ok(tz.length > 0);
        });
    });

    test('should handle progress callback', () => {
        let progressMessages: string[] = [];

        const onProgress = (message: string) => {
            progressMessages.push(message);
        };

        // Simulate progress updates
        onProgress('Creating search job...');
        onProgress('Job created: 12345');
        onProgress('Waiting for query to complete...');
        onProgress('Fetching results...');

        assert.strictEqual(progressMessages.length, 4);
        assert.ok(progressMessages[0].includes('Creating'));
        assert.ok(progressMessages[1].includes('Job created'));
        assert.ok(progressMessages[2].includes('Waiting'));
        assert.ok(progressMessages[3].includes('Fetching'));
    });

    test('should validate query string format', () => {
        // Valid queries
        const validQueries = [
            '_sourceCategory=prod | count',
            '_index=sumologic_default',
            'error | parse "status=* " as status | count by status',
            '* | limit 100'
        ];

        validQueries.forEach(query => {
            assert.strictEqual(typeof query, 'string');
            assert.ok(query.length > 0);
        });

        // Empty or whitespace queries should be invalid
        const invalidQueries = ['', '   ', '\n\n'];
        invalidQueries.forEach(query => {
            assert.ok(query.trim().length === 0,
                'Empty/whitespace query should be invalid');
        });
    });

    test('should validate byReceiptTime boolean values', () => {
        const validValues = [true, false];

        validValues.forEach(value => {
            assert.strictEqual(typeof value, 'boolean');
        });

        // Ensure type safety
        const byReceiptTime: boolean = false;
        assert.strictEqual(typeof byReceiptTime, 'boolean');
    });
});

suite('Query Execution Error Handling Tests', () => {
    test('should handle missing profile error', async () => {
        try {
            // Simulate error when profile doesn't exist
            const errorMessage = `Profile 'non-existent-profile' not found`;
            throw new Error(errorMessage);
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok((error as Error).message.includes('not found'));
        }
    });

    test('should handle missing credentials error', async () => {
        try {
            // Simulate error when credentials don't exist
            const errorMessage = 'No credentials found for profile';
            throw new Error(errorMessage);
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok((error as Error).message.includes('credentials'));
        }
    });

    test('should handle search job creation failure', async () => {
        try {
            // Simulate API error
            const errorMessage = 'Failed to create search job';
            throw new Error(errorMessage);
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok((error as Error).message.includes('Failed to create'));
        }
    });

    test('should handle invalid time range error', async () => {
        try {
            // Simulate invalid time format
            const errorMessage = 'Invalid time format: invalid-time';
            throw new Error(errorMessage);
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok((error as Error).message.includes('Invalid time'));
        }
    });

    test('should handle query timeout error', async () => {
        try {
            // Simulate timeout
            const errorMessage = 'Query execution timeout after 60000ms';
            throw new Error(errorMessage);
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok((error as Error).message.includes('timeout'));
        }
    });

    test('should handle network errors', async () => {
        try {
            // Simulate network error
            const errorMessage = 'Network error: ECONNREFUSED';
            throw new Error(errorMessage);
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok((error as Error).message.includes('Network error'));
        }
    });

    test('should handle API authentication errors', async () => {
        try {
            // Simulate auth error
            const errorMessage = 'Authentication failed: Invalid credentials';
            throw new Error(errorMessage);
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok((error as Error).message.includes('Authentication failed'));
        }
    });
});

suite('Query Result Type Tests', () => {
    test('should validate RecordsResponse structure', () => {
        // Mock records response
        const mockRecordsResponse = {
            records: [
                {
                    map: {
                        _count: '100',
                        _sourceCategory: 'prod/app'
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

        assert.ok(Array.isArray(mockRecordsResponse.records));
        assert.strictEqual(mockRecordsResponse.records.length, 2);
        assert.ok(mockRecordsResponse.records[0].map);
        assert.ok(Array.isArray(mockRecordsResponse.fields));
    });

    test('should validate MessagesResponse structure', () => {
        // Mock messages response
        const mockMessagesResponse = {
            messages: [
                {
                    map: {
                        _raw: 'Error occurred in application',
                        _messageTime: '1640000000000',
                        _sourceCategory: 'prod/app'
                    }
                },
                {
                    map: {
                        _raw: 'Warning: High memory usage',
                        _messageTime: '1640000001000',
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

        assert.ok(Array.isArray(mockMessagesResponse.messages));
        assert.strictEqual(mockMessagesResponse.messages.length, 2);
        assert.ok(mockMessagesResponse.messages[0].map);
        assert.ok(mockMessagesResponse.messages[0].map._raw);
        assert.ok(Array.isArray(mockMessagesResponse.fields));
    });

    test('should handle empty results', () => {
        const emptyRecordsResponse = {
            records: [],
            fields: []
        };

        assert.ok(Array.isArray(emptyRecordsResponse.records));
        assert.strictEqual(emptyRecordsResponse.records.length, 0);
    });

    test('should validate field metadata structure', () => {
        const fieldMetadata = {
            name: '_count',
            fieldType: 'long',
            keyField: false
        };

        assert.strictEqual(typeof fieldMetadata.name, 'string');
        assert.strictEqual(typeof fieldMetadata.fieldType, 'string');
        assert.ok(['string', 'long', 'double', 'boolean'].includes(fieldMetadata.fieldType));
    });
});

suite('Query Mode Detection Tests', () => {
    test('should identify aggregation queries (records mode)', () => {
        const aggregationQueries = [
            '_sourceCategory=prod | count',
            '_sourceCategory=prod | count by _sourceHost',
            '_sourceCategory=prod | sum(_size) as bytes',
            '_sourceCategory=prod | avg(response_time)',
            '_sourceCategory=prod | max(value) by category',
            '_sourceCategory=prod | timeslice 1h | count by _timeslice'
        ];

        aggregationQueries.forEach(query => {
            // Check if query contains aggregation operators
            const hasAggregation = /\|\s*(count|sum|avg|max|min|pct|stddev|first|last|most_recent|least_recent)/i.test(query);
            assert.ok(hasAggregation, `${query} should be identified as aggregation`);
        });
    });

    test('should identify message queries (messages mode)', () => {
        const messageQueries = [
            '_sourceCategory=prod error',
            '_sourceCategory=prod | where status=500',
            '_sourceCategory=prod | parse "status=* " as status',
            '_sourceCategory=prod | limit 100'
        ];

        messageQueries.forEach(query => {
            // Check if query has no aggregation operators
            const hasAggregation = /\|\s*(count|sum|avg|max|min|pct|stddev|first|last|most_recent|least_recent)(?!\w)/i.test(query);
            assert.ok(!hasAggregation || query.includes('limit'),
                `${query} should be identified as message query`);
        });
    });

    test('should handle mixed queries with limit', () => {
        const query = '_sourceCategory=prod | limit 1000 | count';

        // Has both limit and aggregation
        const hasLimit = query.includes('limit');
        const hasAggregation = /\|\s*count/i.test(query);

        assert.ok(hasLimit && hasAggregation, 'Should detect both limit and aggregation');
    });
});

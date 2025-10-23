import * as assert from 'assert';
import * as vscode from 'vscode';
import { formatRecordsAsCSV } from '../../commands/runQuery';

/**
 * Unit tests for shared functions in runQuery.ts
 * These test the helper/utility functions without requiring API calls
 */
suite('RunQuery Shared Functions Unit Tests', () => {

    test('formatRecordsAsCSV should format records with _timeslice first', () => {
        const records = [
            { map: { _timeslice: '1234567890000', _sourceCategory: 'app/web', count: '10' } },
            { map: { _timeslice: '1234567900000', _sourceCategory: 'app/api', count: '20' } }
        ];

        const csv = formatRecordsAsCSV(records);

        // Should have headers
        assert.ok(csv.includes('_timeslice'), 'CSV should contain _timeslice header');
        assert.ok(csv.includes('_sourceCategory'), 'CSV should contain _sourceCategory header');
        assert.ok(csv.includes('count'), 'CSV should contain count header');

        // Check _timeslice is first column
        const lines = csv.split('\n');
        const headers = lines[0].split(',');
        assert.strictEqual(headers[0], '_timeslice', '_timeslice should be first column');

        // Should have data rows
        assert.ok(csv.includes('1234567890000'), 'CSV should contain first timestamp');
        assert.ok(csv.includes('1234567900000'), 'CSV should contain second timestamp');
    });

    test('formatRecordsAsCSV should handle empty results', () => {
        const records: any[] = [];
        const csv = formatRecordsAsCSV(records);
        assert.strictEqual(csv, 'No results found');
    });

    test('formatRecordsAsCSV should escape CSV special characters', () => {
        const records = [
            { map: { field1: 'value, with comma', field2: 'value "with quotes"', field3: 'value\nwith\nnewline' } }
        ];

        const csv = formatRecordsAsCSV(records);

        // Values with commas should be quoted
        assert.ok(csv.includes('"value, with comma"'), 'Should quote values with commas');

        // Values with quotes should escape quotes and be quoted
        assert.ok(csv.includes('"value ""with quotes"""'), 'Should escape and quote values with quotes');

        // Values with newlines should be quoted
        assert.ok(csv.includes('"value\nwith\nnewline"'), 'Should quote values with newlines');
    });

    test('formatRecordsAsCSV should handle records with varying fields', () => {
        const records = [
            { map: { field1: 'a', field2: 'b' } },
            { map: { field1: 'c', field3: 'd' } },
            { map: { field2: 'e', field3: 'f', field4: 'g' } }
        ];

        const csv = formatRecordsAsCSV(records);

        // All unique fields should be in headers
        assert.ok(csv.includes('field1'), 'Should include field1');
        assert.ok(csv.includes('field2'), 'Should include field2');
        assert.ok(csv.includes('field3'), 'Should include field3');
        assert.ok(csv.includes('field4'), 'Should include field4');

        // Should have 4 rows (1 header + 3 data)
        const lines = csv.trim().split('\n');
        assert.strictEqual(lines.length, 4, 'Should have 4 lines total');
    });

    test('formatRecordsAsCSV should handle numeric and string values', () => {
        const records = [
            { map: { number_field: 123, string_field: 'test', bool_field: true, null_field: null } }
        ];

        const csv = formatRecordsAsCSV(records);

        // Should convert all types to strings
        assert.ok(csv.includes('123'), 'Should include numeric value');
        assert.ok(csv.includes('test'), 'Should include string value');
        assert.ok(csv.includes('true'), 'Should include boolean value');
    });

    test('formatRecordsAsCSV should sort fields alphabetically except _timeslice', () => {
        const records = [
            { map: { zebra: '1', apple: '2', _timeslice: '3', banana: '4' } }
        ];

        const csv = formatRecordsAsCSV(records);
        const lines = csv.split('\n');
        const headers = lines[0].split(',');

        // _timeslice should be first
        assert.strictEqual(headers[0], '_timeslice', '_timeslice should be first');

        // Rest should be sorted
        const restHeaders = headers.slice(1);
        const sortedRest = [...restHeaders].sort();
        assert.deepStrictEqual(restHeaders, sortedRest, 'Non-timeslice fields should be sorted alphabetically');
    });

    test('formatRecordsAsCSV should handle transposed data structure', () => {
        // Simulate data from: | transpose row _timeslice column _sourceCategory
        const records = [
            { map: { _timeslice: '1000', 'app/web': '10', 'app/api': '5', 'system/auth': '2' } },
            { map: { _timeslice: '2000', 'app/web': '15', 'app/api': '8', 'system/auth': '3' } }
        ];

        const csv = formatRecordsAsCSV(records);

        // Should have _timeslice as first column
        const lines = csv.split('\n');
        const headers = lines[0].split(',');
        assert.strictEqual(headers[0], '_timeslice', '_timeslice should be first in transposed data');

        // Should have all source categories as columns
        assert.ok(csv.includes('app/web'), 'Should include app/web column');
        assert.ok(csv.includes('app/api'), 'Should include app/api column');
        assert.ok(csv.includes('system/auth'), 'Should include system/auth column');

        // Should have correct data rows
        assert.strictEqual(lines.length, 3, 'Should have header + 2 data rows');
    });
});

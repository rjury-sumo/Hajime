"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
const customFields_1 = require("../../api/customFields");
const testHelper_1 = require("./testHelper");
suite('Custom Fields API Integration Tests', function () {
    this.timeout(30000);
    let client;
    let context;
    let profileManager;
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!(0, testHelper_1.shouldRunIntegrationTests)()) {
                this.skip();
                return;
            }
            ;
            if (!(0, testHelper_1.shouldRunIntegrationTests)()) {
                return;
            }
            const extension = vscode.extensions.getExtension('tba.sumo-query-language');
            if (!extension) {
                throw new Error('Extension not found');
            }
            if (!extension.isActive) {
                yield extension.activate();
            }
            context = (_a = extension.exports) === null || _a === void 0 ? void 0 : _a.context;
            if (!context) {
                throw new Error('Extension context not available');
            }
            profileManager = yield (0, testHelper_1.setupIntegrationProfile)(context);
            const config = (0, testHelper_1.getIntegrationTestConfig)();
            client = new customFields_1.CustomFieldsClient({ accessId: config.accessId, accessKey: config.accessKey, endpoint: config.endpoint });
            console.log('✅ Custom Fields API test environment configured');
        });
    });
    suiteTeardown(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if ((0, testHelper_1.shouldRunIntegrationTests)() && profileManager) {
                yield (0, testHelper_1.cleanupIntegrationProfile)(profileManager);
            }
        });
    });
    test('should list custom fields', () => __awaiter(this, void 0, void 0, function* () {
        const response = yield client.listCustomFields();
        assert.ok(response.data, 'Response should have data');
        assert.ok(Array.isArray(response.data.data), 'Data should be an array');
        const fields = response.data.data;
        console.log(`✅ Found ${fields.length} custom fields`);
        if (fields.length > 0) {
            fields.slice(0, 5).forEach(field => {
                console.log(`   - ${field.fieldName} (${field.dataType}, ${field.state})`);
            });
            if (fields.length > 5) {
                console.log(`   ... and ${fields.length - 5} more`);
            }
        }
        else {
            console.log('   (No custom fields defined in this environment)');
        }
    }));
    test('should verify custom field structure', () => __awaiter(this, void 0, void 0, function* () {
        const response = yield client.listCustomFields();
        const fields = response.data.data;
        if (fields.length === 0) {
            console.log('⚠️  No custom fields found to verify structure');
            return;
        }
        const field = fields[0];
        // Verify required fields
        assert.ok(field.fieldId, 'Field should have fieldId');
        assert.ok(field.fieldName, 'Field should have fieldName');
        assert.ok(field.dataType, 'Field should have dataType');
        assert.ok(field.state, 'Field should have state');
        console.log('✅ Custom field structure verified');
        console.log(`   ID: ${field.fieldId}`);
        console.log(`   Name: ${field.fieldName}`);
        console.log(`   Type: ${field.dataType}`);
        console.log(`   State: ${field.state}`);
    }));
    test('should extract field names', () => __awaiter(this, void 0, void 0, function* () {
        const response = yield client.listCustomFields();
        const fieldNames = customFields_1.CustomFieldsClient.extractFieldNames(response.data);
        assert.ok(Array.isArray(fieldNames), 'Field names should be an array');
        if (fieldNames.length > 0) {
            console.log(`✅ Extracted ${fieldNames.length} field names:`);
            fieldNames.slice(0, 10).forEach(name => {
                assert.ok(typeof name === 'string', 'Field name should be a string');
                console.log(`   - ${name}`);
            });
            if (fieldNames.length > 10) {
                console.log(`   ... and ${fieldNames.length - 10} more`);
            }
        }
        else {
            console.log('⚠️  No field names to extract');
        }
    }));
    test('should format custom fields as table', () => __awaiter(this, void 0, void 0, function* () {
        const response = yield client.listCustomFields();
        const fields = response.data.data;
        const table = customFields_1.CustomFieldsClient.formatCustomFieldsAsTable(fields);
        assert.ok(typeof table === 'string', 'Table should be a string');
        assert.ok(table.length > 0, 'Table should not be empty');
        console.log('✅ Custom fields formatted as table:');
        console.log(table);
    }));
    test('should group fields by data type', () => __awaiter(this, void 0, void 0, function* () {
        const response = yield client.listCustomFields();
        const fields = response.data.data;
        if (fields.length === 0) {
            console.log('⚠️  No fields to group by data type');
            return;
        }
        const dataTypes = new Set(fields.map(f => f.dataType));
        console.log(`✅ Found ${dataTypes.size} different data types:`);
        Array.from(dataTypes).forEach(type => {
            const count = fields.filter(f => f.dataType === type).length;
            const fieldNames = fields.filter(f => f.dataType === type).map(f => f.fieldName);
            console.log(`   ${type}: ${count} field(s)`);
            fieldNames.slice(0, 3).forEach(name => {
                console.log(`     - ${name}`);
            });
            if (fieldNames.length > 3) {
                console.log(`     ... and ${fieldNames.length - 3} more`);
            }
        });
    }));
    test('should group fields by state', () => __awaiter(this, void 0, void 0, function* () {
        const response = yield client.listCustomFields();
        const fields = response.data.data;
        if (fields.length === 0) {
            console.log('⚠️  No fields to group by state');
            return;
        }
        const states = new Set(fields.map(f => f.state));
        console.log(`✅ Found ${states.size} different states:`);
        Array.from(states).forEach(state => {
            const count = fields.filter(f => f.state === state).length;
            console.log(`   ${state}: ${count} field(s)`);
        });
    }));
    test('should verify field names are unique', () => __awaiter(this, void 0, void 0, function* () {
        const response = yield client.listCustomFields();
        const fields = response.data.data;
        if (fields.length === 0) {
            console.log('⚠️  No fields to verify uniqueness');
            return;
        }
        const fieldNames = fields.map(f => f.fieldName);
        const uniqueNames = new Set(fieldNames);
        assert.strictEqual(fieldNames.length, uniqueNames.size, 'All field names should be unique');
        console.log(`✅ All ${fieldNames.length} field names are unique`);
    }));
    test('should verify field IDs are unique', () => __awaiter(this, void 0, void 0, function* () {
        const response = yield client.listCustomFields();
        const fields = response.data.data;
        if (fields.length === 0) {
            console.log('⚠️  No fields to verify ID uniqueness');
            return;
        }
        const fieldIds = fields.map(f => f.fieldId);
        const uniqueIds = new Set(fieldIds);
        assert.strictEqual(fieldIds.length, uniqueIds.size, 'All field IDs should be unique');
        console.log(`✅ All ${fieldIds.length} field IDs are unique`);
    }));
    test('should verify field naming conventions', () => __awaiter(this, void 0, void 0, function* () {
        const response = yield client.listCustomFields();
        const fields = response.data.data;
        if (fields.length === 0) {
            console.log('⚠️  No fields to verify naming conventions');
            return;
        }
        const fieldNames = fields.map(f => f.fieldName);
        // Check for common naming patterns
        const hasUnderscores = fieldNames.filter(name => name.includes('_'));
        const hasCamelCase = fieldNames.filter(name => /[a-z][A-Z]/.test(name));
        const hasNumbers = fieldNames.filter(name => /\d/.test(name));
        const hasSpecialChars = fieldNames.filter(name => /[^a-zA-Z0-9_]/.test(name));
        console.log('✅ Field naming patterns:');
        console.log(`   With underscores: ${hasUnderscores.length}`);
        console.log(`   CamelCase: ${hasCamelCase.length}`);
        console.log(`   With numbers: ${hasNumbers.length}`);
        console.log(`   With special characters: ${hasSpecialChars.length}`);
        if (hasSpecialChars.length > 0) {
            console.log('   Fields with special characters:');
            hasSpecialChars.slice(0, 5).forEach(name => {
                console.log(`     - ${name}`);
            });
        }
    }));
    test('should handle empty response gracefully', () => __awaiter(this, void 0, void 0, function* () {
        const response = yield client.listCustomFields();
        // Should always return valid structure even if empty
        assert.ok(response.data, 'Response should have data');
        assert.ok(Array.isArray(response.data.data), 'Data should be an array');
        // Test formatting with potentially empty list
        const table = customFields_1.CustomFieldsClient.formatCustomFieldsAsTable(response.data.data);
        assert.ok(table, 'Should handle empty list gracefully');
        console.log('✅ Empty response handling verified');
    }));
});
//# sourceMappingURL=customFields.test.js.map
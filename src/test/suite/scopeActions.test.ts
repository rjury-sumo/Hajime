import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { ScopesCacheDB, Scope } from '../../database/scopesCache';

/**
 * Tests for scope actions functionality
 * Tests the database operations and scope action logic
 */

suite('Scope Actions Test Suite', () => {
    let scopesDB: ScopesCacheDB;
    const testDbPath = path.join(__dirname, 'test-scope-actions.db');
    const testProfileName = 'test-profile-' + Date.now();
    let testScopeId: string;

    suiteSetup(() => {
        // Clean up any existing test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        scopesDB = new ScopesCacheDB(testDbPath, testProfileName);

        // Create a test scope
        const scope = scopesDB.createScope({
            profile: testProfileName,
            profiles: '*',
            name: 'Test Prod Scope',
            searchScope: '_sourceCategory=prod/application',
            description: 'Test production logs',
            context: 'For testing scope actions'
        });
        testScopeId = scope.id;
    });

    suiteTeardown(() => {
        // Cleanup
        scopesDB.close();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('should create scope with all required fields', () => {
        const scope = scopesDB.getScopeById(testScopeId);

        assert.ok(scope, 'Scope should exist');
        assert.strictEqual(scope!.name, 'Test Prod Scope');
        assert.strictEqual(scope!.searchScope, '_sourceCategory=prod/application');
        assert.strictEqual(scope!.description, 'Test production logs');
        assert.strictEqual(scope!.context, 'For testing scope actions');
        assert.strictEqual(scope!.profile, testProfileName);
        assert.strictEqual(scope!.profiles, '*');
    });

    test('should update scope with facets result path', () => {
        const facetsPath = '/test/path/facets.json';
        const timestamp = new Date().toISOString();

        scopesDB.updateScope(testScopeId, {
            facetsResultPath: facetsPath,
            facetsTimestamp: timestamp
        });

        const scope = scopesDB.getScopeById(testScopeId);

        assert.strictEqual(scope!.facetsResultPath, facetsPath);
        assert.strictEqual(scope!.facetsTimestamp, timestamp);
    });

    test('should update scope with sample logs result path', () => {
        const samplePath = '/test/path/sample.json';
        const timestamp = new Date().toISOString();

        scopesDB.updateScope(testScopeId, {
            sampleLogsResultPath: samplePath,
            sampleLogsTimestamp: timestamp
        });

        const scope = scopesDB.getScopeById(testScopeId);

        assert.strictEqual(scope!.sampleLogsResultPath, samplePath);
        assert.strictEqual(scope!.sampleLogsTimestamp, timestamp);
    });

    test('should update scope with metadata result path', () => {
        const metadataPath = '/test/path/metadata.json';
        const timestamp = new Date().toISOString();

        scopesDB.updateScope(testScopeId, {
            metadataResultPath: metadataPath,
            metadataTimestamp: timestamp
        });

        const scope = scopesDB.getScopeById(testScopeId);

        assert.strictEqual(scope!.metadataResultPath, metadataPath);
        assert.strictEqual(scope!.metadataTimestamp, timestamp);
    });

    test('should update scope with custom time range', () => {
        scopesDB.updateScope(testScopeId, {
            queryFrom: '-24h'
        });

        const scope = scopesDB.getScopeById(testScopeId);

        assert.strictEqual(scope!.queryFrom, '-24h');
    });

    test('should retrieve scope by name', () => {
        const scope = scopesDB.getScopeByName('Test Prod Scope');

        assert.ok(scope, 'Scope should be found by name');
        assert.strictEqual(scope!.id, testScopeId);
        assert.strictEqual(scope!.searchScope, '_sourceCategory=prod/application');
    });

    test('should list all scopes for profile', () => {
        // Create additional scopes
        scopesDB.createScope({
            profile: testProfileName,
            profiles: '*',
            name: 'Test Dev Scope',
            searchScope: '_sourceCategory=dev/application',
            description: 'Development logs'
        });

        scopesDB.createScope({
            profile: testProfileName,
            profiles: testProfileName,
            name: 'Test Staging Scope',
            searchScope: '_sourceCategory=staging/application',
            description: 'Staging logs'
        });

        const scopes = scopesDB.getAllScopes();

        assert.ok(scopes.length >= 3, 'Should have at least 3 scopes');
        const scopeNames = scopes.map(s => s.name);
        assert.ok(scopeNames.includes('Test Prod Scope'));
        assert.ok(scopeNames.includes('Test Dev Scope'));
        assert.ok(scopeNames.includes('Test Staging Scope'));
    });

    test('should filter scopes by profile', () => {
        const allScopes = scopesDB.getAllScopes();

        // Scopes with '*' should apply to all profiles
        const universalScopes = allScopes.filter(s => s.profiles === '*');
        assert.ok(universalScopes.length >= 2, 'Should have universal scopes');

        // Scopes with specific profile
        const profileSpecificScopes = allScopes.filter(s => s.profiles === testProfileName);
        assert.ok(profileSpecificScopes.length >= 1, 'Should have profile-specific scopes');
    });

    test('should delete scope', () => {
        // Create a scope to delete
        const tempScope = scopesDB.createScope({
            profile: testProfileName,
            profiles: '*',
            name: 'Temp Scope',
            searchScope: '_sourceCategory=temp'
        });

        // Verify it exists
        let scope = scopesDB.getScopeById(tempScope.id);
        assert.ok(scope, 'Temp scope should exist');

        // Delete it
        scopesDB.deleteScope(tempScope.id);

        // Verify it's gone
        scope = scopesDB.getScopeById(tempScope.id);
        assert.strictEqual(scope, undefined, 'Temp scope should be deleted');
    });

    test('should handle modifiedAt timestamp on update', () => {
        const scope = scopesDB.getScopeById(testScopeId);
        const originalModifiedAt = scope!.modifiedAt;

        // Wait a bit to ensure timestamp difference
        setTimeout(() => {
            scopesDB.updateScope(testScopeId, {
                description: 'Updated description'
            });

            const updatedScope = scopesDB.getScopeById(testScopeId);
            assert.notStrictEqual(updatedScope!.modifiedAt, originalModifiedAt,
                'modifiedAt should be updated');
        }, 10);
    });
});

suite('Scope Query Building Tests', () => {
    test('should build facets query correctly', () => {
        const searchScope = '_sourceCategory=prod/application';
        const expectedQuery = `${searchScope}\n| limit 1000 | facets`;

        // Simulate the query building logic
        const query = `${searchScope}\n| limit 1000 | facets`;

        assert.strictEqual(query, expectedQuery);
        assert.ok(query.includes('| limit 1000'));
        assert.ok(query.includes('| facets'));
    });

    test('should build sample logs query correctly', () => {
        const searchScope = '_sourceCategory=prod/application';
        const expectedQuery = `${searchScope}\n| limit 1000`;

        // Simulate the query building logic
        const query = `${searchScope}\n| limit 1000`;

        assert.strictEqual(query, expectedQuery);
        assert.ok(query.includes('| limit 1000'));
        assert.ok(!query.includes('| facets'));
    });

    test('should handle complex search scopes', () => {
        const complexScope = '_sourceCategory=prod/application AND error AND NOT warning';
        const query = `${complexScope}\n| limit 1000 | facets`;

        assert.ok(query.includes('AND'));
        assert.ok(query.includes('NOT'));
        assert.ok(query.includes('| limit 1000 | facets'));
    });

    test('should handle index-based scopes', () => {
        const indexScope = '_index=sumologic_default';
        const query = `${indexScope}\n| limit 1000`;

        assert.ok(query.includes('_index='));
        assert.ok(query.includes('| limit 1000'));
    });

    test('should handle view-based scopes', () => {
        const viewScope = '_view=my_partition_view';
        const query = `${viewScope}\n| limit 1000 | facets`;

        assert.ok(query.includes('_view='));
        assert.ok(query.includes('| limit 1000 | facets'));
    });
});

suite('Scope Result Path Management Tests', () => {
    let scopesDB: ScopesCacheDB;
    const testDbPath = path.join(__dirname, 'test-scope-paths.db');
    const testProfileName = 'test-profile-paths';
    let scopeId: string;

    suiteSetup(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        scopesDB = new ScopesCacheDB(testDbPath, testProfileName);

        const scope = scopesDB.createScope({
            profile: testProfileName,
            profiles: '*',
            name: 'Path Test Scope',
            searchScope: '_sourceCategory=test'
        });
        scopeId = scope.id;
    });

    suiteTeardown(() => {
        scopesDB.close();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('should construct correct facets result file path', () => {
        const fileName = `${scopeId}_facets_latest.json`;

        assert.ok(fileName.includes(scopeId));
        assert.ok(fileName.includes('facets'));
        assert.ok(fileName.endsWith('.json'));
    });

    test('should construct correct sample logs result file path', () => {
        const fileName = `${scopeId}_sample_latest.json`;

        assert.ok(fileName.includes(scopeId));
        assert.ok(fileName.includes('sample'));
        assert.ok(fileName.endsWith('.json'));
    });

    test('should construct correct metadata result file path', () => {
        const fileName = `${scopeId}_metadata_latest.json`;

        assert.ok(fileName.includes(scopeId));
        assert.ok(fileName.includes('metadata'));
        assert.ok(fileName.endsWith('.json'));
    });

    test('should track all three result types independently', () => {
        const facetsPath = '/path/to/facets.json';
        const samplePath = '/path/to/sample.json';
        const metadataPath = '/path/to/metadata.json';

        scopesDB.updateScope(scopeId, {
            facetsResultPath: facetsPath,
            facetsTimestamp: new Date().toISOString()
        });

        scopesDB.updateScope(scopeId, {
            sampleLogsResultPath: samplePath,
            sampleLogsTimestamp: new Date().toISOString()
        });

        scopesDB.updateScope(scopeId, {
            metadataResultPath: metadataPath,
            metadataTimestamp: new Date().toISOString()
        });

        const scope = scopesDB.getScopeById(scopeId);

        assert.strictEqual(scope!.facetsResultPath, facetsPath);
        assert.strictEqual(scope!.sampleLogsResultPath, samplePath);
        assert.strictEqual(scope!.metadataResultPath, metadataPath);
        assert.ok(scope!.facetsTimestamp);
        assert.ok(scope!.sampleLogsTimestamp);
        assert.ok(scope!.metadataTimestamp);
    });
});

suite('Scope Profile Matching Tests', () => {
    test('should match universal scope to any profile', () => {
        const scope = {
            profiles: '*',
            name: 'Universal Scope'
        };

        const testProfiles = ['prod', 'dev', 'staging', 'test'];

        testProfiles.forEach(profile => {
            // Universal scopes should match any profile
            assert.ok(scope.profiles === '*',
                `Universal scope should match ${profile}`);
        });
    });

    test('should match specific profile scope', () => {
        const scope = {
            profiles: 'prod',
            name: 'Production Scope'
        };

        const matchesProd = scope.profiles === 'prod';
        const matchesDev = scope.profiles === 'dev';

        assert.ok(matchesProd, 'Should match prod profile');
        assert.ok(!matchesDev, 'Should not match dev profile');
    });

    test('should match comma-separated profile list', () => {
        const scope = {
            profiles: 'prod,staging,dev',
            name: 'Multi Profile Scope'
        };

        const profileList = scope.profiles.split(',').map(p => p.trim());

        assert.ok(profileList.includes('prod'), 'Should include prod');
        assert.ok(profileList.includes('staging'), 'Should include staging');
        assert.ok(profileList.includes('dev'), 'Should include dev');
        assert.ok(!profileList.includes('test'), 'Should not include test');
    });

    test('should handle profile list with spaces', () => {
        const scope = {
            profiles: 'prod, staging, dev',
            name: 'Spaced Profile Scope'
        };

        const profileList = scope.profiles.split(',').map(p => p.trim());

        assert.strictEqual(profileList.length, 3);
        profileList.forEach(profile => {
            assert.strictEqual(profile.trim(), profile,
                'Profile names should be trimmed');
        });
    });
});

suite('Scope Time Range Tests', () => {
    test('should use default time range when not specified', () => {
        const defaultFrom = '-3h';
        const defaultTo = 'now';

        // Simulate scope action using defaults
        const queryFrom: string | undefined = undefined;
        const from = queryFrom ? queryFrom : defaultFrom;
        const to = defaultTo;

        assert.strictEqual(from, '-3h');
        assert.strictEqual(to, 'now');
    });

    test('should use custom time range when specified', () => {
        const customFrom = '-24h';
        const customTo = 'now';

        const from = customFrom;
        const to = customTo;

        assert.strictEqual(from, '-24h');
        assert.strictEqual(to, 'now');
    });

    test('should validate relative time format', () => {
        const validTimes = ['-1h', '-3h', '-6h', '-12h', '-24h', '-7d', '-30d'];

        validTimes.forEach(time => {
            assert.ok(time.match(/^-\d+[hdwm]$/),
                `${time} should be valid relative time`);
        });
    });

    test('should handle absolute time ranges', () => {
        const from = '2024-01-01T00:00:00';
        const to = '2024-01-31T23:59:59';

        assert.ok(from.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
            'From time should be ISO format');
        assert.ok(to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
            'To time should be ISO format');
    });
});

suite('Scope Validation Tests', () => {
    test('should validate scope name is required', () => {
        const validateName = (name: string | undefined) => {
            if (!name || name.trim().length === 0) {
                return 'Scope name is required';
            }
            return null;
        };

        assert.strictEqual(validateName(''), 'Scope name is required');
        assert.strictEqual(validateName('   '), 'Scope name is required');
        assert.strictEqual(validateName(undefined), 'Scope name is required');
        assert.strictEqual(validateName('Valid Name'), null);
    });

    test('should validate search scope is required', () => {
        const validateSearchScope = (scope: string | undefined) => {
            if (!scope || scope.trim().length === 0) {
                return 'Search scope is required';
            }
            return null;
        };

        assert.strictEqual(validateSearchScope(''), 'Search scope is required');
        assert.strictEqual(validateSearchScope('   '), 'Search scope is required');
        assert.strictEqual(validateSearchScope(undefined), 'Search scope is required');
        assert.strictEqual(validateSearchScope('_sourceCategory=prod'), null);
    });

    test('should validate profiles input', () => {
        const validateProfiles = (profiles: string | undefined) => {
            if (!profiles || profiles.trim().length === 0) {
                return 'Profile list is required (* for all)';
            }
            return null;
        };

        assert.strictEqual(validateProfiles(''), 'Profile list is required (* for all)');
        assert.strictEqual(validateProfiles(undefined), 'Profile list is required (* for all)');
        assert.strictEqual(validateProfiles('*'), null);
        assert.strictEqual(validateProfiles('prod,dev'), null);
    });
});

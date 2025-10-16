import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { ScopesCacheDB, Scope } from '../../database/scopesCache';

suite('ScopesCache Test Suite', () => {
    let scopesDB: ScopesCacheDB;
    const testDbPath = path.join(__dirname, 'test-scopes.db');
    const testProfileName = 'test-profile-' + Date.now();

    suiteSetup(() => {
        // Clean up any existing test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        scopesDB = new ScopesCacheDB(testDbPath, testProfileName);
    });

    suiteTeardown(() => {
        // Cleanup
        scopesDB.close();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('should create a scope with default index search scope', () => {
        const newScope = scopesDB.createScope({
            profile: testProfileName,
            name: 'default index',
            searchScope: '_index = sumologic_default',
            description: '',
            context: ''
        });

        assert.ok(newScope.id, 'Scope should have an ID');
        assert.strictEqual(newScope.name, 'default index');
        assert.strictEqual(newScope.searchScope, '_index = sumologic_default');
        assert.strictEqual(newScope.description, '');
        assert.strictEqual(newScope.context, '');
        assert.strictEqual(newScope.profile, testProfileName);
        assert.ok(newScope.createdAt, 'Scope should have createdAt timestamp');
        assert.ok(newScope.modifiedAt, 'Scope should have modifiedAt timestamp');
    });

    test('should retrieve created scope by name', () => {
        const scope = scopesDB.getScopeByName('default index');

        assert.ok(scope, 'Scope should be found');
        assert.strictEqual(scope?.name, 'default index');
        assert.strictEqual(scope?.searchScope, '_index = sumologic_default');
    });

    test('should list all scopes for profile', () => {
        const scopes = scopesDB.getAllScopes();

        assert.ok(scopes.length > 0, 'Should have at least one scope');
        const defaultIndexScope = scopes.find(s => s.name === 'default index');
        assert.ok(defaultIndexScope, 'Should find the default index scope');
    });
});

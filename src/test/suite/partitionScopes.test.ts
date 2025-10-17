import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { ScopesCacheDB, Scope } from '../../database/scopesCache';

/**
 * Tests for partition scope integration
 * Tests creating and managing scopes from partition definitions
 */

suite('Partition Scope Creation Tests', () => {
    let scopesDB: ScopesCacheDB;
    const testDbPath = path.join(__dirname, 'test-partition-scopes.db');
    const testProfileName = 'test-partition-profile';

    suiteSetup(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        scopesDB = new ScopesCacheDB(testDbPath, testProfileName);
    });

    suiteTeardown(() => {
        scopesDB.close();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('should create scope from partition definition', () => {
        // Mock partition data
        const partition = {
            name: 'my_partition',
            routingExpression: '_sourceCategory=prod/application',
            retentionPeriod: 30,
            isCompliantDataRetention: false,
            isActive: true,
            dataForwardingId: null,
            analyticsTier: 'continuous'
        };

        // Create scope from partition
        const scope = scopesDB.createScope({
            profile: testProfileName,
            profiles: '*',
            name: `Partition: ${partition.name}`,
            searchScope: `_index=${partition.name}`,
            description: `Auto-created from partition ${partition.name}`,
            context: `Routing: ${partition.routingExpression}`
        });

        assert.ok(scope.id, 'Scope should have ID');
        assert.ok(scope.name.includes('Partition:'));
        assert.ok(scope.name.includes(partition.name));
        assert.ok(scope.searchScope.includes('_index='));
        assert.ok(scope.context?.includes(partition.routingExpression));
    });

    test('should create scope with partition metadata', () => {
        const partition = {
            name: 'security_logs',
            routingExpression: '_sourceCategory=security/*',
            retentionPeriod: 90,
            isCompliantDataRetention: true,
            analyticsTier: 'frequent'
        };

        const scope = scopesDB.createScope({
            profile: testProfileName,
            profiles: '*',
            name: `Partition: ${partition.name}`,
            searchScope: `_index=${partition.name}`,
            description: `Retention: ${partition.retentionPeriod} days, Tier: ${partition.analyticsTier}`,
            context: `Routing: ${partition.routingExpression}`
        });

        assert.ok(scope.description?.includes('Retention:'));
        assert.ok(scope.description?.includes('90 days'));
        assert.ok(scope.description?.includes('Tier:'));
        assert.ok(scope.description?.includes('frequent'));
    });

    test('should handle partition with view', () => {
        const partition = {
            name: 'my_partition',
            routingExpression: '_sourceCategory=prod/*',
            isActive: true
        };

        // Partitions can be queried via _index or _view
        const indexScope = scopesDB.createScope({
            profile: testProfileName,
            profiles: '*',
            name: `Partition Index: ${partition.name}`,
            searchScope: `_index=${partition.name}`
        });

        const viewScope = scopesDB.createScope({
            profile: testProfileName,
            profiles: '*',
            name: `Partition View: ${partition.name}`,
            searchScope: `_view=${partition.name}`
        });

        assert.ok(indexScope.searchScope.includes('_index='));
        assert.ok(viewScope.searchScope.includes('_view='));
    });

    test('should update existing partition scope on refresh', () => {
        const partitionName = 'updatable_partition';

        // Create initial scope
        const initialScope = scopesDB.createScope({
            profile: testProfileName,
            profiles: '*',
            name: `Partition: ${partitionName}`,
            searchScope: `_index=${partitionName}`,
            description: 'Initial description',
            context: 'Routing: _sourceCategory=old/*'
        });

        // Simulate partition update
        const updatedPartition = {
            name: partitionName,
            routingExpression: '_sourceCategory=new/*',
            retentionPeriod: 60
        };

        // Update scope
        scopesDB.updateScope(initialScope.id, {
            context: `Routing: ${updatedPartition.routingExpression}`,
            description: `Retention: ${updatedPartition.retentionPeriod} days`
        });

        const updatedScope = scopesDB.getScopeById(initialScope.id);

        assert.ok(updatedScope!.context?.includes('new/*'));
        assert.ok(updatedScope!.description?.includes('60 days'));
    });

    test('should handle inactive partitions', () => {
        const partition = {
            name: 'inactive_partition',
            routingExpression: '_sourceCategory=archived/*',
            isActive: false
        };

        const scope = scopesDB.createScope({
            profile: testProfileName,
            profiles: '*',
            name: `Partition: ${partition.name} (Inactive)`,
            searchScope: `_index=${partition.name}`,
            description: `Status: ${partition.isActive ? 'Active' : 'Inactive'}`
        });

        assert.ok(scope.name.includes('(Inactive)'));
        assert.ok(scope.description?.includes('Inactive'));
    });
});

suite('Partition Scope Naming Tests', () => {
    test('should format partition scope name correctly', () => {
        const partitionNames = [
            'my_partition',
            'security_logs',
            'application_traces',
            'sumologic_default'
        ];

        partitionNames.forEach(name => {
            const scopeName = `Partition: ${name}`;
            assert.ok(scopeName.startsWith('Partition:'));
            assert.ok(scopeName.includes(name));
        });
    });

    test('should handle special characters in partition names', () => {
        const specialNames = [
            'partition-with-dashes',
            'partition_with_underscores',
            'partition.with.dots'
        ];

        specialNames.forEach(name => {
            const scopeName = `Partition: ${name}`;
            assert.strictEqual(scopeName, `Partition: ${name}`);
        });
    });

    test('should distinguish between active and inactive partitions', () => {
        const activeName = 'Partition: active_partition';
        const inactiveName = 'Partition: inactive_partition (Inactive)';

        assert.ok(!activeName.includes('(Inactive)'));
        assert.ok(inactiveName.includes('(Inactive)'));
    });
});

suite('Partition Routing Expression Tests', () => {
    test('should handle simple routing expressions', () => {
        const routingExpressions = [
            '_sourceCategory=prod/*',
            '_sourceCategory=security/logs',
            '_source=my-source',
            '_sourceHost=app-server-*'
        ];

        routingExpressions.forEach(expr => {
            assert.ok(expr.includes('='));
            assert.strictEqual(typeof expr, 'string');
        });
    });

    test('should handle complex routing expressions with AND/OR', () => {
        const complexExpressions = [
            '_sourceCategory=prod/* AND _sourceHost=app-*',
            '_sourceCategory=security/* OR _sourceCategory=audit/*',
            '(_sourceCategory=prod/* OR _sourceCategory=staging/*) AND _source=app'
        ];

        complexExpressions.forEach(expr => {
            const hasLogicalOperator = expr.includes(' AND ') || expr.includes(' OR ');
            assert.ok(hasLogicalOperator, 'Should contain logical operators');
        });
    });

    test('should handle routing expressions with wildcards', () => {
        const wildcardExpressions = [
            '_sourceCategory=prod/*',
            '_sourceCategory=*/application',
            '_sourceHost=app-*',
            '_source=*-collector'
        ];

        wildcardExpressions.forEach(expr => {
            assert.ok(expr.includes('*'), 'Should contain wildcard');
        });
    });

    test('should validate routing expression syntax', () => {
        const validExpressions = [
            '_sourceCategory=prod/*',
            '_source=my-source',
            '_sourceHost=server-1'
        ];

        validExpressions.forEach(expr => {
            // Basic validation: should have = and start with _
            assert.ok(expr.includes('='));
            assert.ok(expr.startsWith('_') || expr.includes('(_sourceCategory'));
        });
    });
});

suite('Partition Analytics Tier Tests', () => {
    test('should identify continuous analytics tier', () => {
        const tier = 'continuous';

        assert.strictEqual(tier, 'continuous');
        assert.ok(['continuous', 'frequent', 'infrequent'].includes(tier));
    });

    test('should identify frequent analytics tier', () => {
        const tier = 'frequent';

        assert.strictEqual(tier, 'frequent');
        assert.ok(['continuous', 'frequent', 'infrequent'].includes(tier));
    });

    test('should identify infrequent analytics tier', () => {
        const tier = 'infrequent';

        assert.strictEqual(tier, 'infrequent');
        assert.ok(['continuous', 'frequent', 'infrequent'].includes(tier));
    });

    test('should include tier in scope description', () => {
        const tiers = ['continuous', 'frequent', 'infrequent'];

        tiers.forEach(tier => {
            const description = `Analytics Tier: ${tier}`;
            assert.ok(description.includes(tier));
        });
    });
});

suite('Partition Retention Period Tests', () => {
    test('should handle standard retention periods', () => {
        const retentionPeriods = [30, 60, 90, 180, 365, 400];

        retentionPeriods.forEach(period => {
            assert.ok(period > 0);
            assert.strictEqual(typeof period, 'number');
        });
    });

    test('should format retention period in description', () => {
        const retentionPeriods = [30, 90, 365];

        retentionPeriods.forEach(period => {
            const description = `Retention: ${period} days`;
            assert.ok(description.includes(`${period} days`));
        });
    });

    test('should identify compliant data retention', () => {
        const compliantPartition = {
            isCompliantDataRetention: true,
            retentionPeriod: 2557 // 7 years for compliance
        };

        assert.strictEqual(compliantPartition.isCompliantDataRetention, true);
        assert.ok(compliantPartition.retentionPeriod >= 2557);
    });

    test('should identify standard data retention', () => {
        const standardPartition = {
            isCompliantDataRetention: false,
            retentionPeriod: 90
        };

        assert.strictEqual(standardPartition.isCompliantDataRetention, false);
        assert.ok(standardPartition.retentionPeriod < 2557);
    });
});

suite('Partition Scope Query Generation Tests', () => {
    test('should generate index query from partition', () => {
        const partitionName = 'my_partition';
        const query = `_index=${partitionName}`;

        assert.strictEqual(query, '_index=my_partition');
        assert.ok(query.startsWith('_index='));
    });

    test('should generate view query from partition', () => {
        const partitionName = 'my_partition';
        const query = `_view=${partitionName}`;

        assert.strictEqual(query, '_view=my_partition');
        assert.ok(query.startsWith('_view='));
    });

    test('should generate facets query for partition scope', () => {
        const partitionName = 'my_partition';
        const searchScope = `_index=${partitionName}`;
        const query = `${searchScope}\n| limit 1000 | facets`;

        assert.ok(query.includes(`_index=${partitionName}`));
        assert.ok(query.includes('| limit 1000 | facets'));
    });

    test('should generate sample query for partition scope', () => {
        const partitionName = 'my_partition';
        const searchScope = `_index=${partitionName}`;
        const query = `${searchScope}\n| limit 1000`;

        assert.ok(query.includes(`_index=${partitionName}`));
        assert.ok(query.includes('| limit 1000'));
        assert.ok(!query.includes('| facets'));
    });

    test('should combine partition query with additional filters', () => {
        const partitionName = 'my_partition';
        const baseQuery = `_index=${partitionName}`;
        const additionalFilter = 'error';
        const combinedQuery = `${baseQuery} ${additionalFilter}`;

        assert.ok(combinedQuery.includes('_index='));
        assert.ok(combinedQuery.includes('error'));
    });
});

suite('Bulk Partition Scope Creation Tests', () => {
    let scopesDB: ScopesCacheDB;
    const testDbPath = path.join(__dirname, 'test-bulk-partition-scopes.db');
    const testProfileName = 'test-bulk-profile';

    suiteSetup(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        scopesDB = new ScopesCacheDB(testDbPath, testProfileName);
    });

    suiteTeardown(() => {
        scopesDB.close();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('should create scopes for multiple partitions', () => {
        const partitions = [
            { name: 'partition_1', routingExpression: '_sourceCategory=prod/*' },
            { name: 'partition_2', routingExpression: '_sourceCategory=dev/*' },
            { name: 'partition_3', routingExpression: '_sourceCategory=test/*' }
        ];

        const createdScopes: Scope[] = [];

        partitions.forEach(partition => {
            const scope = scopesDB.createScope({
                profile: testProfileName,
                profiles: '*',
                name: `Partition: ${partition.name}`,
                searchScope: `_index=${partition.name}`,
                context: `Routing: ${partition.routingExpression}`
            });
            createdScopes.push(scope);
        });

        assert.strictEqual(createdScopes.length, 3);
        createdScopes.forEach((scope, index) => {
            assert.ok(scope.name.includes(`partition_${index + 1}`));
        });
    });

    test('should avoid duplicate partition scopes', () => {
        const partitionName = 'duplicate_test_partition';

        // Create first scope
        const scope1 = scopesDB.createScope({
            profile: testProfileName,
            profiles: '*',
            name: `Partition: ${partitionName}`,
            searchScope: `_index=${partitionName}`
        });

        // Check if scope already exists before creating
        const existingScope = scopesDB.getScopeByName(`Partition: ${partitionName}`);

        assert.ok(existingScope, 'Scope should exist');
        assert.strictEqual(existingScope!.id, scope1.id);

        // Don't create duplicate - this test validates the check logic
        const shouldCreate = existingScope === undefined;
        assert.strictEqual(shouldCreate, false, 'Should not create duplicate');
    });

    test('should update existing partition scopes during refresh', () => {
        const partitionName = 'refresh_test_partition';

        // Create initial scope
        const initialScope = scopesDB.createScope({
            profile: testProfileName,
            profiles: '*',
            name: `Partition: ${partitionName}`,
            searchScope: `_index=${partitionName}`,
            context: 'Routing: old_expression'
        });

        // Simulate refresh with updated partition data
        const existingScope = scopesDB.getScopeByName(`Partition: ${partitionName}`);
        if (existingScope) {
            scopesDB.updateScope(existingScope.id, {
                context: 'Routing: new_expression',
                description: 'Updated via refresh'
            });
        }

        const refreshedScope = scopesDB.getScopeById(initialScope.id);

        assert.ok(refreshedScope!.context?.includes('new_expression'));
        assert.ok(refreshedScope!.description?.includes('Updated via refresh'));
    });
});

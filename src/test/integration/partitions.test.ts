import * as assert from 'assert';
import * as vscode from 'vscode';
import { PartitionsClient, Partition } from '../../api/partitions';
import {
    shouldRunIntegrationTests,
    getIntegrationTestConfig,
    setupIntegrationProfile,
    cleanupIntegrationProfile,
    skipIfNotConfigured
} from './testHelper';
import { ProfileManager } from '../../profileManager';

suite('Partitions API Integration Tests', function() {
    this.timeout(30000);

    let client: PartitionsClient;
    let context: vscode.ExtensionContext;
    let profileManager: ProfileManager;

    suiteSetup(async function() {
        if (!shouldRunIntegrationTests()) { this.skip(); return; };

        if (!shouldRunIntegrationTests()) {
            return;
        }

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

        profileManager = await setupIntegrationProfile(context);

        const config = getIntegrationTestConfig();
        client = new PartitionsClient({ accessId: config.accessId, accessKey: config.accessKey, endpoint: config.endpoint });

        console.log('✅ Partitions API test environment configured');
    });

    suiteTeardown(async function() {
        if (shouldRunIntegrationTests() && profileManager) {
            await cleanupIntegrationProfile(profileManager);
        }
    });

    test('should list partitions', async () => {
        const response = await client.listPartitions();

        assert.ok(response.data, 'Response should have data');
        assert.ok(Array.isArray(response.data!.data), 'Data should be an array');

        const partitions = response.data!.data;
        console.log(`✅ Found ${partitions.length} partitions`);

        if (partitions.length > 0) {
            partitions.slice(0, 5).forEach(partition => {
                console.log(`   - ${partition.name} (${partition.isActive ? 'Active' : 'Inactive'})`);
            });
            if (partitions.length > 5) {
                console.log(`   ... and ${partitions.length - 5} more`);
            }
        }
    });

    test('should verify partition structure', async () => {
        const response = await client.listPartitions();
        const partitions = response.data!.data;

        if (partitions.length === 0) {
            console.log('⚠️  No partitions found to verify structure');
            return;
        }

        const partition = partitions[0];

        // Verify required fields
        assert.ok(partition.id, 'Partition should have ID');
        assert.ok(partition.name, 'Partition should have name');
        assert.ok(partition.routingExpression, 'Partition should have routingExpression');
        assert.ok(typeof partition.retentionPeriod === 'number', 'Partition should have retentionPeriod');
        assert.ok(typeof partition.isActive === 'boolean', 'Partition should have isActive');
        assert.ok(typeof partition.isCompliant === 'boolean', 'Partition should have isCompliant');
        assert.ok(typeof partition.totalBytes === 'number', 'Partition should have totalBytes');

        console.log('✅ Partition structure verified');
        console.log(`   ID: ${partition.id}`);
        console.log(`   Name: ${partition.name}`);
        console.log(`   Active: ${partition.isActive}`);
        console.log(`   Retention: ${partition.retentionPeriod} days`);
    });

    test('should extract partition names', async () => {
        const response = await client.listPartitions();
        const partitionNames = PartitionsClient.extractPartitionNames(response.data!);

        assert.ok(Array.isArray(partitionNames), 'Partition names should be an array');

        if (partitionNames.length > 0) {
            console.log(`✅ Extracted ${partitionNames.length} partition names:`);
            partitionNames.slice(0, 5).forEach(name => {
                assert.ok(typeof name === 'string', 'Partition name should be a string');
                console.log(`   - ${name}`);
            });
        } else {
            console.log('⚠️  No partition names to extract');
        }
    });

    test('should format partitions as table', async () => {
        const response = await client.listPartitions();
        const partitions = response.data!.data;

        const table = PartitionsClient.formatPartitionsAsTable(partitions);

        assert.ok(typeof table === 'string', 'Table should be a string');
        assert.ok(table.length > 0, 'Table should not be empty');

        console.log('✅ Partitions formatted as table:');
        console.log(table);
    });

    test('should filter active partitions', async () => {
        const response = await client.listPartitions();
        const partitions = response.data!.data;

        const activePartitions = partitions.filter(p => p.isActive);
        const inactivePartitions = partitions.filter(p => !p.isActive);

        console.log(`✅ Active partitions: ${activePartitions.length}`);
        console.log(`   Inactive partitions: ${inactivePartitions.length}`);

        if (activePartitions.length > 0) {
            console.log('   Active partition names:');
            activePartitions.slice(0, 5).forEach(p => {
                console.log(`     - ${p.name}`);
            });
        }
    });

    test('should verify partition routing expressions', async () => {
        const response = await client.listPartitions();
        const partitions = response.data!.data;

        if (partitions.length === 0) {
            console.log('⚠️  No partitions to verify routing expressions');
            return;
        }

        console.log('✅ Partition routing expressions:');
        partitions.slice(0, 5).forEach(partition => {
            assert.ok(partition.routingExpression, 'Routing expression should exist');
            assert.ok(typeof partition.routingExpression === 'string', 'Routing expression should be a string');

            console.log(`   ${partition.name}:`);
            console.log(`     ${partition.routingExpression}`);
        });
    });

    test('should verify partition retention periods', async () => {
        const response = await client.listPartitions();
        const partitions = response.data!.data;

        if (partitions.length === 0) {
            console.log('⚠️  No partitions to verify retention periods');
            return;
        }

        const retentionPeriods = new Set(partitions.map(p => p.retentionPeriod));

        console.log(`✅ Found ${retentionPeriods.size} different retention periods:`);
        Array.from(retentionPeriods).sort((a, b) => a - b).forEach(days => {
            const count = partitions.filter(p => p.retentionPeriod === days).length;
            console.log(`   ${days} days: ${count} partition(s)`);
        });

        // Verify retention periods are positive
        partitions.forEach(partition => {
            assert.ok(partition.retentionPeriod > 0, `Retention period should be positive for ${partition.name}`);
        });
    });

    test('should verify partition sizes', async () => {
        const response = await client.listPartitions();
        const partitions = response.data!.data;

        if (partitions.length === 0) {
            console.log('⚠️  No partitions to verify sizes');
            return;
        }

        const totalBytes = partitions.reduce((sum, p) => sum + p.totalBytes, 0);

        const formatBytes = (bytes: number): string => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
        };

        console.log(`✅ Total size across ${partitions.length} partitions: ${formatBytes(totalBytes)}`);

        // Show largest partitions
        const sortedBySize = [...partitions].sort((a, b) => b.totalBytes - a.totalBytes);
        console.log('   Largest partitions:');
        sortedBySize.slice(0, 5).forEach(p => {
            console.log(`     ${p.name}: ${formatBytes(p.totalBytes)}`);
        });

        // Verify sizes are non-negative
        partitions.forEach(partition => {
            assert.ok(partition.totalBytes >= 0, `Total bytes should be non-negative for ${partition.name}`);
        });
    });

    test('should verify partition analytics tiers', async () => {
        const response = await client.listPartitions();
        const partitions = response.data!.data;

        if (partitions.length === 0) {
            console.log('⚠️  No partitions to verify analytics tiers');
            return;
        }

        const tiers = new Set(partitions.map(p => p.analyticsTier || 'N/A'));

        console.log(`✅ Analytics tiers in use:`);
        Array.from(tiers).forEach(tier => {
            const count = partitions.filter(p => (p.analyticsTier || 'N/A') === tier).length;
            console.log(`   ${tier}: ${count} partition(s)`);
        });
    });

    test('should verify default search inclusion', async () => {
        const response = await client.listPartitions();
        const partitions = response.data!.data;

        if (partitions.length === 0) {
            console.log('⚠️  No partitions to verify default search inclusion');
            return;
        }

        const includedPartitions = partitions.filter(p => p.isIncludedInDefaultSearch === true);
        const excludedPartitions = partitions.filter(p => p.isIncludedInDefaultSearch === false);
        const unknownPartitions = partitions.filter(p => p.isIncludedInDefaultSearch === undefined);

        console.log('✅ Default search inclusion:');
        console.log(`   Included: ${includedPartitions.length}`);
        console.log(`   Excluded: ${excludedPartitions.length}`);
        console.log(`   Unknown: ${unknownPartitions.length}`);

        if (includedPartitions.length > 0) {
            console.log('   Included partitions:');
            includedPartitions.slice(0, 5).forEach(p => {
                console.log(`     - ${p.name}`);
            });
        }
    });
});

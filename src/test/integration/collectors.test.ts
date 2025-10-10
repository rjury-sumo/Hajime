import * as assert from 'assert';
import * as vscode from 'vscode';
import { CollectorsClient, Collector } from '../../api/collectors';
import {
    shouldRunIntegrationTests,
    getIntegrationTestConfig,
    setupIntegrationProfile,
    cleanupIntegrationProfile,
    skipIfNotConfigured
} from './testHelper';
import { ProfileManager } from '../../profileManager';

suite('Collectors API Integration Tests', function() {
    this.timeout(30000);

    let client: CollectorsClient;
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
        client = new CollectorsClient({ accessId: config.accessId, accessKey: config.accessKey, endpoint: config.endpoint });

        console.log('✅ Collectors API test environment configured');
    });

    suiteTeardown(async function() {
        if (shouldRunIntegrationTests() && profileManager) {
            await cleanupIntegrationProfile(profileManager);
        }
    });

    test('should list collectors with default limit', async () => {
        const response = await client.listCollectors();

        assert.ok(response.data, 'Response should have data');
        assert.ok(Array.isArray(response.data!.collectors), 'Data should contain collectors array');

        const collectors = response.data!.collectors;
        console.log(`✅ Found ${collectors.length} collectors`);

        if (collectors.length > 0) {
            collectors.slice(0, 5).forEach(collector => {
                console.log(`   - ${collector.name} (${collector.collectorType}, ${collector.alive ? 'Alive' : 'Dead'})`);
            });
            if (collectors.length > 5) {
                console.log(`   ... and ${collectors.length - 5} more`);
            }
        }
    });

    test('should list collectors with custom limit', async () => {
        const response = await client.listCollectors({ limit: 10 });

        assert.ok(response.data, 'Response should have data');
        assert.ok(Array.isArray(response.data!.collectors), 'Data should contain collectors array');

        const collectors = response.data!.collectors;
        assert.ok(collectors.length <= 10, 'Should return at most 10 collectors');

        console.log(`✅ Found ${collectors.length} collectors (limit: 10)`);
    });

    test('should fetch all collectors with automatic pagination', async () => {
        const response = await client.fetchAllCollectors();

        assert.ok(response.data, 'Response should have data');
        assert.ok(Array.isArray(response.data!.collectors), 'Data should contain collectors array');

        const collectors = response.data!.collectors;
        console.log(`✅ Fetched all ${collectors.length} collectors using automatic pagination`);

        if (collectors.length > 0) {
            console.log(`   First collector: ${collectors[0].name}`);
            console.log(`   Last collector: ${collectors[collectors.length - 1].name}`);
        }
    });

    test('should verify collector structure', async () => {
        const response = await client.listCollectors();
        const collectors = response.data!.collectors;

        if (collectors.length === 0) {
            console.log('⚠️  No collectors found to verify structure');
            return;
        }

        const collector = collectors[0];

        // Verify required fields
        assert.ok(typeof collector.id === 'number', 'Collector should have numeric ID');
        assert.ok(collector.name, 'Collector should have name');
        assert.ok(collector.collectorType, 'Collector should have collectorType');
        assert.ok(typeof collector.alive === 'boolean', 'Collector should have alive status');

        console.log('✅ Collector structure verified');
        console.log(`   ID: ${collector.id}`);
        console.log(`   Name: ${collector.name}`);
        console.log(`   Type: ${collector.collectorType}`);
        console.log(`   Alive: ${collector.alive}`);
        if (collector.hostName) {
            console.log(`   Host: ${collector.hostName}`);
        }
    });

    test('should format collectors as table', async () => {
        const response = await client.listCollectors();
        const collectors = response.data!.collectors;

        const table = CollectorsClient.formatCollectorsAsTable(collectors);

        assert.ok(typeof table === 'string', 'Table should be a string');
        assert.ok(table.length > 0, 'Table should not be empty');

        console.log('✅ Collectors formatted as table:');
        console.log(table);
    });

    test('should get collector statistics', async () => {
        const response = await client.fetchAllCollectors();
        const collectors = response.data!.collectors;

        const stats = CollectorsClient.getCollectorStats(collectors);

        assert.ok(typeof stats.total === 'number', 'Stats should have total count');
        assert.ok(typeof stats.alive === 'number', 'Stats should have alive count');
        assert.ok(typeof stats.dead === 'number', 'Stats should have dead count');
        assert.ok(typeof stats.ephemeral === 'number', 'Stats should have ephemeral count');
        assert.ok(typeof stats.byType === 'object', 'Stats should have byType breakdown');

        assert.strictEqual(stats.total, collectors.length, 'Total should match collectors length');
        assert.strictEqual(stats.alive + stats.dead, stats.total, 'Alive + Dead should equal Total');

        console.log('✅ Collector statistics:');
        console.log(`   Total: ${stats.total}`);
        console.log(`   Alive: ${stats.alive}`);
        console.log(`   Dead: ${stats.dead}`);
        console.log(`   Ephemeral: ${stats.ephemeral}`);
        console.log('   By Type:');
        Object.entries(stats.byType).forEach(([type, count]) => {
            console.log(`     ${type}: ${count}`);
        });
    });

    test('should filter alive collectors', async () => {
        const response = await client.fetchAllCollectors();
        const collectors = response.data!.collectors;

        const aliveCollectors = collectors.filter(c => c.alive);
        const deadCollectors = collectors.filter(c => !c.alive);

        console.log(`✅ Alive collectors: ${aliveCollectors.length}`);
        console.log(`   Dead collectors: ${deadCollectors.length}`);

        if (aliveCollectors.length > 0) {
            console.log('   Alive collector names:');
            aliveCollectors.slice(0, 5).forEach(c => {
                console.log(`     - ${c.name} (${c.collectorType})`);
            });
        }

        if (deadCollectors.length > 0) {
            console.log('   Dead collector names:');
            deadCollectors.slice(0, 5).forEach(c => {
                console.log(`     - ${c.name} (${c.collectorType})`);
            });
        }
    });

    test('should verify collector types', async () => {
        const response = await client.fetchAllCollectors();
        const collectors = response.data!.collectors;

        if (collectors.length === 0) {
            console.log('⚠️  No collectors to verify types');
            return;
        }

        const types = new Set(collectors.map(c => c.collectorType));

        console.log(`✅ Found ${types.size} different collector types:`);
        Array.from(types).forEach(type => {
            const count = collectors.filter(c => c.collectorType === type).length;
            console.log(`   ${type}: ${count} collector(s)`);
        });

        // Verify types are valid strings
        collectors.forEach(collector => {
            assert.ok(collector.collectorType, `Collector type should exist for ${collector.name}`);
            assert.ok(typeof collector.collectorType === 'string', `Collector type should be string for ${collector.name}`);
        });
    });

    test('should verify ephemeral collectors', async () => {
        const response = await client.fetchAllCollectors();
        const collectors = response.data!.collectors;

        if (collectors.length === 0) {
            console.log('⚠️  No collectors to verify ephemeral status');
            return;
        }

        const ephemeralCollectors = collectors.filter(c => c.ephemeral === true);
        const nonEphemeralCollectors = collectors.filter(c => c.ephemeral === false);

        console.log('✅ Ephemeral collectors:');
        console.log(`   Ephemeral: ${ephemeralCollectors.length}`);
        console.log(`   Non-ephemeral: ${nonEphemeralCollectors.length}`);

        if (ephemeralCollectors.length > 0) {
            console.log('   Ephemeral collector names:');
            ephemeralCollectors.slice(0, 5).forEach(c => {
                console.log(`     - ${c.name}`);
            });
        }
    });

    test('should verify collector versions', async () => {
        const response = await client.fetchAllCollectors();
        const collectors = response.data!.collectors;

        if (collectors.length === 0) {
            console.log('⚠️  No collectors to verify versions');
            return;
        }

        const collectorsWithVersion = collectors.filter(c => c.collectorVersion);

        console.log(`✅ Collectors with version info: ${collectorsWithVersion.length}/${collectors.length}`);

        if (collectorsWithVersion.length > 0) {
            const versions = new Set(collectorsWithVersion.map(c => c.collectorVersion));
            console.log(`   Unique versions: ${versions.size}`);
            Array.from(versions).slice(0, 5).forEach(version => {
                const count = collectorsWithVersion.filter(c => c.collectorVersion === version).length;
                console.log(`     ${version}: ${count} collector(s)`);
            });
        }
    });

    test('should verify last seen timestamps', async () => {
        const response = await client.fetchAllCollectors();
        const collectors = response.data!.collectors;

        if (collectors.length === 0) {
            console.log('⚠️  No collectors to verify last seen');
            return;
        }

        const collectorsWithLastSeen = collectors.filter(c => c.lastSeenAlive);

        console.log(`✅ Collectors with last seen data: ${collectorsWithLastSeen.length}/${collectors.length}`);

        if (collectorsWithLastSeen.length > 0) {
            const sortedByLastSeen = [...collectorsWithLastSeen].sort((a, b) =>
                (b.lastSeenAlive || 0) - (a.lastSeenAlive || 0)
            );

            console.log('   Most recently seen:');
            sortedByLastSeen.slice(0, 3).forEach(c => {
                const date = new Date(c.lastSeenAlive!);
                console.log(`     ${c.name}: ${date.toISOString()}`);
            });
        }
    });
});

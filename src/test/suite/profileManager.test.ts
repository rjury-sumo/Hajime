import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager, SumoLogicProfile } from '../../profileManager';

suite('ProfileManager Test Suite', () => {
    let context: vscode.ExtensionContext;
    let profileManager: ProfileManager;
    const testProfileName = 'test-profile-' + Date.now();
    const testProfile: SumoLogicProfile = {
        name: testProfileName,
        region: 'https://api.us2.sumologic.com'
    };

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

    suiteTeardown(async () => {
        // Cleanup test profile
        try {
            const profiles = await profileManager.getProfiles();
            if (profiles.find(p => p.name === testProfileName)) {
                await profileManager.deleteProfile(testProfileName);
            }
        } catch (err) {
            // Ignore cleanup errors
        }
    });

    test('should create a new profile', async () => {
        await profileManager.createProfile(testProfile, 'test-access-id', 'test-access-key');

        const profiles = await profileManager.getProfiles();
        const createdProfile = profiles.find(p => p.name === testProfileName);

        assert.ok(createdProfile, 'Profile should be created');
        assert.strictEqual(createdProfile?.region, testProfile.region);
    });

    test('should get profile credentials', async () => {
        const credentials = await profileManager.getProfileCredentials(testProfileName);

        assert.ok(credentials, 'Credentials should exist');
        assert.strictEqual(credentials?.accessId, 'test-access-id');
        assert.strictEqual(credentials?.accessKey, 'test-access-key');
    });

    test('should get active profile', async () => {
        await profileManager.setActiveProfile(testProfileName);

        const activeProfile = await profileManager.getActiveProfile();

        assert.ok(activeProfile, 'Active profile should exist');
        assert.strictEqual(activeProfile?.name, testProfileName);
    });

    test('should get profile directory path', () => {
        const profileDir = profileManager.getProfileDirectory(testProfileName);

        assert.ok(profileDir, 'Profile directory path should exist');
        assert.ok(profileDir.includes(testProfileName), 'Path should include profile name');
    });

    test('should get profile endpoint', () => {
        const endpoint = profileManager.getProfileEndpoint(testProfile);

        assert.strictEqual(endpoint, testProfile.region);
    });

    test('should handle custom endpoint', () => {
        const customProfile: SumoLogicProfile = {
            name: 'custom',
            region: 'us2',
            endpoint: 'https://custom.sumologic.com'
        };

        const endpoint = profileManager.getProfileEndpoint(customProfile);

        assert.strictEqual(endpoint, customProfile.endpoint);
    });

    test('should check if profiles exist', async () => {
        const hasProfiles = await profileManager.hasProfiles();

        assert.strictEqual(hasProfiles, true, 'Should have at least one profile');
    });

    test('should update profile', async () => {
        const updatedRegion = 'https://api.eu.sumologic.com';
        await profileManager.updateProfile(testProfileName, { region: updatedRegion });

        const profiles = await profileManager.getProfiles();
        const updatedProfile = profiles.find(p => p.name === testProfileName);

        assert.strictEqual(updatedProfile?.region, updatedRegion);
    });

    test('should delete profile', async () => {
        await profileManager.deleteProfile(testProfileName);

        const profiles = await profileManager.getProfiles();
        const deletedProfile = profiles.find(p => p.name === testProfileName);

        assert.strictEqual(deletedProfile, undefined, 'Profile should be deleted');
    });

    test('should throw error when creating duplicate profile', async () => {
        await profileManager.createProfile(testProfile, 'test-id', 'test-key');

        await assert.rejects(
            async () => await profileManager.createProfile(testProfile, 'test-id', 'test-key'),
            /already exists/,
            'Should throw error for duplicate profile'
        );
    });

    test('should throw error when deleting non-existent profile', async () => {
        await assert.rejects(
            async () => await profileManager.deleteProfile('non-existent-profile-' + Date.now()),
            /not found/,
            'Should throw error for non-existent profile'
        );
    });
});

import * as vscode from 'vscode';
import { SumoLogicClient, SumoLogicConfig } from '../../api/client';
import { ProfileManager, SumoLogicProfile } from '../../profileManager';

/**
 * Integration test configuration from environment variables
 */
export interface IntegrationTestConfig {
    accessId: string;
    accessKey: string;
    endpoint: string;
    profileName: string;
}

/**
 * Get integration test configuration from environment variables
 */
export function getIntegrationTestConfig(): IntegrationTestConfig {
    const accessId = process.env.SUMO_ACCESS_ID;
    const accessKey = process.env.SUMO_ACCESS_KEY;

    if (!accessId || !accessKey) {
        throw new Error(
            'Integration tests require SUMO_ACCESS_ID and SUMO_ACCESS_KEY environment variables. ' +
            'Set these variables to run integration tests.'
        );
    }

    return {
        accessId,
        accessKey,
        endpoint: 'au', // Australia region
        profileName: 'integration_test'
    };
}

/**
 * Check if integration tests should run
 */
export function shouldRunIntegrationTests(): boolean {
    return !!(process.env.SUMO_ACCESS_ID && process.env.SUMO_ACCESS_KEY);
}

/**
 * Create a Sumo Logic API client for integration tests
 */
export function createIntegrationClient(): SumoLogicClient {
    const config = getIntegrationTestConfig();

    const clientConfig: SumoLogicConfig = {
        accessId: config.accessId,
        accessKey: config.accessKey,
        endpoint: config.endpoint
    };

    return new SumoLogicClient(clientConfig);
}

/**
 * Setup integration test profile
 */
export async function setupIntegrationProfile(context: vscode.ExtensionContext): Promise<ProfileManager> {
    const config = getIntegrationTestConfig();
    const profileManager = new ProfileManager(context);

    // Check if profile already exists
    const profiles = await profileManager.getProfiles();
    const existingProfile = profiles.find(p => p.name === config.profileName);

    const profile: SumoLogicProfile = {
        name: config.profileName,
        region: config.endpoint
    };

    if (existingProfile) {
        // Update existing profile
        await profileManager.updateProfile(
            config.profileName,
            profile,
            config.accessId,
            config.accessKey
        );
    } else {
        // Create new profile
        await profileManager.createProfile(
            profile,
            config.accessId,
            config.accessKey
        );
    }

    // Set as active profile
    await profileManager.setActiveProfile(config.profileName);

    return profileManager;
}

/**
 * Cleanup integration test profile
 */
export async function cleanupIntegrationProfile(profileManager: ProfileManager): Promise<void> {
    const config = getIntegrationTestConfig();

    try {
        const profiles = await profileManager.getProfiles();
        if (profiles.find(p => p.name === config.profileName)) {
            await profileManager.deleteProfile(config.profileName);
        }
    } catch (error) {
        // Ignore cleanup errors
        console.error('Failed to cleanup integration test profile:', error);
    }
}

/**
 * Skip test suite if integration tests are not configured
 */
export function skipIfNotConfigured(suite: Mocha.Suite): void {
    if (!shouldRunIntegrationTests()) {
        suite.pending = true;
        console.log('⚠️  Skipping integration tests - SUMO_ACCESS_ID and SUMO_ACCESS_KEY not set');
    }
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
    condition: () => Promise<boolean>,
    options: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
    const timeout = options.timeout || 30000; // 30 seconds default
    const interval = options.interval || 1000; // 1 second default
    const message = options.message || 'Condition not met';

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        if (await condition()) {
            return;
        }
        await sleep(interval);
    }

    throw new Error(`${message} (timeout after ${timeout}ms)`);
}

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a unique test identifier
 */
export function generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

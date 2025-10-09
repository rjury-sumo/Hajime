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
exports.getIntegrationTestConfig = getIntegrationTestConfig;
exports.shouldRunIntegrationTests = shouldRunIntegrationTests;
exports.createIntegrationClient = createIntegrationClient;
exports.setupIntegrationProfile = setupIntegrationProfile;
exports.cleanupIntegrationProfile = cleanupIntegrationProfile;
exports.skipIfNotConfigured = skipIfNotConfigured;
exports.waitFor = waitFor;
exports.sleep = sleep;
exports.generateTestId = generateTestId;
const client_1 = require("../../api/client");
const profileManager_1 = require("../../profileManager");
/**
 * Get integration test configuration from environment variables
 */
function getIntegrationTestConfig() {
    const accessId = process.env.SUMO_ACCESS_ID;
    const accessKey = process.env.SUMO_ACCESS_KEY;
    if (!accessId || !accessKey) {
        throw new Error('Integration tests require SUMO_ACCESS_ID and SUMO_ACCESS_KEY environment variables. ' +
            'Set these variables to run integration tests.');
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
function shouldRunIntegrationTests() {
    return !!(process.env.SUMO_ACCESS_ID && process.env.SUMO_ACCESS_KEY);
}
/**
 * Create a Sumo Logic API client for integration tests
 */
function createIntegrationClient() {
    const config = getIntegrationTestConfig();
    const clientConfig = {
        accessId: config.accessId,
        accessKey: config.accessKey,
        endpoint: config.endpoint
    };
    return new client_1.SumoLogicClient(clientConfig);
}
/**
 * Setup integration test profile
 */
function setupIntegrationProfile(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = getIntegrationTestConfig();
        const profileManager = new profileManager_1.ProfileManager(context);
        // Check if profile already exists
        const profiles = yield profileManager.getProfiles();
        const existingProfile = profiles.find(p => p.name === config.profileName);
        const profile = {
            name: config.profileName,
            region: config.endpoint
        };
        if (existingProfile) {
            // Update existing profile
            yield profileManager.updateProfile(config.profileName, profile, config.accessId, config.accessKey);
        }
        else {
            // Create new profile
            yield profileManager.createProfile(profile, config.accessId, config.accessKey);
        }
        // Set as active profile
        yield profileManager.setActiveProfile(config.profileName);
        return profileManager;
    });
}
/**
 * Cleanup integration test profile
 */
function cleanupIntegrationProfile(profileManager) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = getIntegrationTestConfig();
        try {
            const profiles = yield profileManager.getProfiles();
            if (profiles.find(p => p.name === config.profileName)) {
                yield profileManager.deleteProfile(config.profileName);
            }
        }
        catch (error) {
            // Ignore cleanup errors
            console.error('Failed to cleanup integration test profile:', error);
        }
    });
}
/**
 * Skip test suite if integration tests are not configured
 */
function skipIfNotConfigured(suite) {
    if (!shouldRunIntegrationTests()) {
        suite.pending = true;
        console.log('⚠️  Skipping integration tests - SUMO_ACCESS_ID and SUMO_ACCESS_KEY not set');
    }
}
/**
 * Wait for a condition with timeout
 */
function waitFor(condition_1) {
    return __awaiter(this, arguments, void 0, function* (condition, options = {}) {
        const timeout = options.timeout || 30000; // 30 seconds default
        const interval = options.interval || 1000; // 1 second default
        const message = options.message || 'Condition not met';
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (yield condition()) {
                return;
            }
            yield sleep(interval);
        }
        throw new Error(`${message} (timeout after ${timeout}ms)`);
    });
}
/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Generate a unique test identifier
 */
function generateTestId() {
    return `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}
//# sourceMappingURL=testHelper.js.map
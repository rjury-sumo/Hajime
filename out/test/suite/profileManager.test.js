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
const profileManager_1 = require("../../profileManager");
suite('ProfileManager Test Suite', () => {
    let context;
    let profileManager;
    const testProfileName = 'test-profile-' + Date.now();
    const testProfile = {
        name: testProfileName,
        region: 'https://api.us2.sumologic.com'
    };
    suiteSetup(() => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // Get extension context
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
        profileManager = new profileManager_1.ProfileManager(context);
    }));
    suiteTeardown(() => __awaiter(void 0, void 0, void 0, function* () {
        // Cleanup test profile
        try {
            const profiles = yield profileManager.getProfiles();
            if (profiles.find(p => p.name === testProfileName)) {
                yield profileManager.deleteProfile(testProfileName);
            }
        }
        catch (err) {
            // Ignore cleanup errors
        }
    }));
    test('should create a new profile', () => __awaiter(void 0, void 0, void 0, function* () {
        yield profileManager.createProfile(testProfile, 'test-access-id', 'test-access-key');
        const profiles = yield profileManager.getProfiles();
        const createdProfile = profiles.find(p => p.name === testProfileName);
        assert.ok(createdProfile, 'Profile should be created');
        assert.strictEqual(createdProfile === null || createdProfile === void 0 ? void 0 : createdProfile.region, testProfile.region);
    }));
    test('should get profile credentials', () => __awaiter(void 0, void 0, void 0, function* () {
        const credentials = yield profileManager.getProfileCredentials(testProfileName);
        assert.ok(credentials, 'Credentials should exist');
        assert.strictEqual(credentials === null || credentials === void 0 ? void 0 : credentials.accessId, 'test-access-id');
        assert.strictEqual(credentials === null || credentials === void 0 ? void 0 : credentials.accessKey, 'test-access-key');
    }));
    test('should get active profile', () => __awaiter(void 0, void 0, void 0, function* () {
        yield profileManager.setActiveProfile(testProfileName);
        const activeProfile = yield profileManager.getActiveProfile();
        assert.ok(activeProfile, 'Active profile should exist');
        assert.strictEqual(activeProfile === null || activeProfile === void 0 ? void 0 : activeProfile.name, testProfileName);
    }));
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
        const customProfile = {
            name: 'custom',
            region: 'us2',
            endpoint: 'https://custom.sumologic.com'
        };
        const endpoint = profileManager.getProfileEndpoint(customProfile);
        assert.strictEqual(endpoint, customProfile.endpoint);
    });
    test('should check if profiles exist', () => __awaiter(void 0, void 0, void 0, function* () {
        const hasProfiles = yield profileManager.hasProfiles();
        assert.strictEqual(hasProfiles, true, 'Should have at least one profile');
    }));
    test('should update profile', () => __awaiter(void 0, void 0, void 0, function* () {
        const updatedRegion = 'https://api.eu.sumologic.com';
        yield profileManager.updateProfile(testProfileName, { region: updatedRegion });
        const profiles = yield profileManager.getProfiles();
        const updatedProfile = profiles.find(p => p.name === testProfileName);
        assert.strictEqual(updatedProfile === null || updatedProfile === void 0 ? void 0 : updatedProfile.region, updatedRegion);
    }));
    test('should delete profile', () => __awaiter(void 0, void 0, void 0, function* () {
        yield profileManager.deleteProfile(testProfileName);
        const profiles = yield profileManager.getProfiles();
        const deletedProfile = profiles.find(p => p.name === testProfileName);
        assert.strictEqual(deletedProfile, undefined, 'Profile should be deleted');
    }));
    test('should throw error when creating duplicate profile', () => __awaiter(void 0, void 0, void 0, function* () {
        yield profileManager.createProfile(testProfile, 'test-id', 'test-key');
        yield assert.rejects(() => __awaiter(void 0, void 0, void 0, function* () { return yield profileManager.createProfile(testProfile, 'test-id', 'test-key'); }), /already exists/, 'Should throw error for duplicate profile');
    }));
    test('should throw error when deleting non-existent profile', () => __awaiter(void 0, void 0, void 0, function* () {
        yield assert.rejects(() => __awaiter(void 0, void 0, void 0, function* () { return yield profileManager.deleteProfile('non-existent-profile-' + Date.now()); }), /not found/, 'Should throw error for non-existent profile');
    }));
});
//# sourceMappingURL=profileManager.test.js.map
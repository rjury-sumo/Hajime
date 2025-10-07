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
exports.ProfileManager = void 0;
const vscode = require("vscode");
/**
 * Profile storage keys
 */
const PROFILES_KEY = 'sumologic.profiles';
const ACTIVE_PROFILE_KEY = 'sumologic.activeProfile';
/**
 * Get secret storage key for a profile's credentials
 */
function getProfileAccessIdKey(profileName) {
    return `sumologic.profile.${profileName}.accessId`;
}
function getProfileAccessKeyKey(profileName) {
    return `sumologic.profile.${profileName}.accessKey`;
}
/**
 * Profile Manager handles multiple Sumo Logic connection profiles
 */
class ProfileManager {
    constructor(context) {
        this.context = context;
    }
    /**
     * Get all configured profiles
     */
    getProfiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode.workspace.getConfiguration('sumologic');
            const profiles = config.get('profiles') || [];
            return profiles;
        });
    }
    /**
     * Save profiles to configuration
     */
    saveProfiles(profiles) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode.workspace.getConfiguration('sumologic');
            yield config.update('profiles', profiles, vscode.ConfigurationTarget.Global);
        });
    }
    /**
     * Get the active profile name
     */
    getActiveProfileName() {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode.workspace.getConfiguration('sumologic');
            return config.get('activeProfile');
        });
    }
    /**
     * Set the active profile
     */
    setActiveProfile(profileName) {
        return __awaiter(this, void 0, void 0, function* () {
            const profiles = yield this.getProfiles();
            const profile = profiles.find(p => p.name === profileName);
            if (!profile) {
                throw new Error(`Profile '${profileName}' not found`);
            }
            const config = vscode.workspace.getConfiguration('sumologic');
            yield config.update('activeProfile', profileName, vscode.ConfigurationTarget.Global);
        });
    }
    /**
     * Get the active profile
     */
    getActiveProfile() {
        return __awaiter(this, void 0, void 0, function* () {
            const activeProfileName = yield this.getActiveProfileName();
            if (!activeProfileName) {
                return undefined;
            }
            const profiles = yield this.getProfiles();
            return profiles.find(p => p.name === activeProfileName);
        });
    }
    /**
     * Create a new profile
     */
    createProfile(profile, accessId, accessKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const profiles = yield this.getProfiles();
            // Check if profile name already exists
            if (profiles.find(p => p.name === profile.name)) {
                throw new Error(`Profile '${profile.name}' already exists`);
            }
            // Store credentials securely
            yield this.context.secrets.store(getProfileAccessIdKey(profile.name), accessId);
            yield this.context.secrets.store(getProfileAccessKeyKey(profile.name), accessKey);
            // Add profile to list
            profiles.push(profile);
            yield this.saveProfiles(profiles);
            // Set as active if it's the first profile
            if (profiles.length === 1) {
                yield this.setActiveProfile(profile.name);
            }
        });
    }
    /**
     * Update an existing profile
     */
    updateProfile(profileName, updates, accessId, accessKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const profiles = yield this.getProfiles();
            const index = profiles.findIndex(p => p.name === profileName);
            if (index === -1) {
                throw new Error(`Profile '${profileName}' not found`);
            }
            // Update profile metadata
            profiles[index] = Object.assign(Object.assign({}, profiles[index]), updates);
            yield this.saveProfiles(profiles);
            // Update credentials if provided
            if (accessId) {
                yield this.context.secrets.store(getProfileAccessIdKey(profileName), accessId);
            }
            if (accessKey) {
                yield this.context.secrets.store(getProfileAccessKeyKey(profileName), accessKey);
            }
        });
    }
    /**
     * Delete a profile
     */
    deleteProfile(profileName) {
        return __awaiter(this, void 0, void 0, function* () {
            const profiles = yield this.getProfiles();
            const filteredProfiles = profiles.filter(p => p.name !== profileName);
            if (filteredProfiles.length === profiles.length) {
                throw new Error(`Profile '${profileName}' not found`);
            }
            // Delete credentials
            yield this.context.secrets.delete(getProfileAccessIdKey(profileName));
            yield this.context.secrets.delete(getProfileAccessKeyKey(profileName));
            // Remove from list
            yield this.saveProfiles(filteredProfiles);
            // Clear active profile if it was deleted
            const activeProfileName = yield this.getActiveProfileName();
            if (activeProfileName === profileName) {
                const config = vscode.workspace.getConfiguration('sumologic');
                yield config.update('activeProfile', filteredProfiles.length > 0 ? filteredProfiles[0].name : undefined, vscode.ConfigurationTarget.Global);
            }
        });
    }
    /**
     * Get credentials for a profile
     */
    getProfileCredentials(profileName) {
        return __awaiter(this, void 0, void 0, function* () {
            const accessId = yield this.context.secrets.get(getProfileAccessIdKey(profileName));
            const accessKey = yield this.context.secrets.get(getProfileAccessKeyKey(profileName));
            if (!accessId || !accessKey) {
                return null;
            }
            return { accessId, accessKey };
        });
    }
    /**
     * Get endpoint for a profile
     */
    getProfileEndpoint(profile) {
        if (profile.endpoint) {
            return profile.endpoint;
        }
        return profile.region;
    }
    /**
     * Check if any profiles exist
     */
    hasProfiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const profiles = yield this.getProfiles();
            return profiles.length > 0;
        });
    }
}
exports.ProfileManager = ProfileManager;
//# sourceMappingURL=profileManager.js.map
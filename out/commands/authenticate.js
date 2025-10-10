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
exports.createClient = createClient;
exports.createClientForProfile = createClientForProfile;
exports.authenticateCommand = authenticateCommand;
exports.switchProfileCommand = switchProfileCommand;
exports.listProfilesCommand = listProfilesCommand;
exports.deleteProfileCommand = deleteProfileCommand;
exports.testConnectionCommand = testConnectionCommand;
const vscode = require("vscode");
const client_1 = require("../api/client");
const profileManager_1 = require("../profileManager");
/**
 * Create a Sumo Logic client for the active profile
 */
function createClient(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const profileManager = new profileManager_1.ProfileManager(context);
        const activeProfile = yield profileManager.getActiveProfile();
        if (!activeProfile) {
            return null;
        }
        const credentials = yield profileManager.getProfileCredentials(activeProfile.name);
        if (!credentials) {
            return null;
        }
        const endpoint = profileManager.getProfileEndpoint(activeProfile);
        try {
            return new client_1.SumoLogicClient({
                accessId: credentials.accessId,
                accessKey: credentials.accessKey,
                endpoint: endpoint
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create Sumo Logic client: ${error}`);
            return null;
        }
    });
}
/**
 * Create a Sumo Logic client for a specific profile
 */
function createClientForProfile(context, profileName) {
    return __awaiter(this, void 0, void 0, function* () {
        const profileManager = new profileManager_1.ProfileManager(context);
        const profiles = yield profileManager.getProfiles();
        const profile = profiles.find(p => p.name === profileName);
        if (!profile) {
            vscode.window.showErrorMessage(`Profile '${profileName}' not found`);
            return null;
        }
        const credentials = yield profileManager.getProfileCredentials(profile.name);
        if (!credentials) {
            vscode.window.showErrorMessage(`No credentials found for profile '${profileName}'`);
            return null;
        }
        const endpoint = profileManager.getProfileEndpoint(profile);
        try {
            return new client_1.SumoLogicClient({
                accessId: credentials.accessId,
                accessKey: credentials.accessKey,
                endpoint: endpoint
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create Sumo Logic client: ${error}`);
            return null;
        }
    });
}
/**
 * Command to create/update a connection profile
 */
function authenticateCommand(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const profileManager = new profileManager_1.ProfileManager(context);
        // Prompt for profile name
        const profileName = yield vscode.window.showInputBox({
            prompt: 'Enter a name for this connection profile',
            placeHolder: 'e.g., Production, Development, Customer-Org',
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Profile name cannot be empty';
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                    return 'Profile name can only contain letters, numbers, hyphens, and underscores';
                }
                return null;
            }
        });
        if (!profileName) {
            return; // User cancelled
        }
        // Check if profile already exists
        const profiles = yield profileManager.getProfiles();
        const existingProfile = profiles.find(p => p.name === profileName);
        if (existingProfile) {
            const overwrite = yield vscode.window.showWarningMessage(`Profile '${profileName}' already exists. Do you want to update it?`, 'Update', 'Cancel');
            if (overwrite !== 'Update') {
                return;
            }
        }
        // Prompt for deployment region
        const region = yield vscode.window.showQuickPick([
            { label: 'US1 (api.sumologic.com)', value: 'us1', description: 'United States' },
            { label: 'US2 (api.us2.sumologic.com)', value: 'us2', description: 'United States' },
            { label: 'EU (api.eu.sumologic.com)', value: 'eu', description: 'Europe' },
            { label: 'AU (api.au.sumologic.com)', value: 'au', description: 'Australia' },
            { label: 'DE (api.de.sumologic.com)', value: 'de', description: 'Germany' },
            { label: 'JP (api.jp.sumologic.com)', value: 'jp', description: 'Japan' },
            { label: 'CA (api.ca.sumologic.com)', value: 'ca', description: 'Canada' },
            { label: 'IN (api.in.sumologic.com)', value: 'in', description: 'India' },
            { label: 'Custom Endpoint', value: 'custom', description: 'Specify custom API endpoint' }
        ], {
            placeHolder: 'Select your Sumo Logic deployment region',
            ignoreFocusOut: true
        });
        if (!region) {
            return; // User cancelled
        }
        // Handle custom endpoint
        let endpoint;
        if (region.value === 'custom') {
            const customEndpoint = yield vscode.window.showInputBox({
                prompt: 'Enter custom API endpoint URL',
                placeHolder: 'https://api.custom.sumologic.com',
                ignoreFocusOut: true,
                validateInput: (value) => {
                    if (!value.startsWith('http://') && !value.startsWith('https://')) {
                        return 'Endpoint must start with http:// or https://';
                    }
                    return null;
                }
            });
            if (!customEndpoint) {
                return; // User cancelled
            }
            endpoint = customEndpoint;
        }
        // Prompt for Access ID
        const accessId = yield vscode.window.showInputBox({
            prompt: 'Enter your Sumo Logic Access ID',
            placeHolder: 'suABC123...',
            ignoreFocusOut: true,
            password: false
        });
        if (!accessId) {
            return; // User cancelled
        }
        // Prompt for Access Key
        const accessKey = yield vscode.window.showInputBox({
            prompt: 'Enter your Sumo Logic Access Key',
            placeHolder: 'Your access key',
            ignoreFocusOut: true,
            password: true
        });
        if (!accessKey) {
            return; // User cancelled
        }
        // Create or update profile
        try {
            if (existingProfile) {
                yield profileManager.updateProfile(profileName, {
                    region: region.value === 'custom' ? 'us1' : region.value,
                    endpoint: endpoint
                }, accessId, accessKey);
                vscode.window.showInformationMessage(`Profile '${profileName}' updated successfully`);
            }
            else {
                yield profileManager.createProfile({
                    name: profileName,
                    region: region.value === 'custom' ? 'us1' : region.value,
                    endpoint: endpoint
                }, accessId, accessKey);
                vscode.window.showInformationMessage(`Profile '${profileName}' created and set as active`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to save profile: ${error}`);
        }
    });
}
/**
 * Command to switch active profile
 */
function switchProfileCommand(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const profileManager = new profileManager_1.ProfileManager(context);
        const profiles = yield profileManager.getProfiles();
        if (profiles.length === 0) {
            vscode.window.showInformationMessage('No profiles configured. Please create a profile first.');
            return;
        }
        const activeProfileName = yield profileManager.getActiveProfileName();
        const items = profiles.map(p => ({
            label: p.name,
            description: p.endpoint || p.region,
            detail: p.name === activeProfileName ? '(Active)' : ''
        }));
        const selected = yield vscode.window.showQuickPick(items, {
            placeHolder: 'Select a profile to activate',
            ignoreFocusOut: true
        });
        if (!selected) {
            return;
        }
        try {
            yield profileManager.setActiveProfile(selected.label);
            // Load autocomplete data for the new profile
            const { getDynamicCompletionProvider, getMetadataCompletionProvider } = yield Promise.resolve().then(() => require('../extension'));
            const dynamicProvider = getDynamicCompletionProvider();
            if (dynamicProvider) {
                yield dynamicProvider.loadProfileData(selected.label);
            }
            // Load metadata cache for the new profile
            const metadataProvider = getMetadataCompletionProvider();
            if (metadataProvider) {
                const metadataDir = profileManager.getProfileMetadataDirectory(selected.label);
                yield metadataProvider.loadMetadataCache(metadataDir, selected.label);
            }
            vscode.window.showInformationMessage(`Switched to profile '${selected.label}'`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to switch profile: ${error}`);
        }
    });
}
/**
 * Command to list all profiles
 */
function listProfilesCommand(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const profileManager = new profileManager_1.ProfileManager(context);
        const profiles = yield profileManager.getProfiles();
        if (profiles.length === 0) {
            vscode.window.showInformationMessage('No profiles configured.');
            return;
        }
        const activeProfileName = yield profileManager.getActiveProfileName();
        const profileList = profiles.map(p => `${p.name === activeProfileName ? '✓' : ' '} ${p.name} (${p.endpoint || p.region})`).join('\n');
        vscode.window.showInformationMessage(`Configured Profiles:\n${profileList}`, { modal: true });
    });
}
/**
 * Command to delete a profile
 */
function deleteProfileCommand(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const profileManager = new profileManager_1.ProfileManager(context);
        const profiles = yield profileManager.getProfiles();
        if (profiles.length === 0) {
            vscode.window.showInformationMessage('No profiles configured.');
            return;
        }
        const items = profiles.map(p => ({
            label: p.name,
            description: p.endpoint || p.region
        }));
        const selected = yield vscode.window.showQuickPick(items, {
            placeHolder: 'Select a profile to delete',
            ignoreFocusOut: true
        });
        if (!selected) {
            return;
        }
        const confirm = yield vscode.window.showWarningMessage(`Are you sure you want to delete profile '${selected.label}'?`, 'Delete', 'Cancel');
        if (confirm !== 'Delete') {
            return;
        }
        try {
            // Clear autocomplete data for this profile
            const { getDynamicCompletionProvider } = yield Promise.resolve().then(() => require('../extension'));
            const dynamicProvider = getDynamicCompletionProvider();
            if (dynamicProvider) {
                yield dynamicProvider.clearProfileData(selected.label);
            }
            yield profileManager.deleteProfile(selected.label);
            vscode.window.showInformationMessage(`Profile '${selected.label}' deleted`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to delete profile: ${error}`);
        }
    });
}
/**
 * Command to test connection to Sumo Logic
 */
function testConnectionCommand(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const profileManager = new profileManager_1.ProfileManager(context);
        const activeProfile = yield profileManager.getActiveProfile();
        if (!activeProfile) {
            vscode.window.showErrorMessage('No active profile. Please create a profile first.');
            return;
        }
        const client = yield createClient(context);
        if (!client) {
            vscode.window.showErrorMessage(`No credentials found for profile '${activeProfile.name}'.`);
            return;
        }
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Testing connection to Sumo Logic (${activeProfile.name})...`,
            cancellable: false
        }, () => __awaiter(this, void 0, void 0, function* () {
            const response = yield client.testConnection();
            if (response.error) {
                vscode.window.showErrorMessage(`Connection failed for '${activeProfile.name}': ${response.error}`);
            }
            else {
                vscode.window.showInformationMessage(`Successfully connected to '${activeProfile.name}' at ${client.getEndpoint()}`);
            }
        }));
    });
}
//# sourceMappingURL=authenticate.js.map
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Connection profile for a Sumo Logic organization
 */
export interface SumoLogicProfile {
    name: string;
    region: string;
    endpoint?: string; // Custom endpoint if specified
    instanceName?: string; // Instance name for web UI URLs (e.g., service.us2.sumologic.com)
}

/**
 * Profile storage keys
 */
const PROFILES_KEY = 'sumologic.profiles';
const ACTIVE_PROFILE_KEY = 'sumologic.activeProfile';

/**
 * Get secret storage key for a profile's credentials
 */
function getProfileAccessIdKey(profileName: string): string {
    return `sumologic.profile.${profileName}.accessId`;
}

function getProfileAccessKeyKey(profileName: string): string {
    return `sumologic.profile.${profileName}.accessKey`;
}

/**
 * Profile Manager handles multiple Sumo Logic connection profiles
 */
export class ProfileManager {
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Get all configured profiles
     */
    async getProfiles(): Promise<SumoLogicProfile[]> {
        const config = vscode.workspace.getConfiguration('sumologic');
        const profiles = config.get<SumoLogicProfile[]>('profiles') || [];
        return profiles;
    }

    /**
     * Save profiles to configuration
     */
    private async saveProfiles(profiles: SumoLogicProfile[]): Promise<void> {
        const config = vscode.workspace.getConfiguration('sumologic');
        await config.update('profiles', profiles, vscode.ConfigurationTarget.Global);
    }

    /**
     * Get the active profile name
     */
    async getActiveProfileName(): Promise<string | undefined> {
        const config = vscode.workspace.getConfiguration('sumologic');
        return config.get<string>('activeProfile');
    }

    /**
     * Set the active profile
     */
    async setActiveProfile(profileName: string): Promise<void> {
        const profiles = await this.getProfiles();
        const profile = profiles.find(p => p.name === profileName);

        if (!profile) {
            throw new Error(`Profile '${profileName}' not found`);
        }

        const config = vscode.workspace.getConfiguration('sumologic');
        await config.update('activeProfile', profileName, vscode.ConfigurationTarget.Global);
    }

    /**
     * Get the active profile
     */
    async getActiveProfile(): Promise<SumoLogicProfile | undefined> {
        const activeProfileName = await this.getActiveProfileName();
        if (!activeProfileName) {
            return undefined;
        }

        const profiles = await this.getProfiles();
        return profiles.find(p => p.name === activeProfileName);
    }

    /**
     * Get the user's home directory
     */
    private getUserHomeDirectory(): string {
        const homeDir = process.env.HOME || process.env.USERPROFILE;
        if (!homeDir) {
            throw new Error('Could not determine user home directory');
        }
        return homeDir;
    }

    /**
     * Get the file storage path for profiles
     * Priority:
     * 1. If fileStoragePath setting is configured, use it (with variable substitution)
     * 2. Otherwise, default to ~/.sumologic (user home directory)
     */
    private getFileStoragePath(): string {
        const config = vscode.workspace.getConfiguration('sumologic');
        let storagePath = config.get<string>('fileStoragePath') || '';

        // If empty or not set, use default home directory location
        if (!storagePath || storagePath.trim() === '') {
            return path.join(this.getUserHomeDirectory(), '.sumologic');
        }

        // Replace ${userHome} variable with actual home path
        const homeDir = this.getUserHomeDirectory();
        storagePath = storagePath.replace(/\$\{userHome\}/g, homeDir);

        // Replace ${workspaceFolder} variable with actual workspace path (if workspace is open)
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            storagePath = storagePath.replace(/\$\{workspaceFolder\}/g, workspaceFolder.uri.fsPath);
        } else if (storagePath.includes('${workspaceFolder}')) {
            // If no workspace is open but path contains ${workspaceFolder}, fall back to home directory
            return path.join(homeDir, '.sumologic');
        }

        // If it's an absolute path, use it as-is
        if (path.isAbsolute(storagePath)) {
            return storagePath;
        }

        // If it's a relative path and workspace is open, make it relative to workspace
        if (workspaceFolder) {
            return path.join(workspaceFolder.uri.fsPath, storagePath);
        }

        // Otherwise, make it relative to home directory
        return path.join(homeDir, storagePath);
    }

    /**
     * Get the directory path for a specific profile
     */
    getProfileDirectory(profileName: string): string {
        return path.join(this.getFileStoragePath(), profileName);
    }

    /**
     * Get the metadata directory path for a specific profile
     */
    getProfileMetadataDirectory(profileName: string): string {
        return path.join(this.getProfileDirectory(profileName), 'metadata');
    }

    /**
     * Get the library directory path for a specific profile
     */
    getProfileLibraryDirectory(profileName: string): string {
        return path.join(this.getProfileDirectory(profileName), 'library');
    }

    /**
     * Get the library content directory path for a specific profile
     * This is where JSON content files are stored
     */
    getProfileLibraryContentDirectory(profileName: string): string {
        return path.join(this.getProfileLibraryDirectory(profileName), 'content');
    }

    /**
     * Create directory for a profile
     */
    private async createProfileDirectory(profileName: string): Promise<void> {
        const profileDir = this.getProfileDirectory(profileName);

        // Create directory if it doesn't exist
        if (!fs.existsSync(profileDir)) {
            fs.mkdirSync(profileDir, { recursive: true });
        }

        // Also create metadata subdirectory
        const metadataDir = this.getProfileMetadataDirectory(profileName);
        if (!fs.existsSync(metadataDir)) {
            fs.mkdirSync(metadataDir, { recursive: true });
        }

        // Create library subdirectory
        const libraryDir = this.getProfileLibraryDirectory(profileName);
        if (!fs.existsSync(libraryDir)) {
            fs.mkdirSync(libraryDir, { recursive: true });
        }

        // Create library/content subdirectory for JSON files
        const libraryContentDir = this.getProfileLibraryContentDirectory(profileName);
        if (!fs.existsSync(libraryContentDir)) {
            fs.mkdirSync(libraryContentDir, { recursive: true });
        }
    }

    /**
     * Create a new profile
     */
    async createProfile(profile: SumoLogicProfile, accessId: string, accessKey: string): Promise<void> {
        const profiles = await this.getProfiles();

        // Check if profile name already exists
        if (profiles.find(p => p.name === profile.name)) {
            throw new Error(`Profile '${profile.name}' already exists`);
        }

        // Store credentials securely
        await this.context.secrets.store(getProfileAccessIdKey(profile.name), accessId);
        await this.context.secrets.store(getProfileAccessKeyKey(profile.name), accessKey);

        // Create profile directory
        await this.createProfileDirectory(profile.name);

        // Add profile to list
        profiles.push(profile);
        await this.saveProfiles(profiles);

        // Set as active if it's the first profile
        if (profiles.length === 1) {
            await this.setActiveProfile(profile.name);
        }
    }

    /**
     * Update an existing profile
     */
    async updateProfile(profileName: string, updates: Partial<SumoLogicProfile>, accessId?: string, accessKey?: string): Promise<void> {
        const profiles = await this.getProfiles();
        const index = profiles.findIndex(p => p.name === profileName);

        if (index === -1) {
            throw new Error(`Profile '${profileName}' not found`);
        }

        // Update profile metadata
        profiles[index] = { ...profiles[index], ...updates };
        await this.saveProfiles(profiles);

        // Update credentials if provided
        if (accessId) {
            await this.context.secrets.store(getProfileAccessIdKey(profileName), accessId);
        }
        if (accessKey) {
            await this.context.secrets.store(getProfileAccessKeyKey(profileName), accessKey);
        }
    }

    /**
     * Delete a profile
     */
    async deleteProfile(profileName: string): Promise<void> {
        const profiles = await this.getProfiles();
        const filteredProfiles = profiles.filter(p => p.name !== profileName);

        if (filteredProfiles.length === profiles.length) {
            throw new Error(`Profile '${profileName}' not found`);
        }

        // Delete credentials
        await this.context.secrets.delete(getProfileAccessIdKey(profileName));
        await this.context.secrets.delete(getProfileAccessKeyKey(profileName));

        // Remove from list
        await this.saveProfiles(filteredProfiles);

        // Clear active profile if it was deleted
        const activeProfileName = await this.getActiveProfileName();
        if (activeProfileName === profileName) {
            const config = vscode.workspace.getConfiguration('sumologic');
            await config.update('activeProfile', filteredProfiles.length > 0 ? filteredProfiles[0].name : undefined, vscode.ConfigurationTarget.Global);
        }
    }

    /**
     * Get credentials for a profile
     */
    async getProfileCredentials(profileName: string): Promise<{ accessId: string; accessKey: string } | null> {
        const accessId = await this.context.secrets.get(getProfileAccessIdKey(profileName));
        const accessKey = await this.context.secrets.get(getProfileAccessKeyKey(profileName));

        if (!accessId || !accessKey) {
            return null;
        }

        return { accessId, accessKey };
    }

    /**
     * Get endpoint for a profile
     */
    getProfileEndpoint(profile: SumoLogicProfile): string {
        if (profile.endpoint) {
            return profile.endpoint;
        }
        return profile.region;
    }

    /**
     * Get instance name for web UI URLs
     * Priority: 1) Profile property, 2) Global VS Code setting, 3) Default based on endpoint
     * Defaults to service.<endpoint>.sumologic.com except for us1/prod where it's service.sumologic.com
     */
    getInstanceName(profile: SumoLogicProfile): string {
        // First check profile-specific instance name
        if (profile.instanceName && profile.instanceName.trim()) {
            return profile.instanceName.trim();
        }

        // Then check VS Code global settings for custom instance name
        const config = vscode.workspace.getConfiguration('sumologic');
        const customInstanceName = config.get<string>('instanceName');
        if (customInstanceName && customInstanceName.trim()) {
            return customInstanceName.trim();
        }

        // Get the endpoint/region
        const endpoint = this.getProfileEndpoint(profile);

        // For us1 or prod, use service.sumologic.com (original instance)
        if (endpoint === 'us1' || endpoint === 'prod') {
            return 'service.sumologic.com';
        }

        // For other endpoints, use service.<endpoint>.sumologic.com
        return `service.${endpoint}.sumologic.com`;
    }

    /**
     * Check if any profiles exist
     */
    async hasProfiles(): Promise<boolean> {
        const profiles = await this.getProfiles();
        return profiles.length > 0;
    }

    /**
     * Ensure all profile directories exist (run on startup)
     */
    async ensureProfileDirectoriesExist(): Promise<void> {
        const profiles = await this.getProfiles();

        for (const profile of profiles) {
            await this.createProfileDirectory(profile.name);
        }
    }
}

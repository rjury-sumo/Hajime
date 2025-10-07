import * as vscode from 'vscode';

/**
 * Connection profile for a Sumo Logic organization
 */
export interface SumoLogicProfile {
    name: string;
    region: string;
    endpoint?: string; // Custom endpoint if specified
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
     * Check if any profiles exist
     */
    async hasProfiles(): Promise<boolean> {
        const profiles = await this.getProfiles();
        return profiles.length > 0;
    }
}

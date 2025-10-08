import * as vscode from 'vscode';
import { SumoLogicClient } from '../api/client';
import { ProfileManager } from '../profileManager';

/**
 * Create a Sumo Logic client for the active profile
 */
export async function createClient(context: vscode.ExtensionContext): Promise<SumoLogicClient | null> {
    const profileManager = new ProfileManager(context);

    const activeProfile = await profileManager.getActiveProfile();
    if (!activeProfile) {
        return null;
    }

    const credentials = await profileManager.getProfileCredentials(activeProfile.name);
    if (!credentials) {
        return null;
    }

    const endpoint = profileManager.getProfileEndpoint(activeProfile);

    try {
        return new SumoLogicClient({
            accessId: credentials.accessId,
            accessKey: credentials.accessKey,
            endpoint: endpoint
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create Sumo Logic client: ${error}`);
        return null;
    }
}

/**
 * Create a Sumo Logic client for a specific profile
 */
export async function createClientForProfile(context: vscode.ExtensionContext, profileName: string): Promise<SumoLogicClient | null> {
    const profileManager = new ProfileManager(context);

    const profiles = await profileManager.getProfiles();
    const profile = profiles.find(p => p.name === profileName);

    if (!profile) {
        vscode.window.showErrorMessage(`Profile '${profileName}' not found`);
        return null;
    }

    const credentials = await profileManager.getProfileCredentials(profile.name);
    if (!credentials) {
        vscode.window.showErrorMessage(`No credentials found for profile '${profileName}'`);
        return null;
    }

    const endpoint = profileManager.getProfileEndpoint(profile);

    try {
        return new SumoLogicClient({
            accessId: credentials.accessId,
            accessKey: credentials.accessKey,
            endpoint: endpoint
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create Sumo Logic client: ${error}`);
        return null;
    }
}

/**
 * Command to create/update a connection profile
 */
export async function authenticateCommand(context: vscode.ExtensionContext): Promise<void> {
    const profileManager = new ProfileManager(context);

    // Prompt for profile name
    const profileName = await vscode.window.showInputBox({
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
    const profiles = await profileManager.getProfiles();
    const existingProfile = profiles.find(p => p.name === profileName);
    if (existingProfile) {
        const overwrite = await vscode.window.showWarningMessage(
            `Profile '${profileName}' already exists. Do you want to update it?`,
            'Update', 'Cancel'
        );
        if (overwrite !== 'Update') {
            return;
        }
    }

    // Prompt for deployment region
    const region = await vscode.window.showQuickPick(
        [
            { label: 'US1 (api.sumologic.com)', value: 'us1', description: 'United States' },
            { label: 'US2 (api.us2.sumologic.com)', value: 'us2', description: 'United States' },
            { label: 'EU (api.eu.sumologic.com)', value: 'eu', description: 'Europe' },
            { label: 'AU (api.au.sumologic.com)', value: 'au', description: 'Australia' },
            { label: 'DE (api.de.sumologic.com)', value: 'de', description: 'Germany' },
            { label: 'JP (api.jp.sumologic.com)', value: 'jp', description: 'Japan' },
            { label: 'CA (api.ca.sumologic.com)', value: 'ca', description: 'Canada' },
            { label: 'IN (api.in.sumologic.com)', value: 'in', description: 'India' },
            { label: 'Custom Endpoint', value: 'custom', description: 'Specify custom API endpoint' }
        ],
        {
            placeHolder: 'Select your Sumo Logic deployment region',
            ignoreFocusOut: true
        }
    );

    if (!region) {
        return; // User cancelled
    }

    // Handle custom endpoint
    let endpoint: string | undefined;
    if (region.value === 'custom') {
        const customEndpoint = await vscode.window.showInputBox({
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
    const accessId = await vscode.window.showInputBox({
        prompt: 'Enter your Sumo Logic Access ID',
        placeHolder: 'suABC123...',
        ignoreFocusOut: true,
        password: false
    });

    if (!accessId) {
        return; // User cancelled
    }

    // Prompt for Access Key
    const accessKey = await vscode.window.showInputBox({
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
            await profileManager.updateProfile(
                profileName,
                {
                    region: region.value === 'custom' ? 'us1' : region.value,
                    endpoint: endpoint
                },
                accessId,
                accessKey
            );
            vscode.window.showInformationMessage(`Profile '${profileName}' updated successfully`);
        } else {
            await profileManager.createProfile(
                {
                    name: profileName,
                    region: region.value === 'custom' ? 'us1' : region.value,
                    endpoint: endpoint
                },
                accessId,
                accessKey
            );
            vscode.window.showInformationMessage(`Profile '${profileName}' created and set as active`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to save profile: ${error}`);
    }
}

/**
 * Command to switch active profile
 */
export async function switchProfileCommand(context: vscode.ExtensionContext): Promise<void> {
    const profileManager = new ProfileManager(context);
    const profiles = await profileManager.getProfiles();

    if (profiles.length === 0) {
        vscode.window.showInformationMessage('No profiles configured. Please create a profile first.');
        return;
    }

    const activeProfileName = await profileManager.getActiveProfileName();

    const items = profiles.map(p => ({
        label: p.name,
        description: p.endpoint || p.region,
        detail: p.name === activeProfileName ? '(Active)' : ''
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a profile to activate',
        ignoreFocusOut: true
    });

    if (!selected) {
        return;
    }

    try {
        await profileManager.setActiveProfile(selected.label);

        // Load autocomplete data for the new profile
        const { getDynamicCompletionProvider } = await import('../extension');
        const dynamicProvider = getDynamicCompletionProvider();
        if (dynamicProvider) {
            await dynamicProvider.loadProfileData(selected.label);
        }

        vscode.window.showInformationMessage(`Switched to profile '${selected.label}'`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to switch profile: ${error}`);
    }
}

/**
 * Command to list all profiles
 */
export async function listProfilesCommand(context: vscode.ExtensionContext): Promise<void> {
    const profileManager = new ProfileManager(context);
    const profiles = await profileManager.getProfiles();

    if (profiles.length === 0) {
        vscode.window.showInformationMessage('No profiles configured.');
        return;
    }

    const activeProfileName = await profileManager.getActiveProfileName();

    const profileList = profiles.map(p =>
        `${p.name === activeProfileName ? '✓' : ' '} ${p.name} (${p.endpoint || p.region})`
    ).join('\n');

    vscode.window.showInformationMessage(
        `Configured Profiles:\n${profileList}`,
        { modal: true }
    );
}

/**
 * Command to delete a profile
 */
export async function deleteProfileCommand(context: vscode.ExtensionContext): Promise<void> {
    const profileManager = new ProfileManager(context);
    const profiles = await profileManager.getProfiles();

    if (profiles.length === 0) {
        vscode.window.showInformationMessage('No profiles configured.');
        return;
    }

    const items = profiles.map(p => ({
        label: p.name,
        description: p.endpoint || p.region
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a profile to delete',
        ignoreFocusOut: true
    });

    if (!selected) {
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete profile '${selected.label}'?`,
        'Delete', 'Cancel'
    );

    if (confirm !== 'Delete') {
        return;
    }

    try {
        // Clear autocomplete data for this profile
        const { getDynamicCompletionProvider } = await import('../extension');
        const dynamicProvider = getDynamicCompletionProvider();
        if (dynamicProvider) {
            await dynamicProvider.clearProfileData(selected.label);
        }

        await profileManager.deleteProfile(selected.label);
        vscode.window.showInformationMessage(`Profile '${selected.label}' deleted`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete profile: ${error}`);
    }
}

/**
 * Command to test connection to Sumo Logic
 */
export async function testConnectionCommand(context: vscode.ExtensionContext): Promise<void> {
    const profileManager = new ProfileManager(context);
    const activeProfile = await profileManager.getActiveProfile();

    if (!activeProfile) {
        vscode.window.showErrorMessage('No active profile. Please create a profile first.');
        return;
    }

    const client = await createClient(context);

    if (!client) {
        vscode.window.showErrorMessage(`No credentials found for profile '${activeProfile.name}'.`);
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Testing connection to Sumo Logic (${activeProfile.name})...`,
        cancellable: false
    }, async () => {
        const response = await client.testConnection();

        if (response.error) {
            vscode.window.showErrorMessage(`Connection failed for '${activeProfile.name}': ${response.error}`);
        } else {
            vscode.window.showInformationMessage(`Successfully connected to '${activeProfile.name}' at ${client.getEndpoint()}`);
        }
    });
}

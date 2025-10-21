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
            prompt: existingProfile && existingProfile.endpoint
                ? `Enter custom API endpoint URL (press Enter to keep: ${existingProfile.endpoint})`
                : 'Enter custom API endpoint URL',
            placeHolder: existingProfile?.endpoint || 'https://api.custom.sumologic.com',
            value: existingProfile?.endpoint || '',
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (value && value.trim()) {
                    if (!value.startsWith('http://') && !value.startsWith('https://')) {
                        return 'Endpoint must start with http:// or https://';
                    }
                }
                return null;
            }
        });

        if (customEndpoint === undefined) {
            return; // User cancelled
        }
        endpoint = customEndpoint.trim() || existingProfile?.endpoint;
    }

    // Get existing credentials if updating
    const existingCredentials = existingProfile ? await profileManager.getProfileCredentials(profileName) : null;
    const hasCredentials = existingCredentials?.accessId && existingCredentials?.accessKey;

    // Prompt for Access ID
    const accessId = await vscode.window.showInputBox({
        prompt: hasCredentials
            ? 'Enter your Sumo Logic Access ID (press Enter to keep current credentials)'
            : 'Enter your Sumo Logic Access ID',
        placeHolder: hasCredentials ? '*****' : 'suABC123...',
        value: '',
        ignoreFocusOut: true,
        password: false
    });

    if (accessId === undefined) {
        return; // User cancelled
    }

    const finalAccessId = accessId.trim() || existingCredentials?.accessId;
    if (!finalAccessId) {
        vscode.window.showErrorMessage('Access ID is required');
        return;
    }

    // Prompt for Access Key
    const accessKey = await vscode.window.showInputBox({
        prompt: hasCredentials
            ? 'Enter your Sumo Logic Access Key (press Enter to keep current credentials)'
            : 'Enter your Sumo Logic Access Key',
        placeHolder: hasCredentials ? '*****' : 'Your access key',
        value: '',
        ignoreFocusOut: true,
        password: true
    });

    if (accessKey === undefined) {
        return; // User cancelled
    }

    const finalAccessKey = accessKey.trim() || existingCredentials?.accessKey;
    if (!finalAccessKey) {
        vscode.window.showErrorMessage('Access Key is required');
        return;
    }

    // Prompt for custom instance name (optional)
    const defaultInstanceName = region.value === 'us1' || region.value === 'prod'
        ? 'service.sumologic.com'
        : `service.${region.value}.sumologic.com`;

    const currentInstanceName = existingProfile?.instanceName || '';
    const displayDefault = currentInstanceName || defaultInstanceName;

    const instanceName = await vscode.window.showInputBox({
        prompt: existingProfile
            ? `Enter custom instance name for web UI (press Enter to keep: ${displayDefault})`
            : 'Enter custom instance name for web UI (optional, leave empty for default)',
        placeHolder: displayDefault,
        value: currentInstanceName,
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (value && value.trim()) {
                // Basic validation for domain format
                if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value.trim())) {
                    return 'Instance name should be a valid domain (e.g., service.us2.sumologic.com or rick.au.sumologic.com)';
                }
            }
            return null;
        }
    });

    if (instanceName === undefined) {
        return; // User cancelled
    }

    // Create or update profile
    try {
        if (existingProfile) {
            await profileManager.updateProfile(
                profileName,
                {
                    region: region.value === 'custom' ? 'us1' : region.value,
                    endpoint: endpoint,
                    instanceName: instanceName.trim() || existingProfile.instanceName
                },
                finalAccessId,
                finalAccessKey
            );
            vscode.window.showInformationMessage(`Profile '${profileName}' updated successfully`);
        } else {
            await profileManager.createProfile(
                {
                    name: profileName,
                    region: region.value === 'custom' ? 'us1' : region.value,
                    endpoint: endpoint,
                    instanceName: instanceName.trim() || undefined
                },
                finalAccessId,
                finalAccessKey
            );
            vscode.window.showInformationMessage(`Profile '${profileName}' created and set as active`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to save profile: ${error}`);
    }
}

/**
 * Command to edit profile settings
 */
export async function editProfileCommand(context: vscode.ExtensionContext, profileName?: string): Promise<void> {
    const profileManager = new ProfileManager(context);
    const profiles = await profileManager.getProfiles();

    // If no profile name provided, prompt to select one
    if (!profileName) {
        if (profiles.length === 0) {
            vscode.window.showInformationMessage('No profiles configured. Please create a profile first.');
            return;
        }

        const items = profiles.map(p => ({
            label: p.name,
            description: p.endpoint || p.region
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a profile to edit',
            ignoreFocusOut: true
        });

        if (!selected) {
            return;
        }
        profileName = selected.label;
    }

    // Get the profile
    const profile = profiles.find(p => p.name === profileName);
    if (!profile) {
        vscode.window.showErrorMessage(`Profile '${profileName}' not found`);
        return;
    }

    // Get existing credentials
    const credentials = await profileManager.getProfileCredentials(profileName);

    // Show edit options
    const editOption = await vscode.window.showQuickPick([
        { label: 'Edit Instance Name', value: 'instanceName', description: `Current: ${profile.instanceName || '(default)'}` },
        { label: 'Edit Region/Endpoint', value: 'region', description: `Current: ${profile.endpoint || profile.region}` },
        { label: 'Edit Credentials', value: 'credentials', description: 'Update Access ID and Key' },
        { label: 'Edit All Settings', value: 'all', description: 'Update all profile settings' }
    ], {
        placeHolder: `Edit settings for profile: ${profileName}`,
        ignoreFocusOut: true
    });

    if (!editOption) {
        return;
    }

    let newInstanceName = profile.instanceName;
    let newRegion = profile.region;
    let newEndpoint = profile.endpoint;
    let newAccessId = credentials?.accessId;
    let newAccessKey = credentials?.accessKey;

    // Edit instance name
    if (editOption.value === 'instanceName' || editOption.value === 'all') {
        const defaultInstanceName = profile.region === 'us1' || profile.region === 'prod'
            ? 'service.sumologic.com'
            : `service.${profile.region}.sumologic.com`;

        const currentValue = profile.instanceName || '';
        const displayDefault = currentValue || defaultInstanceName;

        const instanceName = await vscode.window.showInputBox({
            prompt: `Enter custom instance name for web UI (press Enter to keep current: ${displayDefault})`,
            placeHolder: displayDefault,
            value: currentValue,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (value && value.trim()) {
                    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value.trim())) {
                        return 'Instance name should be a valid domain (e.g., rick.au.sumologic.com)';
                    }
                }
                return null;
            }
        });

        if (instanceName === undefined) {
            return; // User cancelled
        }
        // If empty string entered, keep current value
        newInstanceName = instanceName.trim() || profile.instanceName;
    }

    // Edit region/endpoint
    if (editOption.value === 'region' || editOption.value === 'all') {
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

        if (region.value === 'custom') {
            const customEndpoint = await vscode.window.showInputBox({
                prompt: 'Enter custom API endpoint URL',
                placeHolder: 'https://api.custom.sumologic.com',
                value: profile.endpoint || '',
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
            newEndpoint = customEndpoint;
            newRegion = 'us1'; // Fallback region for custom endpoint
        } else {
            newRegion = region.value;
            newEndpoint = undefined;
        }
    }

    // Edit credentials
    if (editOption.value === 'credentials' || editOption.value === 'all') {
        const hasCredentials = credentials?.accessId && credentials?.accessKey;
        const maskedValue = hasCredentials ? '*****' : '';

        const accessId = await vscode.window.showInputBox({
            prompt: hasCredentials
                ? 'Enter your Sumo Logic Access ID (press Enter to keep current credentials)'
                : 'Enter your Sumo Logic Access ID',
            placeHolder: hasCredentials ? '*****' : 'suABC123...',
            value: '',
            ignoreFocusOut: true,
            password: false
        });

        if (accessId === undefined) {
            return; // User cancelled
        }
        // If empty and credentials exist, keep existing; otherwise use new value
        newAccessId = accessId.trim() || credentials?.accessId;

        const accessKey = await vscode.window.showInputBox({
            prompt: hasCredentials
                ? 'Enter your Sumo Logic Access Key (press Enter to keep current credentials)'
                : 'Enter your Sumo Logic Access Key',
            placeHolder: hasCredentials ? '*****' : 'Your access key',
            value: '',
            ignoreFocusOut: true,
            password: true
        });

        if (accessKey === undefined) {
            return; // User cancelled
        }
        // If empty and credentials exist, keep existing; otherwise use new value
        newAccessKey = accessKey.trim() || credentials?.accessKey;
    }

    // Update profile
    try {
        await profileManager.updateProfile(
            profileName,
            {
                region: newRegion,
                endpoint: newEndpoint,
                instanceName: newInstanceName
            },
            newAccessId,
            newAccessKey
        );
        vscode.window.showInformationMessage(`Profile '${profileName}' updated successfully`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to update profile: ${error}`);
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
        const { getDynamicCompletionProvider, getMetadataCompletionProvider } = await import('../extension');
        const dynamicProvider = getDynamicCompletionProvider();
        if (dynamicProvider) {
            await dynamicProvider.loadProfileData(selected.label);
        }

        // Load metadata cache for the new profile
        const metadataProvider = getMetadataCompletionProvider();
        if (metadataProvider) {
            const metadataDir = profileManager.getProfileMetadataDirectory(selected.label);
            await metadataProvider.loadMetadataCache(metadataDir, selected.label);
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
 * Command to repair/check profile credentials
 */
export async function repairProfileCredentialsCommand(context: vscode.ExtensionContext): Promise<void> {
    const profileManager = new ProfileManager(context);
    const profiles = await profileManager.getProfiles();

    if (profiles.length === 0) {
        vscode.window.showInformationMessage('No profiles configured.');
        return;
    }

    // Check all profiles for missing credentials
    const profilesNeedingRepair: { name: string; missingAccessId: boolean; missingAccessKey: boolean }[] = [];

    for (const profile of profiles) {
        const credStatus = await profileManager.hasCompleteCredentials(profile.name);
        if (!credStatus.hasAccessId || !credStatus.hasAccessKey) {
            profilesNeedingRepair.push({
                name: profile.name,
                missingAccessId: !credStatus.hasAccessId,
                missingAccessKey: !credStatus.hasAccessKey
            });
        }
    }

    if (profilesNeedingRepair.length === 0) {
        vscode.window.showInformationMessage('All profiles have complete credentials.');
        return;
    }

    // Show which profiles need repair
    const message = `Found ${profilesNeedingRepair.length} profile(s) with missing credentials:\n\n` +
        profilesNeedingRepair.map(p => {
            const missing = [];
            if (p.missingAccessId) {missing.push('Access ID');}
            if (p.missingAccessKey) {missing.push('Access Key');}
            return `• ${p.name}: Missing ${missing.join(' and ')}`;
        }).join('\n');

    const repair = await vscode.window.showWarningMessage(
        message,
        { modal: true },
        'Repair All',
        'Cancel'
    );

    if (repair !== 'Repair All') {
        return;
    }

    // Repair each profile
    for (const profileInfo of profilesNeedingRepair) {
        const profile = profiles.find(p => p.name === profileInfo.name);
        if (!profile) {continue;}

        vscode.window.showInformationMessage(`Repairing credentials for profile: ${profileInfo.name}`);

        // Get existing credentials (may be partial)
        const existing = await profileManager.getProfileCredentials(profileInfo.name);

        // Prompt for Access ID if missing
        let accessId = existing?.accessId;
        if (profileInfo.missingAccessId) {
            const input = await vscode.window.showInputBox({
                prompt: `Enter Access ID for profile '${profileInfo.name}'`,
                placeHolder: 'suABC123...',
                ignoreFocusOut: true,
                password: false
            });

            if (!input) {
                vscode.window.showWarningMessage(`Skipped repairing ${profileInfo.name}`);
                continue;
            }
            accessId = input.trim();
        }

        // Prompt for Access Key if missing
        let accessKey = existing?.accessKey;
        if (profileInfo.missingAccessKey) {
            const input = await vscode.window.showInputBox({
                prompt: `Enter Access Key for profile '${profileInfo.name}'`,
                placeHolder: 'Your access key',
                ignoreFocusOut: true,
                password: true
            });

            if (!input) {
                vscode.window.showWarningMessage(`Skipped repairing ${profileInfo.name}`);
                continue;
            }
            accessKey = input.trim();
        }

        // Store the credentials
        if (accessId && accessKey) {
            await profileManager.updateProfile(profileInfo.name, {}, accessId, accessKey);
            vscode.window.showInformationMessage(`✓ Repaired credentials for ${profileInfo.name}`);
        }
    }

    vscode.window.showInformationMessage('Profile credential repair complete!');
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
export async function testConnectionCommand(context: vscode.ExtensionContext, profileName?: string): Promise<void> {
    const profileManager = new ProfileManager(context);

    // Get client for specified or active profile
    let client: SumoLogicClient | null;
    let targetProfileName: string;

    if (profileName) {
        client = await createClientForProfile(context, profileName);
        targetProfileName = profileName;
    } else {
        client = await createClient(context);
        const activeProfile = await profileManager.getActiveProfile();
        if (!activeProfile) {
            vscode.window.showErrorMessage('No active profile. Please create a profile first.');
            return;
        }
        targetProfileName = activeProfile.name;
    }

    if (!client) {
        // Error message already shown by createClient/createClientForProfile
        // Update status bar only if this is the active profile
        const activeProfile = await profileManager.getActiveProfile();
        if (!profileName || profileName === activeProfile?.name) {
            const { getStatusBarManager } = await import('../extension');
            const statusBar = getStatusBarManager();
            if (statusBar) {
                statusBar.setConnectionStatus('disconnected');
            }
        }
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Testing connection to Sumo Logic (${targetProfileName})...`,
        cancellable: false
    }, async () => {
        const response = await client!.testConnection();

        // Update status bar only if this is the active profile
        const activeProfile = await profileManager.getActiveProfile();
        const isActiveProfile = !profileName || profileName === activeProfile?.name;
        const { getStatusBarManager } = await import('../extension');
        const statusBar = getStatusBarManager();

        if (response.error) {
            vscode.window.showErrorMessage(`Connection failed for '${targetProfileName}': ${response.error}`);
            if (statusBar && isActiveProfile) {
                statusBar.setConnectionStatus('disconnected');
            }
        } else {
            vscode.window.showInformationMessage(`Successfully connected to '${targetProfileName}' at ${client!.getEndpoint()}`);
            if (statusBar && isActiveProfile) {
                statusBar.setConnectionStatus('connected');
            }
        }
    });
}

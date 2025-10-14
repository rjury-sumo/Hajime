import * as vscode from 'vscode';
import { ProfileManager } from '../profileManager';
import { UsersRolesClient } from '../api/usersRoles';
import { createUsersRolesDB, User, Role } from '../database/usersRoles';

/**
 * Fetch and cache users for the active profile
 */
export async function fetchUsers(context: vscode.ExtensionContext, profileName?: string): Promise<void> {
    const profileManager = new ProfileManager(context);

    // Determine which profile to use
    let targetProfileName = profileName;
    if (!targetProfileName) {
        targetProfileName = await profileManager.getActiveProfileName();
        if (!targetProfileName) {
            vscode.window.showErrorMessage('No active profile selected');
            return;
        }
    }

    // Get profile and credentials
    const profiles = await profileManager.getProfiles();
    const profile = profiles.find(p => p.name === targetProfileName);
    if (!profile) {
        vscode.window.showErrorMessage(`Profile '${targetProfileName}' not found`);
        return;
    }

    const credentials = await profileManager.getProfileCredentials(targetProfileName);
    if (!credentials) {
        vscode.window.showErrorMessage(`No credentials found for profile '${targetProfileName}'`);
        return;
    }

    // Show progress
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Fetching users for ${targetProfileName}`,
            cancellable: false
        },
        async (progress) => {
            try {
                // Create API client
                const endpoint = profileManager.getProfileEndpoint(profile);
                const client = new UsersRolesClient({
                    accessId: credentials.accessId,
                    accessKey: credentials.accessKey,
                    endpoint
                });

                progress.report({ message: 'Fetching users from API...' });

                // Fetch all users
                const response = await client.getAllUsers();
                if (response.error || !response.data) {
                    vscode.window.showErrorMessage(`Failed to fetch users: ${response.error}`);
                    return;
                }

                const users = response.data;
                progress.report({ message: `Storing ${users.length} users in database...` });

                // Open database
                const profileDir = profileManager.getProfileDirectory(targetProfileName);
                const db = createUsersRolesDB(profileDir, targetProfileName);

                // Convert API response to database format
                const now = new Date().toISOString();
                const dbUsers: User[] = users.map(u => ({
                    id: u.id,
                    profile: targetProfileName,
                    firstName: u.firstName,
                    lastName: u.lastName,
                    email: u.email,
                    roleIds: u.roleIds || [],
                    isActive: u.isActive,
                    isLockedOut: u.isLockedOut,
                    isMfaEnabled: u.isMfaEnabled,
                    lastModified: u.lastModified,
                    createdAt: u.createdAt,
                    createdBy: u.createdBy,
                    modifiedAt: u.modifiedAt,
                    modifiedBy: u.modifiedBy,
                    lastFetched: now
                }));

                // Store in database
                db.upsertUsers(dbUsers);
                db.close();

                vscode.window.showInformationMessage(
                    `Successfully cached ${users.length} users for ${targetProfileName}`
                );
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error fetching users: ${error.message}`);
            }
        }
    );
}

/**
 * Fetch and cache roles for the active profile
 */
export async function fetchRoles(context: vscode.ExtensionContext, profileName?: string): Promise<void> {
    const profileManager = new ProfileManager(context);

    // Determine which profile to use
    let targetProfileName = profileName;
    if (!targetProfileName) {
        targetProfileName = await profileManager.getActiveProfileName();
        if (!targetProfileName) {
            vscode.window.showErrorMessage('No active profile selected');
            return;
        }
    }

    // Get profile and credentials
    const profiles = await profileManager.getProfiles();
    const profile = profiles.find(p => p.name === targetProfileName);
    if (!profile) {
        vscode.window.showErrorMessage(`Profile '${targetProfileName}' not found`);
        return;
    }

    const credentials = await profileManager.getProfileCredentials(targetProfileName);
    if (!credentials) {
        vscode.window.showErrorMessage(`No credentials found for profile '${targetProfileName}'`);
        return;
    }

    // Show progress
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Fetching roles for ${targetProfileName}`,
            cancellable: false
        },
        async (progress) => {
            try {
                // Create API client
                const endpoint = profileManager.getProfileEndpoint(profile);
                const client = new UsersRolesClient({
                    accessId: credentials.accessId,
                    accessKey: credentials.accessKey,
                    endpoint
                });

                progress.report({ message: 'Fetching roles from API...' });

                // Fetch all roles
                const response = await client.getAllRoles();
                if (response.error || !response.data) {
                    vscode.window.showErrorMessage(`Failed to fetch roles: ${response.error}`);
                    return;
                }

                const roles = response.data;
                progress.report({ message: `Storing ${roles.length} roles in database...` });

                // Open database
                const profileDir = profileManager.getProfileDirectory(targetProfileName);
                const db = createUsersRolesDB(profileDir, targetProfileName);

                // Convert API response to database format
                const now = new Date().toISOString();
                const dbRoles: Role[] = roles.map(r => ({
                    id: r.id,
                    profile: targetProfileName,
                    name: r.name,
                    description: r.description,
                    filterPredicate: r.filterPredicate,
                    users: r.users || [],
                    capabilities: r.capabilities || [],
                    autofillDependencies: r.autofillDependencies,
                    createdAt: r.createdAt,
                    createdBy: r.createdBy,
                    modifiedAt: r.modifiedAt,
                    modifiedBy: r.modifiedBy,
                    lastFetched: now
                }));

                // Store in database
                db.upsertRoles(dbRoles);
                db.close();

                vscode.window.showInformationMessage(
                    `Successfully cached ${roles.length} roles for ${targetProfileName}`
                );
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error fetching roles: ${error.message}`);
            }
        }
    );
}

/**
 * Fetch both users and roles for the active profile
 */
export async function fetchUsersAndRoles(context: vscode.ExtensionContext, profileName?: string): Promise<void> {
    await fetchUsers(context, profileName);
    await fetchRoles(context, profileName);
}

/**
 * Register all users and roles commands
 */
export function registerUsersRolesCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('sumologic.fetchUsers', () => fetchUsers(context)),
        vscode.commands.registerCommand('sumologic.fetchRoles', () => fetchRoles(context)),
        vscode.commands.registerCommand('sumologic.fetchUsersAndRoles', () => fetchUsersAndRoles(context))
    );
}

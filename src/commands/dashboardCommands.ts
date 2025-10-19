import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager } from '../profileManager';
import { DashboardClient, Dashboard } from '../api/dashboards';
import { createDashboardsCacheDB, DashboardsCacheDB, DashboardItem } from '../database/dashboardsCache';
import { DashboardsWebviewProvider } from '../views/dashboardsWebviewProvider';

/**
 * Command to list dashboards for a profile
 */
export async function listMyDashboards(context: vscode.ExtensionContext, profileName?: string): Promise<void> {
    const profileManager = new ProfileManager(context);

    // Determine which profile to use
    if (!profileName) {
        const activeProfile = await profileManager.getActiveProfile();
        if (!activeProfile) {
            vscode.window.showErrorMessage('No active profile. Please select a profile first.');
            return;
        }
        profileName = activeProfile.name;
    }

    // Get profile
    const profiles = await profileManager.getProfiles();
    const profile = profiles.find(p => p.name === profileName);
    if (!profile) {
        vscode.window.showErrorMessage(`Profile not found: ${profileName}`);
        return;
    }

    // Get credentials
    const credentials = await profileManager.getProfileCredentials(profileName);
    if (!credentials) {
        vscode.window.showErrorMessage(`No credentials found for profile: ${profileName}`);
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Fetching dashboards for ${profileName}...`,
            cancellable: false
        }, async (progress) => {
            // Create API client
            const client = new DashboardClient({
                accessId: credentials.accessId,
                accessKey: credentials.accessKey,
                endpoint: profileManager.getProfileEndpoint(profile)
            });

            // Fetch all dashboards
            progress.report({ message: 'Retrieving dashboards from API...' });
            const response = await client.listAllDashboards();

            if (response.error || !response.data) {
                // Check if it's a permission error
                if (response.statusCode === 403 || response.statusCode === 401) {
                    vscode.window.showWarningMessage(
                        `Unable to fetch dashboards for ${profileName}: Insufficient permissions. ` +
                        'Your user role may not have "View Dashboards" capability. ' +
                        `HTTP Status: ${response.statusCode}`
                    );
                } else {
                    vscode.window.showErrorMessage(
                        `Failed to fetch dashboards for ${profileName}: ${response.error}` +
                        (response.statusCode ? ` (HTTP ${response.statusCode})` : '')
                    );
                }
                return;
            }

            const dashboards = response.data;
            vscode.window.showInformationMessage(
                `Found ${dashboards.length} dashboard(s) for ${profileName}. Saving to database...`
            );
            progress.report({ message: `Found ${dashboards.length} dashboards. Saving to database...` });

            // Get profile directory and create database
            const profileDir = profileManager.getProfileDirectory(profileName);
            const db = createDashboardsCacheDB(profileDir, profileName);

            // Get dashboards directory for JSON files
            const dashboardsDir = profileManager.getProfileDashboardsDirectory(profileName);
            if (!fs.existsSync(dashboardsDir)) {
                fs.mkdirSync(dashboardsDir, { recursive: true });
            }

            // Store dashboards in database and save JSON files
            const now = new Date().toISOString();
            const dashboardItems: DashboardItem[] = [];

            for (const dashboard of dashboards) {
                // Create database item
                dashboardItems.push({
                    id: dashboard.id,
                    profile: profileName,
                    title: dashboard.title,
                    description: dashboard.description,
                    folderId: dashboard.folderId,
                    contentId: dashboard.contentId,
                    lastFetched: now
                });

                // Save JSON file
                const jsonFilePath = path.join(dashboardsDir, `${dashboard.id}.json`);
                fs.writeFileSync(jsonFilePath, JSON.stringify(dashboard, null, 2), 'utf-8');
            }

            // Batch insert into database
            db.upsertDashboards(dashboardItems);
            db.close();

            vscode.window.showInformationMessage(
                `Successfully fetched and cached ${dashboards.length} dashboard(s) for ${profileName}. Click the Dashboards node to view.`
            );

            // Refresh the dashboards webview if it's open
            vscode.commands.executeCommand('sumologic.viewDashboards', profileName);
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to list dashboards: ${error.message}`);
    }
}

/**
 * Command to view dashboards in webview
 */
export async function viewDashboards(
    context: vscode.ExtensionContext,
    dashboardsWebviewProvider: DashboardsWebviewProvider,
    profileName?: string
): Promise<void> {
    const profileManager = new ProfileManager(context);

    // Determine which profile to use
    if (!profileName) {
        const activeProfile = await profileManager.getActiveProfile();
        if (!activeProfile) {
            vscode.window.showErrorMessage('No active profile. Please select a profile first.');
            return;
        }
        profileName = activeProfile.name;
    }

    // Show the dashboards webview
    await dashboardsWebviewProvider.show(profileName);
}

/**
 * Command to get a single dashboard by ID and save it
 */
export async function getDashboardById(context: vscode.ExtensionContext, dashboardId?: string): Promise<void> {
    const profileManager = new ProfileManager(context);

    // Get active profile
    const activeProfile = await profileManager.getActiveProfile();
    if (!activeProfile) {
        vscode.window.showErrorMessage('No active profile. Please select a profile first.');
        return;
    }

    // Prompt for dashboard ID if not provided
    if (!dashboardId) {
        dashboardId = await vscode.window.showInputBox({
            prompt: 'Enter Dashboard ID',
            placeHolder: 'e.g., B23OjNs5ZCyn5VdMwOBoLo3PjgRnJSAlNTKEDAcpuDG2CIgRe9KFXMofm2H2'
        });

        if (!dashboardId) {
            return;
        }
    }

    // Get credentials
    const credentials = await profileManager.getProfileCredentials(activeProfile.name);
    if (!credentials) {
        vscode.window.showErrorMessage(`No credentials found for profile: ${activeProfile.name}`);
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Fetching dashboard ${dashboardId}...`,
            cancellable: false
        }, async () => {
            // Create API client
            const client = new DashboardClient({
                accessId: credentials.accessId,
                accessKey: credentials.accessKey,
                endpoint: profileManager.getProfileEndpoint(activeProfile)
            });

            // Fetch dashboard
            const response = await client.getDashboard(dashboardId!);

            if (response.error || !response.data) {
                // Check if it's a permission error
                if (response.statusCode === 403 || response.statusCode === 401) {
                    vscode.window.showWarningMessage(
                        `Unable to fetch dashboard ${dashboardId}: Insufficient permissions. ` +
                        'Your user role may not have "View Dashboards" capability. ' +
                        `HTTP Status: ${response.statusCode}`
                    );
                } else if (response.statusCode === 404) {
                    vscode.window.showErrorMessage(
                        `Dashboard not found: ${dashboardId} (HTTP 404)`
                    );
                } else {
                    vscode.window.showErrorMessage(
                        `Failed to fetch dashboard ${dashboardId}: ${response.error}` +
                        (response.statusCode ? ` (HTTP ${response.statusCode})` : '')
                    );
                }
                return;
            }

            const dashboard = response.data;

            // Get profile directory and create database
            const profileDir = profileManager.getProfileDirectory(activeProfile.name);
            const db = createDashboardsCacheDB(profileDir, activeProfile.name);

            // Get dashboards directory for JSON file
            const dashboardsDir = profileManager.getProfileDashboardsDirectory(activeProfile.name);
            if (!fs.existsSync(dashboardsDir)) {
                fs.mkdirSync(dashboardsDir, { recursive: true });
            }

            // Store dashboard in database
            const now = new Date().toISOString();
            db.upsertDashboard({
                id: dashboard.id,
                profile: activeProfile.name,
                title: dashboard.title,
                description: dashboard.description,
                folderId: dashboard.folderId,
                contentId: dashboard.contentId,
                lastFetched: now
            });

            // Save JSON file
            const jsonFilePath = path.join(dashboardsDir, `${dashboard.id}.json`);
            fs.writeFileSync(jsonFilePath, JSON.stringify(dashboard, null, 2), 'utf-8');

            db.close();

            vscode.window.showInformationMessage(
                `Successfully fetched dashboard: ${dashboard.title}`
            );

            // Open the JSON file
            const uri = vscode.Uri.file(jsonFilePath);
            vscode.commands.executeCommand('sumologic.openExportedContentFromPath', jsonFilePath);
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to get dashboard: ${error.message}`);
    }
}

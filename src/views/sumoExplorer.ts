import * as vscode from 'vscode';
import { ProfileManager, SumoLogicProfile } from '../profileManager';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Tree item types for the Sumo Logic Explorer
 */
export enum TreeItemType {
    Profile = 'profile',
    ProfilesSection = 'profilesSection',
    QueriesSection = 'queriesSection',
    CollectorsSection = 'collectorsSection',
    ContentSection = 'contentSection',
    QuickActionsSection = 'quickActionsSection',
    QuickAction = 'quickAction',
    RecentQuery = 'recentQuery',
    Collector = 'collector',
    Content = 'content'
}

/**
 * Custom tree item for Sumo Logic Explorer
 */
export class SumoTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly type: TreeItemType,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly profile?: SumoLogicProfile,
        public readonly data?: any
    ) {
        super(label, collapsibleState);
        this.contextValue = type;
        this.setupItem();
    }

    private setupItem() {
        switch (this.type) {
            case TreeItemType.Profile:
                this.iconPath = new vscode.ThemeIcon('database');
                this.tooltip = `Profile: ${this.label}\nRegion: ${this.profile?.region}`;
                this.command = {
                    command: 'sumologic.switchProfile',
                    title: 'Switch Profile',
                    arguments: [this.profile?.name]
                };
                break;
            case TreeItemType.ProfilesSection:
                this.iconPath = new vscode.ThemeIcon('account');
                this.tooltip = 'Sumo Logic Profiles';
                break;
            case TreeItemType.QueriesSection:
                this.iconPath = new vscode.ThemeIcon('history');
                this.tooltip = 'Recent Queries';
                break;
            case TreeItemType.CollectorsSection:
                this.iconPath = new vscode.ThemeIcon('server');
                this.tooltip = 'Data Collectors';
                break;
            case TreeItemType.ContentSection:
                this.iconPath = new vscode.ThemeIcon('folder-library');
                this.tooltip = 'Saved Content';
                break;
            case TreeItemType.QuickActionsSection:
                this.iconPath = new vscode.ThemeIcon('zap');
                this.tooltip = 'Quick Actions';
                break;
            case TreeItemType.QuickAction:
                this.iconPath = new vscode.ThemeIcon(this.data?.icon || 'circle-outline');
                this.command = {
                    command: this.data?.command,
                    title: this.label
                };
                break;
            case TreeItemType.RecentQuery:
                this.iconPath = new vscode.ThemeIcon('file-code');
                this.tooltip = this.data?.tooltip || this.label;
                this.command = {
                    command: 'vscode.open',
                    title: 'Open Query',
                    arguments: [vscode.Uri.file(this.data?.filePath)]
                };
                break;
            case TreeItemType.Collector:
                this.iconPath = new vscode.ThemeIcon('server-process');
                this.tooltip = `Collector: ${this.label}`;
                break;
            case TreeItemType.Content:
                this.iconPath = new vscode.ThemeIcon('folder');
                this.tooltip = `Content: ${this.label}`;
                break;
        }
    }
}

/**
 * Tree data provider for Sumo Logic Explorer view
 */
export class SumoExplorerProvider implements vscode.TreeDataProvider<SumoTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SumoTreeItem | undefined | null | void> = new vscode.EventEmitter<SumoTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SumoTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private profileManager: ProfileManager;

    constructor(private context: vscode.ExtensionContext) {
        this.profileManager = new ProfileManager(context);

        // Listen for configuration changes to refresh tree
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('sumologic')) {
                this.refresh();
            }
        });
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item for display
     */
    getTreeItem(element: SumoTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for tree item
     */
    async getChildren(element?: SumoTreeItem): Promise<SumoTreeItem[]> {
        if (!element) {
            // Root level - show main sections
            return this.getRootItems();
        }

        switch (element.type) {
            case TreeItemType.ProfilesSection:
                return this.getProfileItems();
            case TreeItemType.QuickActionsSection:
                return this.getQuickActionItems();
            case TreeItemType.QueriesSection:
                return this.getRecentQueryItems();
            case TreeItemType.CollectorsSection:
                return this.getCollectorItems();
            case TreeItemType.ContentSection:
                return this.getContentItems();
            default:
                return [];
        }
    }

    /**
     * Get root level items
     */
    private async getRootItems(): Promise<SumoTreeItem[]> {
        const items: SumoTreeItem[] = [];

        // Check if any profiles exist
        const hasProfiles = await this.profileManager.hasProfiles();

        if (!hasProfiles) {
            // Show a welcome item prompting to create first profile
            const welcomeItem = new SumoTreeItem(
                'Create your first profile',
                TreeItemType.QuickAction,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                { command: 'sumologic.createProfile', icon: 'add' }
            );
            return [welcomeItem];
        }

        // Show active profile at top
        const activeProfile = await this.profileManager.getActiveProfile();
        if (activeProfile) {
            const activeProfileItem = new SumoTreeItem(
                `${activeProfile.name} (Active)`,
                TreeItemType.Profile,
                vscode.TreeItemCollapsibleState.None,
                activeProfile
            );
            activeProfileItem.iconPath = new vscode.ThemeIcon('check');
            items.push(activeProfileItem);
        }

        // Quick Actions section
        items.push(new SumoTreeItem(
            'Quick Actions',
            TreeItemType.QuickActionsSection,
            vscode.TreeItemCollapsibleState.Expanded
        ));

        // Profiles section
        items.push(new SumoTreeItem(
            'Profiles',
            TreeItemType.ProfilesSection,
            vscode.TreeItemCollapsibleState.Collapsed
        ));

        // Recent Queries section
        items.push(new SumoTreeItem(
            'Recent Queries',
            TreeItemType.QueriesSection,
            vscode.TreeItemCollapsibleState.Collapsed
        ));

        // Collectors section
        items.push(new SumoTreeItem(
            'Collectors',
            TreeItemType.CollectorsSection,
            vscode.TreeItemCollapsibleState.Collapsed
        ));

        // Content section
        items.push(new SumoTreeItem(
            'Content',
            TreeItemType.ContentSection,
            vscode.TreeItemCollapsibleState.Collapsed
        ));

        return items;
    }

    /**
     * Get profile items
     */
    private async getProfileItems(): Promise<SumoTreeItem[]> {
        const profiles = await this.profileManager.getProfiles();
        const activeProfileName = await this.profileManager.getActiveProfileName();

        return profiles.map(profile => {
            const isActive = profile.name === activeProfileName;
            const label = isActive ? `${profile.name} ✓` : profile.name;
            const item = new SumoTreeItem(
                label,
                TreeItemType.Profile,
                vscode.TreeItemCollapsibleState.None,
                profile
            );
            if (isActive) {
                item.description = 'Active';
            }
            return item;
        });
    }

    /**
     * Get quick action items
     */
    private getQuickActionItems(): SumoTreeItem[] {
        const actions = [
            { label: 'New Query', command: 'sumologic.newSumoFile', icon: 'new-file' },
            { label: 'Run Query', command: 'sumologic.runQuery', icon: 'play' },
            { label: 'Test Connection', command: 'sumologic.testConnection', icon: 'plug' },
            { label: 'Fetch Custom Fields', command: 'sumologic.fetchCustomFields', icon: 'refresh' },
            { label: 'Fetch Partitions', command: 'sumologic.fetchPartitions', icon: 'refresh' },
            { label: 'Cache Key Metadata', command: 'sumologic.cacheKeyMetadata', icon: 'database' }
        ];

        return actions.map(action =>
            new SumoTreeItem(
                action.label,
                TreeItemType.QuickAction,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                { command: action.command, icon: action.icon }
            )
        );
    }

    /**
     * Get recent query items by scanning profile directory for .sumo files
     */
    private async getRecentQueryItems(): Promise<SumoTreeItem[]> {
        const activeProfile = await this.profileManager.getActiveProfile();
        if (!activeProfile) {
            return [];
        }

        try {
            const profileDir = this.profileManager.getProfileDirectory(activeProfile.name);

            // Check if directory exists
            if (!fs.existsSync(profileDir)) {
                return [];
            }

            // Get all .sumo files from profile directory
            const files = fs.readdirSync(profileDir)
                .filter(file => file.endsWith('.sumo'))
                .map(file => {
                    const filePath = path.join(profileDir, file);
                    const stats = fs.statSync(filePath);
                    return { file, filePath, mtime: stats.mtime };
                })
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
                .slice(0, 10); // Show only 10 most recent

            if (files.length === 0) {
                return [];
            }

            return files.map(({ file, filePath, mtime }) => {
                const label = file.replace('.sumo', '');
                const tooltip = `${label}\nModified: ${mtime.toLocaleString()}`;
                return new SumoTreeItem(
                    label,
                    TreeItemType.RecentQuery,
                    vscode.TreeItemCollapsibleState.None,
                    undefined,
                    { filePath, tooltip }
                );
            });
        } catch (error) {
            console.error('Error loading recent queries:', error);
            return [];
        }
    }

    /**
     * Get collector items (placeholder for now)
     */
    private async getCollectorItems(): Promise<SumoTreeItem[]> {
        // TODO: Implement when we have collector listing functionality
        // For now, show quick actions to fetch collectors
        return [
            new SumoTreeItem(
                'Fetch Collectors...',
                TreeItemType.QuickAction,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                { command: 'sumologic.fetchCollectors', icon: 'cloud-download' }
            )
        ];
    }

    /**
     * Get content items
     */
    private async getContentItems(): Promise<SumoTreeItem[]> {
        return [
            new SumoTreeItem(
                'Get Personal Folder...',
                TreeItemType.QuickAction,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                { command: 'sumologic.getPersonalFolder', icon: 'folder-opened' }
            ),
            new SumoTreeItem(
                'Export Content by ID...',
                TreeItemType.QuickAction,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                { command: 'sumologic.exportContent', icon: 'export' }
            ),
            new SumoTreeItem(
                'Export Admin Recommended',
                TreeItemType.QuickAction,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                { command: 'sumologic.exportAdminRecommended', icon: 'export' }
            ),
            new SumoTreeItem(
                'Export Global Folder',
                TreeItemType.QuickAction,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                { command: 'sumologic.exportGlobalFolder', icon: 'globe' }
            ),
            new SumoTreeItem(
                'Export Installed Apps',
                TreeItemType.QuickAction,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                { command: 'sumologic.exportInstalledApps', icon: 'extensions' }
            )
        ];
    }
}

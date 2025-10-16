import * as vscode from 'vscode';
import { ProfileManager, SumoLogicProfile } from '../profileManager';
import * as path from 'path';
import * as fs from 'fs';
import { LibraryExplorerProvider, LibraryTreeItem } from './libraryExplorer';
import { RecentQueriesManager } from '../recentQueriesManager';
import { RecentContentManager } from '../recentContentManager';

/**
 * Tree item types for the Sumo Logic Explorer
 */
export enum TreeItemType {
    Profile = 'profile',
    ProfilesSection = 'profilesSection',
    QueriesSection = 'queriesSection',
    RecentContentSection = 'recentContentSection',
    CollectorsSection = 'collectorsSection',
    ContentSection = 'contentSection',
    QuickActionsSection = 'quickActionsSection',
    StorageSection = 'storageSection',
    LibrarySection = 'librarySection',
    UsersSection = 'usersSection',
    RolesSection = 'rolesSection',
    QuickAction = 'quickAction',
    RecentQuery = 'recentQuery',
    RecentContent = 'recentContent',
    Collector = 'collector',
    Content = 'content',
    StorageFolder = 'storageFolder',
    StorageFile = 'storageFile'
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
            case TreeItemType.RecentContentSection:
                this.iconPath = new vscode.ThemeIcon('book');
                this.tooltip = 'Recent Content';
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
            case TreeItemType.RecentContent:
                // Use different icons based on content type
                const iconMap: Record<string, string> = {
                    'DashboardV2SyncDefinition': 'dashboard',
                    'DashboardSyncDefinition': 'dashboard',
                    'Dashboard': 'dashboard',
                    'SavedSearchWithScheduleSyncDefinition': 'search',
                    'Search': 'search',
                    'LookupTableSyncDefinition': 'table',
                    'Lookups': 'table'
                };
                const iconName = iconMap[this.data?.contentType] || 'json';
                this.iconPath = new vscode.ThemeIcon(iconName);
                this.tooltip = this.data?.tooltip || this.label;
                this.command = {
                    command: 'sumologic.openExportedContentFromPath',
                    title: 'Open Content',
                    arguments: [this.data?.filePath]
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
            case TreeItemType.StorageSection:
                this.iconPath = new vscode.ThemeIcon('file-directory');
                this.tooltip = 'Profile Storage Directory';
                break;
            case TreeItemType.LibrarySection:
                this.iconPath = new vscode.ThemeIcon('library');
                this.tooltip = 'Content Library Explorer';
                break;
            case TreeItemType.UsersSection:
                this.iconPath = new vscode.ThemeIcon('account');
                this.tooltip = 'Users';
                this.command = {
                    command: 'sumologic.viewUsers',
                    title: 'View Users',
                    arguments: [this.data?.profileName]
                };
                break;
            case TreeItemType.RolesSection:
                this.iconPath = new vscode.ThemeIcon('shield');
                this.tooltip = 'Roles';
                this.command = {
                    command: 'sumologic.viewRoles',
                    title: 'View Roles',
                    arguments: [this.data?.profileName]
                };
                break;
            case TreeItemType.StorageFolder:
                this.iconPath = new vscode.ThemeIcon('folder');
                this.tooltip = this.data?.path || this.label;
                this.resourceUri = this.data?.path ? vscode.Uri.file(this.data.path) : undefined;
                break;
            case TreeItemType.StorageFile:
                this.iconPath = vscode.ThemeIcon.File;
                this.tooltip = this.data?.path || this.label;
                this.resourceUri = this.data?.path ? vscode.Uri.file(this.data.path) : undefined;
                this.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(this.data?.path)]
                };
                break;
        }
    }
}

/**
 * Tree data provider for Sumo Logic Explorer view
 */
export class SumoExplorerProvider implements vscode.TreeDataProvider<SumoTreeItem | LibraryTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SumoTreeItem | LibraryTreeItem | undefined | null | void> = new vscode.EventEmitter<SumoTreeItem | LibraryTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SumoTreeItem | LibraryTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private profileManager: ProfileManager;
    private libraryExplorerProvider: LibraryExplorerProvider;
    private recentQueriesManager: RecentQueriesManager;
    private recentContentManager: RecentContentManager;

    constructor(private context: vscode.ExtensionContext) {
        this.profileManager = new ProfileManager(context);
        this.libraryExplorerProvider = new LibraryExplorerProvider(context);
        this.recentQueriesManager = new RecentQueriesManager(context);
        this.recentContentManager = new RecentContentManager(context);

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
        this.libraryExplorerProvider.refresh();
    }

    /**
     * Get the recent queries manager
     */
    getRecentQueriesManager(): RecentQueriesManager {
        return this.recentQueriesManager;
    }

    /**
     * Get recent content manager
     */
    getRecentContentManager(): RecentContentManager {
        return this.recentContentManager;
    }

    /**
     * Get tree item for display
     */
    getTreeItem(element: SumoTreeItem | LibraryTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for tree item
     */
    async getChildren(element?: SumoTreeItem | LibraryTreeItem): Promise<(SumoTreeItem | LibraryTreeItem)[]> {
        // If element is a LibraryTreeItem, delegate to LibraryExplorerProvider
        if (element && element instanceof LibraryTreeItem) {
            return this.libraryExplorerProvider.getChildren(element);
        }

        if (!element) {
            // Root level - show main sections
            return this.getRootItems();
        }

        // Handle SumoTreeItem types
        const sumoElement = element as SumoTreeItem;
        switch (sumoElement.type) {
            case TreeItemType.ProfilesSection:
                return this.getProfileItems();
            case TreeItemType.QuickActionsSection:
                return this.getQuickActionItems();
            case TreeItemType.QueriesSection:
                return this.getRecentQueryItems();
            case TreeItemType.RecentContentSection:
                return this.getRecentContentItems();
            case TreeItemType.CollectorsSection:
                return this.getCollectorItems();
            case TreeItemType.StorageSection:
                return this.getStorageItems();
            case TreeItemType.LibrarySection:
                return this.libraryExplorerProvider.getChildren();
            case TreeItemType.Profile:
                return this.getProfileSubItems(sumoElement.profile);
            case TreeItemType.StorageFolder:
                return this.getStorageFolderContents(sumoElement.data?.path);
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

        // Recent Content section
        items.push(new SumoTreeItem(
            'Recent Content',
            TreeItemType.RecentContentSection,
            vscode.TreeItemCollapsibleState.Collapsed
        ));

        // Collectors section
        items.push(new SumoTreeItem(
            'Collectors',
            TreeItemType.CollectorsSection,
            vscode.TreeItemCollapsibleState.Collapsed
        ));

        // Library section (new hierarchical explorer)
        items.push(new SumoTreeItem(
            'Library',
            TreeItemType.LibrarySection,
            vscode.TreeItemCollapsibleState.Collapsed
        ));

        // Storage section
        items.push(new SumoTreeItem(
            'Storage Explorer',
            TreeItemType.StorageSection,
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
                vscode.TreeItemCollapsibleState.Collapsed,
                profile
            );
            if (isActive) {
                item.description = 'Active';
            }
            // Remove the command so clicking doesn't switch profile, allows expansion
            item.command = undefined;
            return item;
        });
    }

    /**
     * Get sub-items for a profile (users, roles, etc.)
     */
    private getProfileSubItems(profile?: SumoLogicProfile): SumoTreeItem[] {
        if (!profile) {
            return [];
        }

        const items: SumoTreeItem[] = [];

        // Users section
        items.push(new SumoTreeItem(
            'Users',
            TreeItemType.UsersSection,
            vscode.TreeItemCollapsibleState.None,
            profile,
            { profileName: profile.name }
        ));

        // Roles section
        items.push(new SumoTreeItem(
            'Roles',
            TreeItemType.RolesSection,
            vscode.TreeItemCollapsibleState.None,
            profile,
            { profileName: profile.name }
        ));

        return items;
    }

    /**
     * Get quick action items
     */
    private getQuickActionItems(): SumoTreeItem[] {
        const actions = [
            { label: 'New Query', command: 'sumologic.newSumoFile', icon: 'new-file' },
            { label: 'Run Query', command: 'sumologic.runQuery', icon: 'play' },
            { label: 'Open Exported Content', command: 'sumologic.openExportedContent', icon: 'file-code' },
            { label: 'Test Connection', command: 'sumologic.testConnection', icon: 'plug' },
            { label: 'Fetch Custom Fields', command: 'sumologic.fetchCustomFields', icon: 'refresh' },
            { label: 'Fetch Partitions', command: 'sumologic.fetchPartitions', icon: 'refresh' },
            { label: 'Cache Key Metadata', command: 'sumologic.cacheKeyMetadata', icon: 'database' },
            { label: 'View Autocomplete Data', command: 'sumologic.viewAutocomplete', icon: 'list-tree' }
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
        const recentQueries = activeProfile
            ? this.recentQueriesManager.getQueriesByProfile(activeProfile.name, 10)
            : this.recentQueriesManager.getQueries(10);

        if (recentQueries.length === 0) {
            return [];
        }

        return recentQueries.map(query => {
            const label = query.name || query.fileName.replace('.sumo', '');
            const lastOpened = new Date(query.lastOpened);
            const tooltipLines = [
                label,
                `File: ${query.fileName}`,
                `Opened: ${lastOpened.toLocaleString()}`
            ];

            if (query.profile) {
                tooltipLines.push(`Profile: ${query.profile}`);
            }

            if (query.queryPreview) {
                tooltipLines.push(`Preview: ${query.queryPreview}`);
            }

            const tooltip = tooltipLines.join('\n');

            return new SumoTreeItem(
                label,
                TreeItemType.RecentQuery,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                { filePath: query.filePath, path: query.filePath, tooltip }
            );
        });
    }

    /**
     * Get recent content items
     */
    private async getRecentContentItems(): Promise<SumoTreeItem[]> {
        // Always show all recent content regardless of profile (file path is the key)
        const recentContent = this.recentContentManager.getContent(10);

        console.log(`[SumoExplorer] Found ${recentContent.length} recent content items`);

        if (recentContent.length === 0) {
            return [];
        }

        return recentContent.map(content => {
            const label = content.contentName || content.fileName.replace('.json', '');
            const lastOpened = new Date(content.lastOpened);
            const tooltipLines = [
                label,
                `Type: ${content.contentType}`,
                `File: ${content.fileName}`,
                `Opened: ${lastOpened.toLocaleString()}`
            ];

            if (content.profile) {
                tooltipLines.push(`Profile: ${content.profile}`);
            }

            const tooltip = tooltipLines.join('\n');

            return new SumoTreeItem(
                label,
                TreeItemType.RecentContent,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                {
                    filePath: content.filePath,
                    contentId: content.contentId,
                    contentName: content.contentName,
                    contentType: content.contentType,
                    tooltip
                }
            );
        });
    }

    /**
     * Get collector items - show profile nodes with fetch collectors command
     */
    private async getCollectorItems(): Promise<SumoTreeItem[]> {
        const profiles = await this.profileManager.getProfiles();
        const activeProfileName = await this.profileManager.getActiveProfileName();

        return profiles.map(profile => {
            const isActive = profile.name === activeProfileName;
            const label = isActive ? `${profile.name} (Active)` : profile.name;
            const item = new SumoTreeItem(
                label,
                TreeItemType.QuickAction,
                vscode.TreeItemCollapsibleState.None,
                profile,
                {
                    command: 'sumologic.fetchCollectors',
                    icon: 'database',
                    profileName: profile.name
                }
            );
            item.tooltip = `Fetch collectors for ${profile.name}`;
            return item;
        });
    }

    /**
     * Get storage items - shows active profile's storage directory and root storage path
     */
    private async getStorageItems(): Promise<SumoTreeItem[]> {
        const items: SumoTreeItem[] = [];

        // Get active profile
        const activeProfile = await this.profileManager.getActiveProfile();

        if (activeProfile) {
            const profileDir = this.profileManager.getProfileDirectory(activeProfile.name);

            // Add active profile storage folder
            items.push(new SumoTreeItem(
                activeProfile.name,
                TreeItemType.StorageFolder,
                vscode.TreeItemCollapsibleState.Collapsed,
                activeProfile,
                { path: profileDir, isProfileRoot: true }
            ));
        }

        // Add all profiles storage folder (shows all profiles)
        const allProfiles = await this.profileManager.getProfiles();
        if (allProfiles.length > 1) {
            for (const profile of allProfiles) {
                if (!activeProfile || profile.name !== activeProfile.name) {
                    const profileDir = this.profileManager.getProfileDirectory(profile.name);
                    items.push(new SumoTreeItem(
                        profile.name,
                        TreeItemType.StorageFolder,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        profile,
                        { path: profileDir, isProfileRoot: true }
                    ));
                }
            }
        }

        return items;
    }

    /**
     * Get contents of a storage folder
     */
    private async getStorageFolderContents(folderPath: string): Promise<SumoTreeItem[]> {
        if (!folderPath || !fs.existsSync(folderPath)) {
            return [];
        }

        try {
            const entries = fs.readdirSync(folderPath, { withFileTypes: true });
            const items: SumoTreeItem[] = [];

            // Sort: folders first, then files, alphabetically within each group
            const folders = entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
            const files = entries.filter(e => e.isFile()).sort((a, b) => a.name.localeCompare(b.name));

            // Add folders
            for (const folder of folders) {
                const fullPath = path.join(folderPath, folder.name);
                const stats = fs.statSync(fullPath);
                const itemCount = fs.readdirSync(fullPath).length;

                items.push(new SumoTreeItem(
                    folder.name,
                    TreeItemType.StorageFolder,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    undefined,
                    {
                        path: fullPath,
                        stats,
                        itemCount,
                        tooltip: `${folder.name}\n${itemCount} items\nModified: ${stats.mtime.toLocaleString()}`
                    }
                ));
            }

            // Add files
            for (const file of files) {
                // Skip hidden files and system files
                if (file.name.startsWith('.')) {
                    continue;
                }

                const fullPath = path.join(folderPath, file.name);
                const stats = fs.statSync(fullPath);
                const sizeKB = (stats.size / 1024).toFixed(1);

                // Determine if this is a query JSON file in queries folder
                const isQueryJson = file.name.endsWith('.json') && folderPath.includes('/queries');

                const item = new SumoTreeItem(
                    file.name,
                    TreeItemType.StorageFile,
                    vscode.TreeItemCollapsibleState.None,
                    undefined,
                    {
                        path: fullPath,
                        stats,
                        tooltip: `${file.name}\nSize: ${sizeKB} KB\nModified: ${stats.mtime.toLocaleString()}`
                    }
                );

                // Override contextValue for query JSON files
                if (isQueryJson) {
                    item.contextValue = 'queryJsonFile';
                }

                items.push(item);
            }

            return items;
        } catch (error) {
            console.error('Error reading storage folder:', error);
            return [];
        }
    }
}

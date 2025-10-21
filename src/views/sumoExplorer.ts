import * as vscode from 'vscode';
import { ProfileManager, SumoLogicProfile } from '../profileManager';
import * as path from 'path';
import * as fs from 'fs';
import { LibraryExplorerProvider, LibraryTreeItem } from './libraryExplorer';
import { RecentQueriesManager } from '../recentQueriesManager';
import { RecentContentManager } from '../recentContentManager';
import { RecentResultsManager } from '../recentResultsManager';

/**
 * Tree item types for the Sumo Logic Explorer
 */
export enum TreeItemType {
    Profile = 'profile',
    ProfilesSection = 'profilesSection',
    QueriesSection = 'queriesSection',
    RecentContentSection = 'recentContentSection',
    RecentResultsSection = 'recentResultsSection',
    CollectorsSection = 'collectorsSection',
    ContentSection = 'contentSection',
    QuickActionsSection = 'quickActionsSection',
    StorageSection = 'storageSection',
    LibrarySection = 'librarySection',
    AutocompleteDataSection = 'autocompleteDataSection',
    UsersSection = 'usersSection',
    RolesSection = 'rolesSection',
    ScopesSection = 'scopesSection',
    DashboardsSection = 'dashboardsSection',
    AccountSection = 'accountSection',
    Scope = 'scope',
    QuickAction = 'quickAction',
    RecentQuery = 'recentQuery',
    RecentContent = 'recentContent',
    RecentResult = 'recentResult',
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
            case TreeItemType.RecentResultsSection:
                this.iconPath = new vscode.ThemeIcon('output');
                this.tooltip = 'Recent Query Results';
                break;
            case TreeItemType.CollectorsSection:
                this.iconPath = new vscode.ThemeIcon('server');
                this.tooltip = `Fetch collectors for ${this.profile?.name || 'profile'}`;
                // Make it clickable to fetch collectors
                if (this.profile) {
                    this.command = {
                        command: 'sumologic.fetchCollectors',
                        title: 'Fetch Collectors',
                        arguments: [this.profile.name]
                    };
                }
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
            case TreeItemType.RecentResult:
                // Use different icons based on file format
                const formatIconMap: Record<string, string> = {
                    'json': 'json',
                    'csv': 'file-text',
                    'table': 'output'
                };
                const resultIcon = formatIconMap[this.data?.format || ''] || 'file';
                this.iconPath = new vscode.ThemeIcon(resultIcon);
                this.tooltip = this.data?.tooltip || this.label;
                // Open JSON results in dedicated query results webview, others in editor
                if (this.data?.format === 'json') {
                    this.command = {
                        command: 'sumologic.openQueryResultAsWebview',
                        title: 'Open Result',
                        arguments: [this]
                    };
                } else {
                    this.command = {
                        command: 'vscode.open',
                        title: 'Open Result',
                        arguments: [vscode.Uri.file(this.data?.filePath)]
                    };
                }
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
            case TreeItemType.DashboardsSection:
                this.iconPath = new vscode.ThemeIcon('dashboard');
                this.tooltip = 'Dashboards';
                this.command = {
                    command: 'sumologic.viewDashboards',
                    title: 'View Dashboards',
                    arguments: [this.data?.profileName]
                };
                break;
            case TreeItemType.ScopesSection:
                this.iconPath = new vscode.ThemeIcon('target');
                this.tooltip = 'Scopes';
                this.command = {
                    command: 'sumologic.viewScopesOverview',
                    title: 'View Scopes Overview',
                    arguments: [this.profile?.name]
                };
                break;
            case TreeItemType.AccountSection:
                this.iconPath = new vscode.ThemeIcon('organization');
                this.tooltip = 'Account Management';
                this.command = {
                    command: 'sumologic.viewAccount',
                    title: 'View Account',
                    arguments: [this.data?.profileName]
                };
                break;
            case TreeItemType.AutocompleteDataSection:
                this.iconPath = new vscode.ThemeIcon('list-tree');
                this.tooltip = 'Autocomplete Data for this profile';
                break;
            case TreeItemType.Scope:
                this.iconPath = new vscode.ThemeIcon('scope');
                this.tooltip = this.data?.description || this.label;
                this.command = {
                    command: 'sumologic.viewScope',
                    title: 'View Scope',
                    arguments: [this.data?.scopeId, this.data?.profileName]
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
    private recentResultsManager: RecentResultsManager;

    constructor(private context: vscode.ExtensionContext) {
        this.profileManager = new ProfileManager(context);
        this.libraryExplorerProvider = new LibraryExplorerProvider(context);
        this.recentQueriesManager = new RecentQueriesManager(context);
        this.recentContentManager = new RecentContentManager(context);
        this.recentResultsManager = new RecentResultsManager(context);

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
     * Get recent results manager
     */
    getRecentResultsManager(): RecentResultsManager {
        return this.recentResultsManager;
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
            case TreeItemType.RecentResultsSection:
                return this.getRecentResultItems();
            case TreeItemType.StorageSection:
                return this.getStorageItems();
            case TreeItemType.LibrarySection:
                return this.getLibraryItemsForProfile(sumoElement.profile);
            case TreeItemType.AutocompleteDataSection:
                return this.getAutocompleteDataItems(sumoElement.profile);
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

        // Recent Results section
        items.push(new SumoTreeItem(
            'Recent Results',
            TreeItemType.RecentResultsSection,
            vscode.TreeItemCollapsibleState.Collapsed
        ));

        // Scopes section (uses _global folder, not profile-specific)
        if (activeProfile) {
            items.push(new SumoTreeItem(
                'Scopes',
                TreeItemType.ScopesSection,
                vscode.TreeItemCollapsibleState.None,
                activeProfile
            ));
        }

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

        // Test Connection
        const testConnectionItem = new SumoTreeItem(
            'Test Connection',
            TreeItemType.QuickAction,
            vscode.TreeItemCollapsibleState.None,
            profile,
            { command: 'sumologic.testConnection', icon: 'plug' }
        );
        testConnectionItem.command = {
            command: 'sumologic.testConnection',
            title: 'Test Connection',
            arguments: [profile.name]
        };
        items.push(testConnectionItem);

        // Autocomplete Data section
        items.push(new SumoTreeItem(
            'Autocomplete Data',
            TreeItemType.AutocompleteDataSection,
            vscode.TreeItemCollapsibleState.Collapsed,
            profile
        ));

        // Collectors section
        items.push(new SumoTreeItem(
            'Collectors',
            TreeItemType.CollectorsSection,
            vscode.TreeItemCollapsibleState.None,
            profile
        ));

        // Library section
        items.push(new SumoTreeItem(
            'Library',
            TreeItemType.LibrarySection,
            vscode.TreeItemCollapsibleState.Collapsed,
            profile
        ));

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

        // Dashboards section
        items.push(new SumoTreeItem(
            'Dashboards',
            TreeItemType.DashboardsSection,
            vscode.TreeItemCollapsibleState.None,
            profile,
            { profileName: profile.name }
        ));

        // Account section
        items.push(new SumoTreeItem(
            'Account',
            TreeItemType.AccountSection,
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
            { label: 'Open Exported Content', command: 'sumologic.openExportedContent', icon: 'file-code' }
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
     * Get autocomplete data items for a specific profile
     */
    private getAutocompleteDataItems(profile?: SumoLogicProfile): SumoTreeItem[] {
        if (!profile) {
            return [];
        }

        const actions = [
            { label: 'Fetch Custom Fields', command: 'sumologic.fetchCustomFields', icon: 'refresh', args: [profile.name] },
            { label: 'Fetch Partitions', command: 'sumologic.fetchPartitions', icon: 'refresh', args: [profile.name] },
            { label: 'Cache Key Metadata', command: 'sumologic.cacheKeyMetadata', icon: 'database', args: [profile.name] },
            { label: 'View Autocomplete Data', command: 'sumologic.viewAutocomplete', icon: 'list-tree', args: [] }
        ];

        return actions.map(action => {
            const item = new SumoTreeItem(
                action.label,
                TreeItemType.QuickAction,
                vscode.TreeItemCollapsibleState.None,
                profile,
                { command: action.command, icon: action.icon, args: action.args }
            );
            // Override the command to include arguments
            item.command = {
                command: action.command,
                title: action.label,
                arguments: action.args
            };
            return item;
        });
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
     * Get recent result items
     */
    private async getRecentResultItems(): Promise<SumoTreeItem[]> {
        const recentResults = this.recentResultsManager.getResults(10);

        if (recentResults.length === 0) {
            return [];
        }

        return recentResults.map(result => {
            const label = result.queryName || result.fileName;
            const lastOpened = new Date(result.lastOpened);
            const tooltipLines = [
                label,
                `File: ${result.fileName}`,
                `Format: ${result.format || 'unknown'}`,
                `Opened: ${lastOpened.toLocaleString()}`
            ];

            if (result.resultPreview) {
                tooltipLines.push(`Preview: ${result.resultPreview}`);
            }

            const tooltip = tooltipLines.join('\n');

            return new SumoTreeItem(
                label,
                TreeItemType.RecentResult,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                { filePath: result.filePath, path: result.filePath, format: result.format, tooltip }
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
     * Get library items for a specific profile
     */
    private async getLibraryItemsForProfile(profile?: SumoLogicProfile): Promise<LibraryTreeItem[]> {
        if (!profile) {
            return [];
        }

        // Create a fake LibraryTreeItem for the profile's library root
        // Then get its top-level nodes
        const libraryRootItem = new (await import('./libraryExplorer')).LibraryTreeItem(
            profile.name,
            'library_root',
            'LibraryRoot',
            profile.name,
            vscode.TreeItemCollapsibleState.Collapsed,
            true,
            false,
            (await import('./libraryExplorer')).LibraryItemType.LibraryRoot
        );

        return this.libraryExplorerProvider.getChildren(libraryRootItem);
    }

    /**
     * Get storage items - shows contents of the File Storage Path
     */
    private async getStorageItems(): Promise<SumoTreeItem[]> {
        // Get the root storage path (e.g., ~/.sumologic)
        const storageRoot = this.profileManager.getStorageRoot();

        // Return contents of the storage root directory
        return this.getStorageFolderContents(storageRoot);
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

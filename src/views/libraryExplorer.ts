import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager, SumoLogicProfile } from '../profileManager';
import { ContentClient, PersonalFolderResponse, ExportResultResponse } from '../api/content';
import { LibraryCacheDB, ContentItem, createLibraryCacheDB } from '../database/libraryCache';
import { formatContentId } from '../utils/contentId';

/**
 * Library tree item types
 */
export enum LibraryItemType {
    LibraryRoot = 'libraryRoot',           // "Library" node under profile
    TopLevelNode = 'topLevelNode',         // Personal, Global, Admin, Apps
    Folder = 'folder',                     // Expandable folder
    Content = 'content',                   // Dashboard, Search, etc.
}

/**
 * Tree item for Library content navigation
 */
export class LibraryTreeItem extends vscode.TreeItem {
    constructor(
        public readonly profile: string,
        public readonly contentId: string,
        public readonly itemType: string,
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly hasChildren: boolean,
        public readonly childrenFetched: boolean,
        public readonly libraryItemType: LibraryItemType,
        public readonly description?: string
    ) {
        super(label, collapsibleState);
        this.setupItem();
    }

    private setupItem() {
        // Set context value for menu contributions
        this.contextValue = `library_${this.libraryItemType}_${this.itemType}`;

        // Set tooltip with ID information
        this.tooltip = this.createTooltip();

        // Set icon based on item type
        this.iconPath = this.getIcon();

        // Set command for non-folder items to open in webview
        if (this.libraryItemType === LibraryItemType.Content ||
            (this.libraryItemType !== LibraryItemType.LibraryRoot &&
             this.libraryItemType !== LibraryItemType.TopLevelNode &&
             !this.hasChildren)) {
            this.command = {
                command: 'sumologic.viewLibraryContent',
                title: 'View Content',
                arguments: [this.profile, this.contentId, this.label]
            };
        }
    }

    private createTooltip(): string {
        const lines: string[] = [this.label];

        if (this.itemType) {
            lines.push(`Type: ${this.itemType}`);
        }

        if (this.contentId && this.contentId !== '0000000000000000') {
            lines.push(`ID: ${formatContentId(this.contentId)}`);
        }

        if (this.description) {
            lines.push(`Description: ${this.description}`);
        }

        return lines.join('\n');
    }

    private getIcon(): vscode.ThemeIcon {
        // Map Sumo Logic item types to VSCode icons
        const iconMap: Record<string, string> = {
            'Folder': 'folder',
            'Dashboard': 'dashboard',
            'DashboardV2SyncDefinition': 'dashboard',
            'Search': 'search',
            'SavedSearchWithScheduleSyncDefinition': 'search',
            'Lookups': 'table',
            'LookupTableSyncDefinition': 'table',
            'Report': 'file-text',
            'ScheduledView': 'calendar',
            'MewboardSyncDefinition': 'layout',
            'MetricsSearch': 'graph',
            'LogSearch': 'search-view-icon',
            'App': 'package',
            'WebhookConnection': 'plug',
        };

        const iconName = iconMap[this.itemType] || 'file';
        return new vscode.ThemeIcon(iconName);
    }
}

/**
 * Tree data provider for Library content navigation
 */
export class LibraryExplorerProvider implements vscode.TreeDataProvider<LibraryTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<LibraryTreeItem | undefined | null | void> =
        new vscode.EventEmitter<LibraryTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<LibraryTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private profileManager: ProfileManager;
    private cacheDatabases: Map<string, LibraryCacheDB> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.profileManager = new ProfileManager(context);
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
    getTreeItem(element: LibraryTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for tree item
     */
    async getChildren(element?: LibraryTreeItem): Promise<LibraryTreeItem[]> {
        if (!element) {
            // Root level - show Library nodes for all profiles
            return this.getLibraryRootNodes();
        }

        switch (element.libraryItemType) {
            case LibraryItemType.LibraryRoot:
                return this.getTopLevelNodes(element.profile);
            case LibraryItemType.TopLevelNode:
            case LibraryItemType.Folder:
                return this.getFolderChildren(element);
            case LibraryItemType.Content:
                // Non-folder items have no children
                return [];
            default:
                return [];
        }
    }

    /**
     * Get library root nodes for all profiles
     */
    private async getLibraryRootNodes(): Promise<LibraryTreeItem[]> {
        const items: LibraryTreeItem[] = [];
        const profiles = await this.profileManager.getProfiles();

        for (const profile of profiles) {
            items.push(new LibraryTreeItem(
                profile.name,
                'library_root',
                'LibraryRoot',
                profile.name,  // Use profile name as label, not "Library"
                vscode.TreeItemCollapsibleState.Collapsed,
                true,
                false,
                LibraryItemType.LibraryRoot
            ));
        }

        return items;
    }

    /**
     * Get top-level nodes (Personal, Global, Admin Recommended, Installed Apps)
     */
    private async getTopLevelNodes(profileName: string): Promise<LibraryTreeItem[]> {
        const items: LibraryTreeItem[] = [];

        // Check cache first
        const db = await this.getCacheDatabase(profileName);
        const cachedTopLevel = db.getTopLevelNodes();

        if (cachedTopLevel.length > 0) {
            // Return cached nodes - mark as top level
            return this.contentItemsToTreeItems(profileName, cachedTopLevel, true);
        }

        // No cache - create placeholder nodes that will fetch on expansion
        const topLevelNodes = [
            { name: 'Personal', id: 'personal', type: 'Folder' },
            { name: 'Global', id: 'global', type: 'Folder' },
            { name: 'Admin Recommended', id: 'adminRecommended', type: 'Folder' },
            { name: 'Installed Apps', id: 'installedApps', type: 'Folder' }
        ];

        for (const node of topLevelNodes) {
            items.push(new LibraryTreeItem(
                profileName,
                node.id,
                node.type,
                node.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                true,
                false,
                LibraryItemType.TopLevelNode
            ));
        }

        return items;
    }

    /**
     * Get children of a folder node
     */
    private async getFolderChildren(element: LibraryTreeItem): Promise<LibraryTreeItem[]> {
        const db = await this.getCacheDatabase(element.profile);

        // Check if we've already fetched children
        if (element.childrenFetched) {
            const cachedChildren = db.getChildren(element.contentId);
            return this.contentItemsToTreeItems(element.profile, cachedChildren);
        }

        // Need to fetch from API
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Loading ${element.label}...`,
            cancellable: false
        }, async () => {
            await this.fetchAndCacheNode(element);
        });

        // Now get children from cache
        const children = db.getChildren(element.contentId);
        return this.contentItemsToTreeItems(element.profile, children);
    }

    /**
     * Fetch a node and its children from the API and cache them
     */
    private async fetchAndCacheNode(element: LibraryTreeItem): Promise<void> {
        const profile = await this.getProfileByName(element.profile);
        if (!profile) {
            throw new Error(`Profile not found: ${element.profile}`);
        }

        const credentials = await this.profileManager.getProfileCredentials(profile.name);
        if (!credentials) {
            throw new Error(`No credentials for profile: ${profile.name}`);
        }

        const client = new ContentClient({
            accessId: credentials.accessId,
            accessKey: credentials.accessKey,
            endpoint: this.profileManager.getProfileEndpoint(profile)
        });

        const db = await this.getCacheDatabase(element.profile);

        // Handle special top-level nodes
        if (element.libraryItemType === LibraryItemType.TopLevelNode) {
            await this.fetchTopLevelNode(element.contentId, client, db, element.profile);
        } else {
            // Regular folder - use getFolder API
            await this.fetchFolder(element.contentId, client, db, element.profile);
        }
    }

    /**
     * Fetch a top-level special node (Personal, Global, Admin, Apps)
     */
    private async fetchTopLevelNode(
        nodeId: string,
        client: ContentClient,
        db: LibraryCacheDB,
        profileName: string
    ): Promise<void> {
        const now = new Date().toISOString();

        switch (nodeId) {
            case 'personal': {
                const response = await client.getPersonalFolder();
                if (response.error || !response.data) {
                    throw new Error(`Failed to fetch Personal folder: ${response.error}`);
                }

                const folder = response.data;

                // Cache the folder itself
                db.upsertContentItem({
                    id: folder.id,
                    profile: profileName,
                    name: folder.name,
                    itemType: folder.itemType,
                    parentId: '0000000000000000',
                    description: folder.description,
                    createdAt: folder.createdAt,
                    createdBy: folder.createdBy,
                    modifiedAt: folder.modifiedAt,
                    modifiedBy: folder.modifiedBy,
                    hasChildren: folder.children && folder.children.length > 0,
                    childrenFetched: true,
                    permissions: folder.permissions,
                    lastFetched: now
                });

                // Cache children
                if (folder.children) {
                    this.cacheChildren(folder.children, folder.id, profileName, db, now);
                }

                // Save JSON
                await this.saveContentJSON(profileName, folder.id, folder);
                break;
            }

            case 'global': {
                const response = await client.exportGlobalFolder();
                if (response.error || !response.data) {
                    throw new Error(`Failed to export Global folder: ${response.error}`);
                }

                const exported = response.data;
                this.cacheExportedContent(exported, '0000000000000000', profileName, db, now, 'data');
                await this.saveContentJSON(profileName, exported.id || 'global', exported);
                break;
            }

            case 'adminRecommended': {
                const response = await client.exportAdminRecommendedFolder();
                if (response.error || !response.data) {
                    throw new Error(`Failed to export Admin Recommended: ${response.error}`);
                }

                const exported = response.data;
                this.cacheExportedContent(exported, '0000000000000000', profileName, db, now, 'children');
                await this.saveContentJSON(profileName, exported.id || 'adminRecommended', exported);
                break;
            }

            case 'installedApps': {
                const response = await client.exportInstalledAppsFolder();
                if (response.error || !response.data) {
                    throw new Error(`Failed to export Installed Apps: ${response.error}`);
                }

                const exported = response.data;
                this.cacheExportedContent(exported, '0000000000000000', profileName, db, now, 'children');
                await this.saveContentJSON(profileName, exported.id || 'installedApps', exported);
                break;
            }
        }
    }

    /**
     * Fetch a regular folder
     */
    private async fetchFolder(
        folderId: string,
        client: ContentClient,
        db: LibraryCacheDB,
        profileName: string
    ): Promise<void> {
        const response = await client.getFolder(folderId);
        if (response.error || !response.data) {
            throw new Error(`Failed to fetch folder: ${response.error}`);
        }

        const folder = response.data;
        const now = new Date().toISOString();

        // Cache the folder
        db.upsertContentItem({
            id: folder.id,
            profile: profileName,
            name: folder.name,
            itemType: folder.itemType,
            parentId: folder.parentId,
            description: folder.description,
            createdAt: folder.createdAt,
            createdBy: folder.createdBy,
            modifiedAt: folder.modifiedAt,
            modifiedBy: folder.modifiedBy,
            hasChildren: folder.children && folder.children.length > 0,
            childrenFetched: true,
            permissions: folder.permissions,
            lastFetched: now
        });

        // Cache children
        if (folder.children) {
            this.cacheChildren(folder.children, folder.id, profileName, db, now);
        }

        // Save JSON
        await this.saveContentJSON(profileName, folder.id, folder);
    }

    /**
     * Cache children from a folder response
     */
    private cacheChildren(
        children: any[],
        parentId: string,
        profileName: string,
        db: LibraryCacheDB,
        timestamp: string
    ): void {
        const items: ContentItem[] = children.map(child => ({
            id: child.id,
            profile: profileName,
            name: child.name,
            itemType: child.itemType,
            parentId: parentId,
            description: child.description,
            createdAt: child.createdAt,
            createdBy: child.createdBy,
            modifiedAt: child.modifiedAt,
            modifiedBy: child.modifiedBy,
            hasChildren: child.itemType === 'Folder' || (child.children && child.children.length > 0),
            childrenFetched: false,
            permissions: child.permissions,
            lastFetched: timestamp
        }));

        db.upsertContentItems(items);
    }

    /**
     * Cache exported content (handles both 'data' and 'children' arrays)
     */
    private cacheExportedContent(
        exported: any,
        parentId: string,
        profileName: string,
        db: LibraryCacheDB,
        timestamp: string,
        childrenKey: 'data' | 'children'
    ): void {
        // Cache the node itself
        db.upsertContentItem({
            id: exported.id || parentId,
            profile: profileName,
            name: exported.name,
            itemType: exported.itemType || 'Folder',
            parentId: parentId,
            description: exported.description,
            createdAt: exported.createdAt,
            createdBy: exported.createdBy,
            modifiedAt: exported.modifiedAt,
            modifiedBy: exported.modifiedBy,
            hasChildren: exported[childrenKey] && exported[childrenKey].length > 0,
            childrenFetched: true,
            permissions: exported.permissions,
            lastFetched: timestamp
        });

        // Cache children
        const children = exported[childrenKey];
        if (children && Array.isArray(children)) {
            this.cacheChildren(children, exported.id, profileName, db, timestamp);
        }
    }

    /**
     * Save content JSON to file
     */
    private async saveContentJSON(profileName: string, contentId: string, content: any): Promise<void> {
        const contentDir = this.profileManager.getProfileLibraryContentDirectory(profileName);

        if (!fs.existsSync(contentDir)) {
            fs.mkdirSync(contentDir, { recursive: true });
        }

        const filePath = path.join(contentDir, `${contentId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
    }

    /**
     * Convert ContentItem array to LibraryTreeItem array
     */
    private contentItemsToTreeItems(profileName: string, items: ContentItem[], isTopLevel: boolean = false): LibraryTreeItem[] {
        return items.map(item => {
            const collapsibleState = item.hasChildren
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;

            // Determine library item type
            let libraryItemType: LibraryItemType;
            if (isTopLevel || item.parentId === '0000000000000000') {
                libraryItemType = LibraryItemType.TopLevelNode;
            } else if (item.itemType === 'Folder') {
                libraryItemType = LibraryItemType.Folder;
            } else {
                libraryItemType = LibraryItemType.Content;
            }

            return new LibraryTreeItem(
                profileName,
                item.id,
                item.itemType,
                item.name,
                collapsibleState,
                item.hasChildren,
                item.childrenFetched,
                libraryItemType,
                item.description
            );
        });
    }

    /**
     * Get or create cache database for a profile
     */
    private async getCacheDatabase(profileName: string): Promise<LibraryCacheDB> {
        if (!this.cacheDatabases.has(profileName)) {
            const profileDir = this.profileManager.getProfileDirectory(profileName);
            const db = createLibraryCacheDB(profileDir, profileName);
            this.cacheDatabases.set(profileName, db);
        }

        return this.cacheDatabases.get(profileName)!;
    }

    /**
     * Get profile by name
     */
    private async getProfileByName(name: string): Promise<SumoLogicProfile | undefined> {
        const profiles = await this.profileManager.getProfiles();
        return profiles.find(p => p.name === name);
    }

    /**
     * Close all cache databases
     */
    dispose(): void {
        for (const db of this.cacheDatabases.values()) {
            db.close();
        }
        this.cacheDatabases.clear();
    }
}

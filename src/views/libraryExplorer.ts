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
    DatabaseViewer = 'databaseViewer',     // Database viewer node
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
        // Also allow clicking on special top-level nodes if they've been fetched
        const isSpecialTopLevel = this.libraryItemType === LibraryItemType.TopLevelNode;

        if (this.libraryItemType === LibraryItemType.Content ||
            (isSpecialTopLevel && this.childrenFetched) ||
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
            case LibraryItemType.DatabaseViewer:
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
     * Get top-level nodes (Personal, Global, Admin Recommended, Installed Apps, Database Viewer)
     */
    private async getTopLevelNodes(profileName: string): Promise<LibraryTreeItem[]> {
        const items: LibraryTreeItem[] = [];

        // Add Database Viewer node first
        const dbViewerItem = new LibraryTreeItem(
            profileName,
            'database_viewer',
            'DatabaseViewer',
            'Database Viewer',
            vscode.TreeItemCollapsibleState.None,
            false,
            true,
            LibraryItemType.DatabaseViewer
        );
        dbViewerItem.command = {
            command: 'sumologic.openDatabaseViewer',
            title: 'Open Database Viewer',
            arguments: [profileName]
        };
        dbViewerItem.iconPath = new vscode.ThemeIcon('database');
        items.push(dbViewerItem);

        // Always show standard top-level nodes (regardless of cache)
        const topLevelNodes = [
            { name: 'Personal', id: 'personal', type: 'Folder' },
            { name: 'Global', id: 'global', type: 'Folder' },
            { name: 'Global (isAdminMode)', id: 'global_admin', type: 'Folder' },
            { name: 'Admin Recommended', id: 'adminRecommended', type: 'Folder' },
            { name: 'Installed Apps', id: 'installedApps', type: 'Folder' }
        ];

        // Check cache to determine if children have been fetched
        const db = await this.getCacheDatabase(profileName);

        for (const node of topLevelNodes) {
            // Check if this node has been cached (fetched before)
            const cachedNode = db.getTopLevelNodes().find(n => n.id === node.id);
            const childrenFetched = cachedNode ? cachedNode.childrenFetched : false;

            items.push(new LibraryTreeItem(
                profileName,
                node.id,
                node.type,
                node.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                true,
                childrenFetched,
                LibraryItemType.TopLevelNode
            ));
        }

        return items;
    }

    /**
     * Get children of a folder node
     */
    private async getFolderChildren(element: LibraryTreeItem): Promise<LibraryTreeItem[]> {
        console.log(`[LibraryExplorer] getFolderChildren: ${element.label} (ID: ${element.contentId}, childrenFetched: ${element.childrenFetched})`);
        const db = await this.getCacheDatabase(element.profile);

        // Check if we've already fetched children
        if (element.childrenFetched) {
            console.log(`[LibraryExplorer] Using cached children for: ${element.contentId}`);
            const cachedChildren = db.getChildren(element.contentId);
            console.log(`[LibraryExplorer] Found ${cachedChildren.length} cached children`);
            return this.contentItemsToTreeItems(element.profile, cachedChildren);
        }

        // Need to fetch from API
        console.log(`[LibraryExplorer] Need to fetch children from API for: ${element.contentId}`);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Loading ${element.label}...`,
            cancellable: false
        }, async () => {
            await this.fetchAndCacheNode(element);
        });

        // Now get children from cache
        console.log(`[LibraryExplorer] Fetching children from cache after API call, parent ID: ${element.contentId}`);
        const children = db.getChildren(element.contentId);
        console.log(`[LibraryExplorer] Found ${children.length} children in cache`);
        const treeItems = this.contentItemsToTreeItems(element.profile, children);
        console.log(`[LibraryExplorer] Converted to ${treeItems.length} tree items`);
        return treeItems;
    }

    /**
     * Fetch a node and its children from the API and cache them
     */
    private async fetchAndCacheNode(element: LibraryTreeItem): Promise<void> {
        console.log(`[LibraryExplorer] fetchAndCacheNode: ${element.label} (ID: ${element.contentId}, Type: ${element.libraryItemType})`);

        const profile = await this.getProfileByName(element.profile);
        if (!profile) {
            console.error(`[LibraryExplorer] Profile not found: ${element.profile}`);
            throw new Error(`Profile not found: ${element.profile}`);
        }

        const credentials = await this.profileManager.getProfileCredentials(profile.name);
        if (!credentials) {
            console.error(`[LibraryExplorer] No credentials for profile: ${profile.name}`);
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
            console.log(`[LibraryExplorer] Fetching top-level node: ${element.contentId}`);
            await this.fetchTopLevelNode(element.contentId, client, db, element.profile);
        } else {
            // Regular folder - use getFolder API
            console.log(`[LibraryExplorer] Fetching regular folder: ${element.contentId}`);
            await this.fetchFolder(element.contentId, client, db, element.profile);
        }
        console.log(`[LibraryExplorer] fetchAndCacheNode completed for: ${element.label}`);
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
        console.log(`[LibraryExplorer] fetchTopLevelNode: ${nodeId}`);
        const now = new Date().toISOString();

        switch (nodeId) {
            case 'personal': {
                console.log(`[LibraryExplorer] Fetching Personal folder...`);
                const response = await client.getPersonalFolder();
                if (response.error || !response.data) {
                    console.error(`[LibraryExplorer] Failed to fetch Personal folder:`, response.error);
                    throw new Error(`Failed to fetch Personal folder: ${response.error}`);
                }
                console.log(`[LibraryExplorer] Personal folder fetched, children count: ${response.data.children?.length || 0}`);

                const folder = response.data;
                console.log(`[LibraryExplorer] Personal folder actual ID: ${folder.id}`);

                // Cache the folder itself using BOTH the actual ID and the 'personal' alias
                const folderItem = {
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
                };

                db.upsertContentItem(folderItem);

                // Also cache with the 'personal' ID for tree lookup
                db.upsertContentItem({
                    ...folderItem,
                    id: 'personal'
                });

                // Cache children with 'personal' as parent ID so tree lookup works
                if (folder.children) {
                    console.log(`[LibraryExplorer] Caching ${folder.children.length} children for Personal folder with parent ID: personal`);
                    this.cacheChildren(folder.children, 'personal', profileName, db, now);
                }

                // Save JSON with both the actual ID and the alias ID
                await this.saveContentJSON(profileName, folder.id, folder);
                await this.saveContentJSON(profileName, 'personal', folder);
                console.log(`[LibraryExplorer] Personal folder cached successfully`);
                break;
            }

            case 'global': {
                console.log(`[LibraryExplorer] Fetching Global folder...`);
                const response = await client.exportGlobalFolder(false);
                if (response.error || !response.data) {
                    console.error(`[LibraryExplorer] Failed to export Global folder:`, response.error);
                    throw new Error(`Failed to export Global folder: ${response.error}`);
                }

                const exported = response.data;
                console.log(`[LibraryExplorer] Global folder fetched, data items: ${exported.data?.length || 0}`);

                // Ensure the exported object has itemType set
                if (!exported.itemType) {
                    exported.itemType = 'Folder';
                }

                this.cacheGlobalFolderFlat(exported, 'global', profileName, db, now);
                // Save with alias ID
                await this.saveContentJSON(profileName, 'global', exported);
                console.log(`[LibraryExplorer] Global folder cached successfully`);
                break;
            }

            case 'global_admin': {
                console.log(`[LibraryExplorer] Fetching Global folder (isAdminMode)...`);
                const response = await client.exportGlobalFolder(true);
                if (response.error || !response.data) {
                    console.error(`[LibraryExplorer] Failed to export Global folder (isAdminMode):`, response.error);
                    throw new Error(`Failed to export Global folder (isAdminMode): ${response.error}`);
                }

                const exported = response.data;
                console.log(`[LibraryExplorer] Global folder (isAdminMode) fetched, data items: ${exported.data?.length || 0}`);

                // Ensure the exported object has itemType set
                if (!exported.itemType) {
                    exported.itemType = 'Folder';
                }

                this.cacheGlobalFolderFlat(exported, 'global_admin', profileName, db, now);
                // Save with alias ID
                await this.saveContentJSON(profileName, 'global_admin', exported);
                console.log(`[LibraryExplorer] Global folder (isAdminMode) cached successfully`);
                break;
            }

            case 'adminRecommended': {
                console.log(`[LibraryExplorer] Fetching Admin Recommended folder...`);
                const response = await client.exportAdminRecommendedFolder();
                if (response.error || !response.data) {
                    console.error(`[LibraryExplorer] Failed to export Admin Recommended:`, response.error);
                    throw new Error(`Failed to export Admin Recommended: ${response.error}`);
                }

                const exported = response.data;
                console.log(`[LibraryExplorer] Admin Recommended fetched, children count: ${exported.children?.length || 0}`);

                // Ensure the exported object has itemType set
                if (!exported.itemType) {
                    exported.itemType = 'Folder';
                }

                this.cacheExportedContentWithAlias(exported, 'adminRecommended', profileName, db, now, 'children');
                // Save with alias ID
                await this.saveContentJSON(profileName, 'adminRecommended', exported);
                console.log(`[LibraryExplorer] Admin Recommended cached successfully`);
                break;
            }

            case 'installedApps': {
                console.log(`[LibraryExplorer] Fetching Installed Apps folder...`);
                const response = await client.exportInstalledAppsFolder();
                if (response.error || !response.data) {
                    console.error(`[LibraryExplorer] Failed to export Installed Apps:`, response.error);
                    throw new Error(`Failed to export Installed Apps: ${response.error}`);
                }

                const exported = response.data;
                console.log(`[LibraryExplorer] Installed Apps fetched, children count: ${exported.children?.length || 0}`);

                // Ensure the exported object has itemType set
                if (!exported.itemType) {
                    exported.itemType = 'Folder';
                }

                this.cacheExportedContentWithAlias(exported, 'installedApps', profileName, db, now, 'children');
                // Save with alias ID
                await this.saveContentJSON(profileName, 'installedApps', exported);
                console.log(`[LibraryExplorer] Installed Apps cached successfully`);
                break;
            }
        }
        console.log(`[LibraryExplorer] fetchTopLevelNode completed for: ${nodeId}`);
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
            name: child.name || child.id || 'Unnamed',
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
            name: exported.name || exported.id || 'Unnamed',
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
     * Cache exported content with an alias ID for special top-level nodes
     */
    private cacheExportedContentWithAlias(
        exported: any,
        aliasId: string,
        profileName: string,
        db: LibraryCacheDB,
        timestamp: string,
        childrenKey: 'data' | 'children'
    ): void {
        console.log(`[LibraryExplorer] cacheExportedContentWithAlias: aliasId=${aliasId}, actual ID=${exported.id}`);

        // Cache the node with the alias ID
        const folderItem = {
            id: aliasId,
            profile: profileName,
            name: exported.name || aliasId,
            itemType: exported.itemType || 'Folder',
            parentId: '0000000000000000',
            description: exported.description,
            createdAt: exported.createdAt,
            createdBy: exported.createdBy,
            modifiedAt: exported.modifiedAt,
            modifiedBy: exported.modifiedBy,
            hasChildren: exported[childrenKey] && exported[childrenKey].length > 0,
            childrenFetched: true,
            permissions: exported.permissions,
            lastFetched: timestamp
        };

        db.upsertContentItem(folderItem);

        // Also cache with the actual ID if different
        if (exported.id && exported.id !== aliasId) {
            db.upsertContentItem({
                ...folderItem,
                id: exported.id
            });
        }

        // Cache children with alias ID as parent
        const children = exported[childrenKey];
        if (children && Array.isArray(children)) {
            console.log(`[LibraryExplorer] Caching ${children.length} children with parent ID: ${aliasId}`);
            this.cacheChildren(children, aliasId, profileName, db, timestamp);
        }
    }

    /**
     * Cache Global folder flat export data
     * Global folder exports return a flat list of all items with their parentIds
     * We need to build a hierarchy by finding root items and their children
     */
    private cacheGlobalFolderFlat(
        exported: any,
        globalNodeId: string,
        profileName: string,
        db: LibraryCacheDB,
        timestamp: string
    ): void {
        if (!exported.data || !Array.isArray(exported.data)) {
            // No data - create empty Global node
            db.upsertContentItem({
                id: globalNodeId,
                profile: profileName,
                name: 'Global',
                itemType: 'Folder',
                parentId: '0000000000000000',
                description: 'Global folder',
                createdAt: timestamp,
                createdBy: '',
                modifiedAt: timestamp,
                modifiedBy: '',
                hasChildren: false,
                childrenFetched: true,
                permissions: [],
                lastFetched: timestamp
            });
            return;
        }

        const allItems = exported.data;
        const itemIds = new Set(allItems.map((item: any) => item.id));

        // Find root items - items whose parentId is NOT in the list
        // (meaning their parent is outside this export, so they're top-level in Global)
        const rootItems = allItems.filter((item: any) => !itemIds.has(item.parentId));

        // Create the Global root node
        db.upsertContentItem({
            id: globalNodeId,
            profile: profileName,
            name: 'Global',
            itemType: 'Folder',
            parentId: '0000000000000000',
            description: 'Global folder',
            createdAt: timestamp,
            createdBy: '',
            modifiedAt: timestamp,
            modifiedBy: '',
            hasChildren: rootItems.length > 0,
            childrenFetched: true,
            permissions: [],
            lastFetched: timestamp
        });

        // Cache all items with adjusted parentIds
        const items: ContentItem[] = allItems.map((item: any) => {
            // If this is a root item, set its parent to the Global node
            const parentId = itemIds.has(item.parentId) ? item.parentId : globalNodeId;

            return {
                id: item.id,
                profile: profileName,
                name: item.name || item.id || 'Unnamed',
                itemType: item.itemType,
                parentId: parentId,
                description: item.description,
                createdAt: item.createdAt,
                createdBy: item.createdBy,
                modifiedAt: item.modifiedAt,
                modifiedBy: item.modifiedBy,
                hasChildren: item.itemType === 'Folder',
                childrenFetched: false,
                permissions: item.permissions,
                lastFetched: timestamp
            };
        });

        db.upsertContentItems(items);
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

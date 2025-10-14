import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Content item structure for library cache
 */
export interface ContentItem {
    id: string;                  // Hex content ID
    profile: string;             // Profile name
    name: string;
    itemType: string;            // Folder, Dashboard, Search, etc.
    parentId: string;            // Parent content ID (0000000000000000 for root)
    description?: string;
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
    hasChildren: boolean;        // True if Folder or has children array
    childrenFetched: boolean;    // True if children have been loaded
    permissions?: string[];      // Array of permission strings
    lastFetched: string;         // ISO timestamp of last API fetch
}

/**
 * SQLite database for caching library content metadata
 */
export class LibraryCacheDB {
    private db: Database.Database;
    private profileName: string;

    /**
     * Create or open a library cache database for a profile
     * @param dbPath Full path to the SQLite database file
     * @param profileName Name of the profile this cache belongs to
     */
    constructor(dbPath: string, profileName: string) {
        // Ensure directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Open database with WAL mode for better concurrency
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.profileName = profileName;

        // Initialize schema
        this.initializeSchema();
    }

    /**
     * Initialize database schema
     */
    private initializeSchema(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS content_items (
                id TEXT PRIMARY KEY,
                profile TEXT NOT NULL,
                name TEXT NOT NULL,
                itemType TEXT NOT NULL,
                parentId TEXT,
                description TEXT,
                createdAt TEXT,
                createdBy TEXT,
                modifiedAt TEXT,
                modifiedBy TEXT,
                hasChildren INTEGER DEFAULT 0,
                childrenFetched INTEGER DEFAULT 0,
                permissions TEXT,
                lastFetched TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_profile_parent ON content_items(profile, parentId);
            CREATE INDEX IF NOT EXISTS idx_profile_type ON content_items(profile, itemType);
            CREATE INDEX IF NOT EXISTS idx_last_fetched ON content_items(lastFetched);
        `);
    }

    /**
     * Insert or update a content item in the cache
     */
    upsertContentItem(item: ContentItem): void {
        const stmt = this.db.prepare(`
            INSERT INTO content_items (
                id, profile, name, itemType, parentId, description,
                createdAt, createdBy, modifiedAt, modifiedBy,
                hasChildren, childrenFetched, permissions, lastFetched
            ) VALUES (
                @id, @profile, @name, @itemType, @parentId, @description,
                @createdAt, @createdBy, @modifiedAt, @modifiedBy,
                @hasChildren, @childrenFetched, @permissions, @lastFetched
            )
            ON CONFLICT(id) DO UPDATE SET
                profile = @profile,
                name = @name,
                itemType = @itemType,
                parentId = @parentId,
                description = @description,
                createdAt = @createdAt,
                createdBy = @createdBy,
                modifiedAt = @modifiedAt,
                modifiedBy = @modifiedBy,
                hasChildren = @hasChildren,
                childrenFetched = @childrenFetched,
                permissions = @permissions,
                lastFetched = @lastFetched
        `);

        stmt.run({
            id: item.id,
            profile: item.profile,
            name: item.name,
            itemType: item.itemType,
            parentId: item.parentId || null,
            description: item.description || null,
            createdAt: item.createdAt || null,
            createdBy: item.createdBy || null,
            modifiedAt: item.modifiedAt || null,
            modifiedBy: item.modifiedBy || null,
            hasChildren: item.hasChildren ? 1 : 0,
            childrenFetched: item.childrenFetched ? 1 : 0,
            permissions: item.permissions ? JSON.stringify(item.permissions) : null,
            lastFetched: item.lastFetched
        });
    }

    /**
     * Batch insert or update multiple content items
     */
    upsertContentItems(items: ContentItem[]): void {
        const upsert = this.db.transaction((itemsToInsert: ContentItem[]) => {
            for (const item of itemsToInsert) {
                this.upsertContentItem(item);
            }
        });

        upsert(items);
    }

    /**
     * Get a content item by ID
     */
    getContentItem(id: string): ContentItem | null {
        const stmt = this.db.prepare(`
            SELECT * FROM content_items
            WHERE id = ? AND profile = ?
        `);

        const row = stmt.get(id, this.profileName) as any;

        if (!row) {
            return null;
        }

        return this.rowToContentItem(row);
    }

    /**
     * Get all children of a parent content item
     */
    getChildren(parentId: string): ContentItem[] {
        const stmt = this.db.prepare(`
            SELECT * FROM content_items
            WHERE profile = ? AND parentId = ?
            ORDER BY
                CASE itemType
                    WHEN 'Folder' THEN 0
                    ELSE 1
                END,
                name ASC
        `);

        const rows = stmt.all(this.profileName, parentId) as any[];
        return rows.map(row => this.rowToContentItem(row));
    }

    /**
     * Get all top-level nodes (parentId = '0000000000000000')
     */
    getTopLevelNodes(): ContentItem[] {
        return this.getChildren('0000000000000000');
    }

    /**
     * Check if a node's children have been fetched
     */
    areChildrenFetched(id: string): boolean {
        const stmt = this.db.prepare(`
            SELECT childrenFetched FROM content_items
            WHERE id = ? AND profile = ?
        `);

        const row = stmt.get(id, this.profileName) as any;
        return row ? Boolean(row.childrenFetched) : false;
    }

    /**
     * Mark a node's children as fetched
     */
    markChildrenFetched(id: string, fetched: boolean = true): void {
        const stmt = this.db.prepare(`
            UPDATE content_items
            SET childrenFetched = ?, lastFetched = ?
            WHERE id = ? AND profile = ?
        `);

        stmt.run(fetched ? 1 : 0, new Date().toISOString(), id, this.profileName);
    }

    /**
     * Check if a node needs refresh based on age
     */
    needsRefresh(id: string, maxAgeMinutes: number = 30): boolean {
        const stmt = this.db.prepare(`
            SELECT lastFetched FROM content_items
            WHERE id = ? AND profile = ?
        `);

        const row = stmt.get(id, this.profileName) as any;

        if (!row || !row.lastFetched) {
            return true;
        }

        const lastFetched = new Date(row.lastFetched);
        const now = new Date();
        const ageMinutes = (now.getTime() - lastFetched.getTime()) / (1000 * 60);

        return ageMinutes > maxAgeMinutes;
    }

    /**
     * Get content path from root to item (breadcrumb)
     */
    getContentPath(id: string): ContentItem[] {
        const path: ContentItem[] = [];
        let currentId = id;

        while (currentId && currentId !== '0000000000000000') {
            const item = this.getContentItem(currentId);
            if (!item) {
                break;
            }
            path.unshift(item);
            currentId = item.parentId;
        }

        return path;
    }

    /**
     * Search content items by name
     */
    searchByName(searchTerm: string, limit: number = 50): ContentItem[] {
        const stmt = this.db.prepare(`
            SELECT * FROM content_items
            WHERE profile = ? AND name LIKE ?
            ORDER BY name ASC
            LIMIT ?
        `);

        const rows = stmt.all(this.profileName, `%${searchTerm}%`, limit) as any[];
        return rows.map(row => this.rowToContentItem(row));
    }

    /**
     * Get items by type
     */
    getItemsByType(itemType: string): ContentItem[] {
        const stmt = this.db.prepare(`
            SELECT * FROM content_items
            WHERE profile = ? AND itemType = ?
            ORDER BY name ASC
        `);

        const rows = stmt.all(this.profileName, itemType) as any[];
        return rows.map(row => this.rowToContentItem(row));
    }

    /**
     * Delete a content item and all its descendants
     */
    deleteContentItem(id: string): void {
        // Get all descendants recursively
        const descendants = this.getAllDescendants(id);
        const allIds = [id, ...descendants.map(d => d.id)];

        // Delete in a transaction
        const deleteMany = this.db.transaction((ids: string[]) => {
            const stmt = this.db.prepare(`
                DELETE FROM content_items
                WHERE id = ? AND profile = ?
            `);

            for (const itemId of ids) {
                stmt.run(itemId, this.profileName);
            }
        });

        deleteMany(allIds);
    }

    /**
     * Get all descendants of a content item recursively
     */
    private getAllDescendants(parentId: string): ContentItem[] {
        const descendants: ContentItem[] = [];
        const children = this.getChildren(parentId);

        for (const child of children) {
            descendants.push(child);
            const grandchildren = this.getAllDescendants(child.id);
            descendants.push(...grandchildren);
        }

        return descendants;
    }

    /**
     * Clear all cached content for this profile
     */
    clearCache(): void {
        const stmt = this.db.prepare(`
            DELETE FROM content_items WHERE profile = ?
        `);
        stmt.run(this.profileName);
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        totalItems: number;
        itemsByType: Record<string, number>;
        oldestItem: string | null;
        newestItem: string | null;
    } {
        const totalStmt = this.db.prepare(`
            SELECT COUNT(*) as count FROM content_items WHERE profile = ?
        `);
        const total = (totalStmt.get(this.profileName) as any).count;

        const typeStmt = this.db.prepare(`
            SELECT itemType, COUNT(*) as count
            FROM content_items
            WHERE profile = ?
            GROUP BY itemType
        `);
        const typeRows = typeStmt.all(this.profileName) as any[];
        const itemsByType: Record<string, number> = {};
        for (const row of typeRows) {
            itemsByType[row.itemType] = row.count;
        }

        const oldestStmt = this.db.prepare(`
            SELECT lastFetched FROM content_items
            WHERE profile = ?
            ORDER BY lastFetched ASC
            LIMIT 1
        `);
        const oldest = oldestStmt.get(this.profileName) as any;

        const newestStmt = this.db.prepare(`
            SELECT lastFetched FROM content_items
            WHERE profile = ?
            ORDER BY lastFetched DESC
            LIMIT 1
        `);
        const newest = newestStmt.get(this.profileName) as any;

        return {
            totalItems: total,
            itemsByType,
            oldestItem: oldest?.lastFetched || null,
            newestItem: newest?.lastFetched || null
        };
    }

    /**
     * Close the database connection
     */
    close(): void {
        this.db.close();
    }

    /**
     * Convert database row to ContentItem
     */
    private rowToContentItem(row: any): ContentItem {
        return {
            id: row.id,
            profile: row.profile,
            name: row.name,
            itemType: row.itemType,
            parentId: row.parentId,
            description: row.description,
            createdAt: row.createdAt,
            createdBy: row.createdBy,
            modifiedAt: row.modifiedAt,
            modifiedBy: row.modifiedBy,
            hasChildren: Boolean(row.hasChildren),
            childrenFetched: Boolean(row.childrenFetched),
            permissions: row.permissions ? JSON.parse(row.permissions) : undefined,
            lastFetched: row.lastFetched
        };
    }

    /**
     * Vacuum the database to reclaim space and optimize
     */
    vacuum(): void {
        this.db.exec('VACUUM');
    }
}

/**
 * Factory function to create a LibraryCacheDB for a profile
 */
export function createLibraryCacheDB(profileDirectory: string, profileName: string): LibraryCacheDB {
    const libraryDir = path.join(profileDirectory, 'library');
    if (!fs.existsSync(libraryDir)) {
        fs.mkdirSync(libraryDir, { recursive: true });
    }

    const dbPath = path.join(libraryDir, 'library_cache.db');
    return new LibraryCacheDB(dbPath, profileName);
}

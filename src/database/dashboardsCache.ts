import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Dashboard item structure for dashboards cache
 */
export interface DashboardItem {
    id: string;                  // Dashboard ID (e.g., B23OjNs5ZCyn5VdMwOBoLo3PjgRnJSAlNTKEDAcpuDG2CIgRe9KFXMofm2H2)
    profile: string;             // Profile name
    title: string;
    description?: string;
    folderId?: string;
    contentId?: string;          // Content ID (different from dashboard ID)
    lastFetched: string;         // ISO timestamp of last API fetch
}

/**
 * SQLite database for caching dashboards metadata
 */
export class DashboardsCacheDB {
    private db: Database.Database;
    private profileName: string;

    /**
     * Create or open a dashboards cache database for a profile
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
            CREATE TABLE IF NOT EXISTS dashboards (
                id TEXT PRIMARY KEY,
                profile TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                folderId TEXT,
                contentId TEXT,
                lastFetched TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_profile ON dashboards(profile);
            CREATE INDEX IF NOT EXISTS idx_title ON dashboards(title);
            CREATE INDEX IF NOT EXISTS idx_last_fetched ON dashboards(lastFetched);
        `);
    }

    /**
     * Insert or update a dashboard item in the cache
     */
    upsertDashboard(item: DashboardItem): void {
        const stmt = this.db.prepare(`
            INSERT INTO dashboards (
                id, profile, title, description, folderId, contentId, lastFetched
            ) VALUES (
                @id, @profile, @title, @description, @folderId, @contentId, @lastFetched
            )
            ON CONFLICT(id) DO UPDATE SET
                profile = @profile,
                title = @title,
                description = @description,
                folderId = @folderId,
                contentId = @contentId,
                lastFetched = @lastFetched
        `);

        stmt.run({
            id: item.id,
            profile: item.profile,
            title: item.title,
            description: item.description || null,
            folderId: item.folderId || null,
            contentId: item.contentId || null,
            lastFetched: item.lastFetched
        });
    }

    /**
     * Batch insert or update multiple dashboard items
     */
    upsertDashboards(items: DashboardItem[]): void {
        const upsert = this.db.transaction((itemsToInsert: DashboardItem[]) => {
            for (const item of itemsToInsert) {
                this.upsertDashboard(item);
            }
        });

        upsert(items);
    }

    /**
     * Get a dashboard item by ID
     */
    getDashboard(id: string): DashboardItem | null {
        const stmt = this.db.prepare(`
            SELECT * FROM dashboards
            WHERE id = ? AND profile = ?
        `);

        const row = stmt.get(id, this.profileName) as any;

        if (!row) {
            return null;
        }

        return this.rowToDashboardItem(row);
    }

    /**
     * Get all dashboards for this profile
     */
    getAllDashboards(): DashboardItem[] {
        const stmt = this.db.prepare(`
            SELECT * FROM dashboards
            WHERE profile = ?
            ORDER BY title ASC
        `);

        const rows = stmt.all(this.profileName) as any[];
        return rows.map(row => this.rowToDashboardItem(row));
    }

    /**
     * Search dashboards by title or description
     */
    searchDashboards(searchTerm: string, limit: number = 50): DashboardItem[] {
        const stmt = this.db.prepare(`
            SELECT * FROM dashboards
            WHERE profile = ? AND (title LIKE ? OR description LIKE ?)
            ORDER BY title ASC
            LIMIT ?
        `);

        const rows = stmt.all(this.profileName, `%${searchTerm}%`, `%${searchTerm}%`, limit) as any[];
        return rows.map(row => this.rowToDashboardItem(row));
    }

    /**
     * Delete a dashboard item
     */
    deleteDashboard(id: string): void {
        const stmt = this.db.prepare(`
            DELETE FROM dashboards
            WHERE id = ? AND profile = ?
        `);
        stmt.run(id, this.profileName);
    }

    /**
     * Clear all cached dashboards for this profile
     */
    clearCache(): void {
        const stmt = this.db.prepare(`
            DELETE FROM dashboards WHERE profile = ?
        `);
        stmt.run(this.profileName);
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        totalDashboards: number;
        oldestItem: string | null;
        newestItem: string | null;
    } {
        const totalStmt = this.db.prepare(`
            SELECT COUNT(*) as count FROM dashboards WHERE profile = ?
        `);
        const total = (totalStmt.get(this.profileName) as any).count;

        const oldestStmt = this.db.prepare(`
            SELECT lastFetched FROM dashboards
            WHERE profile = ?
            ORDER BY lastFetched ASC
            LIMIT 1
        `);
        const oldest = oldestStmt.get(this.profileName) as any;

        const newestStmt = this.db.prepare(`
            SELECT lastFetched FROM dashboards
            WHERE profile = ?
            ORDER BY lastFetched DESC
            LIMIT 1
        `);
        const newest = newestStmt.get(this.profileName) as any;

        return {
            totalDashboards: total,
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
     * Convert database row to DashboardItem
     */
    private rowToDashboardItem(row: any): DashboardItem {
        return {
            id: row.id,
            profile: row.profile,
            title: row.title,
            description: row.description,
            folderId: row.folderId,
            contentId: row.contentId,
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
 * Factory function to create a DashboardsCacheDB for a profile
 */
export function createDashboardsCacheDB(profileDirectory: string, profileName: string): DashboardsCacheDB {
    const dashboardsDir = path.join(profileDirectory, 'dashboards');
    if (!fs.existsSync(dashboardsDir)) {
        fs.mkdirSync(dashboardsDir, { recursive: true });
    }

    const dbPath = path.join(dashboardsDir, 'dashboards_cache.db');
    return new DashboardsCacheDB(dbPath, profileName);
}

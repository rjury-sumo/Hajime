import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Scope definition for log analysis
 */
export interface Scope {
    id: string;                    // UUID for the scope
    profile: string;               // Profile name this scope belongs to
    name: string;                  // Display name
    description?: string;          // User description
    searchScope: string;           // Query scope (e.g., "_sourceCategory=prod/app")
    context?: string;              // AI context and use cases
    queryFrom?: string;            // Default 'from' time for queries (e.g., "-3h", "-1d")
    createdAt: string;             // ISO timestamp
    modifiedAt: string;            // ISO timestamp

    // Action results (stored as file paths)
    facetsResultPath?: string;     // Path to facets result JSON file
    facetsTimestamp?: string;      // When facets was last run
    sampleLogsResultPath?: string; // Path to sample logs result JSON file
    sampleLogsTimestamp?: string;  // When sample logs was last run
    metadataResultPath?: string;   // Path to metadata result JSON file
    metadataTimestamp?: string;    // When metadata was last cached
}

/**
 * SQLite database for managing Scopes per profile
 */
export class ScopesCacheDB {
    private db: Database.Database;
    private profileName: string;

    /**
     * Create or open a scopes database for a profile
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
            CREATE TABLE IF NOT EXISTS scopes (
                id TEXT PRIMARY KEY,
                profile TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                searchScope TEXT NOT NULL,
                context TEXT,
                queryFrom TEXT DEFAULT '-3h',
                createdAt TEXT NOT NULL,
                modifiedAt TEXT NOT NULL,
                facetsResultPath TEXT,
                facetsTimestamp TEXT,
                sampleLogsResultPath TEXT,
                sampleLogsTimestamp TEXT,
                metadataResultPath TEXT,
                metadataTimestamp TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_profile ON scopes(profile);
            CREATE INDEX IF NOT EXISTS idx_name ON scopes(profile, name);
        `);

        // Migration: Add metadataResult and metadataTimestamp columns if they don't exist
        this.migrateSchema();
    }

    /**
     * Migrate schema to add missing columns
     */
    private migrateSchema(): void {
        // Check if columns exist
        const tableInfo = this.db.pragma('table_info(scopes)') as Array<{ name: string }>;
        const columns = tableInfo.map((col) => col.name);

        // Legacy columns for backward compatibility
        if (!columns.includes('metadataResult')) {
            this.db.exec('ALTER TABLE scopes ADD COLUMN metadataResult TEXT');
        }

        if (!columns.includes('metadataTimestamp')) {
            this.db.exec('ALTER TABLE scopes ADD COLUMN metadataTimestamp TEXT');
        }

        if (!columns.includes('queryFrom')) {
            this.db.exec("ALTER TABLE scopes ADD COLUMN queryFrom TEXT DEFAULT '-3h'");
        }

        // New path-based columns
        if (!columns.includes('facetsResultPath')) {
            this.db.exec('ALTER TABLE scopes ADD COLUMN facetsResultPath TEXT');
        }

        if (!columns.includes('sampleLogsResultPath')) {
            this.db.exec('ALTER TABLE scopes ADD COLUMN sampleLogsResultPath TEXT');
        }

        if (!columns.includes('metadataResultPath')) {
            this.db.exec('ALTER TABLE scopes ADD COLUMN metadataResultPath TEXT');
        }
    }

    /**
     * Create a new scope
     */
    createScope(scope: Omit<Scope, 'id' | 'createdAt' | 'modifiedAt'>): Scope {
        const now = new Date().toISOString();
        const id = this.generateId();

        const newScope: Scope = {
            id,
            profile: scope.profile,
            name: scope.name,
            description: scope.description,
            searchScope: scope.searchScope,
            context: scope.context,
            queryFrom: scope.queryFrom || '-3h',
            createdAt: now,
            modifiedAt: now,
            facetsResultPath: scope.facetsResultPath,
            facetsTimestamp: scope.facetsTimestamp,
            sampleLogsResultPath: scope.sampleLogsResultPath,
            sampleLogsTimestamp: scope.sampleLogsTimestamp,
            metadataResultPath: scope.metadataResultPath,
            metadataTimestamp: scope.metadataTimestamp
        };

        const stmt = this.db.prepare(`
            INSERT INTO scopes (
                id, profile, name, description, searchScope, context, queryFrom,
                createdAt, modifiedAt, facetsResultPath, facetsTimestamp,
                sampleLogsResultPath, sampleLogsTimestamp, metadataResultPath, metadataTimestamp
            ) VALUES (
                @id, @profile, @name, @description, @searchScope, @context, @queryFrom,
                @createdAt, @modifiedAt, @facetsResultPath, @facetsTimestamp,
                @sampleLogsResultPath, @sampleLogsTimestamp, @metadataResultPath, @metadataTimestamp
            )
        `);

        stmt.run(newScope);
        return newScope;
    }

    /**
     * Update an existing scope
     */
    updateScope(id: string, updates: Partial<Omit<Scope, 'id' | 'profile' | 'createdAt'>>): boolean {
        const now = new Date().toISOString();
        const scope = this.getScopeById(id);

        if (!scope) {
            return false;
        }

        const updated: Scope = {
            ...scope,
            ...updates,
            modifiedAt: now
        };

        const stmt = this.db.prepare(`
            UPDATE scopes SET
                name = @name,
                description = @description,
                searchScope = @searchScope,
                context = @context,
                queryFrom = @queryFrom,
                modifiedAt = @modifiedAt,
                facetsResultPath = @facetsResultPath,
                facetsTimestamp = @facetsTimestamp,
                sampleLogsResultPath = @sampleLogsResultPath,
                sampleLogsTimestamp = @sampleLogsTimestamp,
                metadataResultPath = @metadataResultPath,
                metadataTimestamp = @metadataTimestamp
            WHERE id = @id
        `);

        const result = stmt.run(updated);
        return result.changes > 0;
    }

    /**
     * Delete a scope by ID
     */
    deleteScope(id: string): boolean {
        const stmt = this.db.prepare('DELETE FROM scopes WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    /**
     * Get a scope by ID
     */
    getScopeById(id: string): Scope | undefined {
        const stmt = this.db.prepare('SELECT * FROM scopes WHERE id = ?');
        return stmt.get(id) as Scope | undefined;
    }

    /**
     * Get all scopes for the current profile
     */
    getAllScopes(): Scope[] {
        const stmt = this.db.prepare('SELECT * FROM scopes WHERE profile = ? ORDER BY name ASC');
        return stmt.all(this.profileName) as Scope[];
    }

    /**
     * Get scope by name
     */
    getScopeByName(name: string): Scope | undefined {
        const stmt = this.db.prepare('SELECT * FROM scopes WHERE profile = ? AND name = ?');
        return stmt.get(this.profileName, name) as Scope | undefined;
    }

    /**
     * Generate a unique ID for a scope
     */
    private generateId(): string {
        return `scope_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Close the database connection
     */
    close(): void {
        this.db.close();
    }
}

/**
 * Factory function to create a ScopesCacheDB instance
 */
export function createScopesCacheDB(profileDir: string, profileName: string): ScopesCacheDB {
    const metadataDir = path.join(profileDir, 'metadata');
    if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true });
    }

    const dbPath = path.join(metadataDir, 'scopes.db');
    return new ScopesCacheDB(dbPath, profileName);
}

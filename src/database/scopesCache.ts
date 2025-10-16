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
    createdAt: string;             // ISO timestamp
    modifiedAt: string;            // ISO timestamp

    // Action results (stored as JSON)
    facetsResult?: string;         // JSON from "Profile Scope" action
    facetsTimestamp?: string;      // When facets was last run
    sampleLogsResult?: string;     // JSON from "Sample Logs" action
    sampleLogsTimestamp?: string;  // When sample logs was last run
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
                createdAt TEXT NOT NULL,
                modifiedAt TEXT NOT NULL,
                facetsResult TEXT,
                facetsTimestamp TEXT,
                sampleLogsResult TEXT,
                sampleLogsTimestamp TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_profile ON scopes(profile);
            CREATE INDEX IF NOT EXISTS idx_name ON scopes(profile, name);
        `);
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
            createdAt: now,
            modifiedAt: now,
            facetsResult: scope.facetsResult,
            facetsTimestamp: scope.facetsTimestamp,
            sampleLogsResult: scope.sampleLogsResult,
            sampleLogsTimestamp: scope.sampleLogsTimestamp
        };

        const stmt = this.db.prepare(`
            INSERT INTO scopes (
                id, profile, name, description, searchScope, context,
                createdAt, modifiedAt, facetsResult, facetsTimestamp,
                sampleLogsResult, sampleLogsTimestamp
            ) VALUES (
                @id, @profile, @name, @description, @searchScope, @context,
                @createdAt, @modifiedAt, @facetsResult, @facetsTimestamp,
                @sampleLogsResult, @sampleLogsTimestamp
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
                modifiedAt = @modifiedAt,
                facetsResult = @facetsResult,
                facetsTimestamp = @facetsTimestamp,
                sampleLogsResult = @sampleLogsResult,
                sampleLogsTimestamp = @sampleLogsTimestamp
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

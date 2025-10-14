import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

/**
 * User structure
 */
export interface User {
    id: string;                  // User ID (primary key)
    profile: string;             // Profile name
    firstName: string;
    lastName: string;
    email: string;
    roleIds: string[];           // Array of role IDs
    isActive: boolean;
    isLockedOut: boolean;
    isMfaEnabled: boolean;
    lastModified?: string;
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
    lastFetched: string;         // ISO timestamp of last API fetch
}

/**
 * Role structure
 */
export interface Role {
    id: string;                  // Role ID (primary key)
    profile: string;             // Profile name
    name: string;
    description?: string;
    filterPredicate?: string;
    users: string[];             // Array of user IDs
    capabilities: string[];      // Array of capability strings
    autofillDependencies: boolean;
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
    lastFetched: string;         // ISO timestamp of last API fetch
}

/**
 * SQLite database for caching users and roles
 */
export class UsersRolesDB {
    private db: Database.Database;
    private profileName: string;

    /**
     * Create or open a users/roles database for a profile
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
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                profile TEXT NOT NULL,
                firstName TEXT NOT NULL,
                lastName TEXT NOT NULL,
                email TEXT NOT NULL,
                roleIds TEXT,
                isActive INTEGER DEFAULT 1,
                isLockedOut INTEGER DEFAULT 0,
                isMfaEnabled INTEGER DEFAULT 0,
                lastModified TEXT,
                createdAt TEXT,
                createdBy TEXT,
                modifiedAt TEXT,
                modifiedBy TEXT,
                lastFetched TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS roles (
                id TEXT PRIMARY KEY,
                profile TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                filterPredicate TEXT,
                users TEXT,
                capabilities TEXT,
                autofillDependencies INTEGER DEFAULT 0,
                createdAt TEXT,
                createdBy TEXT,
                modifiedAt TEXT,
                modifiedBy TEXT,
                lastFetched TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_users_profile ON users(profile);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(profile, email);
            CREATE INDEX IF NOT EXISTS idx_roles_profile ON roles(profile);
            CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(profile, name);
        `);
    }

    /**
     * Insert or update a user in the cache
     */
    upsertUser(user: User): void {
        const stmt = this.db.prepare(`
            INSERT INTO users (
                id, profile, firstName, lastName, email, roleIds,
                isActive, isLockedOut, isMfaEnabled, lastModified,
                createdAt, createdBy, modifiedAt, modifiedBy, lastFetched
            ) VALUES (
                @id, @profile, @firstName, @lastName, @email, @roleIds,
                @isActive, @isLockedOut, @isMfaEnabled, @lastModified,
                @createdAt, @createdBy, @modifiedAt, @modifiedBy, @lastFetched
            )
            ON CONFLICT(id) DO UPDATE SET
                profile = @profile,
                firstName = @firstName,
                lastName = @lastName,
                email = @email,
                roleIds = @roleIds,
                isActive = @isActive,
                isLockedOut = @isLockedOut,
                isMfaEnabled = @isMfaEnabled,
                lastModified = @lastModified,
                createdAt = @createdAt,
                createdBy = @createdBy,
                modifiedAt = @modifiedAt,
                modifiedBy = @modifiedBy,
                lastFetched = @lastFetched
        `);

        stmt.run({
            id: user.id,
            profile: user.profile,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            roleIds: JSON.stringify(user.roleIds),
            isActive: user.isActive ? 1 : 0,
            isLockedOut: user.isLockedOut ? 1 : 0,
            isMfaEnabled: user.isMfaEnabled ? 1 : 0,
            lastModified: user.lastModified || null,
            createdAt: user.createdAt || null,
            createdBy: user.createdBy || null,
            modifiedAt: user.modifiedAt || null,
            modifiedBy: user.modifiedBy || null,
            lastFetched: user.lastFetched
        });
    }

    /**
     * Batch insert or update multiple users
     */
    upsertUsers(users: User[]): void {
        const upsert = this.db.transaction((usersToInsert: User[]) => {
            for (const user of usersToInsert) {
                this.upsertUser(user);
            }
        });

        upsert(users);
    }

    /**
     * Get a user by ID
     */
    getUser(id: string): User | null {
        const stmt = this.db.prepare(`
            SELECT * FROM users
            WHERE id = ? AND profile = ?
        `);

        const row = stmt.get(id, this.profileName) as any;

        if (!row) {
            return null;
        }

        return this.rowToUser(row);
    }

    /**
     * Get all users for the profile
     */
    getAllUsers(): User[] {
        const stmt = this.db.prepare(`
            SELECT * FROM users
            WHERE profile = ?
            ORDER BY lastName ASC, firstName ASC
        `);

        const rows = stmt.all(this.profileName) as any[];
        return rows.map(row => this.rowToUser(row));
    }

    /**
     * Search users by name or email
     */
    searchUsers(searchTerm: string): User[] {
        const stmt = this.db.prepare(`
            SELECT * FROM users
            WHERE profile = ? AND (
                firstName LIKE ? OR
                lastName LIKE ? OR
                email LIKE ?
            )
            ORDER BY lastName ASC, firstName ASC
        `);

        const term = `%${searchTerm}%`;
        const rows = stmt.all(this.profileName, term, term, term) as any[];
        return rows.map(row => this.rowToUser(row));
    }

    /**
     * Insert or update a role in the cache
     */
    upsertRole(role: Role): void {
        const stmt = this.db.prepare(`
            INSERT INTO roles (
                id, profile, name, description, filterPredicate, users,
                capabilities, autofillDependencies,
                createdAt, createdBy, modifiedAt, modifiedBy, lastFetched
            ) VALUES (
                @id, @profile, @name, @description, @filterPredicate, @users,
                @capabilities, @autofillDependencies,
                @createdAt, @createdBy, @modifiedAt, @modifiedBy, @lastFetched
            )
            ON CONFLICT(id) DO UPDATE SET
                profile = @profile,
                name = @name,
                description = @description,
                filterPredicate = @filterPredicate,
                users = @users,
                capabilities = @capabilities,
                autofillDependencies = @autofillDependencies,
                createdAt = @createdAt,
                createdBy = @createdBy,
                modifiedAt = @modifiedAt,
                modifiedBy = @modifiedBy,
                lastFetched = @lastFetched
        `);

        stmt.run({
            id: role.id,
            profile: role.profile,
            name: role.name,
            description: role.description || null,
            filterPredicate: role.filterPredicate || null,
            users: JSON.stringify(role.users),
            capabilities: JSON.stringify(role.capabilities),
            autofillDependencies: role.autofillDependencies ? 1 : 0,
            createdAt: role.createdAt || null,
            createdBy: role.createdBy || null,
            modifiedAt: role.modifiedAt || null,
            modifiedBy: role.modifiedBy || null,
            lastFetched: role.lastFetched
        });
    }

    /**
     * Batch insert or update multiple roles
     */
    upsertRoles(roles: Role[]): void {
        const upsert = this.db.transaction((rolesToInsert: Role[]) => {
            for (const role of rolesToInsert) {
                this.upsertRole(role);
            }
        });

        upsert(roles);
    }

    /**
     * Get a role by ID
     */
    getRole(id: string): Role | null {
        const stmt = this.db.prepare(`
            SELECT * FROM roles
            WHERE id = ? AND profile = ?
        `);

        const row = stmt.get(id, this.profileName) as any;

        if (!row) {
            return null;
        }

        return this.rowToRole(row);
    }

    /**
     * Get all roles for the profile
     */
    getAllRoles(): Role[] {
        const stmt = this.db.prepare(`
            SELECT * FROM roles
            WHERE profile = ?
            ORDER BY name ASC
        `);

        const rows = stmt.all(this.profileName) as any[];
        return rows.map(row => this.rowToRole(row));
    }

    /**
     * Search roles by name or description
     */
    searchRoles(searchTerm: string): Role[] {
        const stmt = this.db.prepare(`
            SELECT * FROM roles
            WHERE profile = ? AND (
                name LIKE ? OR
                description LIKE ?
            )
            ORDER BY name ASC
        `);

        const term = `%${searchTerm}%`;
        const rows = stmt.all(this.profileName, term, term) as any[];
        return rows.map(row => this.rowToRole(row));
    }

    /**
     * Get role name by ID (for enrichment purposes)
     */
    getRoleName(roleId: string): string | null {
        const stmt = this.db.prepare(`
            SELECT name FROM roles
            WHERE id = ? AND profile = ?
        `);

        const row = stmt.get(roleId, this.profileName) as any;
        return row ? row.name : null;
    }

    /**
     * Get user name by ID (for enrichment purposes)
     */
    getUserName(userId: string): string | null {
        const stmt = this.db.prepare(`
            SELECT firstName, lastName FROM users
            WHERE id = ? AND profile = ?
        `);

        const row = stmt.get(userId, this.profileName) as any;
        return row ? `${row.firstName} ${row.lastName}` : null;
    }

    /**
     * Get user email by ID (for enrichment purposes)
     */
    getUserEmail(userId: string): string | null {
        const stmt = this.db.prepare(`
            SELECT email FROM users
            WHERE id = ? AND profile = ?
        `);

        const row = stmt.get(userId, this.profileName) as any;
        return row ? row.email : null;
    }

    /**
     * Clear all cached users for this profile
     */
    clearUsers(): void {
        const stmt = this.db.prepare(`
            DELETE FROM users WHERE profile = ?
        `);
        stmt.run(this.profileName);
    }

    /**
     * Clear all cached roles for this profile
     */
    clearRoles(): void {
        const stmt = this.db.prepare(`
            DELETE FROM roles WHERE profile = ?
        `);
        stmt.run(this.profileName);
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        totalUsers: number;
        activeUsers: number;
        totalRoles: number;
    } {
        const usersStmt = this.db.prepare(`
            SELECT COUNT(*) as count FROM users WHERE profile = ?
        `);
        const totalUsers = (usersStmt.get(this.profileName) as any).count;

        const activeUsersStmt = this.db.prepare(`
            SELECT COUNT(*) as count FROM users WHERE profile = ? AND isActive = 1
        `);
        const activeUsers = (activeUsersStmt.get(this.profileName) as any).count;

        const rolesStmt = this.db.prepare(`
            SELECT COUNT(*) as count FROM roles WHERE profile = ?
        `);
        const totalRoles = (rolesStmt.get(this.profileName) as any).count;

        return {
            totalUsers,
            activeUsers,
            totalRoles
        };
    }

    /**
     * Close the database connection
     */
    close(): void {
        this.db.close();
    }

    /**
     * Convert database row to User
     */
    private rowToUser(row: any): User {
        return {
            id: row.id,
            profile: row.profile,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            roleIds: row.roleIds ? JSON.parse(row.roleIds) : [],
            isActive: Boolean(row.isActive),
            isLockedOut: Boolean(row.isLockedOut),
            isMfaEnabled: Boolean(row.isMfaEnabled),
            lastModified: row.lastModified,
            createdAt: row.createdAt,
            createdBy: row.createdBy,
            modifiedAt: row.modifiedAt,
            modifiedBy: row.modifiedBy,
            lastFetched: row.lastFetched
        };
    }

    /**
     * Convert database row to Role
     */
    private rowToRole(row: any): Role {
        return {
            id: row.id,
            profile: row.profile,
            name: row.name,
            description: row.description,
            filterPredicate: row.filterPredicate,
            users: row.users ? JSON.parse(row.users) : [],
            capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
            autofillDependencies: Boolean(row.autofillDependencies),
            createdAt: row.createdAt,
            createdBy: row.createdBy,
            modifiedAt: row.modifiedAt,
            modifiedBy: row.modifiedBy,
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
 * Factory function to create a UsersRolesDB for a profile
 */
export function createUsersRolesDB(profileDirectory: string, profileName: string): UsersRolesDB {
    const metadataDir = path.join(profileDirectory, 'metadata');
    if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true });
    }

    const dbPath = path.join(metadataDir, 'users_roles.db');
    return new UsersRolesDB(dbPath, profileName);
}

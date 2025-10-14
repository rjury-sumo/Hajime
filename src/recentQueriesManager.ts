import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Recent query entry
 */
export interface RecentQuery {
    filePath: string;
    fileName: string;
    name?: string;  // From @name directive
    lastOpened: string;  // ISO timestamp
    profile?: string;
    queryPreview?: string;  // First line of query
}

/**
 * Manager for tracking recently opened .sumo query files
 */
export class RecentQueriesManager {
    private static readonly MAX_RECENT_QUERIES = 20;
    private recentQueriesFile: string;
    private queries: RecentQuery[] = [];

    constructor(private context: vscode.ExtensionContext) {
        const storagePath = context.globalStorageUri.fsPath;
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }
        this.recentQueriesFile = path.join(storagePath, 'recentQueries.json');
        this.loadQueries();
    }

    /**
     * Load recent queries from storage
     */
    private loadQueries(): void {
        try {
            if (fs.existsSync(this.recentQueriesFile)) {
                const data = fs.readFileSync(this.recentQueriesFile, 'utf-8');
                this.queries = JSON.parse(data);
                // Filter out queries for files that no longer exist
                this.queries = this.queries.filter(q => fs.existsSync(q.filePath));
            }
        } catch (error) {
            console.error('Failed to load recent queries:', error);
            this.queries = [];
        }
    }

    /**
     * Save recent queries to storage
     */
    private saveQueries(): void {
        try {
            fs.writeFileSync(
                this.recentQueriesFile,
                JSON.stringify(this.queries, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('Failed to save recent queries:', error);
        }
    }

    /**
     * Parse query metadata from query text
     */
    private parseQueryMetadata(queryText: string): { name?: string; queryPreview?: string } {
        const lines = queryText.split('\n');
        let name: string | undefined;
        let queryPreview: string | undefined;

        // Look for @name directive
        for (const line of lines) {
            const trimmed = line.trim();
            const nameMatch = trimmed.match(/^\/\/\s*@name\s+(.+)$/i);
            if (nameMatch) {
                name = nameMatch[1].trim();
                break;
            }
        }

        // Get first non-comment, non-empty line as preview
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('//')) {
                queryPreview = trimmed.substring(0, 100);  // Limit to 100 chars
                break;
            }
        }

        return { name, queryPreview };
    }

    /**
     * Add a query to recent queries
     */
    public addQuery(filePath: string, profileName?: string): void {
        // Normalize path
        filePath = path.normalize(filePath);

        // Remove existing entry if present
        this.queries = this.queries.filter(q => q.filePath !== filePath);

        try {
            // Read file to get metadata
            const queryText = fs.readFileSync(filePath, 'utf-8');
            const { name, queryPreview } = this.parseQueryMetadata(queryText);

            // Create new entry
            const entry: RecentQuery = {
                filePath,
                fileName: path.basename(filePath),
                name,
                lastOpened: new Date().toISOString(),
                profile: profileName,
                queryPreview
            };

            // Add to front of list
            this.queries.unshift(entry);

            // Keep only max recent queries
            if (this.queries.length > RecentQueriesManager.MAX_RECENT_QUERIES) {
                this.queries = this.queries.slice(0, RecentQueriesManager.MAX_RECENT_QUERIES);
            }

            // Save to disk
            this.saveQueries();
        } catch (error) {
            console.error('Failed to add recent query:', error);
        }
    }

    /**
     * Get all recent queries
     */
    public getQueries(limit?: number): RecentQuery[] {
        const queries = this.queries.filter(q => fs.existsSync(q.filePath));
        return limit ? queries.slice(0, limit) : queries;
    }

    /**
     * Get recent queries for a specific profile
     */
    public getQueriesByProfile(profileName: string, limit?: number): RecentQuery[] {
        const queries = this.queries.filter(q =>
            q.profile === profileName && fs.existsSync(q.filePath)
        );
        return limit ? queries.slice(0, limit) : queries;
    }

    /**
     * Clear all recent queries
     */
    public clearQueries(): void {
        this.queries = [];
        this.saveQueries();
    }

    /**
     * Remove a specific query
     */
    public removeQuery(filePath: string): void {
        filePath = path.normalize(filePath);
        this.queries = this.queries.filter(q => q.filePath !== filePath);
        this.saveQueries();
    }
}

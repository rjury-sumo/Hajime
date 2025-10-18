import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Recent result entry
 */
export interface RecentResult {
    filePath: string;
    fileName: string;
    queryName?: string;  // From @name directive or query identifier
    lastOpened: string;  // ISO timestamp
    format?: string;  // json, csv, table
    resultPreview?: string;  // Preview of first result
}

/**
 * Manager for tracking recently generated query result files
 */
export class RecentResultsManager {
    private static readonly MAX_RECENT_RESULTS = 20;
    private recentResultsFile: string;
    private results: RecentResult[] = [];

    constructor(private context: vscode.ExtensionContext) {
        const storagePath = context.globalStorageUri.fsPath;
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }
        this.recentResultsFile = path.join(storagePath, 'recentResults.json');
        this.loadResults();
    }

    /**
     * Load recent results from storage
     */
    private loadResults(): void {
        try {
            if (fs.existsSync(this.recentResultsFile)) {
                const data = fs.readFileSync(this.recentResultsFile, 'utf-8');
                this.results = JSON.parse(data);
                // Filter out results for files that no longer exist
                this.results = this.results.filter(r => fs.existsSync(r.filePath));
            }
        } catch (error) {
            console.error('Failed to load recent results:', error);
            this.results = [];
        }
    }

    /**
     * Save recent results to storage
     */
    private saveResults(): void {
        try {
            fs.writeFileSync(
                this.recentResultsFile,
                JSON.stringify(this.results, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('Failed to save recent results:', error);
        }
    }

    /**
     * Parse result metadata from JSON result file
     */
    private parseResultMetadata(filePath: string): { queryName?: string; resultPreview?: string; format?: string } {
        let queryName: string | undefined;
        let resultPreview: string | undefined;
        let format: string | undefined;

        const ext = path.extname(filePath).toLowerCase();

        // Determine format from extension
        if (ext === '.json') {
            format = 'json';
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);

                // Try to extract query name from filename pattern
                const basename = path.basename(filePath, '.json');
                const match = basename.match(/^query_(.+?)_(-?\d+[smhd]|[^_]+)_to_/);
                if (match) {
                    queryName = match[1].replace(/_/g, ' ');
                }

                // Get preview from first result
                if (data.results && Array.isArray(data.results) && data.results.length > 0) {
                    const firstResult = data.results[0];
                    if (typeof firstResult === 'object') {
                        const keys = Object.keys(firstResult);
                        if (keys.length > 0) {
                            resultPreview = `${data.results.length} results`;
                        }
                    }
                }
            } catch (error) {
                // If JSON parsing fails, just skip metadata
            }
        } else if (ext === '.csv') {
            format = 'csv';
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split('\n').filter(l => l.trim());
                resultPreview = `${Math.max(0, lines.length - 1)} rows`;
            } catch (error) {
                // Skip
            }
        } else if (ext === '.txt') {
            format = 'table';
        }

        return { queryName, resultPreview, format };
    }

    /**
     * Add a result file to recent results
     */
    public addResult(filePath: string): void {
        // Normalize path
        filePath = path.normalize(filePath);

        // Remove existing entry if present
        this.results = this.results.filter(r => r.filePath !== filePath);

        try {
            // Get metadata
            const { queryName, resultPreview, format } = this.parseResultMetadata(filePath);

            // Create new entry
            const entry: RecentResult = {
                filePath,
                fileName: path.basename(filePath),
                queryName,
                lastOpened: new Date().toISOString(),
                format,
                resultPreview
            };

            // Add to front of list
            this.results.unshift(entry);

            // Keep only max recent results
            if (this.results.length > RecentResultsManager.MAX_RECENT_RESULTS) {
                this.results = this.results.slice(0, RecentResultsManager.MAX_RECENT_RESULTS);
            }

            // Save to disk
            this.saveResults();
        } catch (error) {
            console.error('Failed to add recent result:', error);
        }
    }

    /**
     * Get all recent results
     */
    public getResults(limit?: number): RecentResult[] {
        const results = this.results.filter(r => fs.existsSync(r.filePath));
        return limit ? results.slice(0, limit) : results;
    }


    /**
     * Clear all recent results
     */
    public clearResults(): void {
        this.results = [];
        this.saveResults();
    }

    /**
     * Remove a specific result
     */
    public removeResult(filePath: string): void {
        filePath = path.normalize(filePath);
        this.results = this.results.filter(r => r.filePath !== filePath);
        this.saveResults();
    }
}

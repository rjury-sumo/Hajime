import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Metadata field autocomplete data
 */
interface MetadataFieldCache {
    _sourceCategory: string[];
    _collector: string[];
    _source: string[];
    _sourceHost: string[];
    _sourceName: string[];
    _index: string[];
}

/**
 * Provides context-aware autocomplete for metadata fields
 * Values are populated from cached metadata query results
 */
export class MetadataCompletionProvider {
    private cache: MetadataFieldCache = {
        _sourceCategory: [],
        _collector: [],
        _source: [],
        _sourceHost: [],
        _sourceName: [],
        _index: []
    };

    private metadataDir: string | null = null;
    private currentProfile: string | null = null;

    constructor() {}

    /**
     * Load metadata cache for a specific profile
     */
    async loadMetadataCache(metadataDir: string, profileName: string): Promise<void> {
        this.metadataDir = metadataDir;
        this.currentProfile = profileName;

        // Load each field's cache file
        for (const field of Object.keys(this.cache) as Array<keyof MetadataFieldCache>) {
            const cacheFile = path.join(metadataDir, `${field}.json`);
            if (fs.existsSync(cacheFile)) {
                try {
                    const data = fs.readFileSync(cacheFile, 'utf8');
                    this.cache[field] = JSON.parse(data);
                } catch (error) {
                    console.error(`Failed to load cache for ${field}:`, error);
                    this.cache[field] = [];
                }
            }
        }

        const totalValues = Object.values(this.cache).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`Loaded metadata cache for profile '${profileName}': ${totalValues} values across ${Object.keys(this.cache).length} fields`);
    }

    /**
     * Update cache from query results
     * @param results - Query results to process
     * @param merge - If true, merge with existing cache; if false, replace existing cache
     */
    async updateCacheFromResults(results: any[], merge: boolean = false): Promise<void> {
        if (!this.metadataDir) {
            throw new Error('Metadata directory not set. Call loadMetadataCache first.');
        }

        // Extract unique values for each field using Sets
        const sets: { [K in keyof MetadataFieldCache]: Set<string> } = {
            _sourceCategory: new Set<string>(merge ? this.cache._sourceCategory : []),
            _collector: new Set<string>(merge ? this.cache._collector : []),
            _source: new Set<string>(merge ? this.cache._source : []),
            _sourceHost: new Set<string>(merge ? this.cache._sourceHost : []),
            _sourceName: new Set<string>(merge ? this.cache._sourceName : []),
            _index: new Set<string>(merge ? this.cache._index : [])
        };

        // Process results - handle case-insensitive field names from API
        results.forEach(result => {
            if (result.map) {
                // Create a case-insensitive map of the result
                const lowerCaseMap: { [key: string]: any } = {};
                Object.keys(result.map).forEach(key => {
                    lowerCaseMap[key.toLowerCase()] = result.map[key];
                });

                // Check each field with case-insensitive matching
                for (const field of Object.keys(sets) as Array<keyof MetadataFieldCache>) {
                    const value = lowerCaseMap[field.toLowerCase()];
                    if (value && typeof value === 'string' && value.trim() !== '') {
                        sets[field].add(value);
                    }
                }
            }
        });

        // Convert sets to sorted arrays and save
        for (const field of Object.keys(sets) as Array<keyof MetadataFieldCache>) {
            this.cache[field] = Array.from(sets[field]).sort();

            // Save to file
            const cacheFile = path.join(this.metadataDir, `${field}.json`);
            fs.writeFileSync(cacheFile, JSON.stringify(this.cache[field], null, 2));
        }

        const totalValues = Object.values(this.cache).reduce((sum, arr) => sum + arr.length, 0);
        const mode = merge ? 'Merged' : 'Replaced';
        console.log(`${mode} metadata cache: ${totalValues} values across ${Object.keys(this.cache).length} fields`);
    }

    /**
     * Get completion items for a specific context
     * Returns field-specific completions based on what the user is typing
     */
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] {
        const line = document.lineAt(position).text;
        const textBeforeCursor = line.substring(0, position.character);

        // Match: fieldname (0 or 1 space) = (anything after)
        const fieldMatch = textBeforeCursor.match(/(_sourceCategory|_collector|_source|_sourceHost|_sourceName|_index)\s?=(.*)$/i);

        if (!fieldMatch) {
            return [];
        }

        // Normalize field name to cache key (handle case-insensitive)
        const fieldLower = fieldMatch[1].toLowerCase();
        let field: keyof MetadataFieldCache;

        if (fieldLower === '_sourcecategory') field = '_sourceCategory';
        else if (fieldLower === '_sourcehost') field = '_sourceHost';
        else if (fieldLower === '_sourcename') field = '_sourceName';
        else field = fieldMatch[1] as keyof MetadataFieldCache;

        const values = this.cache[field] || [];
        if (values.length === 0) {
            return [];
        }

        // Return simple completion items - just insert the value
        return values.map(value => {
            const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
            item.detail = `${field} value`;
            return item;
        });
    }

    /**
     * Get all cached values for a specific field
     */
    getFieldValues(field: keyof MetadataFieldCache): string[] {
        return [...this.cache[field]];
    }

    /**
     * Get statistics about cached metadata
     */
    getStats(): { field: string; count: number }[] {
        return Object.entries(this.cache).map(([field, values]) => ({
            field,
            count: values.length
        }));
    }

    /**
     * Clear all cached metadata
     */
    clear(): void {
        this.cache = {
            _sourceCategory: [],
            _collector: [],
            _source: [],
            _sourceHost: [],
            _sourceName: [],
            _index: []
        };
    }

    /**
     * Clear cache for current profile
     */
    async clearProfileCache(): Promise<void> {
        if (!this.metadataDir) {
            return;
        }

        for (const field of Object.keys(this.cache) as Array<keyof MetadataFieldCache>) {
            const cacheFile = path.join(this.metadataDir, `${field}.json`);
            if (fs.existsSync(cacheFile)) {
                fs.unlinkSync(cacheFile);
            }
        }

        this.clear();
        console.log(`Cleared metadata cache for profile '${this.currentProfile}'`);
    }
}

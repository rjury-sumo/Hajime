"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataCompletionProvider = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
/**
 * Provides context-aware autocomplete for metadata fields
 * Values are populated from cached metadata query results
 */
class MetadataCompletionProvider {
    constructor() {
        this.cache = {
            _sourceCategory: [],
            _collector: [],
            _source: [],
            _sourceHost: [],
            _sourceName: [],
            _index: []
        };
        this.metadataDir = null;
        this.currentProfile = null;
    }
    /**
     * Load metadata cache for a specific profile
     */
    loadMetadataCache(metadataDir, profileName) {
        return __awaiter(this, void 0, void 0, function* () {
            this.metadataDir = metadataDir;
            this.currentProfile = profileName;
            // Load each field's cache file
            for (const field of Object.keys(this.cache)) {
                const cacheFile = path.join(metadataDir, `${field}.json`);
                if (fs.existsSync(cacheFile)) {
                    try {
                        const data = fs.readFileSync(cacheFile, 'utf8');
                        this.cache[field] = JSON.parse(data);
                    }
                    catch (error) {
                        console.error(`Failed to load cache for ${field}:`, error);
                        this.cache[field] = [];
                    }
                }
            }
            const totalValues = Object.values(this.cache).reduce((sum, arr) => sum + arr.length, 0);
            console.log(`Loaded metadata cache for profile '${profileName}': ${totalValues} values across ${Object.keys(this.cache).length} fields`);
        });
    }
    /**
     * Update cache from query results
     * @param results - Query results to process
     * @param merge - If true, merge with existing cache; if false, replace existing cache
     */
    updateCacheFromResults(results_1) {
        return __awaiter(this, arguments, void 0, function* (results, merge = false) {
            if (!this.metadataDir) {
                throw new Error('Metadata directory not set. Call loadMetadataCache first.');
            }
            // Extract unique values for each field using Sets
            const sets = {
                _sourceCategory: new Set(merge ? this.cache._sourceCategory : []),
                _collector: new Set(merge ? this.cache._collector : []),
                _source: new Set(merge ? this.cache._source : []),
                _sourceHost: new Set(merge ? this.cache._sourceHost : []),
                _sourceName: new Set(merge ? this.cache._sourceName : []),
                _index: new Set(merge ? this.cache._index : [])
            };
            // Process results - handle case-insensitive field names from API
            results.forEach(result => {
                if (result.map) {
                    // Create a case-insensitive map of the result
                    const lowerCaseMap = {};
                    Object.keys(result.map).forEach(key => {
                        lowerCaseMap[key.toLowerCase()] = result.map[key];
                    });
                    // Check each field with case-insensitive matching
                    for (const field of Object.keys(sets)) {
                        const value = lowerCaseMap[field.toLowerCase()];
                        if (value && typeof value === 'string' && value.trim() !== '') {
                            sets[field].add(value);
                        }
                    }
                }
            });
            // Convert sets to sorted arrays and save
            for (const field of Object.keys(sets)) {
                this.cache[field] = Array.from(sets[field]).sort();
                // Save to file
                const cacheFile = path.join(this.metadataDir, `${field}.json`);
                fs.writeFileSync(cacheFile, JSON.stringify(this.cache[field], null, 2));
            }
            const totalValues = Object.values(this.cache).reduce((sum, arr) => sum + arr.length, 0);
            const mode = merge ? 'Merged' : 'Replaced';
            console.log(`${mode} metadata cache: ${totalValues} values across ${Object.keys(this.cache).length} fields`);
        });
    }
    /**
     * Get completion items for a specific context
     * Returns field-specific completions based on what the user is typing
     */
    provideCompletionItems(document, position) {
        const line = document.lineAt(position).text;
        const textBeforeCursor = line.substring(0, position.character);
        // Match: fieldname (0 or 1 space) = (anything after)
        const fieldMatch = textBeforeCursor.match(/(_sourceCategory|_collector|_source|_sourceHost|_sourceName|_index)\s?=(.*)$/i);
        if (!fieldMatch) {
            return [];
        }
        // Normalize field name to cache key (handle case-insensitive)
        const fieldLower = fieldMatch[1].toLowerCase();
        let field;
        if (fieldLower === '_sourcecategory')
            field = '_sourceCategory';
        else if (fieldLower === '_sourcehost')
            field = '_sourceHost';
        else if (fieldLower === '_sourcename')
            field = '_sourceName';
        else
            field = fieldMatch[1];
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
    getFieldValues(field) {
        return [...this.cache[field]];
    }
    /**
     * Get statistics about cached metadata
     */
    getStats() {
        return Object.entries(this.cache).map(([field, values]) => ({
            field,
            count: values.length
        }));
    }
    /**
     * Clear all cached metadata
     */
    clear() {
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
    clearProfileCache() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.metadataDir) {
                return;
            }
            for (const field of Object.keys(this.cache)) {
                const cacheFile = path.join(this.metadataDir, `${field}.json`);
                if (fs.existsSync(cacheFile)) {
                    fs.unlinkSync(cacheFile);
                }
            }
            this.clear();
            console.log(`Cleared metadata cache for profile '${this.currentProfile}'`);
        });
    }
}
exports.MetadataCompletionProvider = MetadataCompletionProvider;
//# sourceMappingURL=metadataCompletions.js.map
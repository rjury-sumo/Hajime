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
exports.DynamicCompletionProvider = void 0;
const vscode = require("vscode");
/**
 * Manages dynamically discovered fields from query results and custom fields API
 * Fields are stored per profile and persisted in workspace state
 */
class DynamicCompletionProvider {
    constructor(context) {
        this.context = context;
        this.discoveredFields = new Set();
        this.customFields = new Set();
        this.partitions = new Set();
        this.completionItems = [];
        this.currentProfile = null;
    }
    /**
     * Load autocomplete data for a specific profile
     */
    loadProfileData(profileName) {
        return __awaiter(this, void 0, void 0, function* () {
            this.currentProfile = profileName;
            // Load from workspace state
            const stateKey = `sumologic.autocomplete.${profileName}`;
            const data = this.context.workspaceState.get(stateKey);
            if (data) {
                this.discoveredFields = new Set(data.discoveredFields || []);
                this.customFields = new Set(data.customFields || []);
                this.partitions = new Set(data.partitions || []);
                this.rebuildCompletionItems();
                console.log(`Loaded autocomplete data for profile '${profileName}': ${this.discoveredFields.size} fields, ${this.customFields.size} custom fields, ${this.partitions.size} partitions`);
            }
            else {
                // No saved data, start fresh
                this.clear();
            }
        });
    }
    /**
     * Save current autocomplete data for the active profile
     */
    saveProfileData() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.currentProfile) {
                return;
            }
            const stateKey = `sumologic.autocomplete.${this.currentProfile}`;
            const data = {
                discoveredFields: Array.from(this.discoveredFields),
                customFields: Array.from(this.customFields),
                partitions: Array.from(this.partitions)
            };
            yield this.context.workspaceState.update(stateKey, data);
        });
    }
    /**
     * Rebuild completion items from current data
     */
    rebuildCompletionItems() {
        this.completionItems = [];
        // Add discovered fields (sort after metadata with 'bbb' prefix)
        this.discoveredFields.forEach(fieldName => {
            const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
            item.detail = 'Field from query results';
            item.documentation = new vscode.MarkdownString(`Field discovered from query execution (profile: ${this.currentProfile}).`);
            item.sortText = `bbb_${fieldName}`; // After metadata (aaa), before custom fields
            this.completionItems.push(item);
        });
        // Add custom fields (sort after discovered fields with 'ccc' prefix)
        this.customFields.forEach(fieldName => {
            const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
            item.detail = 'Custom field (from API)';
            item.documentation = new vscode.MarkdownString(`Custom field from Sumo Logic organization (profile: ${this.currentProfile}).`);
            item.sortText = `ccc_${fieldName}`; // After discovered fields
            this.completionItems.push(item);
        });
        // Add partitions (sort with custom fields using 'ccc' prefix)
        this.partitions.forEach(partitionName => {
            const item = new vscode.CompletionItem(partitionName, vscode.CompletionItemKind.Value);
            item.detail = 'Partition (for _index or _view)';
            item.documentation = new vscode.MarkdownString(`Partition from Sumo Logic (profile: ${this.currentProfile}).\n\nUse with \`_index=${partitionName}\` or \`_view=${partitionName}\``);
            item.sortText = `ccc_${partitionName}`; // Sort with custom fields
            this.completionItems.push(item);
        });
    }
    /**
     * Add fields discovered from query results
     */
    addFieldsFromResults(results) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!results || results.length === 0) {
                return;
            }
            let fieldsAdded = 0;
            // Extract field names from the map property of each result
            results.forEach(result => {
                if (result.map) {
                    Object.keys(result.map).forEach(fieldName => {
                        if (!this.discoveredFields.has(fieldName)) {
                            this.discoveredFields.add(fieldName);
                            fieldsAdded++;
                        }
                    });
                }
            });
            if (fieldsAdded > 0) {
                this.rebuildCompletionItems();
                yield this.saveProfileData();
                console.log(`Added ${fieldsAdded} new fields to autocomplete for profile '${this.currentProfile}'`);
            }
        });
    }
    /**
     * Get all discovered completion items
     */
    getCompletionItems() {
        return this.completionItems;
    }
    /**
     * Get count of discovered fields
     */
    getFieldCount() {
        return this.discoveredFields.size;
    }
    /**
     * Add a custom field from the API
     */
    addCustomField(fieldName) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if already exists in either set
            if (this.discoveredFields.has(fieldName) || this.customFields.has(fieldName)) {
                return;
            }
            this.customFields.add(fieldName);
            this.rebuildCompletionItems();
            yield this.saveProfileData();
        });
    }
    /**
     * Add a partition from the API
     */
    addPartition(partitionName) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if already exists in any set
            if (this.discoveredFields.has(partitionName) ||
                this.customFields.has(partitionName) ||
                this.partitions.has(partitionName)) {
                return;
            }
            this.partitions.add(partitionName);
            this.rebuildCompletionItems();
            yield this.saveProfileData();
        });
    }
    /**
     * Clear all discovered fields (for current profile)
     */
    clear() {
        this.discoveredFields.clear();
        this.customFields.clear();
        this.partitions.clear();
        this.completionItems = [];
    }
    /**
     * Clear autocomplete data for a specific profile
     */
    clearProfileData(profileName) {
        return __awaiter(this, void 0, void 0, function* () {
            const stateKey = `sumologic.autocomplete.${profileName}`;
            yield this.context.workspaceState.update(stateKey, undefined);
            if (this.currentProfile === profileName) {
                this.clear();
            }
        });
    }
    /**
     * Get all discovered field names
     */
    getFieldNames() {
        return Array.from(this.discoveredFields);
    }
    /**
     * Get all custom field names
     */
    getCustomFieldNames() {
        return Array.from(this.customFields);
    }
    /**
     * Get count of custom fields
     */
    getCustomFieldCount() {
        return this.customFields.size;
    }
    /**
     * Get all partition names
     */
    getPartitionNames() {
        return Array.from(this.partitions);
    }
    /**
     * Get count of partitions
     */
    getPartitionCount() {
        return this.partitions.size;
    }
    /**
     * Check if a field has been discovered
     */
    hasField(fieldName) {
        return this.discoveredFields.has(fieldName) || this.customFields.has(fieldName);
    }
    /**
     * Get current profile name
     */
    getCurrentProfile() {
        return this.currentProfile;
    }
}
exports.DynamicCompletionProvider = DynamicCompletionProvider;
//# sourceMappingURL=dynamicCompletions.js.map
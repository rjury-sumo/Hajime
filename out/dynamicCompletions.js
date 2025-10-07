"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicCompletionProvider = void 0;
const vscode = require("vscode");
/**
 * Manages dynamically discovered fields from query results and custom fields API
 * Fields are added to autocomplete when they appear in query results or fetched from API
 */
class DynamicCompletionProvider {
    constructor() {
        this.discoveredFields = new Set();
        this.customFields = new Set();
        this.completionItems = [];
    }
    /**
     * Add fields discovered from query results
     */
    addFieldsFromResults(results) {
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
                        // Create completion item for this field
                        const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
                        item.detail = 'Field from query results';
                        item.documentation = new vscode.MarkdownString(`Field discovered from recent query execution.\n\nExample value: \`${String(result.map[fieldName]).substring(0, 50)}\``);
                        this.completionItems.push(item);
                    }
                });
            }
        });
        if (fieldsAdded > 0) {
            console.log(`Added ${fieldsAdded} new fields to autocomplete`);
        }
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
        // Check if already exists in either set
        if (this.discoveredFields.has(fieldName) || this.customFields.has(fieldName)) {
            return;
        }
        this.customFields.add(fieldName);
        // Create completion item for this custom field
        const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
        item.detail = 'Custom field (from API)';
        item.documentation = new vscode.MarkdownString(`Custom field defined in your Sumo Logic organization.`);
        this.completionItems.push(item);
    }
    /**
     * Clear all discovered fields (for session reset)
     */
    clear() {
        this.discoveredFields.clear();
        this.customFields.clear();
        this.completionItems = [];
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
     * Check if a field has been discovered
     */
    hasField(fieldName) {
        return this.discoveredFields.has(fieldName) || this.customFields.has(fieldName);
    }
}
exports.DynamicCompletionProvider = DynamicCompletionProvider;
//# sourceMappingURL=dynamicCompletions.js.map
import * as vscode from 'vscode';

/**
 * Per-profile autocomplete data
 */
interface ProfileAutocompleteData {
    discoveredFields: string[];
    customFields: string[];
    partitions: string[];
}

/**
 * Manages dynamically discovered fields from query results and custom fields API
 * Fields are stored per profile and persisted in workspace state
 */
export class DynamicCompletionProvider {
    private discoveredFields: Set<string> = new Set();
    private customFields: Set<string> = new Set();
    private partitions: Set<string> = new Set();
    private completionItems: vscode.CompletionItem[] = [];
    private currentProfile: string | null = null;

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Load autocomplete data for a specific profile
     */
    async loadProfileData(profileName: string): Promise<void> {
        this.currentProfile = profileName;

        // Load from workspace state
        const stateKey = `sumologic.autocomplete.${profileName}`;
        const data = this.context.workspaceState.get<ProfileAutocompleteData>(stateKey);

        if (data) {
            this.discoveredFields = new Set(data.discoveredFields || []);
            this.customFields = new Set(data.customFields || []);
            this.partitions = new Set(data.partitions || []);
            this.rebuildCompletionItems();
            console.log(`Loaded autocomplete data for profile '${profileName}': ${this.discoveredFields.size} fields, ${this.customFields.size} custom fields, ${this.partitions.size} partitions`);
        } else {
            // No saved data, start fresh
            this.clear();
        }
    }

    /**
     * Save current autocomplete data for the active profile
     */
    private async saveProfileData(): Promise<void> {
        if (!this.currentProfile) {
            return;
        }

        const stateKey = `sumologic.autocomplete.${this.currentProfile}`;
        const data: ProfileAutocompleteData = {
            discoveredFields: Array.from(this.discoveredFields),
            customFields: Array.from(this.customFields),
            partitions: Array.from(this.partitions)
        };

        await this.context.workspaceState.update(stateKey, data);
    }

    /**
     * Rebuild completion items from current data
     */
    private rebuildCompletionItems(): void {
        this.completionItems = [];

        // Add discovered fields
        this.discoveredFields.forEach(fieldName => {
            const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
            item.detail = 'Field from query results';
            item.documentation = new vscode.MarkdownString(
                `Field discovered from query execution (profile: ${this.currentProfile}).`
            );
            this.completionItems.push(item);
        });

        // Add custom fields
        this.customFields.forEach(fieldName => {
            const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
            item.detail = 'Custom field (from API)';
            item.documentation = new vscode.MarkdownString(
                `Custom field from Sumo Logic organization (profile: ${this.currentProfile}).`
            );
            this.completionItems.push(item);
        });

        // Add partitions
        this.partitions.forEach(partitionName => {
            const item = new vscode.CompletionItem(partitionName, vscode.CompletionItemKind.Value);
            item.detail = 'Partition (for _index or _view)';
            item.documentation = new vscode.MarkdownString(
                `Partition from Sumo Logic (profile: ${this.currentProfile}).\n\nUse with \`_index=${partitionName}\` or \`_view=${partitionName}\``
            );
            this.completionItems.push(item);
        });
    }

    /**
     * Add fields discovered from query results
     */
    async addFieldsFromResults(results: any[]): Promise<void> {
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
            await this.saveProfileData();
            console.log(`Added ${fieldsAdded} new fields to autocomplete for profile '${this.currentProfile}'`);
        }
    }

    /**
     * Get all discovered completion items
     */
    getCompletionItems(): vscode.CompletionItem[] {
        return this.completionItems;
    }

    /**
     * Get count of discovered fields
     */
    getFieldCount(): number {
        return this.discoveredFields.size;
    }

    /**
     * Add a custom field from the API
     */
    async addCustomField(fieldName: string): Promise<void> {
        // Check if already exists in either set
        if (this.discoveredFields.has(fieldName) || this.customFields.has(fieldName)) {
            return;
        }

        this.customFields.add(fieldName);
        this.rebuildCompletionItems();
        await this.saveProfileData();
    }

    /**
     * Add a partition from the API
     */
    async addPartition(partitionName: string): Promise<void> {
        // Check if already exists in any set
        if (this.discoveredFields.has(partitionName) ||
            this.customFields.has(partitionName) ||
            this.partitions.has(partitionName)) {
            return;
        }

        this.partitions.add(partitionName);
        this.rebuildCompletionItems();
        await this.saveProfileData();
    }

    /**
     * Clear all discovered fields (for current profile)
     */
    clear(): void {
        this.discoveredFields.clear();
        this.customFields.clear();
        this.partitions.clear();
        this.completionItems = [];
    }

    /**
     * Clear autocomplete data for a specific profile
     */
    async clearProfileData(profileName: string): Promise<void> {
        const stateKey = `sumologic.autocomplete.${profileName}`;
        await this.context.workspaceState.update(stateKey, undefined);

        if (this.currentProfile === profileName) {
            this.clear();
        }
    }

    /**
     * Get all discovered field names
     */
    getFieldNames(): string[] {
        return Array.from(this.discoveredFields);
    }

    /**
     * Get all custom field names
     */
    getCustomFieldNames(): string[] {
        return Array.from(this.customFields);
    }

    /**
     * Get count of custom fields
     */
    getCustomFieldCount(): number {
        return this.customFields.size;
    }

    /**
     * Get all partition names
     */
    getPartitionNames(): string[] {
        return Array.from(this.partitions);
    }

    /**
     * Get count of partitions
     */
    getPartitionCount(): number {
        return this.partitions.size;
    }

    /**
     * Check if a field has been discovered
     */
    hasField(fieldName: string): boolean {
        return this.discoveredFields.has(fieldName) || this.customFields.has(fieldName);
    }

    /**
     * Get current profile name
     */
    getCurrentProfile(): string | null {
        return this.currentProfile;
    }
}

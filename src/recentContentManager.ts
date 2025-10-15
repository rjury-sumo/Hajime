import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Recent content entry
 */
export interface RecentContent {
    filePath: string;
    fileName: string;
    contentId: string;
    contentName: string;
    contentType: string;  // type or itemType from JSON
    lastOpened: string;   // ISO timestamp
    profile?: string;
}

/**
 * Manager for tracking recently opened content JSON files
 */
export class RecentContentManager {
    private static readonly MAX_RECENT_CONTENT = 20;
    private recentContentFile: string;
    private content: RecentContent[] = [];

    constructor(private context: vscode.ExtensionContext) {
        const storagePath = context.globalStorageUri.fsPath;
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }
        this.recentContentFile = path.join(storagePath, 'recentContent.json');
        this.loadContent();
    }

    /**
     * Load recent content from storage
     */
    private loadContent(): void {
        try {
            if (fs.existsSync(this.recentContentFile)) {
                const data = fs.readFileSync(this.recentContentFile, 'utf-8');
                this.content = JSON.parse(data);
                // Filter out content for files that no longer exist
                this.content = this.content.filter(c => fs.existsSync(c.filePath));
            }
        } catch (error) {
            console.error('Failed to load recent content:', error);
            this.content = [];
        }
    }

    /**
     * Save recent content to storage
     */
    private saveContent(): void {
        try {
            fs.writeFileSync(
                this.recentContentFile,
                JSON.stringify(this.content, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('Failed to save recent content:', error);
        }
    }

    /**
     * Add a content item to recent content
     */
    public addContent(filePath: string, contentId: string, contentName: string, contentType: string, profileName?: string): void {
        // Normalize path
        filePath = path.normalize(filePath);

        // Reload current state from disk
        this.loadContent();

        // Remove existing entry if present
        this.content = this.content.filter(c => c.filePath !== filePath);

        try {
            // Create new entry
            const entry: RecentContent = {
                filePath,
                fileName: path.basename(filePath),
                contentId,
                contentName,
                contentType,
                lastOpened: new Date().toISOString(),
                profile: profileName
            };

            console.log(`[RecentContent] Adding: ${contentName} (${contentType}) from ${filePath}`);

            // Add to front of list
            this.content.unshift(entry);

            // Keep only max recent content
            if (this.content.length > RecentContentManager.MAX_RECENT_CONTENT) {
                this.content = this.content.slice(0, RecentContentManager.MAX_RECENT_CONTENT);
            }

            // Save to disk
            this.saveContent();
            console.log(`[RecentContent] Saved ${this.content.length} items to ${this.recentContentFile}`);
        } catch (error) {
            console.error('Failed to add recent content:', error);
        }
    }

    /**
     * Get all recent content
     */
    public getContent(limit?: number): RecentContent[] {
        // Reload from disk to ensure we have the latest data
        this.loadContent();
        console.log(`[RecentContent] getContent: Loaded ${this.content.length} items from disk`);
        const content = this.content.filter(c => {
            const exists = fs.existsSync(c.filePath);
            if (!exists) {
                console.log(`[RecentContent] File not found: ${c.filePath}`);
            }
            return exists;
        });
        console.log(`[RecentContent] getContent: Returning ${content.length} items after filtering`);
        return limit ? content.slice(0, limit) : content;
    }

    /**
     * Get recent content for a specific profile
     */
    public getContentByProfile(profileName: string, limit?: number): RecentContent[] {
        // Reload from disk to ensure we have the latest data
        this.loadContent();
        console.log(`[RecentContent] getContentByProfile: Loaded ${this.content.length} items, filtering for profile: ${profileName}`);
        const content = this.content.filter(c => {
            const matchesProfile = c.profile === profileName;
            const exists = fs.existsSync(c.filePath);
            console.log(`[RecentContent] Item: ${c.contentName}, profile: ${c.profile}, matchesProfile: ${matchesProfile}, exists: ${exists}`);
            return matchesProfile && exists;
        });
        console.log(`[RecentContent] getContentByProfile: Returning ${content.length} items`);
        return limit ? content.slice(0, limit) : content;
    }

    /**
     * Clear all recent content
     */
    public clearContent(): void {
        this.content = [];
        this.saveContent();
    }

    /**
     * Remove a specific content item
     */
    public removeContent(filePath: string): void {
        filePath = path.normalize(filePath);
        this.content = this.content.filter(c => c.filePath !== filePath);
        this.saveContent();
    }
}

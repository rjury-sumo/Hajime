import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager } from './profileManager';

/**
 * Utility for writing command output to profile-specific directories
 */
export class OutputWriter {
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Sanitize a string to be safe for use in a filename
     */
    private sanitizeFilename(name: string): string {
        // Replace invalid characters with underscore
        return name
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_{2,}/g, '_')
            .trim();
    }

    /**
     * Get current timestamp in yyyyMMdd_HHmmss format
     */
    private getTimestamp(): string {
        const now = new Date();
        const yyyy = now.getFullYear();
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        return `${yyyy}${MM}${dd}_${HH}${mm}${ss}`;
    }

    /**
     * Write output to a file in the profile's subdirectory
     * @param subdirectory The subdirectory name (e.g., 'queries', 'partitions', 'customfields')
     * @param filename The base filename (will be sanitized and timestamped)
     * @param content The content to write
     * @param extension The file extension (default: 'json')
     * @returns The full path to the created file
     */
    async writeOutput(
        subdirectory: string,
        filename: string,
        content: string,
        extension: string = 'json'
    ): Promise<string> {
        const profileManager = new ProfileManager(this.context);
        const activeProfile = await profileManager.getActiveProfile();

        if (!activeProfile) {
            throw new Error('No active profile. Please create and select a profile first.');
        }

        // Get profile directory
        const profileDir = profileManager.getProfileDirectory(activeProfile.name);

        // Create subdirectory path
        const outputDir = path.join(profileDir, subdirectory);

        // Ensure directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Create timestamped filename
        const sanitizedFilename = this.sanitizeFilename(filename);
        const timestamp = this.getTimestamp();
        const fullFilename = `${sanitizedFilename}_${timestamp}.${extension}`;
        const filePath = path.join(outputDir, fullFilename);

        // Write file
        fs.writeFileSync(filePath, content, 'utf-8');

        return filePath;
    }

    /**
     * Write output and optionally open the file in the editor
     * @param subdirectory The subdirectory name
     * @param filename The base filename
     * @param content The content to write
     * @param extension The file extension (default: 'json')
     * @param openInEditor Whether to open the file in the editor (default: true)
     * @returns The full path to the created file
     */
    async writeAndOpen(
        subdirectory: string,
        filename: string,
        content: string,
        extension: string = 'json',
        openInEditor: boolean = true
    ): Promise<string> {
        const filePath = await this.writeOutput(subdirectory, filename, content, extension);

        if (openInEditor) {
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document, { preview: false });
        }

        return filePath;
    }
}

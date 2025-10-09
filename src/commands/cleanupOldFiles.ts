import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProfileManager } from '../profileManager';

/**
 * Delete files older than X days from the current profile's output directory
 */
export async function cleanupOldFilesCommand(context: vscode.ExtensionContext): Promise<void> {
    try {
        const profileManager = new ProfileManager(context);
        const activeProfile = await profileManager.getActiveProfile();

        if (!activeProfile) {
            vscode.window.showWarningMessage('No active profile. Please create or select a profile first.');
            return;
        }

        // Ask user for the age threshold
        const daysInput = await vscode.window.showInputBox({
            prompt: `Delete files older than how many days from profile '${activeProfile.name}'?`,
            placeHolder: 'Enter number of days (e.g., 7, 30, 90)',
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num <= 0) {
                    return 'Please enter a positive number';
                }
                return null;
            }
        });

        if (!daysInput) {
            return; // User cancelled
        }

        const daysOld = parseInt(daysInput);
        const profileDir = profileManager.getProfileDirectory(activeProfile.name);

        // Check if directory exists
        if (!fs.existsSync(profileDir)) {
            vscode.window.showInformationMessage(`Profile directory does not exist: ${profileDir}`);
            return;
        }

        // Calculate cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        // Find and delete old files
        const deletedFiles = await deleteOldFiles(profileDir, cutoffDate);

        if (deletedFiles.length === 0) {
            vscode.window.showInformationMessage(
                `No files older than ${daysOld} days found in profile '${activeProfile.name}'.`
            );
        } else {
            vscode.window.showInformationMessage(
                `Deleted ${deletedFiles.length} file(s) older than ${daysOld} days from profile '${activeProfile.name}'.`
            );
        }

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to cleanup old files: ${message}`);
    }
}

/**
 * Recursively find and delete files older than the cutoff date
 * Only deletes files with .txt, .json, or .csv extensions for safety
 */
async function deleteOldFiles(dirPath: string, cutoffDate: Date): Promise<string[]> {
    const deletedFiles: string[] = [];
    const allowedExtensions = ['.txt', '.json', '.csv'];

    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                // Recursively process subdirectories
                const subDeleted = await deleteOldFiles(fullPath, cutoffDate);
                deletedFiles.push(...subDeleted);
            } else if (entry.isFile()) {
                // Check if file has allowed extension
                const ext = path.extname(entry.name).toLowerCase();
                if (!allowedExtensions.includes(ext)) {
                    continue; // Skip files with other extensions
                }

                // Check file modification time
                const stats = fs.statSync(fullPath);
                if (stats.mtime < cutoffDate) {
                    try {
                        fs.unlinkSync(fullPath);
                        deletedFiles.push(fullPath);
                    } catch (error) {
                        console.error(`Failed to delete file ${fullPath}:`, error);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
    }

    return deletedFiles;
}

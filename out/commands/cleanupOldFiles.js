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
exports.cleanupOldFilesCommand = cleanupOldFilesCommand;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const profileManager_1 = require("../profileManager");
/**
 * Delete files older than X days from the current profile's output directory
 */
function cleanupOldFilesCommand(context) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const profileManager = new profileManager_1.ProfileManager(context);
            const activeProfile = yield profileManager.getActiveProfile();
            if (!activeProfile) {
                vscode.window.showWarningMessage('No active profile. Please create or select a profile first.');
                return;
            }
            // Ask user for the age threshold
            const daysInput = yield vscode.window.showInputBox({
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
            const deletedFiles = yield deleteOldFiles(profileDir, cutoffDate);
            if (deletedFiles.length === 0) {
                vscode.window.showInformationMessage(`No files older than ${daysOld} days found in profile '${activeProfile.name}'.`);
            }
            else {
                vscode.window.showInformationMessage(`Deleted ${deletedFiles.length} file(s) older than ${daysOld} days from profile '${activeProfile.name}'.`);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to cleanup old files: ${message}`);
        }
    });
}
/**
 * Recursively find and delete files older than the cutoff date
 * Only deletes files with .txt, .json, or .csv extensions for safety
 */
function deleteOldFiles(dirPath, cutoffDate) {
    return __awaiter(this, void 0, void 0, function* () {
        const deletedFiles = [];
        const allowedExtensions = ['.txt', '.json', '.csv'];
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    // Recursively process subdirectories
                    const subDeleted = yield deleteOldFiles(fullPath, cutoffDate);
                    deletedFiles.push(...subDeleted);
                }
                else if (entry.isFile()) {
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
                        }
                        catch (error) {
                            console.error(`Failed to delete file ${fullPath}:`, error);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
        }
        return deletedFiles;
    });
}
//# sourceMappingURL=cleanupOldFiles.js.map
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
exports.OutputWriter = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const profileManager_1 = require("./profileManager");
/**
 * Utility for writing command output to profile-specific directories
 */
class OutputWriter {
    constructor(context) {
        this.context = context;
    }
    /**
     * Sanitize a string to be safe for use in a filename
     */
    sanitizeFilename(name) {
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
    getTimestamp() {
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
    writeOutput(subdirectory_1, filename_1, content_1) {
        return __awaiter(this, arguments, void 0, function* (subdirectory, filename, content, extension = 'json') {
            const profileManager = new profileManager_1.ProfileManager(this.context);
            const activeProfile = yield profileManager.getActiveProfile();
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
        });
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
    writeAndOpen(subdirectory_1, filename_1, content_1) {
        return __awaiter(this, arguments, void 0, function* (subdirectory, filename, content, extension = 'json', openInEditor = true) {
            const filePath = yield this.writeOutput(subdirectory, filename, content, extension);
            if (openInEditor) {
                const document = yield vscode.workspace.openTextDocument(filePath);
                yield vscode.window.showTextDocument(document, { preview: false });
            }
            return filePath;
        });
    }
}
exports.OutputWriter = OutputWriter;
//# sourceMappingURL=outputWriter.js.map
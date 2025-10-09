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
const assert = require("assert");
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const profileManager_1 = require("../../profileManager");
suite('Cleanup Old Files Test Suite', () => {
    let context;
    let profileManager;
    const testProfileName = 'cleanup-test-profile-' + Date.now();
    let testProfileDir;
    suiteSetup(() => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const extension = vscode.extensions.getExtension('tba.sumo-query-language');
        if (!extension) {
            throw new Error('Extension not found');
        }
        if (!extension.isActive) {
            yield extension.activate();
        }
        context = (_a = extension.exports) === null || _a === void 0 ? void 0 : _a.context;
        if (!context) {
            throw new Error('Extension context not available');
        }
        profileManager = new profileManager_1.ProfileManager(context);
        // Create test profile
        yield profileManager.createProfile({ name: testProfileName, region: 'us2' }, 'test-id', 'test-key');
        yield profileManager.setActiveProfile(testProfileName);
        testProfileDir = profileManager.getProfileDirectory(testProfileName);
        // Ensure test directory exists
        if (!fs.existsSync(testProfileDir)) {
            fs.mkdirSync(testProfileDir, { recursive: true });
        }
    }));
    suiteTeardown(() => __awaiter(void 0, void 0, void 0, function* () {
        // Cleanup test profile and files
        try {
            if (fs.existsSync(testProfileDir)) {
                fs.rmSync(testProfileDir, { recursive: true, force: true });
            }
            yield profileManager.deleteProfile(testProfileName);
        }
        catch (err) {
            // Ignore cleanup errors
        }
    }));
    test('should only delete files with allowed extensions', () => __awaiter(void 0, void 0, void 0, function* () {
        // Create test files with various extensions
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 10); // 10 days old
        const testFiles = [
            { name: 'old.txt', ext: '.txt', shouldDelete: true },
            { name: 'old.json', ext: '.json', shouldDelete: true },
            { name: 'old.csv', ext: '.csv', shouldDelete: true },
            { name: 'old.log', ext: '.log', shouldDelete: false },
            { name: 'old.js', ext: '.js', shouldDelete: false },
            { name: 'config.yaml', ext: '.yaml', shouldDelete: false }
        ];
        // Create files
        for (const file of testFiles) {
            const filePath = path.join(testProfileDir, file.name);
            fs.writeFileSync(filePath, 'test content');
            // Set modification time to old date
            fs.utimesSync(filePath, oldDate, oldDate);
        }
        // Verify files were created
        for (const file of testFiles) {
            const filePath = path.join(testProfileDir, file.name);
            assert.ok(fs.existsSync(filePath), `File ${file.name} should exist before cleanup`);
        }
        // Run cleanup command (simulating the command logic)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7); // Files older than 7 days
        yield deleteOldFilesTestHelper(testProfileDir, cutoffDate);
        // Verify only allowed extensions were deleted
        for (const file of testFiles) {
            const filePath = path.join(testProfileDir, file.name);
            if (file.shouldDelete) {
                assert.ok(!fs.existsSync(filePath), `File ${file.name} should be deleted`);
            }
            else {
                assert.ok(fs.existsSync(filePath), `File ${file.name} should NOT be deleted`);
            }
        }
        // Cleanup remaining files
        for (const file of testFiles) {
            const filePath = path.join(testProfileDir, file.name);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    }));
    test('should not delete recent files', () => __awaiter(void 0, void 0, void 0, function* () {
        // Create a recent file
        const recentFile = path.join(testProfileDir, 'recent.txt');
        fs.writeFileSync(recentFile, 'recent content');
        // Set cutoff date to 7 days ago
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        yield deleteOldFilesTestHelper(testProfileDir, cutoffDate);
        // Recent file should still exist
        assert.ok(fs.existsSync(recentFile), 'Recent file should not be deleted');
        // Cleanup
        fs.unlinkSync(recentFile);
    }));
    test('should handle subdirectories', () => __awaiter(void 0, void 0, void 0, function* () {
        // Create subdirectory with old files
        const subDir = path.join(testProfileDir, 'subdir');
        if (!fs.existsSync(subDir)) {
            fs.mkdirSync(subDir);
        }
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 10);
        const subFile = path.join(subDir, 'old-sub.csv');
        fs.writeFileSync(subFile, 'sub content');
        fs.utimesSync(subFile, oldDate, oldDate);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        yield deleteOldFilesTestHelper(testProfileDir, cutoffDate);
        // File in subdirectory should be deleted
        assert.ok(!fs.existsSync(subFile), 'Old file in subdirectory should be deleted');
        // Cleanup
        if (fs.existsSync(subDir)) {
            fs.rmSync(subDir, { recursive: true });
        }
    }));
    test('should handle empty directory', () => __awaiter(void 0, void 0, void 0, function* () {
        const emptyDir = path.join(testProfileDir, 'empty');
        if (!fs.existsSync(emptyDir)) {
            fs.mkdirSync(emptyDir);
        }
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        // Should not throw error on empty directory
        yield deleteOldFilesTestHelper(emptyDir, cutoffDate);
        // Cleanup
        fs.rmdirSync(emptyDir);
    }));
    test('should handle non-existent directory gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
        const nonExistentDir = path.join(testProfileDir, 'non-existent-' + Date.now());
        const cutoffDate = new Date();
        // Should not throw error
        yield deleteOldFilesTestHelper(nonExistentDir, cutoffDate);
    }));
});
/**
 * Helper function that mimics the cleanup logic from cleanupOldFiles.ts
 */
function deleteOldFilesTestHelper(dirPath, cutoffDate) {
    return __awaiter(this, void 0, void 0, function* () {
        const deletedFiles = [];
        const allowedExtensions = ['.txt', '.json', '.csv'];
        if (!fs.existsSync(dirPath)) {
            return deletedFiles;
        }
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    const subDeleted = yield deleteOldFilesTestHelper(fullPath, cutoffDate);
                    deletedFiles.push(...subDeleted);
                }
                else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (!allowedExtensions.includes(ext)) {
                        continue;
                    }
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
//# sourceMappingURL=cleanupOldFiles.test.js.map
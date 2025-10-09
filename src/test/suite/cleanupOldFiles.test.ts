import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProfileManager } from '../../profileManager';

suite('Cleanup Old Files Test Suite', () => {
    let context: vscode.ExtensionContext;
    let profileManager: ProfileManager;
    const testProfileName = 'cleanup-test-profile-' + Date.now();
    let testProfileDir: string;

    suiteSetup(async () => {
        const extension = vscode.extensions.getExtension('tba.sumo-query-language');
        if (!extension) {
            throw new Error('Extension not found');
        }
        if (!extension.isActive) {
            await extension.activate();
        }
        context = extension.exports?.context;
        if (!context) {
            throw new Error('Extension context not available');
        }

        profileManager = new ProfileManager(context);

        // Create test profile
        await profileManager.createProfile(
            { name: testProfileName, region: 'us2' },
            'test-id',
            'test-key'
        );
        await profileManager.setActiveProfile(testProfileName);

        testProfileDir = profileManager.getProfileDirectory(testProfileName);

        // Ensure test directory exists
        if (!fs.existsSync(testProfileDir)) {
            fs.mkdirSync(testProfileDir, { recursive: true });
        }
    });

    suiteTeardown(async () => {
        // Cleanup test profile and files
        try {
            if (fs.existsSync(testProfileDir)) {
                fs.rmSync(testProfileDir, { recursive: true, force: true });
            }
            await profileManager.deleteProfile(testProfileName);
        } catch (err) {
            // Ignore cleanup errors
        }
    });

    test('should only delete files with allowed extensions', async () => {
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

        await deleteOldFilesTestHelper(testProfileDir, cutoffDate);

        // Verify only allowed extensions were deleted
        for (const file of testFiles) {
            const filePath = path.join(testProfileDir, file.name);
            if (file.shouldDelete) {
                assert.ok(!fs.existsSync(filePath), `File ${file.name} should be deleted`);
            } else {
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
    });

    test('should not delete recent files', async () => {
        // Create a recent file
        const recentFile = path.join(testProfileDir, 'recent.txt');
        fs.writeFileSync(recentFile, 'recent content');

        // Set cutoff date to 7 days ago
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);

        await deleteOldFilesTestHelper(testProfileDir, cutoffDate);

        // Recent file should still exist
        assert.ok(fs.existsSync(recentFile), 'Recent file should not be deleted');

        // Cleanup
        fs.unlinkSync(recentFile);
    });

    test('should handle subdirectories', async () => {
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

        await deleteOldFilesTestHelper(testProfileDir, cutoffDate);

        // File in subdirectory should be deleted
        assert.ok(!fs.existsSync(subFile), 'Old file in subdirectory should be deleted');

        // Cleanup
        if (fs.existsSync(subDir)) {
            fs.rmSync(subDir, { recursive: true });
        }
    });

    test('should handle empty directory', async () => {
        const emptyDir = path.join(testProfileDir, 'empty');
        if (!fs.existsSync(emptyDir)) {
            fs.mkdirSync(emptyDir);
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);

        // Should not throw error on empty directory
        await deleteOldFilesTestHelper(emptyDir, cutoffDate);

        // Cleanup
        fs.rmdirSync(emptyDir);
    });

    test('should handle non-existent directory gracefully', async () => {
        const nonExistentDir = path.join(testProfileDir, 'non-existent-' + Date.now());
        const cutoffDate = new Date();

        // Should not throw error
        await deleteOldFilesTestHelper(nonExistentDir, cutoffDate);
    });
});

/**
 * Helper function that mimics the cleanup logic from cleanupOldFiles.ts
 */
async function deleteOldFilesTestHelper(dirPath: string, cutoffDate: Date): Promise<string[]> {
    const deletedFiles: string[] = [];
    const allowedExtensions = ['.txt', '.json', '.csv'];

    if (!fs.existsSync(dirPath)) {
        return deletedFiles;
    }

    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                const subDeleted = await deleteOldFilesTestHelper(fullPath, cutoffDate);
                deletedFiles.push(...subDeleted);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (!allowedExtensions.includes(ext)) {
                    continue;
                }

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

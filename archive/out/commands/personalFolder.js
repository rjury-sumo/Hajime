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
exports.getFolderCommand = getFolderCommand;
exports.getPersonalFolderCommand = getPersonalFolderCommand;
const vscode = require("vscode");
const content_1 = require("../api/content");
const authenticate_1 = require("./authenticate");
/**
 * Command to fetch and display a folder by ID
 */
function getFolderCommand(context) {
    return __awaiter(this, void 0, void 0, function* () {
        // Prompt for folder ID
        const folderId = yield vscode.window.showInputBox({
            prompt: 'Enter the folder ID',
            placeHolder: '0000000000ABC123',
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Folder ID cannot be empty';
                }
                return null;
            }
        });
        if (!folderId) {
            return; // User cancelled
        }
        const baseClient = yield (0, authenticate_1.createClient)(context);
        if (!baseClient) {
            vscode.window.showErrorMessage('No active profile. Please create a profile first.');
            return;
        }
        // Get credentials from the active profile
        const profileManager = yield Promise.resolve().then(() => require('../profileManager'));
        const pm = new profileManager.ProfileManager(context);
        const activeProfile = yield pm.getActiveProfile();
        if (!activeProfile) {
            vscode.window.showErrorMessage('No active profile found.');
            return;
        }
        const credentials = yield pm.getProfileCredentials(activeProfile.name);
        if (!credentials) {
            vscode.window.showErrorMessage('No credentials found for active profile.');
            return;
        }
        const client = new content_1.ContentClient({
            accessId: credentials.accessId,
            accessKey: credentials.accessKey,
            endpoint: pm.getProfileEndpoint(activeProfile)
        });
        yield vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Fetching folder ${folderId} from Sumo Logic...`,
            cancellable: false
        }, (progress) => __awaiter(this, void 0, void 0, function* () {
            const response = yield client.getFolder(folderId);
            if (response.error) {
                // Check if it's a permission error
                if (response.statusCode === 403 || response.statusCode === 401) {
                    vscode.window.showWarningMessage(`Unable to fetch folder: Insufficient permissions.`);
                }
                else if (response.statusCode === 404) {
                    vscode.window.showErrorMessage(`Folder not found: ${folderId}`);
                }
                else {
                    vscode.window.showErrorMessage(`Failed to fetch folder: ${response.error}`);
                }
                return;
            }
            if (!response.data) {
                vscode.window.showWarningMessage('No folder data returned from API.');
                return;
            }
            const folder = response.data;
            // Format the output (reuse the same formatter)
            const outputText = content_1.ContentClient.formatPersonalFolder(folder);
            // Display in new document
            const doc = yield vscode.workspace.openTextDocument({
                content: `Sumo Logic Folder (${activeProfile.name})\n` +
                    `${'='.repeat(80)}\n\n` +
                    outputText,
                language: 'plaintext'
            });
            yield vscode.window.showTextDocument(doc, { preview: false });
            vscode.window.showInformationMessage(`Folder loaded: ${folder.name} (${folder.children.length} items)`);
        }));
    });
}
/**
 * Command to fetch and display the user's personal folder
 */
function getPersonalFolderCommand(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const baseClient = yield (0, authenticate_1.createClient)(context);
        if (!baseClient) {
            vscode.window.showErrorMessage('No active profile. Please create a profile first.');
            return;
        }
        // Get credentials from the active profile
        const profileManager = yield Promise.resolve().then(() => require('../profileManager'));
        const pm = new profileManager.ProfileManager(context);
        const activeProfile = yield pm.getActiveProfile();
        if (!activeProfile) {
            vscode.window.showErrorMessage('No active profile found.');
            return;
        }
        const credentials = yield pm.getProfileCredentials(activeProfile.name);
        if (!credentials) {
            vscode.window.showErrorMessage('No credentials found for active profile.');
            return;
        }
        const client = new content_1.ContentClient({
            accessId: credentials.accessId,
            accessKey: credentials.accessKey,
            endpoint: pm.getProfileEndpoint(activeProfile)
        });
        yield vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Fetching personal folder from Sumo Logic...',
            cancellable: false
        }, (progress) => __awaiter(this, void 0, void 0, function* () {
            const response = yield client.getPersonalFolder();
            if (response.error) {
                // Check if it's a permission error
                if (response.statusCode === 403 || response.statusCode === 401) {
                    vscode.window.showWarningMessage('Unable to fetch personal folder: Insufficient permissions.');
                }
                else {
                    vscode.window.showErrorMessage(`Failed to fetch personal folder: ${response.error}`);
                }
                return;
            }
            if (!response.data) {
                vscode.window.showWarningMessage('No personal folder returned from API.');
                return;
            }
            const folder = response.data;
            // Format the output
            const outputText = content_1.ContentClient.formatPersonalFolder(folder);
            // Display in new document
            const doc = yield vscode.workspace.openTextDocument({
                content: `Sumo Logic Personal Folder (${activeProfile.name})\n` +
                    `${'='.repeat(80)}\n\n` +
                    outputText +
                    `\n\n` +
                    `ℹ️ The Personal Folder ID (${folder.id}) is used as the default\n` +
                    `location for saving content in Sumo Logic.\n`,
                language: 'plaintext'
            });
            yield vscode.window.showTextDocument(doc, { preview: false });
            vscode.window.showInformationMessage(`Personal folder loaded: ${folder.children.length} items found.`);
        }));
    });
}
//# sourceMappingURL=personalFolder.js.map
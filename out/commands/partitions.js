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
exports.fetchPartitionsCommand = fetchPartitionsCommand;
const vscode = require("vscode");
const partitions_1 = require("../api/partitions");
const authenticate_1 = require("./authenticate");
const extension_1 = require("../extension");
/**
 * Command to fetch partitions, display them, and add to autocomplete
 */
function fetchPartitionsCommand(context) {
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
        const client = new partitions_1.PartitionsClient({
            accessId: credentials.accessId,
            accessKey: credentials.accessKey,
            endpoint: pm.getProfileEndpoint(activeProfile)
        });
        yield vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Fetching partitions from Sumo Logic...',
            cancellable: false
        }, (progress) => __awaiter(this, void 0, void 0, function* () {
            const response = yield client.listPartitions();
            if (response.error) {
                // Check if it's a permission error
                if (response.statusCode === 403 || response.statusCode === 401) {
                    vscode.window.showWarningMessage('Unable to fetch partitions: Insufficient permissions. ' +
                        'Your user role may not have "View Partitions" capability.');
                }
                else {
                    vscode.window.showErrorMessage(`Failed to fetch partitions: ${response.error}`);
                }
                return;
            }
            if (!response.data || !response.data.data) {
                vscode.window.showWarningMessage('No partitions returned from API.');
                return;
            }
            const partitions = response.data.data;
            if (partitions.length === 0) {
                vscode.window.showInformationMessage('No partitions found in this organization.');
                return;
            }
            // Sort by name ascending
            partitions.sort((a, b) => a.name.localeCompare(b.name));
            // Extract partition names
            const partitionNames = partitions_1.PartitionsClient.extractPartitionNames(response.data);
            // Add to dynamic completion provider
            const dynamicProvider = (0, extension_1.getDynamicCompletionProvider)();
            if (dynamicProvider) {
                partitionNames.forEach(name => {
                    dynamicProvider.addPartition(name);
                });
            }
            // Format as table
            const tableText = partitions_1.PartitionsClient.formatPartitionsAsTable(partitions);
            // Display in new document
            const doc = yield vscode.workspace.openTextDocument({
                content: `Sumo Logic Partitions (${activeProfile.name})\n` +
                    `=========================================\n` +
                    `Total: ${partitions.length} partitions\n` +
                    `\n` +
                    `Use in queries: _index=partition_name or _view=partition_name\n` +
                    `\n` +
                    tableText +
                    `\n` +
                    `\nℹ️ Partition names have been added to autocomplete for _index and _view.`,
                language: 'plaintext'
            });
            yield vscode.window.showTextDocument(doc, { preview: false });
            vscode.window.showInformationMessage(`Found ${partitions.length} partitions. Names added to autocomplete.`);
        }));
    });
}
//# sourceMappingURL=partitions.js.map
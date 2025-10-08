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
exports.viewAutocompleteCommand = viewAutocompleteCommand;
exports.clearAutocompleteCommand = clearAutocompleteCommand;
const vscode = require("vscode");
const extension_1 = require("../extension");
/**
 * Command to view autocomplete data for the active profile
 */
function viewAutocompleteCommand(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const dynamicProvider = (0, extension_1.getDynamicCompletionProvider)();
        if (!dynamicProvider) {
            vscode.window.showErrorMessage('Autocomplete provider not initialized');
            return;
        }
        const currentProfile = dynamicProvider.getCurrentProfile();
        if (!currentProfile) {
            vscode.window.showInformationMessage('No active profile. Please select a profile first.');
            return;
        }
        // Get all autocomplete data
        const discoveredFields = dynamicProvider.getFieldNames();
        const customFields = dynamicProvider.getCustomFieldNames();
        const partitions = dynamicProvider.getPartitionNames();
        // Format as a readable report
        const totalCount = discoveredFields.length + customFields.length + partitions.length;
        let content = `Autocomplete Data for Profile: ${currentProfile}\n`;
        content += `${'='.repeat(60)}\n\n`;
        content += `Total Items: ${totalCount}\n\n`;
        // Discovered Fields Section
        content += `Discovered Fields (${discoveredFields.length})\n`;
        content += `${'-'.repeat(60)}\n`;
        if (discoveredFields.length > 0) {
            discoveredFields.sort();
            discoveredFields.forEach(field => {
                content += `  • ${field}\n`;
            });
        }
        else {
            content += `  (none)\n`;
        }
        content += `\n`;
        // Custom Fields Section
        content += `Custom Fields (${customFields.length})\n`;
        content += `${'-'.repeat(60)}\n`;
        if (customFields.length > 0) {
            customFields.sort();
            customFields.forEach(field => {
                content += `  • ${field}\n`;
            });
        }
        else {
            content += `  (none)\n`;
        }
        content += `\n`;
        // Partitions Section
        content += `Partitions (${partitions.length})\n`;
        content += `${'-'.repeat(60)}\n`;
        if (partitions.length > 0) {
            partitions.sort();
            partitions.forEach(partition => {
                content += `  • ${partition}\n`;
            });
        }
        else {
            content += `  (none)\n`;
        }
        content += `\n`;
        content += `\nℹ️ This data is stored per profile in the workspace.\n`;
        content += `It persists across VS Code restarts and is automatically\n`;
        content += `loaded when switching profiles.\n`;
        // Display in new document
        const doc = yield vscode.workspace.openTextDocument({
            content: content,
            language: 'plaintext'
        });
        yield vscode.window.showTextDocument(doc, { preview: false });
    });
}
/**
 * Command to clear autocomplete data for the active profile
 */
function clearAutocompleteCommand(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const dynamicProvider = (0, extension_1.getDynamicCompletionProvider)();
        if (!dynamicProvider) {
            vscode.window.showErrorMessage('Autocomplete provider not initialized');
            return;
        }
        const currentProfile = dynamicProvider.getCurrentProfile();
        if (!currentProfile) {
            vscode.window.showInformationMessage('No active profile. Please select a profile first.');
            return;
        }
        const confirm = yield vscode.window.showWarningMessage(`Clear all autocomplete data for profile '${currentProfile}'?`, 'Clear', 'Cancel');
        if (confirm !== 'Clear') {
            return;
        }
        try {
            yield dynamicProvider.clearProfileData(currentProfile);
            vscode.window.showInformationMessage(`Autocomplete data cleared for profile '${currentProfile}'`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to clear autocomplete data: ${error}`);
        }
    });
}
//# sourceMappingURL=viewAutocomplete.js.map
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
exports.fetchCustomFieldsCommand = fetchCustomFieldsCommand;
const vscode = require("vscode");
const customFields_1 = require("../api/customFields");
const authenticate_1 = require("./authenticate");
const extension_1 = require("../extension");
const outputWriter_1 = require("../outputWriter");
/**
 * Command to fetch custom fields and add to autocomplete
 */
function fetchCustomFieldsCommand(context) {
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
        const client = new customFields_1.CustomFieldsClient({
            accessId: credentials.accessId,
            accessKey: credentials.accessKey,
            endpoint: pm.getProfileEndpoint(activeProfile)
        });
        yield vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Fetching custom fields from Sumo Logic...',
            cancellable: false
        }, (progress) => __awaiter(this, void 0, void 0, function* () {
            const response = yield client.listCustomFields();
            if (response.error) {
                // Check if it's a permission error
                if (response.statusCode === 403 || response.statusCode === 401) {
                    vscode.window.showWarningMessage('Unable to fetch custom fields: Insufficient permissions. ' +
                        'Your user role may not have "Manage fields" capability.');
                }
                else {
                    vscode.window.showErrorMessage(`Failed to fetch custom fields: ${response.error}`);
                }
                return;
            }
            if (!response.data || !response.data.data) {
                vscode.window.showWarningMessage('No custom fields returned from API.');
                return;
            }
            const customFields = response.data.data;
            if (!Array.isArray(customFields) || customFields.length === 0) {
                vscode.window.showInformationMessage('No custom fields found in this organization.');
                return;
            }
            // Sort by fieldName ascending
            customFields.sort((a, b) => a.fieldName.localeCompare(b.fieldName));
            // Extract field names
            const fieldNames = customFields.map(f => f.fieldName);
            // Add to dynamic completion provider
            const dynamicProvider = (0, extension_1.getDynamicCompletionProvider)();
            if (dynamicProvider) {
                fieldNames.forEach(fieldName => {
                    dynamicProvider.addCustomField(fieldName);
                });
            }
            // Format as table
            const tableText = customFields_1.CustomFieldsClient.formatCustomFieldsAsTable(customFields);
            const outputText = `Sumo Logic Custom Fields (${activeProfile.name})\n` +
                `==========================================\n` +
                `Total: ${customFields.length} fields\n` +
                `\n` +
                tableText +
                `\n` +
                `\nℹ️ Custom field names have been added to autocomplete.`;
            // Write to file
            const outputWriter = new outputWriter_1.OutputWriter(context);
            const filename = `customfields_${activeProfile.name}`;
            try {
                yield outputWriter.writeAndOpen('customfields', filename, outputText, 'txt');
                vscode.window.showInformationMessage(`Found ${customFields.length} custom fields. Names added to autocomplete.`);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to write custom fields data: ${error}`);
            }
        }));
    });
}
//# sourceMappingURL=customFields.js.map
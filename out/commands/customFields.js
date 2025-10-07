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
            if (!response.data) {
                vscode.window.showWarningMessage('No custom fields returned from API.');
                return;
            }
            // Extract field names
            const fieldNames = customFields_1.CustomFieldsClient.extractFieldNames(response.data);
            if (fieldNames.length === 0) {
                vscode.window.showInformationMessage('No custom fields found in this organization.');
                return;
            }
            // Add to dynamic completion provider
            const dynamicProvider = (0, extension_1.getDynamicCompletionProvider)();
            if (dynamicProvider) {
                // Add each custom field to autocomplete
                fieldNames.forEach(fieldName => {
                    dynamicProvider.addCustomField(fieldName);
                });
                vscode.window.showInformationMessage(`Added ${fieldNames.length} custom fields to autocomplete: ${fieldNames.slice(0, 5).join(', ')}${fieldNames.length > 5 ? '...' : ''}`);
            }
        }));
    });
}
//# sourceMappingURL=customFields.js.map
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
exports.newSumoFileCommand = newSumoFileCommand;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
function newSumoFileCommand() {
    return __awaiter(this, void 0, void 0, function* () {
        // Get workspace folder
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            // No workspace - create untitled file
            const doc = yield vscode.workspace.openTextDocument({
                language: 'sumo',
                content: ''
            });
            yield vscode.window.showTextDocument(doc);
            return;
        }
        // Ask user for filename
        const fileName = yield vscode.window.showInputBox({
            prompt: 'Enter filename for new Sumo query file',
            placeHolder: 'query.sumo',
            validateInput: (value) => {
                if (!value) {
                    return 'Filename cannot be empty';
                }
                if (!value.endsWith('.sumo')) {
                    return 'Filename must end with .sumo';
                }
                return null;
            }
        });
        if (!fileName) {
            return; // User cancelled
        }
        // Determine target directory
        let targetDir;
        if (workspaceFolders.length === 1) {
            targetDir = workspaceFolders[0].uri.fsPath;
        }
        else {
            // Multiple workspace folders - ask user to pick one
            const folder = yield vscode.window.showWorkspaceFolderPick({
                placeHolder: 'Select workspace folder for new file'
            });
            if (!folder) {
                return; // User cancelled
            }
            targetDir = folder.uri.fsPath;
        }
        const filePath = path.join(targetDir, fileName);
        // Check if file already exists
        if (fs.existsSync(filePath)) {
            const overwrite = yield vscode.window.showWarningMessage(`File ${fileName} already exists. Overwrite?`, 'Yes', 'No');
            if (overwrite !== 'Yes') {
                return;
            }
        }
        // Create the file with empty content
        fs.writeFileSync(filePath, '', 'utf8');
        // Open the file
        const doc = yield vscode.workspace.openTextDocument(filePath);
        yield vscode.window.showTextDocument(doc);
    });
}
//# sourceMappingURL=newSumoFile.js.map
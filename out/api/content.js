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
exports.ContentClient = void 0;
const client_1 = require("./client");
/**
 * Client for Sumo Logic Content API
 * Endpoint: GET /api/v2/content/folders/personal
 * Docs: https://api.sumologic.com/docs/#operation/getPersonalFolder
 */
class ContentClient extends client_1.SumoLogicClient {
    /**
     * Get the user's personal folder
     */
    getPersonalFolder() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.makeRequest(ContentClient.PERSONAL_FOLDER_API, 'GET');
        });
    }
    /**
     * Get a folder by ID
     * Endpoint: GET /api/v2/content/folders/{id}
     * Docs: https://api.sumologic.com/docs/#operation/getFolder
     */
    getFolder(folderId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.makeRequest(`/api/v2/content/folders/${folderId}`, 'GET');
        });
    }
    /**
     * Format personal folder as a readable report
     */
    static formatPersonalFolder(folder) {
        let output = '';
        // Folder properties section
        output += 'Personal Folder Properties\n';
        output += '='.repeat(80) + '\n\n';
        output += `ID:          ${folder.id}\n`;
        output += `Name:        ${folder.name}\n`;
        output += `Parent ID:   ${folder.parentId}\n`;
        output += `Description: ${folder.description || '(none)'}\n`;
        output += `Item Type:   ${folder.itemType}\n`;
        output += `Created At:  ${folder.createdAt}\n`;
        output += `Modified At: ${folder.modifiedAt}\n`;
        output += '\n\n';
        // Children section
        output += `Personal Folder Contents (${folder.children.length} items)\n`;
        output += '='.repeat(80) + '\n\n';
        if (folder.children.length === 0) {
            output += '(empty)\n';
        }
        else {
            output += ContentClient.formatChildrenAsTable(folder.children);
        }
        return output;
    }
    /**
     * Format children as a table
     */
    static formatChildrenAsTable(children) {
        if (children.length === 0) {
            return '(no items)\n';
        }
        // Sort by name
        const sortedChildren = [...children].sort((a, b) => a.name.localeCompare(b.name));
        // Calculate column widths
        const nameWidth = Math.max(20, ...sortedChildren.map(c => c.name.length));
        const typeWidth = Math.max(10, ...sortedChildren.map(c => c.itemType.length));
        const idWidth = Math.max(20, ...sortedChildren.map(c => c.id.length));
        const descWidth = 30;
        // Create header
        let table = '';
        table += 'Name'.padEnd(nameWidth) + ' | ';
        table += 'Type'.padEnd(typeWidth) + ' | ';
        table += 'ID'.padEnd(idWidth) + ' | ';
        table += 'Description'.padEnd(descWidth) + ' | ';
        table += 'Modified At\n';
        table += '-'.repeat(nameWidth) + '-+-';
        table += '-'.repeat(typeWidth) + '-+-';
        table += '-'.repeat(idWidth) + '-+-';
        table += '-'.repeat(descWidth) + '-+-';
        table += '-'.repeat(20) + '\n';
        // Create rows
        sortedChildren.forEach(child => {
            const desc = (child.description || '').substring(0, 30);
            const modifiedAt = new Date(child.modifiedAt).toLocaleString();
            table += child.name.substring(0, nameWidth).padEnd(nameWidth) + ' | ';
            table += child.itemType.padEnd(typeWidth) + ' | ';
            table += child.id.padEnd(idWidth) + ' | ';
            table += desc.padEnd(descWidth) + ' | ';
            table += modifiedAt + '\n';
        });
        return table;
    }
}
exports.ContentClient = ContentClient;
ContentClient.PERSONAL_FOLDER_API = '/api/v2/content/folders/personal';
//# sourceMappingURL=content.js.map
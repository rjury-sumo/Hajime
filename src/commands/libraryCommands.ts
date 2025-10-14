import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager } from '../profileManager';
import { ContentClient } from '../api/content';
import { formatContentId, hexToDecimal } from '../utils/contentId';
import { LibraryCacheDB, createLibraryCacheDB } from '../database/libraryCache';
import { LibraryTreeItem } from '../views/libraryExplorer';

/**
 * Copy content ID (hex format) to clipboard
 */
export async function copyLibraryNodeIdCommand(treeItem: LibraryTreeItem): Promise<void> {
    await vscode.env.clipboard.writeText(treeItem.contentId);
    vscode.window.showInformationMessage(`Copied ID: ${treeItem.contentId}`);
}

/**
 * Copy content path to clipboard
 */
export async function copyLibraryNodePathCommand(
    context: vscode.ExtensionContext,
    treeItem: LibraryTreeItem
): Promise<void> {
    const profileManager = new ProfileManager(context);
    const profileDir = profileManager.getProfileDirectory(treeItem.profile);
    const db = createLibraryCacheDB(profileDir, treeItem.profile);

    try {
        const path = await buildContentPath(db, treeItem.contentId);
        await vscode.env.clipboard.writeText(path);
        vscode.window.showInformationMessage(`Copied path: ${path}`);
    } finally {
        db.close();
    }
}

/**
 * Build full path from root to item
 */
async function buildContentPath(db: LibraryCacheDB, contentId: string): Promise<string> {
    const pathParts: string[] = [];
    let currentId = contentId;

    // Walk up the tree to build path
    while (currentId && currentId !== '0000000000000000') {
        const item = db.getContentItem(currentId);
        if (!item) {
            break;
        }
        pathParts.unshift(item.name);
        currentId = item.parentId || '';
    }

    return '/' + pathParts.join('/');
}

/**
 * Open library node in Sumo Logic web UI
 */
export async function openLibraryNodeInWebCommand(
    context: vscode.ExtensionContext,
    treeItem: LibraryTreeItem
): Promise<void> {
    const profileManager = new ProfileManager(context);
    const profiles = await profileManager.getProfiles();
    const profile = profiles.find(p => p.name === treeItem.profile);

    if (!profile) {
        vscode.window.showErrorMessage(`Profile not found: ${treeItem.profile}`);
        return;
    }

    // Convert hex ID to decimal for web UI
    const decimalId = hexToDecimal(treeItem.contentId);

    // Get instance name
    const instanceName = await profileManager.getInstanceName(profile);

    // Construct library URL
    const url = `https://${instanceName}/library/${decimalId}`;

    // Open in browser
    vscode.env.openExternal(vscode.Uri.parse(url));
}

/**
 * Refresh library node (re-fetch from API)
 */
export async function refreshLibraryNodeCommand(
    context: vscode.ExtensionContext,
    treeItem: LibraryTreeItem
): Promise<void> {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Refreshing ${treeItem.label}...`,
        cancellable: false
    }, async () => {
        const result = await fetchAndUpdateNode(context, treeItem);

        if (result.success) {
            vscode.window.showInformationMessage(`Refreshed: ${treeItem.label}`);
            // Trigger tree refresh
            vscode.commands.executeCommand('sumologic.refreshExplorer');
        } else {
            vscode.window.showErrorMessage(`Failed to refresh: ${result.error}`);
        }
    });
}

/**
 * Fetch node from API and update cache
 */
async function fetchAndUpdateNode(
    context: vscode.ExtensionContext,
    treeItem: LibraryTreeItem
): Promise<{ success: boolean; error?: string }> {
    const profileManager = new ProfileManager(context);

    // Get profile
    const profiles = await profileManager.getProfiles();
    const profile = profiles.find(p => p.name === treeItem.profile);
    if (!profile) {
        return { success: false, error: `Profile not found: ${treeItem.profile}` };
    }

    // Get credentials
    const credentials = await profileManager.getProfileCredentials(treeItem.profile);
    if (!credentials) {
        return { success: false, error: `No credentials for profile: ${treeItem.profile}` };
    }

    // Create client
    const client = new ContentClient({
        accessId: credentials.accessId,
        accessKey: credentials.accessKey,
        endpoint: profileManager.getProfileEndpoint(profile)
    });

    // Get database
    const profileDir = profileManager.getProfileDirectory(treeItem.profile);
    const db = createLibraryCacheDB(profileDir, treeItem.profile);

    try {
        // Fetch based on item type
        if (treeItem.itemType === 'Folder') {
            const response = await client.getFolder(treeItem.contentId);
            if (response.error || !response.data) {
                return { success: false, error: response.error || 'Unknown error' };
            }

            // Update database
            const folder = response.data;
            const now = new Date().toISOString();

            db.upsertContentItem({
                id: folder.id,
                profile: treeItem.profile,
                name: folder.name,
                itemType: folder.itemType,
                parentId: folder.parentId,
                description: folder.description,
                createdAt: folder.createdAt,
                createdBy: folder.createdBy,
                modifiedAt: folder.modifiedAt,
                modifiedBy: folder.modifiedBy,
                hasChildren: folder.children && folder.children.length > 0,
                childrenFetched: true,
                permissions: folder.permissions,
                lastFetched: now
            });

            // Update children
            if (folder.children) {
                const children = folder.children.map((child: any) => ({
                    id: child.id,
                    profile: treeItem.profile,
                    name: child.name,
                    itemType: child.itemType,
                    parentId: folder.id,
                    description: child.description,
                    createdAt: child.createdAt,
                    createdBy: child.createdBy,
                    modifiedAt: child.modifiedAt,
                    modifiedBy: child.modifiedBy,
                    hasChildren: child.itemType === 'Folder' || (child.children && child.children.length > 0),
                    childrenFetched: false,
                    permissions: child.permissions,
                    lastFetched: now
                }));
                db.upsertContentItems(children);
            }

            // Save JSON
            const contentDir = profileManager.getProfileLibraryContentDirectory(treeItem.profile);
            if (!fs.existsSync(contentDir)) {
                fs.mkdirSync(contentDir, { recursive: true });
            }
            const filePath = path.join(contentDir, `${folder.id}.json`);
            fs.writeFileSync(filePath, JSON.stringify(folder, null, 2), 'utf-8');
        } else {
            // Non-folder: export content
            const response = await client.exportContent(treeItem.contentId);
            if (response.error || !response.data) {
                return { success: false, error: response.error || 'Unknown error' };
            }

            // Save JSON
            const contentDir = profileManager.getProfileLibraryContentDirectory(treeItem.profile);
            if (!fs.existsSync(contentDir)) {
                fs.mkdirSync(contentDir, { recursive: true });
            }
            const filePath = path.join(contentDir, `${treeItem.contentId}.json`);
            fs.writeFileSync(filePath, JSON.stringify(response.data, null, 2), 'utf-8');

            // Update database timestamp
            const item = db.getContentItem(treeItem.contentId);
            if (item) {
                item.lastFetched = new Date().toISOString();
                db.upsertContentItem(item);
            }
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    } finally {
        db.close();
    }
}

/**
 * View library node details in Quick Pick
 */
export async function viewLibraryNodeDetailsCommand(
    context: vscode.ExtensionContext,
    treeItem: LibraryTreeItem
): Promise<void> {
    const profileManager = new ProfileManager(context);
    const profileDir = profileManager.getProfileDirectory(treeItem.profile);
    const db = createLibraryCacheDB(profileDir, treeItem.profile);

    try {
        const item = db.getContentItem(treeItem.contentId);
        if (!item) {
            vscode.window.showWarningMessage('Content details not available in cache');
            return;
        }

        const formattedId = formatContentId(item.id);
        const path = await buildContentPath(db, item.id);

        // Build details array
        const details: string[] = [
            `Name: ${item.name}`,
            `Type: ${item.itemType}`,
            `ID: ${formattedId}`,
            `Path: ${path}`,
            `Profile: ${item.profile}`
        ];

        if (item.description) {
            details.push(`Description: ${item.description}`);
        }

        if (item.createdAt) {
            details.push(`Created: ${new Date(item.createdAt).toLocaleString()}`);
        }

        if (item.createdBy) {
            details.push(`Created By: ${item.createdBy}`);
        }

        if (item.modifiedAt) {
            details.push(`Modified: ${new Date(item.modifiedAt).toLocaleString()}`);
        }

        if (item.modifiedBy) {
            details.push(`Modified By: ${item.modifiedBy}`);
        }

        if (item.hasChildren) {
            const children = db.getChildren(item.id);
            details.push(`Children: ${children.length} items`);
        }

        details.push(`Last Fetched: ${new Date(item.lastFetched).toLocaleString()}`);

        // Show in Quick Pick
        const selected = await vscode.window.showQuickPick(details, {
            title: `📚 ${item.name}`,
            placeHolder: 'Content details (press ESC to close)'
        });

        // If user selected a line, copy it to clipboard
        if (selected) {
            await vscode.env.clipboard.writeText(selected);
            vscode.window.showInformationMessage(`Copied: ${selected}`);
        }
    } finally {
        db.close();
    }
}

/**
 * Open library node JSON in editor
 */
export async function openLibraryNodeJsonCommand(
    context: vscode.ExtensionContext,
    treeItem: LibraryTreeItem
): Promise<void> {
    const profileManager = new ProfileManager(context);
    const contentDir = profileManager.getProfileLibraryContentDirectory(treeItem.profile);
    const filePath = path.join(contentDir, `${treeItem.contentId}.json`);

    // Check if cached
    if (!fs.existsSync(filePath)) {
        const answer = await vscode.window.showInformationMessage(
            'Content not yet cached. Fetch it now?',
            'Yes', 'No'
        );

        if (answer !== 'Yes') {
            return;
        }

        // Fetch content
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Fetching ${treeItem.label}...`,
            cancellable: false
        }, async () => {
            return await fetchAndUpdateNode(context, treeItem);
        });

        if (!result.success) {
            vscode.window.showErrorMessage(`Failed to fetch content: ${result.error}`);
            return;
        }
    }

    // Open in editor
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc, { preview: false });
}

/**
 * Export library node to file
 */
export async function exportLibraryNodeToFileCommand(
    context: vscode.ExtensionContext,
    treeItem: LibraryTreeItem
): Promise<void> {
    // Ask user for export format
    const format = await vscode.window.showQuickPick(['JSON', 'Markdown', 'Both'], {
        title: 'Select export format',
        placeHolder: 'Choose format for export'
    });

    if (!format) {
        return;
    }

    // Ask for save location
    const defaultName = `${treeItem.label.replace(/[^a-z0-9]/gi, '_')}`;
    const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultName),
        filters: format === 'JSON'
            ? { 'JSON': ['json'] }
            : format === 'Markdown'
            ? { 'Markdown': ['md'] }
            : { 'All': ['json', 'md'] }
    });

    if (!saveUri) {
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Exporting ${treeItem.label}...`,
        cancellable: false
    }, async () => {
        const profileManager = new ProfileManager(context);
        const contentDir = profileManager.getProfileLibraryContentDirectory(treeItem.profile);
        const filePath = path.join(contentDir, `${treeItem.contentId}.json`);

        // Ensure content is cached
        if (!fs.existsSync(filePath)) {
            const result = await fetchAndUpdateNode(context, treeItem);
            if (!result.success) {
                vscode.window.showErrorMessage(`Failed to fetch content: ${result.error}`);
                return;
            }
        }

        // Read content
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Export based on format
        if (format === 'JSON' || format === 'Both') {
            const jsonPath = format === 'Both'
                ? saveUri.fsPath.replace(/\.[^.]+$/, '.json')
                : saveUri.fsPath;
            fs.writeFileSync(jsonPath, JSON.stringify(content, null, 2), 'utf-8');
        }

        if (format === 'Markdown' || format === 'Both') {
            const mdPath = format === 'Both'
                ? saveUri.fsPath.replace(/\.[^.]+$/, '.md')
                : saveUri.fsPath;
            const markdown = generateMarkdown(content, treeItem);
            fs.writeFileSync(mdPath, markdown, 'utf-8');
        }

        vscode.window.showInformationMessage(`Exported: ${treeItem.label}`);
    });
}

/**
 * Generate markdown representation of content
 */
function generateMarkdown(content: any, treeItem: LibraryTreeItem): string {
    const lines: string[] = [];

    lines.push(`# ${content.name || treeItem.label}`);
    lines.push('');

    if (content.description) {
        lines.push(`**Description:** ${content.description}`);
        lines.push('');
    }

    lines.push('## Details');
    lines.push('');
    lines.push(`- **Type:** ${content.itemType}`);
    lines.push(`- **ID:** ${formatContentId(content.id || treeItem.contentId)}`);

    if (content.createdAt) {
        lines.push(`- **Created:** ${new Date(content.createdAt).toLocaleString()}`);
    }

    if (content.createdBy) {
        lines.push(`- **Created By:** ${content.createdBy}`);
    }

    if (content.modifiedAt) {
        lines.push(`- **Modified:** ${new Date(content.modifiedAt).toLocaleString()}`);
    }

    if (content.modifiedBy) {
        lines.push(`- **Modified By:** ${content.modifiedBy}`);
    }

    lines.push('');

    // Add children if present
    if (content.children && content.children.length > 0) {
        lines.push('## Children');
        lines.push('');
        for (const child of content.children) {
            lines.push(`- **${child.name}** (${child.itemType})`);
        }
        lines.push('');
    }

    // Add search query if present
    if (content.search && content.search.queryText) {
        lines.push('## Query');
        lines.push('');
        lines.push('```');
        lines.push(content.search.queryText);
        lines.push('```');
        lines.push('');
    }

    return lines.join('\n');
}

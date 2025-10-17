import * as vscode from 'vscode';
import { ProfileManager } from '../profileManager';
import { createScopesCacheDB, Scope } from '../database/scopesCache';

/**
 * Create a new scope
 */
export async function createScope(context: vscode.ExtensionContext): Promise<void> {
    const profileManager = new ProfileManager(context);
    const activeProfile = await profileManager.getActiveProfile();

    if (!activeProfile) {
        vscode.window.showErrorMessage('No active profile. Please select or create a profile first.');
        return;
    }

    // Prompt for scope properties
    const name = await vscode.window.showInputBox({
        prompt: 'Enter scope name',
        placeHolder: 'e.g., Production App Logs',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Scope name is required';
            }
            return null;
        }
    });

    if (!name) {
        return;
    }

    const searchScope = await vscode.window.showInputBox({
        prompt: 'Enter search scope query',
        placeHolder: 'e.g., _sourceCategory=prod/application',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Search scope is required';
            }
            return null;
        }
    });

    if (!searchScope) {
        return;
    }

    const description = await vscode.window.showInputBox({
        prompt: 'Enter scope description (optional)',
        placeHolder: 'e.g., Production application logs for troubleshooting'
    });

    const context_text = await vscode.window.showInputBox({
        prompt: 'Enter scope context and use cases (optional)',
        placeHolder: 'e.g., Used for analyzing application errors and performance issues'
    });

    // Ask which profiles this scope applies to
    const profilesInput = await vscode.window.showInputBox({
        prompt: 'Which profiles should this scope apply to?',
        placeHolder: '* for all profiles, or comma-separated profile names',
        value: '*',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Profile list is required (* for all)';
            }
            return null;
        }
    });

    if (!profilesInput) {
        return;
    }

    // Create scope in database
    const storageRoot = profileManager.getStorageRoot();
    const db = createScopesCacheDB(storageRoot, activeProfile.name);

    try {
        const newScope = db.createScope({
            profile: activeProfile.name,
            profiles: profilesInput.trim(),
            name: name.trim(),
            searchScope: searchScope.trim(),
            description: description?.trim(),
            context: context_text?.trim()
        });

        vscode.window.showInformationMessage(`Scope "${newScope.name}" created successfully`);

        // Refresh explorer
        vscode.commands.executeCommand('sumologic.refreshExplorer');

        // Open the scope webview
        vscode.commands.executeCommand('sumologic.viewScope', newScope.id, activeProfile.name);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create scope: ${error}`);
    } finally {
        db.close();
    }
}

/**
 * Edit an existing scope
 */
export async function editScope(
    context: vscode.ExtensionContext,
    scopeId: string,
    profileName: string
): Promise<void> {
    const profileManager = new ProfileManager(context);
    const storageRoot = profileManager.getStorageRoot();
    const db = createScopesCacheDB(storageRoot, profileName);

    try {
        const scope = db.getScopeById(scopeId);
        if (!scope) {
            vscode.window.showErrorMessage('Scope not found');
            return;
        }

        // Prompt for updated properties
        const name = await vscode.window.showInputBox({
            prompt: 'Enter scope name',
            value: scope.name,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Scope name is required';
                }
                return null;
            }
        });

        if (!name) {
            return;
        }

        const searchScope = await vscode.window.showInputBox({
            prompt: 'Enter search scope query',
            value: scope.searchScope,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Search scope is required';
                }
                return null;
            }
        });

        if (!searchScope) {
            return;
        }

        const description = await vscode.window.showInputBox({
            prompt: 'Enter scope description (optional)',
            value: scope.description || ''
        });

        const context_text = await vscode.window.showInputBox({
            prompt: 'Enter scope context and use cases (optional)',
            value: scope.context || ''
        });

        // Ask which profiles this scope applies to
        const profilesInput = await vscode.window.showInputBox({
            prompt: 'Which profiles should this scope apply to?',
            placeHolder: '* for all profiles, or comma-separated profile names',
            value: scope.profiles || '*',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Profile list is required (* for all)';
                }
                return null;
            }
        });

        if (!profilesInput) {
            return;
        }

        // Update scope
        const updated = db.updateScope(scopeId, {
            profiles: profilesInput.trim(),
            name: name.trim(),
            searchScope: searchScope.trim(),
            description: description?.trim(),
            context: context_text?.trim()
        });

        if (updated) {
            vscode.window.showInformationMessage(`Scope "${name}" updated successfully`);
            vscode.commands.executeCommand('sumologic.refreshExplorer');
            vscode.commands.executeCommand('sumologic.viewScope', scopeId, profileName);
        } else {
            vscode.window.showErrorMessage('Failed to update scope');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to edit scope: ${error}`);
    } finally {
        db.close();
    }
}

/**
 * Delete a scope
 */
export async function deleteScope(
    context: vscode.ExtensionContext,
    scopeId: string,
    profileName: string
): Promise<void> {
    const profileManager = new ProfileManager(context);
    const storageRoot = profileManager.getStorageRoot();
    const db = createScopesCacheDB(storageRoot, profileName);

    try {
        const scope = db.getScopeById(scopeId);
        if (!scope) {
            vscode.window.showErrorMessage('Scope not found');
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Delete scope "${scope.name}"?`,
            { modal: true },
            'Delete'
        );

        if (confirm === 'Delete') {
            const deleted = db.deleteScope(scopeId);
            if (deleted) {
                vscode.window.showInformationMessage(`Scope "${scope.name}" deleted`);
                vscode.commands.executeCommand('sumologic.refreshExplorer');
            } else {
                vscode.window.showErrorMessage('Failed to delete scope');
            }
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete scope: ${error}`);
    } finally {
        db.close();
    }
}

/**
 * List all scopes for active profile
 */
export async function listScopes(context: vscode.ExtensionContext): Promise<void> {
    const profileManager = new ProfileManager(context);
    const activeProfile = await profileManager.getActiveProfile();

    if (!activeProfile) {
        vscode.window.showErrorMessage('No active profile. Please select or create a profile first.');
        return;
    }

    const storageRoot = profileManager.getStorageRoot();
    const db = createScopesCacheDB(storageRoot, activeProfile.name);

    try {
        const scopes = db.getAllScopes();

        if (scopes.length === 0) {
            vscode.window.showInformationMessage('No scopes defined for this profile');
            return;
        }

        const items = scopes.map(scope => ({
            label: scope.name,
            description: scope.searchScope,
            detail: scope.description,
            scope
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a scope to view'
        });

        if (selected) {
            vscode.commands.executeCommand('sumologic.viewScope', selected.scope.id, activeProfile.name);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to list scopes: ${error}`);
    } finally {
        db.close();
    }
}

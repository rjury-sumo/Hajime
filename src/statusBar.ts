import * as vscode from 'vscode';
import { ProfileManager } from './profileManager';

/**
 * Status bar manager for showing active Sumo Logic profile
 */
export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private profileManager: ProfileManager;

    constructor(context: vscode.ExtensionContext) {
        this.profileManager = new ProfileManager(context);

        // Create status bar item (right side, priority 100)
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );

        this.statusBarItem.command = 'sumologic.switchProfile';
        this.statusBarItem.tooltip = 'Click to switch Sumo Logic profile';

        context.subscriptions.push(this.statusBarItem);

        // Update immediately and watch for configuration changes
        this.updateStatusBar();
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('sumologic')) {
                    this.updateStatusBar();
                }
            })
        );
    }

    /**
     * Update the status bar text with the active profile
     */
    async updateStatusBar(): Promise<void> {
        const activeProfile = await this.profileManager.getActiveProfile();

        if (activeProfile) {
            this.statusBarItem.text = `$(database) ${activeProfile.name}`;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    /**
     * Manually refresh the status bar
     */
    async refresh(): Promise<void> {
        await this.updateStatusBar();
    }
}

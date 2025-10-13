import * as vscode from 'vscode';
import { ProfileManager } from './profileManager';

/**
 * Status bar manager for showing active Sumo Logic profile with connection status
 */
export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private connectionStatusItem: vscode.StatusBarItem;
    private profileManager: ProfileManager;
    private connectionStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
    private lastQueryTime?: Date;

    constructor(context: vscode.ExtensionContext) {
        this.profileManager = new ProfileManager(context);

        // Create profile status bar item (right side, priority 100)
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );

        this.statusBarItem.command = 'sumologic.switchProfile';
        this.statusBarItem.tooltip = 'Click to switch Sumo Logic profile';

        // Create connection status item (right side, priority 101)
        this.connectionStatusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            101
        );

        this.connectionStatusItem.command = 'sumologic.testConnection';
        this.connectionStatusItem.tooltip = 'Click to test connection';

        context.subscriptions.push(this.statusBarItem);
        context.subscriptions.push(this.connectionStatusItem);

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
     * Update the status bar text with the active profile and connection status
     */
    async updateStatusBar(): Promise<void> {
        const activeProfile = await this.profileManager.getActiveProfile();

        if (activeProfile) {
            // Update profile item
            this.statusBarItem.text = `$(database) ${activeProfile.name}`;

            // Build detailed tooltip
            const tooltipLines = [
                `Active Profile: ${activeProfile.name}`,
                `Region: ${activeProfile.region || activeProfile.endpoint || 'unknown'}`,
                '',
                'Click to switch profile'
            ];

            if (this.lastQueryTime) {
                tooltipLines.splice(2, 0, `Last Query: ${this.lastQueryTime.toLocaleString()}`);
            }

            this.statusBarItem.tooltip = tooltipLines.join('\n');
            this.statusBarItem.show();

            // Update connection status item
            this.updateConnectionStatus();
        } else {
            this.statusBarItem.hide();
            this.connectionStatusItem.hide();
        }
    }

    /**
     * Update connection status indicator
     */
    private updateConnectionStatus(): void {
        let icon: string;
        let text: string;
        let tooltip: string;

        switch (this.connectionStatus) {
            case 'connected':
                icon = '$(check)';
                text = 'Connected';
                tooltip = 'Connection verified\nClick to test connection';
                break;
            case 'disconnected':
                icon = '$(error)';
                text = 'Disconnected';
                tooltip = 'Connection failed\nClick to test connection';
                break;
            default:
                icon = '$(question)';
                text = '';
                tooltip = 'Connection status unknown\nClick to test connection';
                break;
        }

        this.connectionStatusItem.text = this.connectionStatus === 'unknown' ? icon : `${icon} ${text}`;
        this.connectionStatusItem.tooltip = tooltip;
        this.connectionStatusItem.show();
    }

    /**
     * Set connection status
     */
    setConnectionStatus(status: 'connected' | 'disconnected' | 'unknown'): void {
        this.connectionStatus = status;
        this.updateConnectionStatus();
    }

    /**
     * Update last query execution time
     */
    setLastQueryTime(time: Date): void {
        this.lastQueryTime = time;
        this.updateStatusBar();
    }

    /**
     * Manually refresh the status bar
     */
    async refresh(): Promise<void> {
        await this.updateStatusBar();
    }
}

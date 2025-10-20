import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProfileManager } from '../profileManager';
import { AccountClient } from '../api/account';

/**
 * Panel provider for viewing and managing Account
 */
export class AccountWebviewProvider {
    private static currentPanel?: vscode.WebviewPanel;
    private static profileManager?: ProfileManager;
    private static currentProfileName?: string;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) {
        AccountWebviewProvider.profileManager = new ProfileManager(context);
    }

    /**
     * Show the account viewer panel
     */
    public async show(profileName?: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (AccountWebviewProvider.currentPanel) {
            AccountWebviewProvider.currentPanel.reveal(column);
            if (profileName) {
                await AccountWebviewProvider.loadProfileData(profileName);
            }
            return;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'accountViewer',
            'Account Management',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this._extensionUri]
            }
        );

        AccountWebviewProvider.currentPanel = panel;

        panel.webview.html = AccountWebviewProvider.getHtmlForWebview(panel.webview);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'loadProfile':
                    await AccountWebviewProvider.loadProfileData(data.profileName);
                    break;
                case 'fetchAccountOwner':
                    await AccountWebviewProvider.fetchAccountOwner();
                    break;
                case 'fetchAccountStatus':
                    await AccountWebviewProvider.fetchAccountStatus();
                    break;
                case 'fetchSubdomain':
                    await AccountWebviewProvider.fetchSubdomain();
                    break;
                case 'fetchUsageForecast':
                    await AccountWebviewProvider.fetchUsageForecast(data.numberOfDays);
                    break;
                case 'generateCreditsUsageReport':
                    await AccountWebviewProvider.generateCreditsUsageReport(data.groupBy, data.reportType, data.includeDeploymentCharge);
                    break;
                case 'loadData':
                    await AccountWebviewProvider.loadAccountData();
                    break;
            }
        });

        // Clean up when panel is closed
        panel.onDidDispose(() => {
            AccountWebviewProvider.currentPanel = undefined;
        });

        // Load profile data
        if (profileName) {
            await AccountWebviewProvider.loadProfileData(profileName);
        } else {
            await AccountWebviewProvider.loadActiveProfile();
        }
    }

    /**
     * Load data for active profile
     */
    private static async loadActiveProfile() {
        if (!AccountWebviewProvider.profileManager) {
            return;
        }
        const activeProfile = await AccountWebviewProvider.profileManager.getActiveProfile();
        if (activeProfile) {
            await AccountWebviewProvider.loadProfileData(activeProfile.name);
        }
    }

    /**
     * Load profile data and send to webview
     */
    private static async loadProfileData(profileName: string) {
        if (!profileName || !AccountWebviewProvider.profileManager) {
            return;
        }

        AccountWebviewProvider.currentProfileName = profileName;

        // Get profile details
        const profiles = await AccountWebviewProvider.profileManager.getProfiles();
        const profile = profiles.find(p => p.name === profileName);

        if (!profile) {
            vscode.window.showErrorMessage(`Profile "${profileName}" not found`);
            return;
        }

        // Send profile data to webview
        if (AccountWebviewProvider.currentPanel) {
            AccountWebviewProvider.currentPanel.webview.postMessage({
                type: 'profileLoaded',
                profileName: profileName,
                region: profile.region
            });

            // Load existing account data
            await AccountWebviewProvider.loadAccountData();
        }
    }

    /**
     * Load existing account data from files
     */
    private static async loadAccountData() {
        if (!AccountWebviewProvider.currentProfileName || !AccountWebviewProvider.profileManager) {
            return;
        }

        const accountDir = AccountWebviewProvider.getAccountDirectory();
        if (!fs.existsSync(accountDir)) {
            return;
        }

        const data: any = {};

        // Load each account data file if it exists
        const files = ['accountOwner.json', 'accountStatus.json', 'subdomain.json', 'usageForecast.json'];
        for (const file of files) {
            const filePath = path.join(accountDir, file);
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const key = file.replace('.json', '');
                    data[key] = JSON.parse(content);
                } catch (error) {
                    console.error(`Error reading ${file}:`, error);
                }
            }
        }

        // Send data to webview
        if (AccountWebviewProvider.currentPanel) {
            AccountWebviewProvider.currentPanel.webview.postMessage({
                type: 'accountDataLoaded',
                data: data
            });
        }
    }

    /**
     * Get account directory for current profile
     */
    private static getAccountDirectory(): string {
        if (!AccountWebviewProvider.profileManager || !AccountWebviewProvider.currentProfileName) {
            return '';
        }
        const profileDir = AccountWebviewProvider.profileManager.getProfileDirectory(AccountWebviewProvider.currentProfileName);
        const accountDir = path.join(profileDir, 'account');

        // Ensure directory exists
        if (!fs.existsSync(accountDir)) {
            fs.mkdirSync(accountDir, { recursive: true });
        }

        return accountDir;
    }

    /**
     * Fetch account owner
     */
    private static async fetchAccountOwner() {
        if (!AccountWebviewProvider.currentProfileName || !AccountWebviewProvider.profileManager) {
            return;
        }

        try {
            // Get profile metadata
            const profiles = await AccountWebviewProvider.profileManager.getProfiles();
            const profile = profiles.find(p => p.name === AccountWebviewProvider.currentProfileName);
            if (!profile) {
                throw new Error('Profile not found');
            }

            // Get credentials
            const credentials = await AccountWebviewProvider.profileManager.getProfileCredentials(AccountWebviewProvider.currentProfileName);
            if (!credentials) {
                throw new Error('Profile credentials not found');
            }

            const client = new AccountClient({
                accessId: credentials.accessId,
                accessKey: credentials.accessKey,
                endpoint: profile.region
            });
            const result = await client.getAccountOwner();

            if (result.error) {
                throw new Error(result.error);
            }

            const response = result.data;

            // Save to file
            const accountDir = AccountWebviewProvider.getAccountDirectory();
            const filePath = path.join(accountDir, 'accountOwner.json');
            fs.writeFileSync(filePath, JSON.stringify(response, null, 2));

            // Reload data
            await AccountWebviewProvider.loadAccountData();

            vscode.window.showInformationMessage('Account owner data fetched successfully');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to fetch account owner: ${error.message}`);
        }
    }

    /**
     * Fetch account status
     */
    private static async fetchAccountStatus() {
        if (!AccountWebviewProvider.currentProfileName || !AccountWebviewProvider.profileManager) {
            return;
        }

        try {
            // Get profile metadata
            const profiles = await AccountWebviewProvider.profileManager.getProfiles();
            const profile = profiles.find(p => p.name === AccountWebviewProvider.currentProfileName);
            if (!profile) {
                throw new Error('Profile not found');
            }

            // Get credentials
            const credentials = await AccountWebviewProvider.profileManager.getProfileCredentials(AccountWebviewProvider.currentProfileName);
            if (!credentials) {
                throw new Error('Profile credentials not found');
            }

            const client = new AccountClient({
                accessId: credentials.accessId,
                accessKey: credentials.accessKey,
                endpoint: profile.region
            });
            const result = await client.getAccountStatus();

            if (result.error) {
                throw new Error(result.error);
            }

            const response = result.data;

            // Save to file
            const accountDir = AccountWebviewProvider.getAccountDirectory();
            const filePath = path.join(accountDir, 'accountStatus.json');
            fs.writeFileSync(filePath, JSON.stringify(response, null, 2));

            // Reload data
            await AccountWebviewProvider.loadAccountData();

            vscode.window.showInformationMessage('Account status data fetched successfully');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to fetch account status: ${error.message}`);
        }
    }

    /**
     * Fetch subdomain
     */
    private static async fetchSubdomain() {
        if (!AccountWebviewProvider.currentProfileName || !AccountWebviewProvider.profileManager) {
            return;
        }

        try {
            // Get profile metadata
            const profiles = await AccountWebviewProvider.profileManager.getProfiles();
            const profile = profiles.find(p => p.name === AccountWebviewProvider.currentProfileName);
            if (!profile) {
                throw new Error('Profile not found');
            }

            // Get credentials
            const credentials = await AccountWebviewProvider.profileManager.getProfileCredentials(AccountWebviewProvider.currentProfileName);
            if (!credentials) {
                throw new Error('Profile credentials not found');
            }

            const client = new AccountClient({
                accessId: credentials.accessId,
                accessKey: credentials.accessKey,
                endpoint: profile.region
            });
            const result = await client.getSubdomain();

            if (result.error) {
                throw new Error(result.error);
            }

            const response = result.data;

            // Save to file
            const accountDir = AccountWebviewProvider.getAccountDirectory();
            const filePath = path.join(accountDir, 'subdomain.json');
            fs.writeFileSync(filePath, JSON.stringify(response, null, 2));

            // Reload data
            await AccountWebviewProvider.loadAccountData();

            vscode.window.showInformationMessage('Subdomain data fetched successfully');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to fetch subdomain: ${error.message}`);
        }
    }

    /**
     * Fetch usage forecast
     */
    private static async fetchUsageForecast(numberOfDays: number) {
        if (!AccountWebviewProvider.currentProfileName || !AccountWebviewProvider.profileManager) {
            return;
        }

        try {
            // Get profile metadata
            const profiles = await AccountWebviewProvider.profileManager.getProfiles();
            const profile = profiles.find(p => p.name === AccountWebviewProvider.currentProfileName);
            if (!profile) {
                throw new Error('Profile not found');
            }

            // Get credentials
            const credentials = await AccountWebviewProvider.profileManager.getProfileCredentials(AccountWebviewProvider.currentProfileName);
            if (!credentials) {
                throw new Error('Profile credentials not found');
            }

            const client = new AccountClient({
                accessId: credentials.accessId,
                accessKey: credentials.accessKey,
                endpoint: profile.region
            });
            const result = await client.getUsageForecast(numberOfDays);

            if (result.error) {
                throw new Error(result.error);
            }

            const response = result.data;

            // Save to file
            const accountDir = AccountWebviewProvider.getAccountDirectory();
            const filePath = path.join(accountDir, 'usageForecast.json');
            fs.writeFileSync(filePath, JSON.stringify(response, null, 2));

            // Reload data
            await AccountWebviewProvider.loadAccountData();

            vscode.window.showInformationMessage(`Usage forecast (${numberOfDays} days) fetched successfully`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to fetch usage forecast: ${error.message}`);
        }
    }

    /**
     * Generate credits usage report
     */
    private static async generateCreditsUsageReport(groupBy: string, reportType: string, includeDeploymentCharge: boolean) {
        if (!AccountWebviewProvider.currentProfileName || !AccountWebviewProvider.profileManager) {
            return;
        }

        try {
            // Get profile metadata
            const profiles = await AccountWebviewProvider.profileManager.getProfiles();
            const profile = profiles.find(p => p.name === AccountWebviewProvider.currentProfileName);
            if (!profile) {
                throw new Error('Profile not found');
            }

            // Get credentials
            const credentials = await AccountWebviewProvider.profileManager.getProfileCredentials(AccountWebviewProvider.currentProfileName);
            if (!credentials) {
                throw new Error('Profile credentials not found');
            }

            const client = new AccountClient({
                accessId: credentials.accessId,
                accessKey: credentials.accessKey,
                endpoint: profile.region
            });

            // Start the export job
            const jobResult = await client.generateUsageReport(
                groupBy as 'day' | 'week' | 'month',
                reportType as 'standard' | 'detailed' | 'childDetailed',
                includeDeploymentCharge
            );

            if (jobResult.error) {
                throw new Error(`API Error: ${jobResult.error}`);
            }

            if (!jobResult.data) {
                throw new Error('No data in response');
            }

            const jobId = jobResult.data.jobId;

            if (!jobId) {
                throw new Error('Job ID missing from API response');
            }

            vscode.window.showInformationMessage(`Credits usage report job started (ID: ${jobId}). Polling for completion...`);

            // Poll for job completion
            let completed = false;
            let downloadUrl: string | undefined;

            while (!completed) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls

                const statusResult = await client.getUsageReportStatus(jobId);

                if (statusResult.error || !statusResult.data) {
                    throw new Error(statusResult.error || 'Failed to get job status');
                }

                if (statusResult.data.status === 'Success') {
                    completed = true;
                    downloadUrl = statusResult.data.reportDownloadURL;
                } else if (statusResult.data.status === 'Failed') {
                    throw new Error('Usage report job failed');
                }
            }

            // Download the report
            if (!downloadUrl) {
                throw new Error('No download URL in response');
            }

            // Prompt user for save location
            const defaultUsageDir = path.join(AccountWebviewProvider.getAccountDirectory(), '..', 'usage');
            if (!fs.existsSync(defaultUsageDir)) {
                fs.mkdirSync(defaultUsageDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
            const defaultFilename = `usage_${timestamp}.csv`;
            const defaultUri = vscode.Uri.file(path.join(defaultUsageDir, defaultFilename));

            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: defaultUri,
                filters: {
                    'CSV Files': ['csv'],
                    'All Files': ['*']
                }
            });

            if (!saveUri) {
                vscode.window.showInformationMessage('Save cancelled');
                return;
            }

            // Download the file
            const reportData = await client.downloadUsageReport(downloadUrl);
            fs.writeFileSync(saveUri.fsPath, reportData);

            vscode.window.showInformationMessage(`Credits usage report saved to ${saveUri.fsPath}`);

            // Open the file
            const doc = await vscode.workspace.openTextDocument(saveUri);
            await vscode.window.showTextDocument(doc);

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to generate credits usage report: ${error.message}`);
        }
    }

    /**
     * Get HTML for webview
     */
    private static getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Management</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        h1 {
            color: var(--vscode-foreground);
            margin-bottom: 10px;
        }
        .profile-info {
            padding: 10px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .section {
            margin-bottom: 30px;
            padding: 15px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
        }
        .section h2 {
            margin-top: 0;
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 2px;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .controls {
            margin-bottom: 15px;
        }
        .data-display {
            background: var(--vscode-editor-background);
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 400px;
            overflow-y: auto;
        }
        .input-group {
            margin-bottom: 10px;
        }
        label {
            display: inline-block;
            width: 200px;
            margin-right: 10px;
        }
        input[type="number"], select {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 8px;
            border-radius: 2px;
        }
        input[type="checkbox"] {
            margin-left: 210px;
        }
        .button-group {
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <h1>Account Management</h1>
    <div class="profile-info">
        <strong>Profile:</strong> <span id="profileName">-</span> |
        <strong>Region:</strong> <span id="region">-</span>
    </div>

    <div class="section">
        <h2>Account Owner</h2>
        <div class="controls">
            <button onclick="fetchAccountOwner()">Fetch Account Owner</button>
        </div>
        <div id="accountOwner" class="data-display">No data loaded</div>
    </div>

    <div class="section">
        <h2>Account Status</h2>
        <div class="controls">
            <button onclick="fetchAccountStatus()">Fetch Account Status</button>
        </div>
        <div id="accountStatus" class="data-display">No data loaded</div>
    </div>

    <div class="section">
        <h2>Subdomain</h2>
        <div class="controls">
            <button onclick="fetchSubdomain()">Fetch Subdomain</button>
        </div>
        <div id="subdomain" class="data-display">No data loaded</div>
    </div>

    <div class="section">
        <h2>Usage Forecast</h2>
        <div class="controls">
            <div class="input-group">
                <label for="numberOfDays">Number of Days:</label>
                <select id="numberOfDays">
                    <option value="7">7 days</option>
                    <option value="28">28 days</option>
                    <option value="90">90 days</option>
                    <option value="custom">Custom</option>
                </select>
                <input type="number" id="customDays" min="1" max="365" value="30" style="display: none; margin-left: 10px;" />
            </div>
            <div class="button-group">
                <button onclick="fetchUsageForecast()">Fetch Usage Forecast</button>
            </div>
        </div>
        <div id="usageForecast" class="data-display">No data loaded</div>
    </div>

    <div class="section">
        <h2>Generate Credits Usage Report</h2>
        <div class="controls">
            <div class="input-group">
                <label for="groupBy">Group By:</label>
                <select id="groupBy">
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                </select>
            </div>
            <div class="input-group">
                <label for="reportType">Report Type:</label>
                <select id="reportType">
                    <option value="standard">Standard</option>
                    <option value="detailed">Detailed</option>
                    <option value="childDetailed">Child Detailed</option>
                </select>
            </div>
            <div class="input-group">
                <label for="includeDeploymentCharge"></label>
                <input type="checkbox" id="includeDeploymentCharge" />
                <label for="includeDeploymentCharge" style="width: auto;">Include Deployment Charge</label>
            </div>
            <div class="button-group">
                <button onclick="generateCreditsUsageReport()">Generate Report</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Show/hide custom days input
        document.getElementById('numberOfDays').addEventListener('change', (e) => {
            const customInput = document.getElementById('customDays');
            if (e.target.value === 'custom') {
                customInput.style.display = 'inline-block';
            } else {
                customInput.style.display = 'none';
            }
        });

        function fetchAccountOwner() {
            vscode.postMessage({ type: 'fetchAccountOwner' });
        }

        function fetchAccountStatus() {
            vscode.postMessage({ type: 'fetchAccountStatus' });
        }

        function fetchSubdomain() {
            vscode.postMessage({ type: 'fetchSubdomain' });
        }

        function fetchUsageForecast() {
            const selector = document.getElementById('numberOfDays');
            let days = selector.value;

            if (days === 'custom') {
                days = document.getElementById('customDays').value;
            }

            vscode.postMessage({
                type: 'fetchUsageForecast',
                numberOfDays: parseInt(days)
            });
        }

        function generateCreditsUsageReport() {
            const groupBy = document.getElementById('groupBy').value;
            const reportType = document.getElementById('reportType').value;
            const includeDeploymentCharge = document.getElementById('includeDeploymentCharge').checked;

            vscode.postMessage({
                type: 'generateCreditsUsageReport',
                groupBy: groupBy,
                reportType: reportType,
                includeDeploymentCharge: includeDeploymentCharge
            });
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'profileLoaded':
                    document.getElementById('profileName').textContent = message.profileName;
                    document.getElementById('region').textContent = message.region;
                    // Request data load
                    vscode.postMessage({ type: 'loadData' });
                    break;

                case 'accountDataLoaded':
                    if (message.data.accountOwner) {
                        document.getElementById('accountOwner').textContent = JSON.stringify(message.data.accountOwner, null, 2);
                    }
                    if (message.data.accountStatus) {
                        document.getElementById('accountStatus').textContent = JSON.stringify(message.data.accountStatus, null, 2);
                    }
                    if (message.data.subdomain) {
                        document.getElementById('subdomain').textContent = JSON.stringify(message.data.subdomain, null, 2);
                    }
                    if (message.data.usageForecast) {
                        document.getElementById('usageForecast').textContent = JSON.stringify(message.data.usageForecast, null, 2);
                    }
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}

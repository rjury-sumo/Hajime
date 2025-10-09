import * as path from 'path';
import * as os from 'os';
import { runTests, downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to test runner
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Download and get the VS Code executable path
        let vscodeExecutablePath = await downloadAndUnzipVSCode('stable');

        // On macOS, we need to use the CLI script instead of Electron directly
        if (os.platform() === 'darwin') {
            const [cli] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
            vscodeExecutablePath = cli;
        }

        // Download VS Code, unzip it and run the integration test
        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: []
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();

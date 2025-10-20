import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { runTests, downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';

async function main() {
    const startTime = Date.now();
    console.log('='.repeat(80));
    console.log('Starting VS Code Extension Tests');
    console.log('='.repeat(80));

    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to test runner
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        console.log(`Extension path: ${extensionDevelopmentPath}`);
        console.log(`Test suite path: ${extensionTestsPath}`);

        // Download and get the VS Code executable path
        console.log('\nDownloading VS Code test instance...');
        let vscodeExecutablePath = await downloadAndUnzipVSCode('stable');

        // On macOS, we need to use the CLI script instead of Electron directly
        if (os.platform() === 'darwin') {
            const [cli] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
            vscodeExecutablePath = cli;
        }

        console.log(`VS Code executable: ${vscodeExecutablePath}`);

        // Check for integration test credentials
        const hasCredentials = !!(process.env.SUMO_ACCESS_ID && process.env.SUMO_ACCESS_KEY);
        if (hasCredentials) {
            console.log('✓ Found SUMO_ACCESS_ID and SUMO_ACCESS_KEY - integration tests will run');
        } else {
            console.log('⚠️  SUMO_ACCESS_ID and SUMO_ACCESS_KEY not set - integration tests will be skipped');
        }

        console.log('\nLaunching VS Code and running tests...');
        console.log('(This may take 30-60 seconds - please wait for completion)\n');

        // Download VS Code, unzip it and run the integration test
        // This will properly wait for all tests to complete
        const exitCode = await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            extensionTestsEnv: {
                // Pass through integration test credentials if they exist
                SUMO_ACCESS_ID: process.env.SUMO_ACCESS_ID,
                SUMO_ACCESS_KEY: process.env.SUMO_ACCESS_KEY,
                // Pass through any other relevant env vars
                NODE_ENV: process.env.NODE_ENV || 'test'
            },
            launchArgs: [
                '--disable-extensions', // Disable other extensions
                '--disable-gpu'        // Disable GPU for stability
            ]
        });

        const endTime = Date.now();
        const totalDuration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('\n' + '='.repeat(80));
        console.log('Test Execution Complete');
        console.log('='.repeat(80));
        console.log(`Total execution time: ${totalDuration}s`);
        console.log(`Exit code: ${exitCode}`);

        // Check for test results files
        const resultsDir = path.resolve(__dirname, '../../test-results');
        if (fs.existsSync(resultsDir)) {
            const files = fs.readdirSync(resultsDir).filter(f =>
                f.startsWith('test-summary-') || f.startsWith('test-results-')
            ).sort().reverse(); // Most recent first

            if (files.length > 0) {
                console.log('\nTest result files generated:');
                files.slice(0, 2).forEach(f => { // Show latest summary and results
                    console.log(`  ${path.join(resultsDir, f)}`);
                });
            }
        }

        console.log('='.repeat(80));

        if (exitCode !== 0) {
            process.exit(exitCode);
        }

    } catch (err) {
        const endTime = Date.now();
        const totalDuration = ((endTime - startTime) / 1000).toFixed(2);

        console.error('\n' + '='.repeat(80));
        console.error('Test Execution Failed');
        console.error('='.repeat(80));
        console.error(`Total execution time: ${totalDuration}s`);
        console.error(`Error: ${err}`);
        console.error('='.repeat(80));

        process.exit(1);
    }
}

main();

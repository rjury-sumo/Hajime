import * as path from 'path';
import Mocha from 'mocha';
import * as fs from 'fs';

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        reporter: 'spec', // Use spec reporter for detailed output
        timeout: 60000,    // 60 second timeout for integration tests
        slow: 5000         // Mark tests as slow if they take more than 5s
    });

    const testsRoot = path.resolve(__dirname, '..');
    const reportDir = path.resolve(__dirname, '../../../test-results');

    // Ensure report directory exists
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
        // Find all test files
        const files = findTestFiles(testsRoot);

        console.log(`\n${'='.repeat(80)}`);
        console.log(`SUMO LOGIC EXTENSION TEST RUNNER`);
        console.log(`${'='.repeat(80)}`);
        console.log(`Found ${files.length} test files`);
        console.log(`Test results directory: ${reportDir}`);
        console.log(`Starting test execution...\n`);

        // Write a marker file to confirm directory access
        try {
            const markerPath = path.join(reportDir, 'test-run-started.txt');
            fs.writeFileSync(markerPath, `Test run started at ${new Date().toISOString()}\n`);
            console.log(`✓ Test results directory is writable`);
        } catch (err) {
            console.error(`✗ Failed to write to test results directory: ${err}`);
        }

        // Add files to the test suite
        files.forEach((f: string) => mocha.addFile(f));

        const testStartTime = Date.now();
        const testResults: any[] = [];
        let passCount = 0;
        let failCount = 0;
        let skipCount = 0;

        // Track test events
        const runner = mocha.run((failures: number) => {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`TEST RUN COMPLETED - Generating reports...`);
            console.log(`${'='.repeat(80)}\n`);

            const testEndTime = Date.now();
            const duration = testEndTime - testStartTime;

            // Generate summary report
            const summary = {
                timestamp: new Date().toISOString(),
                duration: `${(duration / 1000).toFixed(2)}s`,
                total: testResults.length,
                passed: passCount,
                failed: failCount,
                skipped: skipCount,
                tests: testResults
            };

            // Write JSON report
            const jsonReportPath = path.join(reportDir, `test-results-${Date.now()}.json`);
            fs.writeFileSync(jsonReportPath, JSON.stringify(summary, null, 2));

            // Write text summary
            const textReportPath = path.join(reportDir, `test-summary-${Date.now()}.txt`);
            const textReport = [
                '='.repeat(80),
                'TEST RESULTS SUMMARY',
                '='.repeat(80),
                `Timestamp: ${summary.timestamp}`,
                `Duration: ${summary.duration}`,
                `Total Tests: ${summary.total}`,
                `Passed: ${passCount}`,
                `Failed: ${failCount}`,
                `Skipped: ${skipCount}`,
                '='.repeat(80),
                ''
            ];

            if (failCount > 0) {
                textReport.push('FAILED TESTS:');
                testResults.filter(t => t.state === 'failed').forEach(test => {
                    textReport.push(`  ❌ ${test.fullTitle}`);
                    if (test.error) {
                        textReport.push(`     Error: ${test.error}`);
                    }
                });
                textReport.push('');
            }

            textReport.push(`Full report: ${jsonReportPath}`);
            textReport.push('='.repeat(80));

            fs.writeFileSync(textReportPath, textReport.join('\n'));

            console.log('\n' + textReport.join('\n'));
            console.log(`\nTest results saved to:`);
            console.log(`  JSON: ${jsonReportPath}`);
            console.log(`  Text: ${textReportPath}`);

            if (failures > 0) {
                reject(new Error(`${failures} tests failed. See ${textReportPath} for details.`));
            } else {
                resolve();
            }
        });

        // Capture test results
        runner.on('pass', (test: Mocha.Test) => {
            passCount++;
            testResults.push({
                title: test.title,
                fullTitle: test.fullTitle(),
                duration: test.duration,
                state: 'passed'
            });
        });

        runner.on('fail', (test: Mocha.Test, err: Error) => {
            failCount++;
            testResults.push({
                title: test.title,
                fullTitle: test.fullTitle(),
                duration: test.duration,
                state: 'failed',
                error: err.message,
                stack: err.stack
            });
        });

        runner.on('pending', (test: Mocha.Test) => {
            skipCount++;
            testResults.push({
                title: test.title,
                fullTitle: test.fullTitle(),
                state: 'skipped'
            });
        });

        runner.on('end', () => {
            console.log('\n✅ All tests completed. Extension host will close shortly...');
        });
    });
}

function findTestFiles(dir: string): string[] {
    const files: string[] = [];

    function walk(directory: string): void {
        const entries = fs.readdirSync(directory, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
                files.push(fullPath);
            }
        }
    }

    walk(dir);
    return files;
}

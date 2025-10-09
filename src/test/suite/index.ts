import * as path from 'path';
import * as Mocha from 'mocha';
import * as fs from 'fs';

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        reporter: 'spec' // Use spec reporter for detailed output
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        // Find all test files
        const files = findTestFiles(testsRoot);

        console.log(`Found ${files.length} test files`);

        // Add files to the test suite
        files.forEach((f: string) => mocha.addFile(f));

        try {
            // Run the mocha test
            mocha.run(failures => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            console.error(err);
            reject(err);
        }
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

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
const path = require("path");
const os = require("os");
const test_electron_1 = require("@vscode/test-electron");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // The folder containing the Extension Manifest package.json
            const extensionDevelopmentPath = path.resolve(__dirname, '../../');
            // The path to test runner
            const extensionTestsPath = path.resolve(__dirname, './suite/index');
            // Download and get the VS Code executable path
            let vscodeExecutablePath = yield (0, test_electron_1.downloadAndUnzipVSCode)('stable');
            // On macOS, we need to use the CLI script instead of Electron directly
            if (os.platform() === 'darwin') {
                const [cli] = (0, test_electron_1.resolveCliArgsFromVSCodeExecutablePath)(vscodeExecutablePath);
                vscodeExecutablePath = cli;
            }
            // Download VS Code, unzip it and run the integration test
            yield (0, test_electron_1.runTests)({
                vscodeExecutablePath,
                extensionDevelopmentPath,
                extensionTestsPath,
                launchArgs: []
            });
        }
        catch (err) {
            console.error('Failed to run tests:', err);
            process.exit(1);
        }
    });
}
main();
//# sourceMappingURL=runTest.js.map
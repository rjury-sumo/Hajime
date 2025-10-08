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
exports.StatusBarManager = void 0;
const vscode = require("vscode");
const profileManager_1 = require("./profileManager");
/**
 * Status bar manager for showing active Sumo Logic profile
 */
class StatusBarManager {
    constructor(context) {
        this.profileManager = new profileManager_1.ProfileManager(context);
        // Create status bar item (right side, priority 100)
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'sumologic.switchProfile';
        this.statusBarItem.tooltip = 'Click to switch Sumo Logic profile';
        context.subscriptions.push(this.statusBarItem);
        // Update immediately and watch for configuration changes
        this.updateStatusBar();
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('sumologic')) {
                this.updateStatusBar();
            }
        }));
    }
    /**
     * Update the status bar text with the active profile
     */
    updateStatusBar() {
        return __awaiter(this, void 0, void 0, function* () {
            const activeProfile = yield this.profileManager.getActiveProfile();
            if (activeProfile) {
                this.statusBarItem.text = `$(database) ${activeProfile.name}`;
                this.statusBarItem.show();
            }
            else {
                this.statusBarItem.hide();
            }
        });
    }
    /**
     * Manually refresh the status bar
     */
    refresh() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateStatusBar();
        });
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=statusBar.js.map
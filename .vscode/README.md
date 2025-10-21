# VSCode Workspace Configuration

This directory contains shared workspace settings for the Hajime extension development.

## Files

### `settings.json`
Workspace settings that apply to all contributors. These settings:
- Configure TypeScript to use the workspace version
- Set up ESLint for automatic linting
- Configure file exclusions and associations
- Set recommended editor behavior

### `extensions.json`
Recommended VSCode extensions for development:
- **ESLint** - JavaScript/TypeScript linting
- **Mocha Test Explorer** - Run tests from the sidebar
- **Error Lens** - Inline error highlighting
- **GitLens** - Enhanced Git integration
- **Code Spell Checker** - Catch typos in code

When you open this workspace, VSCode will prompt you to install these extensions.

### `launch.json`
Debug configurations:
- **Run Extension** - Launch the extension in a development host
- **Extension Tests** - Run the test suite with debugging

## Personal Settings

If you want to customize settings without affecting the shared configuration:

1. Create `.vscode/settings.local.json` (this file is gitignored)
2. Add your personal preferences there
3. VSCode will merge both files, with local settings taking precedence

Example `.vscode/settings.local.json`:
```json
{
    "editor.formatOnSave": true,
    "editor.fontSize": 14
}
```

## Quick Start

1. Install recommended extensions when prompted
2. Press `F5` to launch the extension in debug mode
3. Use the Test Explorer panel to run tests
4. ESLint will show errors inline as you code

## Troubleshooting

### TypeScript version mismatch
If you see TypeScript errors:
1. Open any `.ts` file
2. Click the TypeScript version in the status bar (bottom right)
3. Select "Use Workspace Version"

### Tests not running
1. Ensure you've compiled: `npm run compile`
2. Check that the `out/` directory exists
3. Reload VSCode: `Cmd/Ctrl+Shift+P` → "Developer: Reload Window"

### ESLint not working
1. Open the Output panel: `View` → `Output`
2. Select "ESLint" from the dropdown
3. Check for any errors
4. Try: `npm install` to ensure all dependencies are installed

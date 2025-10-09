# Testing Guide

This document describes the test suite for the Sumo Logic Query Language VSCode extension.

## Overview

The extension now has a comprehensive test suite covering all key functionality including:
- Profile management
- Dynamic and parser completions
- File cleanup commands
- Extension activation and configuration

## Running Tests

### Run all tests
```bash
npm test
```

This will:
1. Compile TypeScript (`npm run pretest`)
2. Launch VS Code Extension Host
3. Run all test suites
4. Report results

### Run tests in watch mode
```bash
npm run watch
```

### Debug tests
1. Open VS Code
2. Go to Run and Debug (Cmd+Shift+D)
3. Select "Extension Tests" from dropdown
4. Press F5
5. Set breakpoints as needed

## Test Files

### Location
All tests are in `src/test/suite/`:

| Test File | Coverage |
|-----------|----------|
| `extension.test.ts` | Extension activation, commands, language registration |
| `profileManager.test.ts` | Profile CRUD, credentials, directories |
| `dynamicCompletions.test.ts` | Custom fields, partitions, field discovery |
| `parserCompletions.test.ts` | Parser snippets, filtering, context replacement |
| `cleanupOldFiles.test.ts` | File deletion, age filtering, extension safety |

### Test Count

Total: **60+ tests** covering:
- ✅ Extension activation and registration
- ✅ Profile management (create, update, delete, switch)
- ✅ Credential storage and retrieval
- ✅ Dynamic field completion
- ✅ Parser snippet completion with prefix filtering
- ✅ File cleanup with safety checks
- ✅ Configuration management
- ✅ Sort priority ordering
- ✅ Error handling

## Test Framework

- **Framework**: Mocha (TDD style)
- **Runner**: @vscode/test-electron
- **Assertions**: Node.js assert module
- **Environment**: VS Code Extension Host

## Key Features Tested

### ProfileManager
- Create/update/delete profiles
- Store/retrieve credentials securely
- Switch active profiles
- Get profile directories
- Handle custom endpoints
- Error handling for duplicates and missing profiles

### DynamicCompletionProvider
- Add custom fields and partitions
- Discover fields from query results
- Prevent duplicates
- Persist data per profile
- Load saved data on startup
- Correct sort priority (metadata > discovered > custom)

### ParserCompletionProvider
- Load parser snippets from static data
- Filter by app name
- Require "parser" prefix for activation
- Replace "parser" text with snippet
- Low sort priority (after built-in items)

### Cleanup Command
- Only delete .txt, .json, .csv files (safety)
- Age-based deletion
- Recursive subdirectory processing
- Preserve recent files
- Handle empty/missing directories

### Extension Integration
- All commands registered correctly
- Language and grammar registered
- Completion providers active
- Configuration accessible
- Status bar integration

## Best Practices

### Writing Tests
1. **Isolation**: Tests don't depend on each other
2. **Cleanup**: Always clean up in `suiteTeardown`
3. **Unique IDs**: Use timestamps for test data
4. **Async/Await**: All async operations use async/await
5. **Descriptive**: Clear test names and assertion messages

### Test Data
- Test profiles: `test-profile-{timestamp}`
- Test directories: `cleanup-test-profile-{timestamp}`
- Always cleanup in teardown hooks

### Common Patterns

```typescript
suite('My Feature Tests', () => {
    let context: vscode.ExtensionContext;

    suiteSetup(async () => {
        // Get extension context
        const ext = vscode.extensions.getExtension('tba.sumo-query-language');
        await ext?.activate();
        context = ext?.exports?.context;
    });

    suiteTeardown(async () => {
        // Cleanup test data
    });

    test('should do something', async () => {
        // Test logic
        assert.ok(result, 'descriptive message');
    });
});
```

## Continuous Integration

To add CI/CD:

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

## Coverage (Future)

To add code coverage:

```bash
npm install --save-dev nyc
```

Update `package.json`:
```json
"test": "nyc --reporter=html --reporter=text node ./out/test/runTest.js"
```

## Troubleshooting

### Tests fail to start
- Ensure extension compiles: `npm run compile`
- Check VS Code version compatibility
- Verify all dependencies installed: `npm install`

### Tests timeout
- Increase timeout in test file: `this.timeout(10000)`
- Check for unresolved promises
- Verify cleanup in teardown hooks

### Extension not activating in tests
- Check activation events in package.json
- Verify extension ID matches: `tba.sumo-query-language`
- Ensure extension compiles without errors

## Future Enhancements

Potential additions:
- [ ] Integration tests for API calls
- [ ] Mock Sumo Logic API responses
- [ ] Performance benchmarks
- [ ] Code coverage reports
- [ ] Visual regression tests for webviews
- [ ] End-to-end workflow tests

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all existing tests pass
3. Add integration tests for new commands
4. Update this documentation

## Resources

- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Mocha Documentation](https://mochajs.org/)
- [@vscode/test-electron](https://github.com/microsoft/vscode-test)

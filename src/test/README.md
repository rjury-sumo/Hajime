# Test Suite

This directory contains the test suite for the Sumo Logic Query Language VSCode extension.

## Structure

```
test/
├── runTest.ts              # Test runner entry point
├── suite/
│   ├── index.ts            # Test suite loader
│   ├── extension.test.ts   # Extension activation and registration tests
│   ├── profileManager.test.ts          # ProfileManager tests
│   ├── dynamicCompletions.test.ts      # DynamicCompletionProvider tests
│   ├── parserCompletions.test.ts       # ParserCompletionProvider tests
│   └── cleanupOldFiles.test.ts         # File cleanup command tests
```

## Running Tests

Run all tests:
```bash
npm test
```

Run tests with compilation:
```bash
npm run pretest && npm test
```

Watch mode for development:
```bash
npm run watch
```

## Test Coverage

### Extension Tests (`extension.test.ts`)
- Extension presence and activation
- Command registration verification
- Language registration
- Completion provider registration
- Configuration properties

### ProfileManager Tests (`profileManager.test.ts`)
- Profile creation and deletion
- Profile credentials management
- Active profile switching
- Profile directory management
- Profile endpoint handling
- Error handling for duplicate/missing profiles

### DynamicCompletionProvider Tests (`dynamicCompletions.test.ts`)
- Custom field management
- Partition management
- Field discovery from query results
- Duplicate field handling
- Data persistence across sessions
- Sort priority ordering
- Profile-specific data isolation

### ParserCompletionProvider Tests (`parserCompletions.test.ts`)
- Parser snippet loading
- App name filtering
- Completion item structure
- Filter text with "parser" prefix
- Sort priority for low priority display
- Context-aware range replacement
- Case-insensitive app filtering

### Cleanup Command Tests (`cleanupOldFiles.test.ts`)
- File extension filtering (.txt, .json, .csv only)
- Age-based deletion
- Recursive subdirectory processing
- Recent file preservation
- Empty directory handling
- Non-existent directory handling

## Writing New Tests

Tests use Mocha with the TDD interface. Example:

```typescript
suite('My Test Suite', () => {
    suiteSetup(async () => {
        // Run once before all tests
    });

    suiteTeardown(async () => {
        // Run once after all tests
    });

    test('should do something', () => {
        assert.strictEqual(1 + 1, 2);
    });
});
```

## Test Utilities

- Tests have access to the VSCode API through `vscode` imports
- Extension context is exported from `extension.ts` for test access
- Use `vscode.ExtensionContext` for state management testing
- Mock VSCode components as needed for unit tests

## Best Practices

1. **Isolation**: Each test should be independent and not rely on test execution order
2. **Cleanup**: Always clean up test data in `suiteTeardown` or `teardown` hooks
3. **Unique Names**: Use timestamps or random IDs for test profiles/data to avoid conflicts
4. **Assertions**: Use descriptive assertion messages for easier debugging
5. **Async**: Always use `async/await` for asynchronous operations
6. **Mocking**: Mock external dependencies when possible to improve test speed

## Debugging Tests

To debug tests in VS Code:

1. Set breakpoints in test files
2. Open the Debug panel (Cmd+Shift+D)
3. Select "Extension Tests" from the dropdown
4. Press F5 to start debugging

Or use the "Extension Tests" launch configuration in `.vscode/launch.json`.

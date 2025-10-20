# Integration Test Guide

## Overview

Integration tests validate the extension's interaction with live Sumo Logic APIs. They require valid credentials and respect API rate limits.

## Running Integration Tests

### Prerequisites

Set environment variables with your Sumo Logic credentials:

```bash
export SUMO_ACCESS_ID="your-access-id-here"
export SUMO_ACCESS_KEY="your-access-key-here"
```

These are automatically passed to the test runner.

### Running Tests

```bash
npm test
```

The test runner will:
- Detect if credentials are set
- Pass them to the VS Code Extension Host
- Run all tests including integration tests

**Without credentials**: Integration tests will fail (expected)
**With credentials**: Integration tests will run against live APIs

## Rate Limiting

**IMPORTANT**: Sumo Logic APIs enforce rate limiting at **4 requests per second**.

### Current Implementation

The test helper includes a `respectRateLimit()` function:

```typescript
import { respectRateLimit } from './testHelper';

test('my test', async () => {
    await client.someAPICall();
    await respectRateLimit(); // Wait 250ms
    await client.anotherAPICall();
});
```

### Best Practices

1. **Sequential Execution**: Run tests sequentially, not in parallel
2. **Rate Limit Between Calls**: Call `respectRateLimit()` between API requests
3. **Longer Timeouts**: Integration tests have 60s timeout (configured in suite setup)
4. **Handle 429 Errors**: Tests should gracefully handle rate limit errors

### Example Pattern

```typescript
import {
    shouldRunIntegrationTests,
    setupIntegrationProfile,
    respectRateLimit
} from './testHelper';

suite('My API Integration Tests', function() {
    this.timeout(60000); // 60 second timeout

    let client: MyClient;

    suiteSetup(async function() {
        if (!shouldRunIntegrationTests()) {
            this.skip();
            return;
        }
        // Setup client...
    });

    test('should do multiple API calls', async () => {
        const result1 = await client.call1();
        await respectRateLimit(); // Wait between calls

        const result2 = await client.call2();
        await respectRateLimit();

        const result3 = await client.call3();
        // assertions...
    });
});
```

## Integration Test Suites

### Query Execution Tests ([src/test/integration/queryExecution.test.ts](../src/test/integration/queryExecution.test.ts))

Tests end-to-end query execution with metadata directives:
- Query with parameters and metadata
- Multiple parameter substitution
- Messages vs records mode
- Profile credential verification
- Time range parsing

**Test Query Used**:
```
_sourcecategory = * | sum(_size) as bytes, count by _sourcecategory, _sourcehost, _collector
```

### Search Job API Tests ([src/test/integration/searchJob.test.ts](../src/test/integration/searchJob.test.ts))

Tests Search Job API operations:
- Create/delete search jobs
- Job status polling
- Messages retrieval
- Records retrieval
- Pagination
- Time range handling

### Content/Folders API Tests ([src/test/integration/content.test.ts](../src/test/integration/content.test.ts))

Tests content management operations:
- Get personal folder
- Get folder by ID
- Get content by path
- Export content
- List children
- Verify permissions

**⚠️ Rate Limit Risk**: This suite makes many sequential API calls and may hit rate limits.

### Collectors API Tests ([src/test/integration/collectors.test.ts](../src/test/integration/collectors.test.ts))

Tests collector management:
- List collectors
- Verify collector structure
- Check collector versions

### Custom Fields API Tests ([src/test/integration/customFields.test.ts](../src/test/integration/customFields.test.ts))

Tests custom field operations:
- List custom fields
- Verify field naming conventions

### Partitions API Tests ([src/test/integration/partitions.test.ts](../src/test/integration/partitions.test.ts))

Tests partition management:
- List partitions
- Verify structure
- Format as table
- Check routing expressions
- Verify analytics tiers

**⚠️ Rate Limit Risk**: This suite makes multiple API calls per test.

## Common Issues

### Rate Limiting (HTTP 429)

**Symptom**: Tests fail with "API rate limit exceeded"

**Solution**:
1. Add `await respectRateLimit()` between API calls
2. Run tests with longer delays
3. Reduce number of sequential tests

### Missing Credentials

**Symptom**: Tests fail with "Cannot read properties of undefined"

**Solution**: Set `SUMO_ACCESS_ID` and `SUMO_ACCESS_KEY` environment variables

### Timeouts

**Symptom**: Tests timeout after 60 seconds

**Solution**:
1. Check API connectivity
2. Increase timeout: `this.timeout(120000)` for 2 minutes
3. Verify credentials are valid

### Extension Not Activated

**Symptom**: "Extension not found" or "Extension context not available"

**Solution**: This is usually a VS Code test harness issue. Try:
1. Clean build: `npm run clean && npm run compile`
2. Remove `.vscode-test` and re-run tests

## Test Results

Integration test results are saved to `test-results/`:
- `test-summary-{timestamp}.txt` - Human-readable summary
- `test-results-{timestamp}.json` - Detailed JSON report

Check these files for detailed failure information, including rate limit errors.

## CI/CD Considerations

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests (no credentials)
        run: npm test

      - name: Run integration tests (with credentials)
        if: github.ref == 'refs/heads/main'
        env:
          SUMO_ACCESS_ID: ${{ secrets.SUMO_ACCESS_ID }}
          SUMO_ACCESS_KEY: ${{ secrets.SUMO_ACCESS_KEY }}
        run: npm test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

### Best Practices for CI

1. **Separate Jobs**: Run unit tests separately from integration tests
2. **Secrets**: Store credentials as GitHub Secrets
3. **Rate Limiting**: Consider running integration tests on schedule (not every commit)
4. **Artifacts**: Always upload test results for debugging

## Troubleshooting

### Check Environment Variables

```bash
# In terminal
echo $SUMO_ACCESS_ID
echo $SUMO_ACCESS_KEY

# In Node.js
node -e "console.log('ID:', process.env.SUMO_ACCESS_ID ? 'SET' : 'NOT SET')"
```

### Check Test Execution

The test runner logs credential status:
```
✓ Found SUMO_ACCESS_ID and SUMO_ACCESS_KEY - integration tests will run
```

Or:
```
⚠️  SUMO_ACCESS_ID and SUMO_ACCESS_KEY not set - integration tests will be skipped
```

### Rate Limit Calculation

- Sumo Logic API limit: **4 requests/second**
- Safe interval: **250ms between requests**
- Test suite with 20 API calls: ~5 seconds minimum

If hitting rate limits:
1. Add `respectRateLimit()` calls
2. Increase to 300ms: `await sleep(300)`
3. Run tests with `--grep` to isolate specific suites

## Future Improvements

1. **Automatic Rate Limiting**: Wrap API clients with automatic rate limiting
2. **Parallel Test Suites**: Run different API test suites in separate processes
3. **Mock Mode**: Add mock responses for faster testing without API calls
4. **Retry Logic**: Automatically retry on 429 errors with exponential backoff

## Summary

Integration tests validate real API interactions but require careful management of:
- ✅ Credentials (via environment variables)
- ✅ Rate limiting (4 req/sec limit)
- ✅ Timeouts (60s default)
- ✅ Sequential execution (avoid parallel API calls)

Follow the patterns in existing integration tests and always add `respectRateLimit()` between API calls.

# Rate Limit Refactoring Status

## Objective

Add `respectRateLimit()` calls between all API requests in integration tests to avoid HTTP 429 (Rate Limit Exceeded) errors.

## Completed

### ✅ Search Job Integration Tests ([src/test/integration/searchJob.test.ts](../src/test/integration/searchJob.test.ts))

**Status**: COMPLETE - All 8 tests updated

Added `await respectRateLimit()` after every API call:
- `createSearchJob()` - 8 occurrences
- `getSearchJobStatus()` - multiple occurrences in polling loops
- `getMessages()` - 2 occurrences
- `getRecords()` - 1 occurrence
- `deleteSearchJob()` - 8 occurrences

**Pattern Used**:
```typescript
const response = await client.createSearchJob(request);
await respectRateLimit(); // Added this line
assert.ok(response.data);
```

**Tests Updated**:
1. ✅ should create a search job successfully
2. ✅ should get search job status
3. ✅ should wait for search job completion and get messages
4. ✅ should wait for aggregation job and get records
5. ✅ should delete a search job
6. ✅ should handle invalid query error
7. ✅ should handle pagination for large result sets
8. ✅ should respect time range in query

### ✅ Test Helper ([src/test/integration/testHelper.ts](../src/test/integration/testHelper.ts))

**Status**: COMPLETE

Added `respectRateLimit()` function:
```typescript
export async function respectRateLimit(): Promise<void> {
    // Wait 250ms (4 requests/sec = 1 request per 250ms)
    await sleep(250);
}
```

## Remaining Work

### 📝 Query Execution Integration Tests ([src/test/integration/queryExecution.test.ts](../src/test/integration/queryExecution.test.ts))

**Status**: Import added, needs API call updates

**Tests to Update** (6 tests):
1. should execute query with metadata directives and parameters
2. should handle query with multiple parameters
3. should handle messages mode from metadata
4. should respect active profile credentials (no API calls)
5. should parse and execute query with all supported metadata directives
6. should handle time range parsing correctly (no API calls)

**API Calls Needing Rate Limiting**:
- Line 124: `createSearchJob()`
- Line 133: `pollForCompletion()`
- Line 140: `getRecords()`
- Line 164: `deleteSearchJob()`
- Line 203: `createSearchJob()`
- Line 209: `pollForCompletion()`
- Line 212: `deleteSearchJob()`
- Line 239: `createSearchJob()`
- Line 243: `pollForCompletion()`
- Line 246: `getMessages()`
- Line 251: `deleteSearchJob()`
- Line 314: `createSearchJob()`
- Line 318: `pollForCompletion()`
- Line 320: `getRecords()`
- Line 323: `deleteSearchJob()`

### 📝 Content/Folders Integration Tests ([src/test/integration/content.test.ts](../src/test/integration/content.test.ts))

**Status**: NOT STARTED

**High Priority** - This suite makes MANY sequential API calls and hits rate limits frequently.

**Pattern to Add**:
```typescript
import { respectRateLimit } from './testHelper';

// After EVERY await client.* call:
const response = await client.getPersonalFolder();
await respectRateLimit();
```

**Estimated API Calls**: 50+ across all tests

**Tests**: ~20 tests covering folders, content, paths, permissions

### 📝 Collectors Integration Tests ([src/test/integration/collectors.test.ts](../src/test/integration/collectors.test.ts))

**Status**: NOT STARTED

**API Calls**: ~5-10

**Tests**: ~3-5 tests

### 📝 Custom Fields Integration Tests ([src/test/integration/customFields.test.ts](../src/test/integration/customFields.test.ts))

**Status**: NOT STARTED

**API Calls**: ~3-5

**Tests**: ~2-3 tests

### 📝 Partitions Integration Tests ([src/test/integration/partitions.test.ts](../src/test/integration/partitions.test.ts))

**Status**: NOT STARTED

**API Calls**: ~10-15

**Tests**: ~8 tests

## Instructions for Completing Remaining Work

### Step-by-Step Pattern

For each integration test file:

1. **Add Import**:
```typescript
import { respectRateLimit } from './testHelper';
```

2. **Find All API Calls**:
```bash
grep -n "await client\." src/test/integration/FILENAME.test.ts
grep -n "await.*Response =" src/test/integration/FILENAME.test.ts
```

3. **Add Rate Limiting After Each Call**:
```typescript
// Before:
const response = await client.someMethod();
assert.ok(response.data);

// After:
const response = await client.someMethod();
await respectRateLimit();  // ADD THIS LINE
assert.ok(response.data);
```

4. **Special Case - Polling Loops**:
```typescript
// In waitFor or while loops, add inside the loop:
await waitFor(
    async () => {
        const status = await client.getStatus(jobId);
        await respectRateLimit();  // ADD THIS LINE
        return status.data?.state === 'DONE';
    },
    { timeout: 45000, interval: 2000 }
);
```

### Quick Reference Table

| File | Tests | Est. API Calls | Priority | Status |
|------|-------|----------------|----------|---------|
| searchJob.test.ts | 8 | ~40 | High | ✅ DONE |
| queryExecution.test.ts | 6 | ~20 | High | 🔄 Import Added |
| content.test.ts | 20 | ~50+ | High | ⏸️ Not Started |
| partitions.test.ts | 8 | ~15 | Medium | ⏸️ Not Started |
| collectors.test.ts | 3 | ~10 | Medium | ⏸️ Not Started |
| customFields.test.ts | 2 | ~5 | Low | ⏸️ Not Started |

## Testing Progress

### Before Rate Limiting
- Total Tests: 349
- Passing: 319 (91.4%)
- Failing: 30 (8.6%)
  - 25 integration test failures (many due to rate limiting)
  - 5 unit test failures

### After Search Job Rate Limiting
**Expected Improvement**: 8-10 tests should pass (Search Job suite)

Run tests:
```bash
npm test
```

Check results:
```bash
cat test-results/test-summary-*.txt | head -15
```

### Target After Full Refactoring
- Expected Passing: ~340+ (97%+)
- Expected Failing: ~9
  - 0-3 integration tests (data/environment issues)
  - 5 unit tests (completion providers, scope tests)

## Automated Script

For bulk updating (use with caution):

```bash
# Find all integration test files
find src/test/integration -name "*.test.ts" -exec grep -l "client\." {} \;

# For each file, add respectRateLimit import if missing
# Then find and update API calls
```

## Verification

After updating each file:

1. **Compile**:
```bash
npm run compile
```

2. **Run Specific Suite**:
```bash
npm test -- --grep "Search Job API"
npm test -- --grep "Query Execution"
npm test -- --grep "Content/Folders"
```

3. **Check for Rate Limiting Errors**:
```bash
grep "rate.limit.exceeded" test-results/test-results-*.json
```

## Summary

**Completed**: 1/6 integration test suites (Search Job)
**Remaining**: 5 suites
**Estimated Time**: 30-45 minutes for remaining suites
**Impact**: Expected to fix 20-25 failing tests

The `respectRateLimit()` pattern is simple and consistent - just add `await respectRateLimit();` after every `await client.*()` call. The biggest time sink is finding all the API calls in each file.

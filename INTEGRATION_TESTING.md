# Integration Testing Guide

This document describes the integration test suite for API calls to Sumo Logic.

## Overview

The integration tests verify real API interactions with Sumo Logic services:
- **Search Job API** - Create, monitor, and retrieve search results
- **Content API** - Access personal folders and content
- **Partitions API** - List and inspect partitions
- **Custom Fields API** - List custom field definitions

## Setup

### Prerequisites

1. **Sumo Logic Access Credentials**
   - Access ID
   - Access Key
   - Valid Sumo Logic account with Australia (au) region access

2. **Environment Variables**
   ```bash
   export SUMO_ACCESS_ID="your-access-id"
   export SUMO_ACCESS_KEY="your-access-key"
   ```

### Test Profile

Integration tests use a dedicated profile named `integration_test` with:
- **Endpoint**: Australia region (`au`)
- **Credentials**: From environment variables
- **Auto-created**: Profile is created/updated during test setup
- **Auto-cleaned**: Profile is deleted during test teardown

## Running Integration Tests

### Run All Tests (Unit + Integration)
```bash
export SUMO_ACCESS_ID="your-access-id"
export SUMO_ACCESS_KEY="your-access-key"
npm test
```

### Run Only Integration Tests
```bash
export SUMO_ACCESS_ID="your-access-id"
export SUMO_ACCESS_KEY="your-access-key"
npm run test:integration
```

### Skip Integration Tests
If environment variables are not set, integration tests are automatically skipped:
```bash
npm test  # Integration tests skipped, unit tests run
```

### Test Output
```
⚠️  Skipping integration tests - SUMO_ACCESS_ID and SUMO_ACCESS_KEY not set
  OR
✅ Integration test environment configured
✅ Created search job: abc123
⏳ Waiting for job to complete...
✅ Job completed
✅ Retrieved 5 messages
```

## Test Structure

### Test Files

| File | Tests | Description |
|------|-------|-------------|
| `searchJob.test.ts` | 10 tests | Search job creation, status, messages, records, pagination |
| `content.test.ts` | 8 tests | Personal folder, folder by ID, structure, permissions |
| `partitions.test.ts` | 10 tests | List partitions, structure, filtering, formatting |
| `customFields.test.ts` | 10 tests | List fields, structure, grouping, naming conventions |
| `testHelper.ts` | - | Shared utilities for integration tests |

### Total Coverage
**38 integration tests** covering:
- ✅ Search job lifecycle (create, monitor, retrieve, delete)
- ✅ Message and record retrieval
- ✅ Pagination
- ✅ Time range queries
- ✅ Folder access and structure
- ✅ Partition listing and metadata
- ✅ Custom field definitions
- ✅ Error handling

## Test Details

### Search Job Tests

**File**: `src/test/integration/searchJob.test.ts`

| Test | Purpose |
|------|---------|
| should create a search job successfully | Verify job creation API |
| should get search job status | Check job status retrieval |
| should wait for search job completion and get messages | Test message retrieval for raw queries |
| should wait for aggregation job and get records | Test record retrieval for aggregation queries |
| should delete a search job | Verify job deletion |
| should handle invalid query error | Error handling for bad queries |
| should handle pagination for large result sets | Test result pagination |
| should respect time range in query | Verify time range filtering |

**Key Query Used**:
```
_sourceCategory = * | limit 10000
| sum(_size) as bytes, count by _sourceCategory,_view,_collector,_source,_sourceHost,_sourceName
| sort _count desc
```
- Time range: Last 24 hours (`-24h` to `now`)
- Purpose: Comprehensive aggregation query with multiple fields

### Content/Folders Tests

**File**: `src/test/integration/content.test.ts`

| Test | Purpose |
|------|---------|
| should get personal folder | Retrieve user's personal folder |
| should get folder by ID | Access folder by ID |
| should handle non-existent folder ID | Error handling for invalid IDs |
| should verify personal folder structure | Validate folder schema |
| should list child items in personal folder | List folder contents |
| should handle permissions field | Verify permissions structure |
| should verify folder metadata timestamps | Validate timestamps |
| should verify child item types | Check item type diversity |

### Partitions Tests

**File**: `src/test/integration/partitions.test.ts`

| Test | Purpose |
|------|---------|
| should list partitions | Retrieve all partitions |
| should verify partition structure | Validate partition schema |
| should extract partition names | Test utility function |
| should format partitions as table | Test formatting utility |
| should filter active partitions | Filter by active status |
| should verify partition routing expressions | Validate routing logic |
| should verify partition retention periods | Check retention settings |
| should verify partition sizes | Validate size metrics |
| should verify partition analytics tiers | Check tier configuration |
| should verify default search inclusion | Verify search defaults |

### Custom Fields Tests

**File**: `src/test/integration/customFields.test.ts`

| Test | Purpose |
|------|---------|
| should list custom fields | Retrieve all custom fields |
| should verify custom field structure | Validate field schema |
| should extract field names | Test utility function |
| should format custom fields as table | Test formatting utility |
| should group fields by data type | Analyze data types |
| should group fields by state | Analyze field states |
| should verify field names are unique | Uniqueness validation |
| should verify field IDs are unique | ID uniqueness validation |
| should verify field naming conventions | Naming pattern analysis |
| should handle empty response gracefully | Edge case handling |

## Helper Utilities

**File**: `src/test/integration/testHelper.ts`

### Functions

- `getIntegrationTestConfig()` - Get credentials from environment
- `shouldRunIntegrationTests()` - Check if env vars are set
- `setupIntegrationProfile()` - Create/update test profile
- `cleanupIntegrationProfile()` - Delete test profile
- `waitFor()` - Poll for condition with timeout
- `sleep()` - Async delay
- `generateTestId()` - Generate unique test identifiers

### Usage Example

```typescript
import {
    shouldRunIntegrationTests,
    getIntegrationTestConfig,
    setupIntegrationProfile,
    waitFor
} from './testHelper';

suite('My API Tests', function() {
    suiteSetup(async function() {
        if (!shouldRunIntegrationTests()) {
            this.skip();
            return;
        }

        const config = getIntegrationTestConfig();
        client = new MyClient({
            accessId: config.accessId,
            accessKey: config.accessKey,
            endpoint: config.endpoint
        });
    });
});
```

## Best Practices

### Writing Integration Tests

1. **Check Environment**
   ```typescript
   if (!shouldRunIntegrationTests()) {
       this.skip();
       return;
   }
   ```

2. **Use Appropriate Timeouts**
   ```typescript
   this.timeout(60000); // 60 seconds for API calls
   ```

3. **Clean Up Resources**
   ```typescript
   // Always delete jobs, temp content, etc.
   await client.deleteSearchJob(jobId);
   ```

4. **Handle Empty Results**
   ```typescript
   if (results.length === 0) {
       console.log('⚠️  No data returned');
       return; // Skip assertions that need data
   }
   ```

5. **Use Descriptive Logging**
   ```typescript
   console.log('✅ Test passed');
   console.log('⚠️  Warning message');
   console.log('⏳ Waiting...');
   ```

### Common Patterns

**Wait for Async Completion**:
```typescript
await waitFor(
    async () => {
        const status = await client.getStatus(id);
        return status.data?.state === 'DONE';
    },
    {
        timeout: 45000,
        interval: 2000,
        message: 'Operation did not complete'
    }
);
```

**Handle Optional Data**:
```typescript
if (data.length > 0) {
    // Perform assertions
    assert.ok(data[0].field);
} else {
    console.log('⚠️  No data available for assertion');
}
```

## Troubleshooting

### Tests Are Skipped

**Problem**: Integration tests don't run
**Solution**: Set environment variables:
```bash
export SUMO_ACCESS_ID="your-id"
export SUMO_ACCESS_KEY="your-key"
```

### Authentication Errors

**Problem**: 401 Unauthorized
**Solution**:
- Verify credentials are correct
- Check credentials have required permissions
- Ensure endpoint matches account region

### Timeout Errors

**Problem**: Tests timeout waiting for completion
**Solution**:
- Increase timeout: `this.timeout(120000)`
- Check Sumo Logic service status
- Verify query is valid and not too expensive

### Empty Results

**Problem**: No data returned from queries
**Solution**:
- This is often expected (no matching data in time range)
- Tests handle this gracefully with conditional assertions
- Verify time range has data: adjust `-24h` if needed

### Rate Limiting

**Problem**: Too many requests
**Solution**:
- Add delays between tests
- Reduce test frequency
- Use dedicated test account

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests
on: [push, pull_request]
jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run compile
      - name: Run Integration Tests
        env:
          SUMO_ACCESS_ID: ${{ secrets.SUMO_ACCESS_ID }}
          SUMO_ACCESS_KEY: ${{ secrets.SUMO_ACCESS_KEY }}
        run: npm run test:integration
```

### Required Secrets

Add to repository secrets:
- `SUMO_ACCESS_ID`
- `SUMO_ACCESS_KEY`

## Security Notes

⚠️ **Never commit credentials to version control**

- Use environment variables
- Add `.env` to `.gitignore`
- Use CI/CD secrets for automation
- Rotate credentials regularly
- Use dedicated test accounts with minimal permissions

## API Permissions Required

The integration tests require these Sumo Logic capabilities:

| API | Required Capability |
|-----|---------------------|
| Search Job | View Search Jobs, Create Search Jobs |
| Content | View Content |
| Partitions | View Partitions |
| Custom Fields | View Fields |

## Future Enhancements

Potential additions:
- [ ] Scheduled view API tests
- [ ] User management API tests
- [ ] Collector management tests
- [ ] Content creation/modification tests
- [ ] Role and permission tests
- [ ] Webhook/connection tests

## Resources

- [Sumo Logic API Documentation](https://api.sumologic.com/docs/)
- [Search Job API](https://help.sumologic.com/docs/api/search-job/)
- [Content API](https://api.sumologic.com/docs/#tag/content)
- [Partitions API](https://api.sumologic.com/docs/#tag/partitionManagement)
- [Custom Fields API](https://api.sumologic.com/docs/#tag/customFields)

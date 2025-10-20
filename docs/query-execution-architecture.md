# Query Execution Architecture

This document describes the query execution architecture for the Sumo Logic VS Code extension, ensuring all query execution paths use consistent metadata parsing and parameter handling.

## Architecture Overview

All query execution in the extension follows a consistent pattern:

```
User .sumo File → Metadata Parsing → Parameter Handling → Query Execution → Result Display
```

## Core Modules

### 1. Shared Query Metadata Module (`src/services/queryMetadata.ts`)

**Purpose**: Single source of truth for parsing query metadata directives and handling parameters.

**Exported Functions**:
- `parseQueryMetadata(queryText)` - Parses all `@directive` comments
- `cleanQuery(queryText)` - Removes metadata comments from query
- `extractQueryParams(queryText)` - Finds `{{paramName}}` placeholders
- `substituteParams(queryText, params)` - Replaces placeholders with values
- `isAggregationQuery(query)` - Detects if query has aggregation operators

**Supported Metadata Directives**:
```typescript
// @name Query Name
// @from -24h
// @to now
// @timezone UTC
// @mode records|messages
// @output table|json|csv|webview
// @byReceiptTime true|false
// @autoParsingMode AutoParse|Manual
// @debug true|false
// @param param_name=value
```

**Parameter Substitution**:
- Extracts `{{paramName}}` placeholders from query text
- Uses `@param` directive values or prompts user for missing values
- Replaces all placeholders with actual values before execution

### 2. Query Executor Utility (`src/utils/queryExecutor.ts`)

**Purpose**: Reusable query execution logic for programmatic queries (no metadata parsing).

**Exported Functions**:
- `executeQueryForRecords(context, options)` - Execute query and return records
- `executeQueryForMessages(context, options)` - Execute query and return messages

**Options Interface**:
```typescript
interface QueryExecutionOptions {
    query: string;              // Pre-processed query (no metadata)
    profileName: string;        // Profile to execute against
    from?: string;              // Default: '-1h'
    to?: string;                // Default: 'now'
    timeZone?: string;          // Default: 'UTC'
    byReceiptTime?: boolean;    // Default: false
    autoParsingMode?: 'AutoParse' | 'Manual';
    onProgress?: (message: string) => void;
    debug?: boolean;            // Default: false
}
```

**Use Cases**:
- Programmatic queries (e.g., metadata caching)
- Pre-processed queries without metadata directives
- Background queries from other features

## Query Execution Commands

All user-facing query commands use the shared metadata module:

### 1. Run Query (`sumologic.runQuery`)

**File**: `src/commands/runQuery.ts`

**Flow**:
```
1. Parse metadata from .sumo file (parseQueryMetadata)
2. Clean query (cleanQuery)
3. Extract parameters (extractQueryParams)
4. Prompt for missing parameters
5. Substitute parameters (substituteParams)
6. Execute query with SearchJobClient
7. Display results (table/JSON/CSV/webview based on @output)
```

**Features**:
- Supports all metadata directives
- Handles `{{params}}` substitution
- Respects active profile
- Multiple output formats
- Field analysis and charting

### 2. Run in Webview (`sumologic.runQueryWebview`)

**File**: `src/commands/runQueryWebview.ts`

**Flow**:
```
1. Parse metadata (parseQueryMetadata)
2. Clean query (cleanQuery)
3. Extract & substitute parameters (extractQueryParams, substituteParams)
4. Execute query with SearchJobClient
5. Force webview output (ignores @output directive)
```

**Features**:
- Same metadata & parameter handling as Run Query
- Always displays in webview
- Interactive table with filtering, sorting, export

### 3. Quick Chart (`sumologic.runQueryAndChart`)

**File**: `src/commands/runQueryAndChart.ts`

**Flow**:
```
1. Parse metadata (parseQueryMetadata)
2. Clean query (cleanQuery)
3. Extract & substitute parameters (extractQueryParams, substituteParams)
4. Execute query in records mode
5. Generate CSV and automatic chart
```

**Features**:
- Same metadata & parameter handling
- Forces records mode for charting
- Automatic CSV generation
- Launches chart visualization

### 4. Open in Sumo UI (`sumologic.openSearchInWeb`)

**File**: `src/commands/openSearchInWeb.ts`

**Flow**:
```
1. Parse metadata for @from/@to (parseQueryMetadata)
2. Clean query (cleanQuery)
3. Build Sumo Logic web URL
4. Open in browser
```

**Features**:
- Uses metadata for time range
- No parameter substitution (opens in Sumo UI)
- Respects active profile region

## Quick Actions & Code Lenses

**File**: `src/providers/codeLensProvider.ts`

All quick actions in .sumo files trigger the same commands:
- ▶ Run Query → `sumologic.runQuery`
- 📊 Run in Webview → `sumologic.runQueryWebview`
- 📈 Quick Chart → `sumologic.runQueryAndChart`
- 🌐 Edit in Sumo UI → `sumologic.openSearchInWeb`

These all use the shared metadata module, ensuring consistent behavior.

## Profile Management

All query execution respects the active profile:

1. **Profile Selection**: `ProfileManager.getActiveProfile()`
2. **Credentials**: `ProfileManager.getProfileCredentials(profileName)`
3. **Endpoint**: `ProfileManager.getProfileEndpoint(profile)`
4. **Region**: Profile configuration determines API endpoint

## Search Job API Usage

Direct `SearchJobClient` usage locations:

### User-Facing Commands (Use Metadata Module)
- ✅ `src/commands/runQuery.ts` - Uses shared metadata module
- ✅ `src/commands/runQueryWebview.ts` - Uses shared metadata module
- ✅ `src/commands/runQueryAndChart.ts` - Uses shared metadata module

### Utility Functions (No Metadata Needed)
- ✅ `src/utils/queryExecutor.ts` - Programmatic execution, pre-processed queries
- ✅ `src/commands/cacheKeyMetadata.ts` - Uses queryExecutor for metadata caching

### Tests
- ✅ `src/test/integration/searchJob.test.ts` - API integration tests
- ✅ `src/test/integration/queryExecution.test.ts` - End-to-end query tests

### API Implementation
- ✅ `src/api/searchJob.ts` - SearchJobClient implementation

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User .sumo File                         │
│                                                                 │
│  // @name My Query                                              │
│  // @from -24h                                                  │
│  // @to now                                                     │
│  // @param category=*                                           │
│                                                                 │
│  _sourcecategory = {{category}}                                 │
│  | sum(_size) as bytes, count by _sourcecategory               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              services/queryMetadata.ts (Shared)                 │
│                                                                 │
│  1. parseQueryMetadata() → Extract all @directives             │
│  2. cleanQuery() → Remove metadata comments                     │
│  3. extractQueryParams() → Find {{param}} placeholders          │
│  4. substituteParams() → Replace with values                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Query Execution Layer                        │
│                                                                 │
│  User Commands:              Programmatic:                     │
│  • runQuery.ts              • queryExecutor.ts                  │
│  • runQueryWebview.ts       • cacheKeyMetadata.ts              │
│  • runQueryAndChart.ts                                          │
│  • openSearchInWeb.ts                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ProfileManager                               │
│                                                                 │
│  • Get active profile                                           │
│  • Get credentials (accessId, accessKey)                        │
│  • Get endpoint (based on region)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SearchJobClient                              │
│                                                                 │
│  1. createSearchJob(request)                                    │
│  2. pollForCompletion(jobId)                                    │
│  3. getRecords(jobId) OR getMessages(jobId)                     │
│  4. deleteSearchJob(jobId)                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Sumo Logic Search Job API                      │
│              https://api.{region}.sumologic.com                 │
└─────────────────────────────────────────────────────────────────┘
```

## Consistency Guarantees

All query execution paths ensure:

1. ✅ **Metadata Parsing**: All user-facing commands parse `@directives` using `parseQueryMetadata()`
2. ✅ **Parameter Handling**: All commands support `{{param}}` substitution
3. ✅ **Query Cleaning**: Metadata directives are removed before execution
4. ✅ **Profile Respect**: Active profile credentials and endpoint are always used
5. ✅ **Time Parsing**: Relative times (`-1h`, `-24h`) are parsed consistently
6. ✅ **Error Handling**: Consistent error messages and user prompts

## Testing Coverage

### Unit Tests (`src/test/suite/queryMetadata.test.ts`)
- 49 test cases covering all metadata parsing functions
- Parameter extraction and substitution
- Edge cases and real-world queries
- Includes the test query: `_sourcecategory = * | sum(_size) as bytes, count by _sourcecategory, _sourcehost, _collector`

### Integration Tests (`src/test/integration/queryExecution.test.ts`)
- 6 integration tests with live API calls
- Full query flow: parse → clean → substitute → execute
- Profile credential verification
- Messages and records mode execution
- -24h time range queries

## Extension Points

To add new query execution features:

1. **Import shared module**:
   ```typescript
   import {
       parseQueryMetadata,
       cleanQuery,
       extractQueryParams,
       substituteParams
   } from '../services/queryMetadata';
   ```

2. **Follow standard flow**:
   ```typescript
   // Parse metadata
   const metadata = parseQueryMetadata(queryText);
   let cleanedQuery = cleanQuery(queryText);

   // Handle parameters
   const params = extractQueryParams(cleanedQuery);
   // ... prompt for missing params
   cleanedQuery = substituteParams(cleanedQuery, paramValues);

   // Execute with profile
   const profile = await profileManager.getActiveProfile();
   const credentials = await profileManager.getProfileCredentials(profile.name);
   const client = new SearchJobClient({ ... });
   ```

3. **Use metadata directives**:
   ```typescript
   const fromTime = SearchJobClient.parseRelativeTime(metadata.from || '-1h');
   const toTime = SearchJobClient.parseRelativeTime(metadata.to || 'now');
   const timeZone = metadata.timeZone || 'UTC';
   const mode = metadata.mode || 'records';
   ```

## Summary

The refactored architecture ensures:

- **Single source of truth** for metadata parsing
- **Consistent parameter handling** across all commands
- **Reusable utilities** for programmatic queries
- **Complete test coverage** for critical query flow
- **Profile-aware execution** for all queries
- **Extensible design** for future features

All quick actions, toolbar buttons, and command palette commands now use the same underlying query execution logic, ensuring users get consistent behavior regardless of how they run their queries.

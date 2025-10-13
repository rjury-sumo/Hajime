# Hajime - Sumo Logic VS Code Extension

## Project Overview

Hajime is a comprehensive Visual Studio Code extension that provides language support, API integration, and development tools for Sumo Logic query language (`.sumo` files). The extension enables developers to write, execute, and manage Sumo Logic queries directly within VS Code, with full multi-profile support for managing multiple Sumo Logic deployments.

## Key Features

### 1. Language Support
- **Syntax Highlighting**: Full syntax highlighting for Sumo Logic query language (`.sumo` files)
- **Autocomplete**: Context-aware autocomplete for:
  - Sumo Logic operators (parse, where, count, timeslice, etc.)
  - Built-in functions and fields
  - 4500+ parser snippets from Sumo Logic apps (filterable by app name)
  - Dynamically discovered fields from query results
  - Custom fields fetched from API
  - Partitions for `_index` and `_view` usage
  - Metadata field values (e.g., _sourceCategory values after typing `=`)
- **Persistent Autocomplete**: Per-profile autocomplete data stored in workspace state

### 2. Query Execution
- **Run Query Command**: Execute `.sumo` queries directly from VS Code
- **Toolbar Button**: Quick-access play button in editor toolbar for `.sumo` files
- **Query Metadata Directives**: Comment-based configuration:
  ```
  // @from -7d
  // @to now
  // @timezone UTC
  // @mode records
  // @output csv
  ```
- **Multiple Output Formats**:
  - Table (formatted plain text)
  - JSON
  - CSV (records mode only)
- **Automatic Mode Detection**: Smart detection of aggregation vs. raw queries
- **Progress Tracking**: Real-time status updates during query execution

### 3. Multi-Profile Support
- **Profile Management**: Create and manage multiple Sumo Logic deployment profiles
- **Secure Credential Storage**: Credentials stored in VS Code Secret Storage
- **Profile Configuration**:
  - Profile name
  - Access ID and Access Key
  - Deployment region or custom endpoint
  - Per-profile personal folder ID
- **Visual Indicators**: Active profile shown in status bar
- **Quick Switching**: Switch between profiles with command palette

### 4. Content Library Integration
- **Personal Folder**: Fetch and view user's personal folder with properties and contents
- **Folder by ID**: Retrieve any folder by ID with tabular content display
- **Content by Path/ID**: Fetch individual content items by full path or content ID
- **Content Export**: Full export of content items with async job polling
  - Export any content item (folders, dashboards, searches, etc.) with complete definition
  - Export special system folders (Admin Recommended, Global, Installed Apps)
  - Dual output format: JSON + Markdown summary
  - Markdown includes formatted tables for children, panels, and properties
  - Automatic async job polling with timeout handling
  - Smart filename handling: timestamped for regular exports, overwriting for system folders
- **Formatted Output**: Professional table formatting for folder contents showing:
  - Name, Type, ID
  - Description
  - Modified timestamp

### 5. API Integration
- **Search Job API**: Full integration with Sumo Logic Search Job API v2
  - Create search jobs
  - Poll for completion
  - Fetch records and messages
  - Automatic job cleanup
- **Content API**: Integration with Content Library API v2
  - Get personal folder
  - Get folder by ID
  - Get content by path or ID
  - Export content with async job polling (folders, dashboards, searches, etc.)
  - Export special system folders (Admin Recommended, Global, Installed Apps)
  - Dual output: full JSON export + formatted markdown summary
- **Custom Fields API**: Fetch custom field schemas from deployment
- **Partitions API**: Fetch partition definitions for autocomplete
- **Collectors API**: Full Collector Management API integration
  - List all collectors with automatic pagination (>1000 support)
  - Get individual collector by ID
  - List sources for a collector with pagination
  - Statistics and health monitoring

### 6. Data Visualization
- **Webview Query Results**: Interactive paginated table with sorting and filtering
- **Auto-Charting**: Automatic chart generation from query results (line, bar, pie, scatter)
- **CSV Charting**: Visualize any CSV file with interactive ECharts
- **Configurable Page Size**: User-configurable pagination in webview

### 7. File Management
- **Output Organization**: Profile-specific output directories (`output/<profile>/<type>/`)
- **Timestamped Files**: All outputs include timestamps for version tracking
- **Automatic Cleanup**: Command to remove old output files by age
- **JSON Support**: Full JSON output for API responses (collectors, sources, folders)

## Architecture

### Core Components

#### Extension Entry Point (`src/extension.ts`)
- Activates extension and registers all commands
- Initializes completion providers (static + dynamic)
- Sets up status bar manager
- Loads per-profile autocomplete data on activation

#### API Clients (`src/api/`)
- **`client.ts`**: Base `SumoLogicClient` with authentication and request handling
- **`searchJob.ts`**: `SearchJobClient` for query execution
- **`content.ts`**: `ContentClient` for folder/library operations
  - Get content by path or ID
  - Export content with async job polling
  - Export special folders (Admin Recommended, Global, Installed Apps)
  - Format export summaries as markdown with tables
- **`customFields.ts`**: `CustomFieldsClient` for custom field schema fetching
- **`partitions.ts`**: `PartitionsClient` for partition definition fetching
- **`collectors.ts`**: `CollectorsClient` for collector and source management
  - List collectors with pagination
  - Get collector by ID
  - List sources with pagination
  - Automatic pagination for >1000 items
  - Statistics generation (alive/dead, by type)

#### Commands (`src/commands/`)
- **`authenticate.ts`**: Profile management (create, switch, list, delete, test)
- **`runQuery.ts`**: Query execution with metadata parsing
- **`runQueryWebview.ts`**: Interactive webview table with pagination
- **`runQueryAndChart.ts`**: Automatic chart generation from query results
- **`chartCSV.ts`**: Visualize CSV files with interactive charts
- **`personalFolder.ts`**: Content library commands
  - Personal folder and folder-by-ID commands
  - Get content by path or ID
  - Export content (any type: folders, dashboards, searches)
  - Export special folders (Admin Recommended, Global, Installed Apps)
  - Shared export handler with job polling and dual output format
- **`customFields.ts`**: Fetch custom fields for autocomplete
- **`partitions.ts`**: Fetch partitions for autocomplete
- **`collectors.ts`**: Collector and source management
  - Fetch all collectors
  - Get collector by ID
  - Get sources for collector
- **`viewAutocomplete.ts`**: View and clear autocomplete data
- **`cleanupOldFiles.ts`**: Remove old output files by age
- **`cacheKeyMetadata.ts`**: Cache metadata field values for autocomplete
- **`newSumoFile.ts`**: Create new query file with template

#### Language Support (`src/`)
- **`completionProvider.ts`**: Static autocomplete (operators, functions, fields)
- **`dynamicCompletions.ts`**: Dynamic autocomplete with persistence
- **`parserCompletions.ts`**: 4500+ parser templates from Sumo Logic apps
- **`metadataCompletions.ts`**: Context-aware metadata field value suggestions
- **Syntax Highlighting**: TextMate grammar in `syntaxes/sumo.tmLanguage.json`

#### Profile & State Management
- **`profileManager.ts`**: Profile CRUD operations and active profile management
  - Profile directory creation and management
  - Per-profile output directories (`output/<profile>/`)
  - Subdirectories: `queries/`, `customfields/`, `partitions/`, `collectors/`, `content/`, `metadata/`
- **`statusBar.ts`**: Status bar UI showing active profile
- **`outputWriter.ts`**: Centralized file writing with optional timestamps and auto-open
- **`dynamicCompletions.ts`**: Per-profile autocomplete state storage

### Data Flow

```
User creates profile
  └─> Credentials stored in Secret Storage
  └─> Profile config stored in workspace settings
  └─> StatusBar updates

User runs query
  └─> Parse metadata directives (@from, @to, @mode, @output)
  └─> Create SearchJob via API
  └─> Poll for completion
  └─> Fetch results (records or messages)
  └─> Extract fields and add to autocomplete
  └─> Save autocomplete data to workspace state
  └─> Format and display results

User switches profile
  └─> Load autocomplete data for new profile
  └─> Update status bar
  └─> All subsequent API calls use new profile credentials
```

### Storage Strategy

- **Secret Storage**: Access credentials (Access ID and Access Key)
- **Workspace Settings**: Profile configurations and active profile name
- **Workspace State**: Per-profile autocomplete data keyed as `sumologic.autocomplete.{profileName}`

## Technical Implementation Details

### Query Metadata Parsing

The extension parses special comment directives in query files:

```typescript
function parseQueryMetadata(queryText: string): {
    from?: string;
    to?: string;
    timeZone?: string;
    mode?: 'records' | 'messages';
    output?: 'table' | 'json' | 'csv';
}
```

Supported directives:
- `// @from -1h` - Start time (relative or absolute)
- `// @to now` - End time (relative or absolute)
- `// @timezone UTC` - Timezone for query execution
- `// @mode records` - Result type (records or messages)
- `// @output csv` - Output format (table, json, or csv)

These directives are stripped from the query before execution.

### Persistent Autocomplete

Per-profile autocomplete data structure:

```typescript
interface ProfileAutocompleteData {
    discoveredFields: string[];  // Fields found in query results
    customFields: string[];      // Fields from Custom Fields API
    partitions: string[];        // Partitions from Partitions API
}
```

Storage key format: `sumologic.autocomplete.{profileName}`

The system:
1. Loads autocomplete data when profile is activated
2. Automatically saves when new fields/partitions are added
3. Clears data when profile is deleted
4. Maintains separate datasets per profile

### Parser Snippets

The extension includes 282 parser snippets extracted from Sumo Logic apps, formatted with line breaks before pipe operators for readability:

```typescript
{
    parser: "json field=_raw \"CW_RAW_MESSAGE\" as message nodrop\n| parse regex field=message ...",
    app: "Amazon VPC Flow Logs"
}
```

### Content API Integration

The Content API integration provides formatted views of Sumo Logic library structure:

```typescript
interface ContentItem {
    id: string;
    name: string;
    itemType: string;
    parentId: string;
    permissions: string[];
    description?: string;
    createdAt: string;
    createdBy: string;
    modifiedAt: string;
    modifiedBy: string;
    children?: ContentItem[];
}
```

Output formatting includes:
- Property list section
- Tabular children display with columns: Name, Type, ID, Description, Modified At

## Commands Reference

| Command | Description | Keyboard Shortcut |
|---------|-------------|-------------------|
| **Profile Management** | | |
| `Sumo Logic: Create/Update Connection Profile` | Create or update a profile | - |
| `Sumo Logic: Switch Profile` | Switch active profile | - |
| `Sumo Logic: List Profiles` | List all profiles | - |
| `Sumo Logic: Delete Profile` | Delete a profile | - |
| `Sumo Logic: Test Connection` | Test API connectivity | - |
| **Query Execution** | | |
| `Sumo Logic: Run Query` | Execute query (table/JSON/CSV) | - |
| `Sumo Logic: Run Query in Webview` | Execute with interactive table | - |
| `Sumo Logic: Run Query and Chart Results` | Execute and auto-chart | - |
| **Data Visualization** | | |
| `Sumo Logic: Chart CSV Data` | Chart any CSV file | - |
| **API Data Fetching** | | |
| `Sumo Logic: Fetch Custom Fields for Autocomplete` | Update custom field autocomplete | - |
| `Sumo Logic: Fetch Partitions for Autocomplete` | Update partition autocomplete | - |
| `Sumo Logic: Fetch Collectors` | List all collectors | - |
| `Sumo Logic: Get Collector by ID` | Get single collector details | - |
| `Sumo Logic: Get Sources for Collector` | List collector sources | - |
| **Content Library** | | |
| `Sumo Logic: Get Personal Folder` | View personal folder | - |
| `Sumo Logic: Get Folder by ID` | View any folder by ID | - |
| `Sumo Logic: Get Content by Path` | Fetch content by full path | - |
| `Sumo Logic: Get Content by ID` | Fetch content by ID | - |
| `Sumo Logic: Export Content` | Export any content item with full definition | - |
| `Sumo Logic: Export Admin Recommended Folder` | Export Admin Recommended system folder | - |
| `Sumo Logic: Export Global Folder` | Export Global system folder | - |
| `Sumo Logic: Export Installed Apps Folder` | Export Installed Apps system folder | - |
| **Autocomplete & Cache** | | |
| `Sumo Logic: View Autocomplete Data` | Show stored autocomplete items | - |
| `Sumo Logic: Clear Autocomplete Data` | Clear autocomplete for profile | - |
| `Sumo Logic: Cache Key Metadata` | Cache metadata values | - |
| **Utilities** | | |
| `Sumo Logic: New Query File` | Create new .sumo file | - |
| `Sumo Logic: Cleanup Old Files` | Remove old output files | - |

## Configuration

### Profile Settings

Stored in workspace/user settings under `sumologic.profiles`:

```json
{
  "sumologic.profiles": [
    {
      "name": "Production",
      "region": "us1",
      "personalFolderId": "0000000000ABC123"
    }
  ],
  "sumologic.activeProfile": "Production"
}
```

### Supported Regions

- us1, us2, au, ca, de, eu, fed, in, jp
- Custom endpoint support via `endpoint` property

## Development

### Project Structure

```
Hajime/
├── src/
│   ├── api/              # API client implementations
│   ├── commands/         # Command implementations
│   ├── extension.ts      # Extension entry point
│   ├── completionProvider.ts
│   ├── dynamicCompletions.ts
│   ├── profileManager.ts
│   ├── statusBar.ts
│   ├── parserSnippets.ts
│   └── sumoSyntax.json
├── docs/                 # Documentation
├── package.json          # Extension manifest
├── tsconfig.json         # TypeScript configuration
└── README.md             # User documentation
```

### Build Commands

```bash
npm install           # Install dependencies
npm run compile       # Compile TypeScript
npm run watch         # Watch mode for development
npm run lint          # Run ESLint
```

### Key Dependencies

- VS Code Extension API (^1.74.0)
- TypeScript (^5.5.2)
- ECharts (^6.0.0) - for charting
- Node.js built-in modules (https, http)

## Recent Enhancements

### Session 7 (Phase 3: Results & Visualization - Current)
1. **Query Performance Metrics**: Added execution time and job statistics tracking
   - Execution time calculated from job creation to results retrieval
   - Job stats (record count, message count) captured from polling
   - Metrics displayed in webview header with formatted execution time
   - Enhanced `formatRecordsAsHTML` to accept `executionTime` and `jobStats` parameters

2. **Enhanced Export Options**: Multiple export formats with filtering
   - **Export to JSON**: New export function for JSON format with proper formatting
   - **Export to CSV**: Existing CSV export maintained
   - Both exports respect visible columns and applied filters
   - Message passing to extension host for file save dialogs
   - Separate handlers for CSV and JSON export in extension

3. **Copy Functionality**: Copy visible data to clipboard
   - **Copy Visible** button copies filtered data in tab-separated format
   - Uses navigator.clipboard API for modern clipboard access
   - Shows temporary notification on successful copy
   - Respects column visibility and data filters
   - Tab-separated format for easy paste into spreadsheets

4. **Improved Webview Features**:
   - Column management (show/hide via dropdown menu)
   - Global search across all columns
   - Column resizing with drag handles
   - Per-column filtering
   - Pagination with configurable page size
   - Sortable columns (click headers)

**Files Modified:**
- `src/commands/runQuery.ts` - Enhanced webview with performance metrics, JSON export, copy functionality
- `README.md` - Updated with Phase 3 features and enhanced documentation
- `docs/project_summary.md` - Added Session 7 documentation

**User Benefits:**
- Visibility into query performance for optimization
- Flexible export options for different use cases
- Quick copy for sharing data snippets
- Professional data exploration experience

### Session 6 (Phase 2: Developer Experience)
1. **Keyboard Shortcuts**: Implemented intuitive keyboard shortcuts for power users
   - `Cmd/Ctrl+Enter`: Run Query
   - `Cmd/Ctrl+Shift+Enter`: Run Query in Webview
   - `Cmd/Ctrl+Shift+C`: Run Query and Chart
   - `Cmd/Ctrl+Shift+N`: New Query File
   - `Cmd/Ctrl+K Cmd/Ctrl+S`: Switch Profile
2. **Enhanced Status Bar**: Major status bar improvements
   - Connection status indicator (✓ connected / ✗ disconnected / ? unknown)
   - Clickable connection status to test connection
   - Last query execution time tracking
   - Detailed tooltips with profile info, region, and last query time
   - Both profile and connection status items in status bar
3. **Status Bar Integration**: Updated commands to interact with status bar
   - Test connection command updates connection status
   - Run query command updates last query time and connection status
   - Status bar manager exported for use by commands
4. **Command Organization**: All commands already have consistent "Sumo Logic:" prefix (verified)

### Session 1 (Initial Development)
- Initial project setup with syntax highlighting
- Basic autocomplete for operators and functions
- Search Job API integration
- Multi-profile support with secure credential storage
- 282 parser snippets from Sumo Logic apps
- Custom fields and partitions API integration

### Session 2 (Parser & Autocomplete Improvements)
1. **Parser Snippet Expansion**: Expanded from 282 to 4500+ parser snippets
2. **Parser Formatting**: Line breaks before pipe operators for readability
3. **Output Format Directive**: Added `@output` directive (table/json/csv)
4. **Persistent Autocomplete**: Per-profile autocomplete persistence
5. **View/Clear Autocomplete**: Commands to inspect and manage autocomplete
6. **Run Query Button**: Toolbar button for quick query execution
7. **Content Library Integration**: Personal folder and folder-by-ID commands

### Session 3 (Visualization & Advanced Features)
1. **Webview Query Results**: Interactive paginated table with sorting/filtering
2. **Auto-Charting**: Automatic chart generation from query results
3. **CSV Charting**: Visualize any CSV file with ECharts
4. **Metadata Autocomplete**: Context-aware suggestions for metadata field values
5. **File Cleanup**: Command to remove old output files by age
6. **New Query File**: Template creation for new .sumo files
7. **Output Organization**: Profile-specific directory structure

### Session 4 (Collector Management)
1. **Collectors API Integration**: Full Collector Management API support
   - `fetchCollectorsCommand`: List all collectors with pagination
   - `getCollectorCommand`: Get single collector by ID
   - `getSourcesCommand`: Get sources for a collector
2. **Automatic Pagination**: Handle >1000 collectors/sources automatically
3. **JSON Output**: Full JSON formatting for API responses
4. **Statistics**: Collector health stats (alive/dead, by type, ephemeral count)
5. **Integration Testing**: Comprehensive test suite for collectors API
6. **Documentation**: Updated README and PROJECT_SUMMARY with all new features

### Session 5 (Content Export - Current)
1. **Content Retrieval Commands**: Get content by path or ID
   - `getContentByPathCommand`: Fetch content using full library path
   - `getContentByIdCommand`: Fetch content by ID with path lookup
   - Support for both summary and JSON output formats
2. **Content Export with Async Job Polling**: Full export functionality
   - `exportContentCommand`: Export any content item (folders, dashboards, searches, etc.)
   - Async job pattern: start job → poll status → retrieve result
   - Configurable timeout (default 300 seconds)
   - Automatic error handling for permissions, timeouts, not found
3. **Special System Folder Exports**: Three special folder types
   - `exportAdminRecommendedCommand`: Admin Recommended folder
   - `exportGlobalFolderCommand`: Global folder (uses `data` property instead of `children`)
   - `exportInstalledAppsCommand`: Installed Apps folder
   - GET method for all folder exports (not POST)
4. **Dual Output Format**: JSON + Markdown for all exports
   - Full JSON export with complete content definition
   - Markdown summary with formatted tables and properties
   - Markdown includes clickable link to JSON file
   - Only markdown file opens in editor (JSON saved but not opened)
5. **Smart Filename Handling**: Different strategies for different export types
   - Regular content exports: Timestamped files for version tracking
   - System folder exports: Single overwriting file (no timestamp)
6. **Flexible Content Structure Support**: Handle various API response formats
   - Standard folders: `children` array
   - Global folder: `data` array instead of `children`
   - Graceful handling of missing `name` or `type` properties
7. **Rich Markdown Formatting**: Professional summary output
   - Property tables with key-value pairs
   - Children tables with ID, Name, Type, Description, Has Children columns
   - Panels tables for dashboard exports
   - Search configuration sections
   - Nested children counting for accurate item totals
8. **Shared Export Handler**: Reusable code pattern
   - Single `handleExport()` function handles all export types
   - Consistent UX across all export commands
   - Prompts for `isAdminMode` parameter
   - Progress notifications during async operations
9. **Integration Testing**: Comprehensive test coverage
   - Tests for all export types with real API endpoints
   - Graceful handling of 403, 404, 405, 408 errors
   - Detailed logging of API endpoints being called
10. **OutputWriter Enhancement**: Optional timestamp control
    - Added `includeTimestamp` parameter to `writeOutput()` and `writeAndOpen()`
    - Allows system folder exports to overwrite previous versions

## Future Enhancement Ideas

- Tree view for content library exploration
- Query history tracking
- Saved queries management
- Real-time log streaming
- Dashboard and alert management
- Field extraction testing
- Query performance analysis
- Collaborative query sharing
- Git integration for queries
- Query templates library

## API Documentation References

- [Sumo Logic API Docs](https://api.sumologic.com/docs/)
- [Search Job API](https://api.sumologic.com/docs/#tag/searchJobManagement)
- [Content API v2](https://api.sumologic.com/docs/#tag/contentManagement)
  - Get Personal Folder: `GET /api/v2/content/folders/personal`
  - Get Folder: `GET /api/v2/content/folders/{id}`
  - Get Content by Path: `GET /api/v2/content/path?path={path}`
  - Get Content Path: `GET /api/v2/content/{id}/path`
  - Export Content (async):
    - Start: `POST /api/v2/content/{id}/export`
    - Status: `GET /api/v2/content/{id}/export/{jobId}/status`
    - Result: `GET /api/v2/content/{id}/export/{jobId}/result`
  - Export Admin Recommended (async):
    - Start: `GET /api/v2/content/folders/adminRecommended`
    - Status: `GET /api/v2/content/folders/adminRecommended/{jobId}/status`
    - Result: `GET /api/v2/content/folders/adminRecommended/{jobId}/result`
  - Export Global Folder (async):
    - Start: `GET /api/v2/content/folders/global`
    - Status: `GET /api/v2/content/folders/global/{jobId}/status`
    - Result: `GET /api/v2/content/folders/global/{jobId}/result`
  - Export Installed Apps (async):
    - Start: `GET /api/v2/content/folders/installedApps`
    - Status: `GET /api/v2/content/folders/installedApps/{jobId}/status`
    - Result: `GET /api/v2/content/folders/installedApps/{jobId}/result`
- [Custom Fields API](https://api.sumologic.com/docs/#operation/listBuiltInFields)
- [Partitions API](https://api.sumologic.com/docs/#operation/listPartitions)
- [Collector Management API](https://help.sumologic.com/docs/api/collector-management/collector-api-methods-examples/)
  - List Collectors: `GET /api/v1/collectors`
  - Get Collector: `GET /api/v1/collectors/{id}`
  - List Sources: `GET /api/v1/collectors/{id}/sources`

## License

(Add license information if applicable)

## Contributing

(Add contribution guidelines if applicable)

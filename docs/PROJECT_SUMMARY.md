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
- **Content API**: Integration with Content Library API
  - Get personal folder
  - Get folder by ID
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
- **`personalFolder.ts`**: Personal folder and folder-by-ID commands
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
  - Subdirectories: `queries/`, `customfields/`, `partitions/`, `collectors/`, `metadata/`
- **`statusBar.ts`**: Status bar UI showing active profile
- **`outputWriter.ts`**: Centralized file writing with timestamps and auto-open
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

### Session 4 (Collector Management - Current)
1. **Collectors API Integration**: Full Collector Management API support
   - `fetchCollectorsCommand`: List all collectors with pagination
   - `getCollectorCommand`: Get single collector by ID
   - `getSourcesCommand`: Get sources for a collector
2. **Automatic Pagination**: Handle >1000 collectors/sources automatically
3. **JSON Output**: Full JSON formatting for API responses
4. **Statistics**: Collector health stats (alive/dead, by type, ephemeral count)
5. **Integration Testing**: Comprehensive test suite for collectors API
6. **Documentation**: Updated README and PROJECT_SUMMARY with all new features

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
- [Content API](https://api.sumologic.com/docs/#tag/contentManagement)
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

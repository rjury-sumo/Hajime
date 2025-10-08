# Hajime - Sumo Logic VS Code Extension

## Project Overview

Hajime is a comprehensive Visual Studio Code extension that provides language support, API integration, and development tools for Sumo Logic query language (`.sumo` files). The extension enables developers to write, execute, and manage Sumo Logic queries directly within VS Code, with full multi-profile support for managing multiple Sumo Logic deployments.

## Key Features

### 1. Language Support
- **Syntax Highlighting**: Full syntax highlighting for Sumo Logic query language (`.sumo` files)
- **Autocomplete**: Context-aware autocomplete for:
  - Sumo Logic operators (parse, where, count, timeslice, etc.)
  - Built-in functions and fields
  - 282 parser snippets from Sumo Logic apps
  - Dynamically discovered fields from query results
  - Custom fields fetched from API
  - Partitions for `_index` and `_view` usage
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
- **`customFields.ts`**: Custom field schema fetching
- **`partitions.ts`**: Partition definition fetching

#### Commands (`src/commands/`)
- **`authenticate.ts`**: Profile management (create, switch, delete)
- **`runQuery.ts`**: Query execution with metadata parsing
- **`personalFolder.ts`**: Personal folder and folder-by-ID commands
- **`viewAutocomplete.ts`**: View and clear autocomplete data

#### Language Support (`src/`)
- **`completionProvider.ts`**: Static autocomplete (operators, functions, fields)
- **`dynamicCompletions.ts`**: Dynamic autocomplete with persistence
- **`parserSnippets.ts`**: 282 parser templates from Sumo Logic apps
- **`sumoSyntax.json`**: TextMate grammar for syntax highlighting

#### Profile & State Management
- **`profileManager.ts`**: Profile CRUD operations and active profile management
- **`statusBar.ts`**: Status bar UI showing active profile
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
| `Sumo Logic: Configure Credentials` | Create a new profile | - |
| `Sumo Logic: Switch Profile` | Switch active profile | - |
| `Sumo Logic: Delete Profile` | Delete a profile | - |
| `Sumo Logic: Run Query` | Execute current query | - |
| `Sumo Logic: Get Personal Folder` | View personal folder | - |
| `Sumo Logic: Get Folder by ID` | View any folder by ID | - |
| `Sumo Logic: Fetch Custom Fields` | Update custom field autocomplete | - |
| `Sumo Logic: Fetch Partitions` | Update partition autocomplete | - |
| `Sumo Logic: View Autocomplete Data` | Show stored autocomplete items | - |
| `Sumo Logic: Clear Autocomplete Data` | Clear autocomplete for profile | - |

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

- VS Code Extension API (^1.96.0)
- TypeScript (^5.7.2)
- Node.js built-in modules (https, querystring)

## Recent Enhancements

### Session 1 (Previous)
- Initial project setup
- Syntax highlighting and basic autocomplete
- Search Job API integration
- Multi-profile support
- Parser snippets integration
- Custom fields and partitions API integration

### Session 2 (Current)
1. **Parser Snippet Formatting**: Reformatted 282 snippets with line breaks before pipe operators
2. **Output Format Directive**: Added `@output` directive support for specifying output format in query files
3. **Persistent Autocomplete**: Implemented per-profile autocomplete persistence in workspace state
4. **View/Clear Autocomplete**: Added commands to inspect and manage autocomplete data
5. **Run Query Button**: Added toolbar button for quick query execution
6. **Content Library Integration**: Added personal folder and folder-by-ID commands

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

## License

(Add license information if applicable)

## Contributing

(Add contribution guidelines if applicable)

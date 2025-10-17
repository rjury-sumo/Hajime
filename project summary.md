# Hajime - Sumo Logic Query Language Extension

## Project Overview

Hajime is a comprehensive VS Code extension that transforms the editor into a complete IDE for Sumo Logic. It provides language support, query execution, content management, and data exploration capabilities for Sumo Logic users.

## Core Features

### Language & Query Development
- **Syntax Highlighting** - Full support for Sumo Logic query language
- **IntelliSense** - Context-aware autocomplete with 100+ operators, functions, and 4500+ parser snippets
- **Query Execution** - Run queries with multiple output formats (table, JSON, CSV, webview, charts)
- **Query Metadata Directives** - Control execution via comment directives (@from, @to, @mode, @output, etc.)
- **Parameterized Queries** - Use `{{param}}` placeholders with @param directives

### Multi-Profile Connection Management
- **Multiple Profiles** - Connect to different Sumo Logic deployments (prod, dev, customer environments)
- **Secure Storage** - Credentials stored via VS Code Secret Storage API
- **Quick Switching** - Switch profiles from status bar or sidebar
- **Per-Profile Data** - Isolated autocomplete, query history, and outputs

### Scopes - Log Analysis Organization
- **Scope Management** - Create, edit, delete reusable log analysis scopes
- **Search Scopes** - Define log filters (e.g., `_sourceCategory=prod/app`)
- **Multi-Profile Support** - Apply scopes to specific profiles or all profiles
- **Scope Actions**:
  - **Profile Scope** - Run facets query to analyze field distributions
  - **Sample Logs** - Retrieve sample messages (up to 1000)
  - **Cache Metadata** - Extract field values for autocomplete
  - **New Query** - Generate .sumo file with scope filter and field list
- **Partition Integration** - Auto-create scopes from partitions
- **SQLite Storage** - Global scopes database with extensible schema

### Content Library Management
- **Tree View Explorer** - Hierarchical navigation of Personal, Global, Admin Recommended, and Installed Apps
- **SQLite Caching** - Local database for fast navigation and offline access
- **Specialized Webviews** - Custom displays for dashboards (v1 & v2), searches, and generic content
- **Rich Context Menus** - 7+ actions per item (View, Open JSON, Open in Web, Copy ID, Copy Path, Export, Refresh)
- **Recursive Fetching** - Bulk download entire folder hierarchies
- **Database Viewer** - SQL query interface for exploring cached content

### Users & Roles Management
- **User Management** - Fetch and cache organization users
- **Role Management** - Browse roles with capabilities and membership
- **Interactive Webviews** - Filter, sort, search, and export users/roles
- **User Enrichment** - Automatic email mapping in library content (Created By, Modified By)
- **SQLite Storage** - Per-profile users_roles.db database

### Data Visualization
- **Interactive Webview Tables** - Paginated, sortable, filterable results
- **Apache ECharts Integration** - Auto-charting for time-series and category data
- **CSV Charting** - Visualize any CSV file with chart engine
- **Performance Metrics** - Execution time and job statistics
- **Export Options** - Export to CSV/JSON with filters applied

### API Integration
- **Query Execution API** - Run queries via Search Job API
- **Content Library API** - Browse and export content
- **Collectors API** - Manage collectors and sources
- **Custom Fields API** - Fetch field schemas
- **Partitions API** - Retrieve partition definitions
- **Users & Roles API** - Fetch organization users and roles

### Developer Experience
- **Tree View Sidebar** - Dedicated activity bar with one-click access to all features
- **CodeLens Buttons** - Inline action buttons above queries (▶ Run | 📊 Webview | 📈 Chart)
- **Keyboard Shortcuts** - Power user shortcuts for common operations
- **Status Bar Integration** - Connection status, profile switcher, query metrics
- **Recent Queries** - Intelligent tracking of opened .sumo files with persistence
- **Storage Explorer** - Browse profile-specific cached files
- **Utility Commands** - Cleanup, metadata management, autocomplete cache

## Technical Architecture

### Storage Structure
```
~/.sumologic/
├── _global/
│   └── scopes/
│       └── scopes.db              # Global scopes database
├── {profile}/
│   ├── metadata/
│   │   ├── library.db             # Content library cache
│   │   └── users_roles.db         # Users and roles cache
│   ├── queries/                   # Query results and .sumo files
│   ├── collectors/                # Collector exports
│   ├── content/                   # Content exports
│   ├── customfields/              # Field schemas
│   ├── partitions/                # Partition definitions
│   └── searches/                  # Saved search exports
```

### Key Technologies
- **TypeScript** - Primary language
- **better-sqlite3** - Native SQLite for caching
- **Apache ECharts** - Data visualization
- **VS Code Extension API** - UI components and integration
- **Sumo Logic REST API** - All backend interactions

### Database Schema

#### Scopes (scopes.db)
- Stores scope definitions with search filters, descriptions, and context
- Multi-profile support (profiles field)
- Action results cached as file paths
- Timestamps for facets, sample logs, and metadata

#### Library Cache (library.db)
- Full content hierarchy with parent-child relationships
- Type-specific metadata (dashboards, searches, lookups)
- Efficient indexing for path and parent ID lookups

#### Users & Roles (users_roles.db)
- Users table with email, roles, MFA status, lock status
- Roles table with capabilities and user membership
- Helper methods for enrichment

## Extension Commands

### Scope Commands
- `sumologic.createScope` - Create a new scope
- `sumologic.editScope` - Edit existing scope
- `sumologic.deleteScope` - Delete a scope
- `sumologic.listScopes` - List all scopes
- `sumologic.viewScope` - View scope in webview
- `sumologic.viewScopesOverview` - View all scopes in table
- `sumologic.profileScope` - Run facets analysis
- `sumologic.sampleScopeLogs` - Retrieve sample logs
- `sumologic.cacheScopeMetadata` - Cache metadata from scope

### Query Commands
- `sumologic.newQueryFile` - Create new .sumo file
- `sumologic.runQuery` - Execute query with standard output
- `sumologic.runQueryInWebview` - Execute with interactive table
- `sumologic.runQueryAndChart` - Execute and auto-chart
- `sumologic.chartCSVData` - Chart any CSV file
- `sumologic.cacheKeyMetadata` - Cache field values for autocomplete

### Profile Commands
- `sumologic.createProfile` - Create connection profile
- `sumologic.switchProfile` - Switch active profile
- `sumologic.deleteProfile` - Delete profile
- `sumologic.testConnection` - Test profile connection

### Content Library Commands
- `sumologic.exportContent` - Export content item
- `sumologic.getContentByPath` - Fetch by path
- `sumologic.getContentById` - Fetch by ID
- `sumologic.exportGlobalFolder` - Export Global folder
- `sumologic.exportAdminRecommendedFolder` - Export Admin Recommended
- `sumologic.exportInstalledAppsFolder` - Export Installed Apps
- `sumologic.fetchFolderRecursively` - Bulk download folder tree
- `sumologic.openDatabaseViewer` - Browse library cache

### Users & Roles Commands
- `sumologic.fetchUsers` - Fetch all users
- `sumologic.fetchRoles` - Fetch all roles
- `sumologic.fetchUsersAndRoles` - Fetch both
- `sumologic.viewUsers` - Open users webview
- `sumologic.viewRoles` - Open roles webview

### Metadata Commands
- `sumologic.fetchCustomFields` - Fetch field schemas
- `sumologic.fetchPartitions` - Fetch partition definitions
- `sumologic.fetchCollectors` - List collectors
- `sumologic.getCollectorById` - Get collector details
- `sumologic.getSourcesForCollector` - List sources

## User Workflows

### Workflow 1: Explore Logs with Scopes
1. Create scope with search filter (e.g., `_sourceCategory=prod/api`)
2. Run "Profile Scope" to analyze field distributions
3. Review facets results showing top values per field
4. Run "Sample Logs" to preview actual log messages
5. Click "New Query" to generate .sumo file with field list
6. Customize query and execute with interactive webview

### Workflow 2: Auto-Create Scopes from Partitions
1. Open Scopes Overview webview
2. Click "Add Partition Scopes"
3. Extension creates a scope for each partition
4. Each scope includes routing expression and metadata
5. Use scopes to quickly explore partition data

### Workflow 3: Query Development with Autocomplete
1. Create new .sumo file
2. Use autocomplete for operators, functions, parsers
3. After `=` in metadata fields, see cached values
4. Run query to get results
5. Fields from results automatically added to autocomplete
6. Cache metadata from scope for richer suggestions

### Workflow 4: Content Library Exploration
1. Browse library tree in sidebar
2. Click dashboard or search to view in specialized webview
3. For searches, click "Open in .sumo File" to edit and run
4. Use Database Viewer to query cached content
5. Export entire folders recursively for offline access

### Workflow 5: Multi-Profile Development
1. Create profiles for different environments (dev, prod, customer orgs)
2. Switch profiles from status bar
3. Each profile maintains independent autocomplete and query history
4. Scopes can apply to specific profiles or all profiles
5. Recent queries track which profile was active

## Configuration

### Extension Settings
- `sumologic.fileStoragePath` - Output directory (default: `${workspaceFolder}/output`)
- `sumologic.webviewPageSize` - Rows per page in webview (default: 100)

### Query Metadata Directives
```
// @name Query Name
// @from -7d
// @to now
// @timezone UTC
// @mode records
// @output table
// @byReceiptTime false
// @autoParsingMode Manual
// @param paramName=defaultValue
```

## Development

### Build & Run
1. `npm install` - Install dependencies (auto-rebuilds native modules)
2. `F5` - Launch extension in debug mode

### Native Module Rebuild
```bash
npm run rebuild  # Manually rebuild better-sqlite3 for Electron
```

### Testing
- Unit tests in `src/test/suite/`
- Integration tests documented in `INTEGRATION_TESTING.md`

## Future Enhancements

### Potential Features
- AI-powered query suggestions using scope context
- Collaborative scope sharing across teams
- Scope templates for common log sources
- Advanced scope filtering with time-based rules
- Integration with Sumo Logic alerting
- Query history and version control
- Diff view for comparing query results
- Custom dashboard creation from webview

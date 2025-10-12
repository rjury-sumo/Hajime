# Sumo Logic Query Language Support

A comprehensive Visual Studio Code extension that provides a complete IDE experience for working with Sumo Logic. Write, execute, and visualize queries, manage multiple deployment connections, and interact with Sumo Logic APIs - all from within VS Code.

## Overview

**Hajime** transforms VS Code into a powerful development environment for Sumo Logic, offering:

### 🎯 IDE Experience for Query Development
Rich language support for `.sumo` files with intelligent autocomplete that goes beyond basic syntax:
- **hundreds ofParser Snippets** from Sumo Logic apps (AWS, Azure, GCP, security tools, etc.) Type `parser` to trigger list.
- **Dynamic Field Discovery** - fields from your query results automatically added to autocomplete
- **Context-Aware Suggestions** - metadata field values suggested as you type (e.g., `_sourceCategory=` shows your actual categories)
- **Syntax Highlighting** with full support for operators, functions, comments, and regex patterns
- **Smart Snippets** for common query patterns

### 🔌 Multi-Profile Connection Management
Connect to multiple Sumo Logic deployments and easily switch between them:
- **Secure Credential Storage** using VS Code's secret storage
- **Multiple Profiles** - Production, Development, Customer environments, etc.
- **Quick Profile Switching** from the status bar
- **Per-Profile Data** - autocomplete suggestions, query history, and outputs organized by profile
- **API Integration** - execute queries, fetch metadata, manage collectors, explore content library

### 📊 Query Execution with Multiple Output Formats
Execute queries directly from VS Code with flexible output options:
- **Traditional Output** - formatted tables, JSON, or CSV files
- **Interactive Webview** - paginated, sortable, filterable table for exploring large result sets
- **Auto-Charting** - automatic visualization with Apache ECharts (line, bar, pie, scatter charts)
- **Query Metadata Directives** - control time range, timezone, output format via comments in your query
- **Automatic Mode Detection** - smart detection of aggregated vs. raw log queries

![alt text](<docs/images/sumo buttons.png>)
![alt text](docs/images/query.webview.output.png)

### 📈 Advanced Data Visualization
Visualize query results and data files with interactive charts:
- **Automatic Chart Selection** - chooses appropriate chart type based on your data
- **Time-Series Charts** - line and area charts for timeslice queries
- **Category Charts** - bar and pie charts for aggregations
- **CSV Charting** - visualize any CSV file with the built-in chart engine
- **Apache ECharts Integration** - professional, interactive charts with zoom, pan, and export

![category](docs/images/category.echart.png)
![tiemseries](docs/images/timeseries.transpose.echart.png)

### 🔧 API Integration & Metadata Management
Fetch and manage configuration from your Sumo Logic deployment:
- **Collectors & Sources** - list, inspect, and export collector/source configurations
- **Custom Fields** - fetch field schemas for accurate autocomplete
- **Partitions** - retrieve partition definitions for `_index` and `_view` usage
- **Content Library** - browse folders and saved content
- **Metadata Caching** - cache common field values for faster autocomplete

## Quick Start

1. **Install the Extension** - Search for "Sumo Logic Query Language" in VS Code extensions
2. **Create a Profile** - Run `Sumo Logic: Create/Update Connection Profile` from command palette
3. **Create a Query** - Create a new file with `.sumo` extension or run `Sumo Logic: New Query File`
4. **Write Your Query** - Use autocomplete (`Ctrl+Space`) to discover operators, functions, and parsers
5. **Execute** - Click the ▶️ button in the toolbar or run `Sumo Logic: Run Query`

## Detailed Features

### Language Support

- **Syntax Highlighting**: Full syntax highlighting for Sumo Logic query language including:
  - Keywords and operators (`and`, `or`, `not`, `in`)
  - Functions (aggregating, math, parse, search operators)
  - Metadata fields (`_raw`, `_source`, `_sourceCategory`, etc.)
  - Comments (`//` and `/* */`)
  - Strings and regex patterns

- **IntelliSense/Autocomplete**: Intelligent code completion for:
  - 100+ Sumo Logic operators and functions
  - Built-in metadata fields
  - 4500+ parser snippets from Sumo Logic apps (filterable by app name)
  - Dynamic fields from query results
  - Custom fields from API
  - Partition names for _index and _view
  - Metadata field values (context-aware)
  - Categorized suggestions (functions, fields, operators, snippets)

- **Language Configuration**:
  - Auto-closing brackets, quotes, and parentheses
  - Comment toggling support
  - Smart bracket matching

## Usage Guide

### Writing Queries

1. **Create a Query File**:
   - Create a file with `.sumo` extension, or
   - Run `Sumo Logic: New Query File` for a template with metadata directives

2. **Use Autocomplete**:
   - Press `Ctrl+Space` (Windows/Linux) or `Cmd+Space` (macOS) to trigger suggestions
   - Type `parser` to see 4500+ parser snippets from Sumo Logic apps
   - Filter by app name (e.g., `AWS`, `Azure`, `Apache`, etc.)
   - After `=` in metadata fields, see cached values from your environment

3. **Add Query Metadata** (optional):
   ```sumo
   // @from -7d
   // @to now
   // @timezone UTC
   // @mode records
   // @output table

   _sourceCategory=prod/application error
   | count by _sourceHost
   ```

### Executing Queries

There are three ways to execute queries, each with different visualization options:

#### 1. Standard Query Execution
**Command**: `Sumo Logic: Run Query` (toolbar ▶️ button)

Outputs results in your choice of format:
- **Table** - Formatted text table (default)
- **JSON** - Raw JSON response
- **CSV** - Comma-separated values (aggregated queries only)

Specify format using `// @output table|json|csv` directive in your query.

#### 2. Interactive Webview Table
**Command**: `Sumo Logic: Run Query in Webview` (toolbar 📋 button)

Displays results in an interactive table with:
- **Pagination** - configurable page size
- **Sorting** - click column headers to sort
- **Filtering** - search across all columns
- **Export** - copy or download data

Perfect for exploring large result sets (thousands of rows).

#### 3. Auto-Charting
**Command**: `Sumo Logic: Run Query and Chart Results` (toolbar 📈 button)

Automatically generates interactive charts from your query results:
- **Time-Series** - Line/area charts for timeslice queries
- **Category Data** - Bar/pie charts for aggregations
- **Interactive** - Zoom, pan, export via Apache ECharts

Also works on CSV files: Right-click any `.csv` file → `Sumo Logic: Chart CSV Data`

### Managing Connections

**Connection profiles** let you work with multiple Sumo Logic deployments:

1. **Create a Profile**:
   - Run `Sumo Logic: Create/Update Connection Profile`
   - Enter profile name (e.g., `Production`, `Dev`, `Customer-ABC`)
   - Select region (us1, us2, eu, au, de, jp, ca, in) or enter custom endpoint
   - Enter Access ID and Access Key (stored securely)

2. **Switch Profiles**:
   - Click the profile name in the status bar (bottom-right), or
   - Run `Sumo Logic: Switch Profile`
   - All queries and API calls use the active profile

3. **Manage Profiles**:
   - `Sumo Logic: List Profiles` - View all configured profiles
   - `Sumo Logic: Test Connection` - Verify API connectivity
   - `Sumo Logic: Delete Profile` - Remove a profile and its credentials

**Profile Features**:
- 🔐 Credentials stored securely in VS Code's secret storage
- 💾 Per-profile autocomplete data (fields, partitions, metadata values)
- 📁 Organized output: `output/<profile>/queries/`, `collectors/`, etc.
- 🔄 Quick switching without re-entering credentials

### Fetching Metadata & Configuration

Enhance autocomplete and export configuration from your Sumo Logic deployment:

| Command | What It Does | Output Location |
|---------|--------------|-----------------|
| **Fetch Custom Fields for Autocomplete** | Retrieves custom field definitions from your org | Adds to autocomplete + `output/<profile>/customfields/` |
| **Fetch Partitions for Autocomplete** | Retrieves partition list and routing expressions | Adds to autocomplete + `output/<profile>/partitions/` |
| **Fetch Collectors** | Lists all collectors with health stats (alive/dead, by type) | `output/<profile>/collectors/` (table format) |
| **Get Collector by ID** | Gets detailed configuration for a specific collector | `output/<profile>/collectors/` (JSON) |
| **Get Sources for Collector** | Lists all sources for a collector with health info | `output/<profile>/collectors/` (JSON) |
| **Cache Key Metadata** | Analyzes query results to cache common field values | Adds to autocomplete cache |
| **Get Personal Folder** | Shows your personal folder contents | Opens in new tab |
| **Get Folder by ID** | Shows any folder's contents and properties | Opens in new tab |

All fetched data enhances autocomplete and is persisted per profile.

### Utility Commands

| Command | Description |
|---------|-------------|
| **New Query File** | Create a `.sumo` file with template and metadata directives |
| **Cleanup Old Files** | Remove old query results (by age) to manage disk space |
| **View Autocomplete Data** | Inspect what's cached for autocomplete in active profile |
| **Clear Autocomplete Data** | Clear all autocomplete cache for active profile |

## Example Workflows

### Workflow 1: Writing and Executing a Query

```sumo
// Query metadata (optional)
// @from -24h
// @to now
// @output table

// Search for errors in production
_sourceCategory=prod/application error
| parse regex field=_raw "(?<error_type>\w+Error)"
| count by error_type
| sort _count desc
```

1. Use autocomplete to discover operators and fields
2. Click ▶️ to execute with table output
3. Fields like `error_type` automatically added to autocomplete
4. Try 📋 button for interactive table or 📈 for charts

### Workflow 2: Exploring Time-Series Data

```sumo
// @from -7d
// @to now

_sourceCategory=metrics
| timeslice 1h
| count by _timeslice, host
| transpose row _timeslice column host
```

1. Execute with `Run Query and Chart Results` command
2. Get automatic line chart showing trends by host
3. Interactive chart with zoom, pan, legend toggle
4. Export chart as image if needed

### Workflow 3: Managing Collectors

1. Run `Fetch Collectors` to get overview with stats
2. Note collector ID from the table
3. Run `Get Collector by ID` to see full configuration (JSON)
4. Run `Get Sources for Collector` to audit source setup
5. JSON files saved to `output/<profile>/collectors/` for documentation

## Configuration

### Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `sumologic.fileStoragePath` | `${workspaceFolder}/output` | Directory for output files. Supports `${workspaceFolder}` variable. |
| `sumologic.webviewPageSize` | `100` | Number of rows per page in webview tables (10-10000) |

The extension activates automatically when you open `.sumo` files.

### Query Metadata Directives

Control query execution with comment directives:

```sumo
// @from -7d              // Start time (relative: -1h, -7d or absolute: 2024-01-01T00:00:00)
// @to now                // End time (relative or absolute)
// @timezone UTC          // Timezone for query execution
// @mode records          // Result type: records (aggregated) or messages (raw logs)
// @output table          // Output format: table, json, or csv
```

## Requirements

- Visual Studio Code 1.74.0 or higher
- Sumo Logic Access ID and Access Key (for API integration)
- Appropriate permissions in Sumo Logic:
  - Query execution: Basic user
  - Custom fields: "Manage fields" capability
  - Partitions: "View Partitions" capability
  - Collectors: "Manage or View Collectors" capability

## Known Issues

None at this time. Please report issues on the [GitHub repository](https://github.com/yourusername/hajime).

## Frequently Asked Questions

**Q: Where are my credentials stored?**
A: Credentials are stored securely in VS Code's Secret Storage API, not in plain text files.

**Q: Can I use custom endpoints (not standard regions)?**
A: Yes, when creating a profile, you can enter a custom endpoint URL instead of selecting a region.

**Q: How do I see my query history?**
A: Query results are saved to `output/<profile>/queries/` with timestamps in filenames.

**Q: Can I share profiles across workspaces?**
A: Profiles are stored globally in VS Code, so they're available in all workspaces. However, autocomplete data and output files are workspace-specific.

**Q: What if I have more than 1000 collectors/sources?**
A: The extension automatically handles pagination, fetching all items regardless of count.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for detailed release history.

### Latest Updates

- **Collector Management**: Full API integration for collectors and sources
- **Advanced Charting**: Apache ECharts integration with auto-chart selection
- **Interactive Webview**: Sortable, filterable tables for query results
- **Metadata Autocomplete**: Context-aware suggestions for field values
- **4500+ Parsers**: Comprehensive parser library from Sumo Logic apps

## Development

For extension development:

1. Clone the repository
2. Run `npm install` to install dependencies
3. Press `F5` to open a new VS Code window with the extension loaded
4. Create or open a `.sumo` file to test

For more information:
- [VS Code Extension API](https://code.visualstudio.com/api/get-started/your-first-extension)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT

# Sumo Logic Query Language Support

A Visual Studio Code extension providing language support for Sumo Logic search queries.

## Features

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
  - Categorized suggestions (functions, fields, operators, snippets)

- **Snippets**: Pre-built code snippets for common patterns:
  - `parse regex` - Parse regex capture expression
  - `transpose` - Timeslice and transpose for multiple series
  - `count` - Count by field with sort

- **Language Configuration**:
  - Auto-closing brackets, quotes, and parentheses
  - Comment toggling support
  - Smart bracket matching

## Usage

### Basic Query Editing

1. Create or open a file with `.sumo` extension
2. Start writing your Sumo Logic queries
3. Use `Ctrl+Space` (Windows/Linux) or `Cmd+Space` (macOS) to trigger autocomplete
4. Type `//` for single-line comments or `/* */` for block comments

#### Parser Snippets

The extension includes 4500+ parser snippets from Sumo Logic apps:

- Type `parser` to see all available parser snippets
- Filter by app name (e.g., type `1Password`, `AWS`, `Apache`, etc.)
- Snippets are labeled with their app name and operation type
- Preview the full parser code in the autocomplete documentation

### API Integration (Query Execution)

#### Available Commands

| Command | Description |
|---------|-------------|
| **Sumo Logic: Create/Update Connection Profile** | Create or update a connection profile with Access ID, Access Key, and region. Credentials are stored securely per profile. |
| **Sumo Logic: Switch Profile** | Switch between configured connection profiles. Active profile is shown in the status bar. |
| **Sumo Logic: List Profiles** | Display all configured connection profiles. |
| **Sumo Logic: Delete Profile** | Remove a connection profile and its credentials. |
| **Sumo Logic: Test Connection** | Verify the active profile's API connectivity. |
| **Sumo Logic: Run Query** | Execute the current `.sumo` file as a search job and display results in a new window. Supports metadata directives:<br/>• `// @from -7d` - Set query start time (relative or absolute)<br/>• `// @to now` - Set query end time (relative or absolute)<br/>• `// @timezone UTC` - Set timezone for query execution<br/>• `// @mode records` - Returns aggregated query results (default)<br/>• `// @mode messages` - Returns raw log messages for non-aggregated queries<br/>• `// @output table` - Output format: table (default), json, or csv<br/>Auto-detects aggregation and prompts if ambiguous. Supports multiple output formats:<br/>• **Table** - Formatted table view (default)<br/>• **JSON** - JSON format<br/>• **CSV** - CSV format (records only)<br/>Query results contribute to session autocomplete. |
| **Sumo Logic: Fetch Custom Fields for Autocomplete** | Fetch organization custom fields from API and add to autocomplete. Displays fields in a formatted table. Data is persisted per profile. Requires "Manage fields" permission. |
| **Sumo Logic: Fetch Partitions for Autocomplete** | Fetch partitions list from API, display as formatted table, and cache partition names for `_index` and `_view` autocomplete. Data is persisted per profile. Requires "View Partitions" permission. |
| **Sumo Logic: View Autocomplete Data** | View all autocomplete data (discovered fields, custom fields, partitions) for the active profile. Shows what's stored and will be available in autocomplete. |
| **Sumo Logic: Clear Autocomplete Data** | Clear all autocomplete data for the active profile. Useful if you want to start fresh. |

#### Multi-Profile Support

Work with multiple Sumo Logic organizations using connection profiles:

1. **Create a Profile**: Run `Sumo Logic: Create/Update Connection Profile`
   - Enter profile name (e.g., `Production`, `Development`, `Customer-ABC`)
   - Select deployment region (us1, us2, eu, au, de, jp, ca, in)
   - Enter Access ID and Access Key

2. **Switch Profiles**: Click the profile name in the status bar (bottom-right) or use `Sumo Logic: Switch Profile`

3. **Run Queries**: Open a `.sumo` file and run `Sumo Logic: Run Query` - uses the active profile

**Features:**
- 📁 Multiple organization support
- 🔄 Quick profile switching via status bar
- 🔐 Secure credential storage per profile
- ✅ Visual indicator showing active profile
- 🔍 Dynamic autocomplete from query results, custom fields, and partitions
- 💾 **Persistent autocomplete per profile** - autocomplete data is saved per profile and restored when switching

See [MULTI-PROFILE-GUIDE.md](MULTI-PROFILE-GUIDE.md) for detailed documentation.

## Example

```sumo
// Search for errors in production
_sourceCategory=prod/application error
| parse regex field=_raw "(?<error_type>\w+Error)"
| count by error_type
| sort _count desc
```

## Requirements

- Visual Studio Code 1.74.0 or higher

## Extension Settings

This extension activates automatically when you open `.sumo` files. No additional configuration required.

## Known Issues

None at this time. Please report issues on the GitHub repository.

## Release Notes

### 0.0.3

- Optimized completion provider performance
- Added proper completion item categorization
- Fixed syntax highlighting for comments
- Improved extension activation (now activates only for .sumo files)
- Added comprehensive documentation

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

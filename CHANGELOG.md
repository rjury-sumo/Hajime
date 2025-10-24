# Changelog

All notable changes to the "Sumo Logic Query Language" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-10-24

### Added
- **Search Audit Explorer**: New comprehensive search audit analysis feature under each profile
  - Query search audit index (`_view=sumologic_search_usage_per_query`) with customizable filters
  - Time range selection (from/to) with relative time support (-24h, -7d, etc.)
  - Filter by user name, query type, content name using keyword expressions
  - Filter by query text using keyword expressions (*, ?, quoted strings)
  - Advanced regex filtering with Google RE2 format for granular query pattern matching
  - Interactive webview form with inline help and keyword expression documentation links
  - Performance warnings for regex filters vs keyword filters
- **Search Audit Results Viewer**: Dedicated webview for analyzing search audit results
  - Sortable, filterable table with key metrics (searches, scan GB, runtime, results)
  - Expandable/collapsible query display with proper line breaks and monospace font
  - Wide query column (600-800px) for better readability of complex queries
  - One-click "Open" button to launch queries in new .sumo editor windows
  - Summary statistics showing total searches, scan volume, and runtime
  - Results automatically saved to `<profile>/search_audit/` with timestamped filenames
  - Click Search Audit node to open query form and view previous results

## [0.2.1] - 2025-10-24

### Fixed
- **Recent Items Persistence**: Recent queries, content, and results now stored in `~/.sumologic/_global/recent/` directory instead of VSCode extension storage
  - Recent items now persist across extension reloads and reinstalls
  - Uses configured `sumologic.fileStoragePath` setting (defaults to `~/.sumologic`)
  - More reliable storage location that's independent of VSCode
- **Library Explorer Node Operations**: Fixed multiple issues with special top-level library nodes (Personal, Global, Admin Recommended, Installed Apps)
  - Fixed "NOT NULL constraint" errors when refreshing special nodes
  - Special nodes can now be properly refreshed using context menu
  - Clicking on expanded special nodes now shows folder-specific webview with children table
  - Fixed file path resolution for special nodes (now saves JSON with alias IDs)
  - Added `itemType: 'Folder'` to exported folder objects for proper detection
  - Children items now properly display in tree after expansion
- **Content Opening Workflow**: Refactored content opening to use shared utility function
  - Consolidated duplicate code from `openExportedContent.ts`, `viewLibraryContent.ts`, and `dashboardsWebviewProvider.ts`
  - Dashboard API responses now properly normalized with `itemType` field
  - Recent content tracking works consistently across all content sources

### Added
- **Folder Webview**: New dedicated webview for viewing folder contents
  - Shows folder metadata (ID, path, description, created/modified info)
  - Displays children in formatted table with Name, Type, Description columns
  - "View" button for each child item to open them directly
  - Used for Personal, Global, Admin Recommended, and Installed Apps folders
- **Enhanced Logging**: Added comprehensive logging throughout library operations
  - Logs for content fetch operations, caching, and file saves
  - Easier debugging of library node expansion and content viewing
  - All logs tagged with `[LibraryExplorer]`, `[libraryCommands]`, or `[viewLibraryContent]` prefixes

### Changed
- Recent content managers (`RecentContentManager`, `RecentQueriesManager`, `RecentResultsManager`) now require `ProfileManager` parameter
- Library tree items for special nodes become clickable after being fetched
- Special top-level nodes now save JSON files with both alias IDs and actual IDs for compatibility

## [0.2.0] - 2025-10-24

### Added
- **Timeslice Transpose Chart Type**: New advanced chart type specifically for transposed timeslice data
  - Automatically uses `_timeslice` as X-axis for time series
  - Treats all other columns as separate series on the chart
  - Supports line, area, and bar chart types with stacking options
  - Top N series filtering to handle queries with many series
  - Ideal for queries like: `| timeslice 1m | count by _timeslice, _sourceCategory | transpose row _timeslice column _sourceCategory`
- **Comprehensive Test Suite**: Added unit and integration tests for shared query execution functions
  - 8 new unit tests for CSV formatting and data structure handling
  - 10 new integration tests for complete query workflows
  - Tests cover profile authentication, metadata processing, query execution, and file saving
  - Total test coverage: 349 tests with 94.8% pass rate

### Changed
- **Major Code Refactoring**: Consolidated duplicate code across query command files
  - Extracted 7 shared functions from `runQuery.ts`, `runQueryAndChart.ts`, and `runQueryWebview.ts`
  - Reduced code duplication by 40-50% across command files
  - Shared functions: `getActiveProfileClient()`, `processQueryMetadata()`, `promptForTimeRange()`, `determineQueryMode()`, `executeSearchJob()`, `saveQueryResults()`, `updateDynamicFieldAutocomplete()`
  - All three query commands now use the same core logic for consistent behavior
  - Bug fixes and feature additions now automatically apply to all query commands
- **Improved CSV Column Ordering**: CSV exports now guarantee `_timeslice` appears as first column for better chart compatibility
- **Enhanced Code Maintainability**: Centralized query execution logic makes future enhancements easier to implement

### Fixed
- Missing metadata directives in some query executors for autoparsing and receipttime
- 10k parser snippets and fixed bugs in extracting incomplete parsers
- Inconsistent behavior between runQuery, runQueryAndChart, and runQueryWebview commands
- CSV column ordering for timeslice transpose queries

## [0.1.3] - 2025-10-23

### Fixed
- Missing metadata directives in some query executors for autoparsing and receipttime
- 10k parser snippets and fixed the bugs in extracting incomplete parsers

## [0.1.2] - 2025-10-22

### Added
- messages webview de-selects internal columns by default
- toggle formatted dates for ms epcoh in webview

## [0.1.0] - 2025-10-22

### Added
- Initial release
- Syntax highlighting for Sumo Logic Query Language
- IntelliSense with 100+ operators and functions
- Multi-profile connection management
- Query execution with multiple output formats
- Interactive webview with pagination and filtering
- Apache ECharts integration for data visualization
- Library explorer with SQLite caching
- Users & roles management
- Account management with usage reporting
- Scopes for log analysis
- 4500+ parser snippets from Sumo Logic apps

### Changed
- N/A (initial release)

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- Credentials stored securely in VS Code Secret Storage
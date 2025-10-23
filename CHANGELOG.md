# Changelog

All notable changes to the "Sumo Logic Query Language" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
# JSON Viewer Feature

## Overview
The webview query results now automatically detect and provide enhanced viewing for JSON-formatted string data in table cells.

## Features

### 1. Automatic JSON Detection
- Automatically detects valid JSON strings in any column
- Works for both objects `{}` and arrays `[]`
- Validates JSON before showing viewer controls

### 2. Cell Preview
When JSON is detected in a cell, it displays:
- **JSON Badge**: Small blue badge indicating JSON content
- **Preview Text**: Shows `{...}` or `[...]` with character count
- **View Button**: "⤢ View" button to open the modal viewer

Example cell display:
```
[JSON] {...} (443 chars) [⤢ View]
```

### 3. Modal Viewer
Clicking the "View" button opens a modal with three tabs:

#### Formatted Tab (Default)
- Pretty-printed JSON with 2-space indentation
- Syntax highlighting with VS Code theme colors:
  - **Keys**: Light blue (#9cdcfe)
  - **Strings**: Orange (#ce9178)
  - **Numbers**: Light green (#b5cea8)
  - **Booleans/Null**: Blue (#569cd6)

#### Raw Tab
- Original unformatted JSON string
- Useful for copying exact value
- Wrapped text with preserved spacing

#### Tree Tab
- Interactive tree view
- Expandable/collapsible nodes (click ▼/▶)
- Nested structure visualization
- Color-coded by data type

### 4. Modal Actions
- **Copy Button**: Copies formatted JSON to clipboard with visual feedback
- **Close Button**: × button in header
- **ESC Key**: Press ESC to close modal
- **Click Outside**: Click backdrop to close

## Usage Example

Given a Sumo Logic query that returns `_fieldinfo` column with JSON data:

```json
{"topKEntries":[{"fieldValue":"","score":986},{"fieldValue":"7CB34911D894AB7F","score":1}]}
```

### Before
The table cell would show the entire JSON string unformatted, making it hard to read.

### After
The table cell shows:
- Badge: `JSON`
- Preview: `{...} (443 chars)`
- Button: `⤢ View`

Clicking "View" opens a modal where you can:
1. See formatted, syntax-highlighted JSON
2. View the raw string
3. Explore the tree structure interactively
4. Copy the JSON with one click

## Technical Details

### JSON Detection Logic
```javascript
// Validates that string starts and ends with JSON brackets
// and can be successfully parsed
if ((value.startsWith('{') && value.endsWith('}')) ||
    (value.startsWith('[') && value.endsWith(']'))) {
    JSON.parse(value); // Validates JSON
    return true;
}
```

### Files Modified
- `src/commands/runQuery.ts`: Added JSON detection, cell rendering, modal HTML, and JavaScript functions

### CSS Classes Added
- `.json-cell` - Cell container
- `.json-badge` - Blue JSON indicator
- `.json-preview` - Preview text
- `.json-expand-btn` - View button
- `.json-modal` - Modal overlay
- `.json-modal-content` - Modal dialog
- `.json-formatted` - Formatted view
- `.json-raw` - Raw view
- `.json-tree` - Tree view
- Syntax highlighting classes: `.json-key`, `.json-string`, `.json-number`, `.json-boolean`, `.json-null`

## Tested With
- Example query: `/Users/rjury/.sumologic/rick/queries/query_view=sumologic_search_usage_per_query_limit_10_records_-6h_to_now_20251016_150136.json`
- 23 records with JSON in `_fieldinfo` column
- Successfully detected and parsed all JSON data

## Browser Compatibility
- Modern browsers with ES6+ support
- Clipboard API for copy functionality
- CSS Grid and Flexbox for layout

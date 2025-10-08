import * as vscode from 'vscode';
import { SearchJobClient, SearchJobRequest, SearchJobStatus } from '../api/searchJob';
import { createClient } from './authenticate';
import { getDynamicCompletionProvider } from '../extension';
import { OutputWriter } from '../outputWriter';

/**
 * Parse query metadata from comments
 * Looks for special comments like:
 * // @name my-query-name
 * // @from -1h
 * // @to now
 * // @timezone UTC
 * // @mode messages
 * // @output webview
 */
function parseQueryMetadata(queryText: string): {
    name?: string;
    from?: string;
    to?: string;
    timeZone?: string;
    mode?: 'records' | 'messages';
    output?: 'table' | 'json' | 'csv' | 'webview';
} {
    const metadata: {
        name?: string;
        from?: string;
        to?: string;
        timeZone?: string;
        mode?: 'records' | 'messages';
        output?: 'table' | 'json' | 'csv' | 'webview';
    } = {};

    const lines = queryText.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();

        // Match @name directive
        const nameMatch = trimmed.match(/^\/\/\s*@name\s+(.+)$/i);
        if (nameMatch) {
            metadata.name = nameMatch[1].trim();
            continue;
        }

        // Match @from directive
        const fromMatch = trimmed.match(/^\/\/\s*@from\s+(.+)$/i);
        if (fromMatch) {
            metadata.from = fromMatch[1].trim();
            continue;
        }

        // Match @to directive
        const toMatch = trimmed.match(/^\/\/\s*@to\s+(.+)$/i);
        if (toMatch) {
            metadata.to = toMatch[1].trim();
            continue;
        }

        // Match @timezone directive
        const tzMatch = trimmed.match(/^\/\/\s*@timezone\s+(.+)$/i);
        if (tzMatch) {
            metadata.timeZone = tzMatch[1].trim();
            continue;
        }

        // Match @mode directive
        const modeMatch = trimmed.match(/^\/\/\s*@mode\s+(records|messages)$/i);
        if (modeMatch) {
            metadata.mode = modeMatch[1].toLowerCase() as 'records' | 'messages';
            continue;
        }

        // Match @output directive
        const outputMatch = trimmed.match(/^\/\/\s*@output\s+(table|json|csv|webview)$/i);
        if (outputMatch) {
            metadata.output = outputMatch[1].toLowerCase() as 'table' | 'json' | 'csv' | 'webview';
            continue;
        }
    }

    return metadata;
}

/**
 * Remove metadata comments from query
 */
function cleanQuery(queryText: string): string {
    const lines = queryText.split('\n');
    const cleanedLines = lines.filter(line => {
        const trimmed = line.trim();
        return !trimmed.match(/^\/\/\s*@(name|from|to|timezone|mode|output)\s+/i);
    });
    return cleanedLines.join('\n').trim();
}

/**
 * Detect if query is an aggregation (has aggregation operators)
 */
function isAggregationQuery(query: string): boolean {
    const aggregationOperators = [
        'count', 'sum', 'avg', 'min', 'max', 'stddev', 'pct',
        'first', 'last', 'most_recent', 'least_recent',
        'count_distinct', 'count_frequent', 'fillmissing',
        'transpose', 'timeslice', 'rollingstd'
    ];

    const lowerQuery = query.toLowerCase();
    return aggregationOperators.some(op =>
        lowerQuery.includes(`| ${op}`) ||
        lowerQuery.includes(`|${op}`)
    );
}

/**
 * Format records as a table string
 */
function formatRecordsAsTable(records: any[]): string {
    if (records.length === 0) {
        return 'No results found';
    }

    // Get all unique keys from all records
    const allKeys = new Set<string>();
    records.forEach(record => {
        Object.keys(record.map).forEach(key => allKeys.add(key));
    });

    const keys = Array.from(allKeys);
    const columnWidths = keys.map(key => {
        const maxValueLength = Math.max(
            key.length,
            ...records.map(r => String(r.map[key] || '').length)
        );
        return Math.min(maxValueLength, 50); // Cap at 50 chars
    });

    // Create header
    let table = keys.map((key, i) => key.padEnd(columnWidths[i])).join(' | ') + '\n';
    table += columnWidths.map(w => '-'.repeat(w)).join('-+-') + '\n';

    // Create rows
    records.forEach(record => {
        const row = keys.map((key, i) => {
            const value = String(record.map[key] || '');
            return value.substring(0, 50).padEnd(columnWidths[i]);
        }).join(' | ');
        table += row + '\n';
    });

    return table;
}

/**
 * Format records as CSV
 */
function formatRecordsAsCSV(records: any[]): string {
    if (records.length === 0) {
        return 'No results found';
    }

    // Get all unique keys from all records
    const allKeys = new Set<string>();
    records.forEach(record => {
        Object.keys(record.map).forEach(key => allKeys.add(key));
    });

    const keys = Array.from(allKeys);

    // Helper to escape CSV values
    const escapeCSV = (value: any): string => {
        const str = String(value || '');
        // If contains comma, quote, or newline, wrap in quotes and escape quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    // Create header
    let csv = keys.map(escapeCSV).join(',') + '\n';

    // Create rows
    records.forEach(record => {
        const row = keys.map(key => escapeCSV(record.map[key])).join(',');
        csv += row + '\n';
    });

    return csv;
}

/**
 * Format results as JSON
 */
function formatResultsAsJSON(results: any[]): string {
    return JSON.stringify(results, null, 2);
}

/**
 * Format records as HTML for webview display with sorting, filtering, and pagination
 */
function formatRecordsAsHTML(records: any[], queryInfo: { query: string; from: string; to: string; mode: string; count: number; pageSize: number }): string {
    if (records.length === 0) {
        return '<p>No results found</p>';
    }

    // Get all unique keys from all records
    const allKeys = new Set<string>();
    records.forEach(record => {
        Object.keys(record.map).forEach(key => allKeys.add(key));
    });

    const keys = Array.from(allKeys);

    // Serialize data for JavaScript
    const recordsJson = JSON.stringify(records.map(r => r.map));
    const keysJson = JSON.stringify(keys);

    // Build HTML table
    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .header {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 18px;
            font-weight: 600;
        }
        .query-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin: 5px 0;
        }
        .query-code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 8px 12px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            margin: 10px 0;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .table-container {
            overflow-x: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            font-size: 13px;
        }
        th {
            background-color: var(--vscode-editor-lineHighlightBackground);
            color: var(--vscode-foreground);
            font-weight: 600;
            text-align: left;
            padding: 6px 12px;
            border-bottom: 2px solid var(--vscode-panel-border);
            position: sticky;
            top: 0;
            z-index: 10;
            cursor: pointer;
            user-select: none;
            position: relative;
            min-width: 100px;
        }
        th:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .resize-handle {
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            width: 5px;
            cursor: col-resize;
            user-select: none;
            z-index: 11;
        }
        .resize-handle:hover {
            background-color: var(--vscode-focusBorder);
        }
        .resizing {
            background-color: var(--vscode-focusBorder);
        }
        .sort-indicator {
            font-size: 10px;
            margin-left: 4px;
            opacity: 0.6;
        }
        .filter-row th {
            padding: 4px 8px;
            cursor: default;
        }
        .filter-row th:hover {
            background-color: var(--vscode-editor-lineHighlightBackground);
        }
        .filter-input {
            width: 100%;
            padding: 4px 6px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 12px;
            box-sizing: border-box;
        }
        .filter-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        td {
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            vertical-align: top;
            word-break: break-word;
        }
        tbody tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        tbody tr:last-child td {
            border-bottom: none;
        }
        .result-count {
            margin-top: 15px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .hidden {
            display: none;
        }
        .pagination {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 15px;
            padding: 10px 0;
            border-top: 1px solid var(--vscode-panel-border);
        }
        .pagination-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .pagination-controls {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .pagination-button {
            padding: 4px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .pagination-button:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }
        .pagination-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .page-input {
            width: 60px;
            padding: 4px 6px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 12px;
            text-align: center;
        }
        .toolbar {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 15px;
            padding: 10px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border-radius: 3px;
            flex-wrap: wrap;
        }
        .toolbar-section {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .toolbar-button {
            padding: 4px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .toolbar-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .toolbar-button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .toolbar-button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .global-search {
            flex: 1;
            min-width: 200px;
            padding: 4px 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 12px;
        }
        .column-toggle {
            position: relative;
        }
        .column-menu {
            display: none;
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 4px;
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 3px;
            padding: 8px;
            z-index: 1000;
            max-height: 300px;
            overflow-y: auto;
            min-width: 200px;
        }
        .column-menu.show {
            display: block;
        }
        .column-menu-item {
            display: flex;
            align-items: center;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
        }
        .column-menu-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .column-menu-item input[type="checkbox"] {
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Sumo Logic Query Results</h1>
        <div class="query-info"><strong>Mode:</strong> ${queryInfo.mode}</div>
        <div class="query-info"><strong>Time Range:</strong> ${queryInfo.from} to ${queryInfo.to}</div>
        <div class="query-info"><strong>Results:</strong> ${queryInfo.count} ${queryInfo.mode}</div>
        <div class="query-code">${escapeHtml(queryInfo.query)}</div>
    </div>
    <div class="toolbar">
        <div class="toolbar-section">
            <input type="text" class="global-search" id="globalSearch" placeholder="Search all columns..." oninput="globalSearch()">
            <button class="toolbar-button secondary" onclick="clearAllFilters()">Clear Filters</button>
        </div>
        <div class="toolbar-section">
            <div class="column-toggle">
                <button class="toolbar-button secondary" onclick="toggleColumnMenu()">Columns ▾</button>
                <div class="column-menu" id="columnMenu">
                    ${keys.map((key, idx) => `
                        <div class="column-menu-item">
                            <input type="checkbox" id="col-toggle-${idx}" checked onchange="toggleColumn(${idx})">
                            <label for="col-toggle-${idx}">${escapeHtml(key)}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
            <button class="toolbar-button" onclick="exportToCSV()">Export CSV</button>
        </div>
    </div>
    <div class="table-container">
        <table id="resultsTable">
            <thead>
                <tr class="header-row">
                    ${keys.map((key, idx) => `<th data-column="${idx}"><span onclick="sortTable(${idx})">${escapeHtml(key)}<span class="sort-indicator" id="sort-${idx}"></span></span><div class="resize-handle" onmousedown="startResize(event, ${idx})"></div></th>`).join('')}
                </tr>
                <tr class="filter-row">
                    ${keys.map((key, idx) => `<th><input type="text" class="filter-input" placeholder="Filter..." oninput="filterTable()" data-column="${idx}"></th>`).join('')}
                </tr>
            </thead>
            <tbody id="tableBody">
                ${records.map((record, rowIdx) => `
                    <tr data-row="${rowIdx}">
                        ${keys.map(key => `<td>${escapeHtml(String(record.map[key] || ''))}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    <div class="pagination">
        <div class="pagination-info">
            Showing <span id="pageStart">1</span>-<span id="pageEnd">${Math.min(queryInfo.pageSize, records.length)}</span> of <span id="visibleCount">${records.length}</span> results
        </div>
        <div class="pagination-controls">
            <button class="pagination-button" id="firstPageBtn" onclick="goToPage(1)">First</button>
            <button class="pagination-button" id="prevPageBtn" onclick="goToPage(currentPage - 1)">Previous</button>
            <span style="font-size: 12px;">Page <input type="number" class="page-input" id="pageInput" value="1" min="1" onchange="goToPageInput()"> of <span id="totalPages">1</span></span>
            <button class="pagination-button" id="nextPageBtn" onclick="goToPage(currentPage + 1)">Next</button>
            <button class="pagination-button" id="lastPageBtn" onclick="goToPage(totalPages)">Last</button>
        </div>
    </div>

    <script>
        const allData = ${recordsJson};
        const pageSize = ${queryInfo.pageSize};
        const columns = ${keysJson};
        let sortColumn = -1;
        let sortAscending = true;
        let currentPage = 1;
        let totalPages = 1;
        let filteredData = [];
        let hiddenColumns = new Set();

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function sortTable(columnIndex) {
            const tbody = document.getElementById('tableBody');
            const rows = Array.from(tbody.querySelectorAll('tr'));

            // Toggle sort direction if clicking same column
            if (sortColumn === columnIndex) {
                sortAscending = !sortAscending;
            } else {
                sortColumn = columnIndex;
                sortAscending = true;
            }

            // Clear all sort indicators
            columns.forEach((_, idx) => {
                document.getElementById('sort-' + idx).textContent = '';
            });

            // Set current sort indicator
            document.getElementById('sort-' + columnIndex).textContent = sortAscending ? '▲' : '▼';

            // Sort rows
            rows.sort((a, b) => {
                const aRowIdx = parseInt(a.dataset.row);
                const bRowIdx = parseInt(b.dataset.row);
                const aValue = String(allData[aRowIdx][columns[columnIndex]] || '');
                const bValue = String(allData[bRowIdx][columns[columnIndex]] || '');

                // Try numeric comparison first
                const aNum = parseFloat(aValue);
                const bNum = parseFloat(bValue);
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return sortAscending ? aNum - bNum : bNum - aNum;
                }

                // Fall back to string comparison
                const comparison = aValue.localeCompare(bValue);
                return sortAscending ? comparison : -comparison;
            });

            // Re-append sorted rows
            rows.forEach(row => tbody.appendChild(row));
        }

        function filterTable() {
            const filters = Array.from(document.querySelectorAll('.filter-input'));

            // Build filtered data array
            filteredData = [];
            allData.forEach((row, idx) => {
                let visible = true;

                filters.forEach((filter, colIdx) => {
                    const filterValue = filter.value.toLowerCase();
                    if (filterValue) {
                        const cellValue = String(row[columns[colIdx]] || '').toLowerCase();
                        if (!cellValue.includes(filterValue)) {
                            visible = false;
                        }
                    }
                });

                if (visible) {
                    filteredData.push(idx);
                }
            });

            // Reset to page 1 when filtering
            currentPage = 1;
            updatePagination();
            renderPage();
        }

        function renderPage() {
            const tbody = document.getElementById('tableBody');
            const rows = tbody.querySelectorAll('tr');

            const startIdx = (currentPage - 1) * pageSize;
            const endIdx = startIdx + pageSize;

            rows.forEach((row, idx) => {
                const rowIdx = parseInt(row.dataset.row);
                const filteredIdx = filteredData.indexOf(rowIdx);

                if (filteredIdx >= startIdx && filteredIdx < endIdx) {
                    row.classList.remove('hidden');
                } else {
                    row.classList.add('hidden');
                }
            });
        }

        function updatePagination() {
            totalPages = Math.ceil(filteredData.length / pageSize);

            document.getElementById('visibleCount').textContent = filteredData.length;
            document.getElementById('totalPages').textContent = totalPages;
            document.getElementById('pageInput').value = currentPage;

            const startIdx = (currentPage - 1) * pageSize + 1;
            const endIdx = Math.min(currentPage * pageSize, filteredData.length);

            document.getElementById('pageStart').textContent = filteredData.length > 0 ? startIdx : 0;
            document.getElementById('pageEnd').textContent = endIdx;

            // Update button states
            document.getElementById('firstPageBtn').disabled = currentPage === 1;
            document.getElementById('prevPageBtn').disabled = currentPage === 1;
            document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
            document.getElementById('lastPageBtn').disabled = currentPage === totalPages;
        }

        function goToPage(page) {
            if (page < 1 || page > totalPages) return;
            currentPage = page;
            updatePagination();
            renderPage();
        }

        function goToPageInput() {
            const input = document.getElementById('pageInput');
            const page = parseInt(input.value);
            if (!isNaN(page)) {
                goToPage(page);
            }
        }

        // Initialize pagination
        filteredData = allData.map((_, idx) => idx);
        updatePagination();
        renderPage();

        // Global search functionality
        function globalSearch() {
            const searchValue = document.getElementById('globalSearch').value.toLowerCase();

            if (!searchValue) {
                // If search is empty, apply column filters
                filterTable();
                return;
            }

            // Build filtered data array
            filteredData = [];
            allData.forEach((row, idx) => {
                // Check if any column contains the search value
                const matchesSearch = columns.some(col => {
                    const cellValue = String(row[col] || '').toLowerCase();
                    return cellValue.includes(searchValue);
                });

                // Also check column filters
                const filters = Array.from(document.querySelectorAll('.filter-input'));
                let matchesFilters = true;
                filters.forEach((filter, colIdx) => {
                    const filterValue = filter.value.toLowerCase();
                    if (filterValue) {
                        const cellValue = String(row[columns[colIdx]] || '').toLowerCase();
                        if (!cellValue.includes(filterValue)) {
                            matchesFilters = false;
                        }
                    }
                });

                if (matchesSearch && matchesFilters) {
                    filteredData.push(idx);
                }
            });

            currentPage = 1;
            updatePagination();
            renderPage();
        }

        // Clear all filters
        function clearAllFilters() {
            // Clear global search
            document.getElementById('globalSearch').value = '';

            // Clear column filters
            document.querySelectorAll('.filter-input').forEach(input => {
                input.value = '';
            });

            // Reset filtered data
            filteredData = allData.map((_, idx) => idx);
            currentPage = 1;
            updatePagination();
            renderPage();
        }

        // Column visibility toggle
        function toggleColumnMenu() {
            const menu = document.getElementById('columnMenu');
            menu.classList.toggle('show');
        }

        // Close column menu when clicking outside
        document.addEventListener('click', (event) => {
            const menu = document.getElementById('columnMenu');
            const toggle = event.target.closest('.column-toggle');
            if (!toggle && menu.classList.contains('show')) {
                menu.classList.remove('show');
            }
        });

        function toggleColumn(columnIndex) {
            if (hiddenColumns.has(columnIndex)) {
                hiddenColumns.delete(columnIndex);
            } else {
                hiddenColumns.add(columnIndex);
            }

            // Update header cells
            const headerCells = document.querySelectorAll(\`th[data-column="\${columnIndex}"]\`);
            headerCells.forEach(cell => {
                if (hiddenColumns.has(columnIndex)) {
                    cell.style.display = 'none';
                } else {
                    cell.style.display = '';
                }
            });

            // Update filter row cells
            const filterCells = document.querySelectorAll(\`.filter-row th:nth-child(\${columnIndex + 1})\`);
            filterCells.forEach(cell => {
                if (hiddenColumns.has(columnIndex)) {
                    cell.style.display = 'none';
                } else {
                    cell.style.display = '';
                }
            });

            // Update data cells
            const dataCells = document.querySelectorAll(\`td:nth-child(\${columnIndex + 1})\`);
            dataCells.forEach(cell => {
                if (hiddenColumns.has(columnIndex)) {
                    cell.style.display = 'none';
                } else {
                    cell.style.display = '';
                }
            });
        }

        // Export to CSV
        function exportToCSV() {
            // Get visible columns
            const visibleColumns = columns.filter((_, idx) => !hiddenColumns.has(idx));

            // Build CSV content
            let csv = '';

            // Header row
            csv += visibleColumns.map(col => {
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                const escaped = String(col).replace(/"/g, '""');
                return escaped.includes(',') || escaped.includes('"') || escaped.includes('\\n')
                    ? \`"\${escaped}"\`
                    : escaped;
            }).join(',') + '\\n';

            // Data rows (only filtered data)
            filteredData.forEach(rowIdx => {
                const row = allData[rowIdx];
                csv += visibleColumns.map(col => {
                    const value = String(row[col] || '');
                    const escaped = value.replace(/"/g, '""');
                    return escaped.includes(',') || escaped.includes('"') || escaped.includes('\\n')
                        ? \`"\${escaped}"\`
                        : escaped;
                }).join(',') + '\\n';
            });

            // Send CSV data to extension host for file save
            if (typeof vscode !== 'undefined') {
                vscode.postMessage({
                    command: 'exportCSV',
                    csvData: csv
                });
            }
        }

        // Acquire VS Code API
        const vscode = acquireVsCodeApi();

        // Column resizing functionality
        let resizingColumn = null;
        let startX = 0;
        let startWidth = 0;

        function startResize(event, columnIndex) {
            event.stopPropagation(); // Prevent sorting when clicking resize handle
            resizingColumn = columnIndex;
            const th = event.target.parentElement;
            startX = event.pageX;
            startWidth = th.offsetWidth;

            // Add class to show visual feedback
            event.target.classList.add('resizing');

            document.addEventListener('mousemove', doResize);
            document.addEventListener('mouseup', stopResize);

            // Prevent text selection during resize
            document.body.style.userSelect = 'none';
        }

        function doResize(event) {
            if (resizingColumn === null) return;

            const diff = event.pageX - startX;
            const newWidth = Math.max(50, startWidth + diff); // Min width of 50px

            // Get all cells in this column (header and data)
            const headerCells = document.querySelectorAll(\`th[data-column="\${resizingColumn}"]\`);
            const dataCells = document.querySelectorAll(\`td:nth-child(\${resizingColumn + 1})\`);

            headerCells.forEach(cell => {
                cell.style.width = newWidth + 'px';
                cell.style.minWidth = newWidth + 'px';
                cell.style.maxWidth = newWidth + 'px';
            });

            dataCells.forEach(cell => {
                cell.style.width = newWidth + 'px';
                cell.style.minWidth = newWidth + 'px';
                cell.style.maxWidth = newWidth + 'px';
            });
        }

        function stopResize(event) {
            if (resizingColumn === null) return;

            // Remove visual feedback
            const resizeHandles = document.querySelectorAll('.resize-handle');
            resizeHandles.forEach(handle => handle.classList.remove('resizing'));

            resizingColumn = null;
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);

            // Re-enable text selection
            document.body.style.userSelect = '';
        }
    </script>
</body>
</html>`;

    return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    const div = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return text.replace(/[&<>"']/g, (char) => div[char as keyof typeof div]);
}

/**
 * Command to run the current query
 */
export async function runQueryCommand(context: vscode.ExtensionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    if (editor.document.languageId !== 'sumo') {
        vscode.window.showErrorMessage('Current file is not a Sumo Logic query (.sumo)');
        return;
    }

    // Get client
    const baseClient = await createClient(context);
    if (!baseClient) {
        vscode.window.showErrorMessage('No credentials configured. Please run "Sumo Logic: Configure Credentials" first.');
        return;
    }

    const client = new SearchJobClient({
        accessId: (await context.secrets.get('sumologic.accessId'))!,
        accessKey: (await context.secrets.get('sumologic.accessKey'))!,
        endpoint: baseClient.getEndpoint()
    });

    // Get query text
    const queryText = editor.document.getText();
    if (!queryText.trim()) {
        vscode.window.showErrorMessage('Query is empty');
        return;
    }

    // Parse metadata from comments
    const metadata = parseQueryMetadata(queryText);
    const cleanedQuery = cleanQuery(queryText);

    // Prompt for time range if not specified
    let from = metadata.from;
    let to = metadata.to;

    if (!from) {
        from = await vscode.window.showInputBox({
            prompt: 'Enter start time (e.g., -1h, -30m, -1d, or ISO timestamp)',
            value: '-1h',
            ignoreFocusOut: true
        });

        if (!from) {
            return; // User cancelled
        }
    }

    if (!to) {
        to = await vscode.window.showInputBox({
            prompt: 'Enter end time (e.g., now, -30m, or ISO timestamp)',
            value: 'now',
            ignoreFocusOut: true
        });

        if (!to) {
            return; // User cancelled
        }
    }

    // Parse relative times
    const fromTime = SearchJobClient.parseRelativeTime(from);
    const toTime = SearchJobClient.parseRelativeTime(to);

    // Determine mode: explicit from metadata, user choice, or auto-detect
    let mode: 'records' | 'messages' = metadata.mode || 'records';

    // If no explicit mode and query doesn't look like aggregation, prompt user
    if (!metadata.mode && !isAggregationQuery(cleanedQuery)) {
        const modeChoice = await vscode.window.showQuickPick(
            [
                { label: 'Messages (Raw Events)', value: 'messages', description: 'Return raw log messages' },
                { label: 'Records (Aggregated)', value: 'records', description: 'Return aggregated results' }
            ],
            {
                placeHolder: 'This appears to be a raw search. Select result type:',
                ignoreFocusOut: true
            }
        );

        if (!modeChoice) {
            return; // User cancelled
        }
        mode = modeChoice.value as 'records' | 'messages';
    }

    // Determine output format: explicit from metadata or prompt user
    let outputFormat: 'table' | 'json' | 'csv' | 'webview' = metadata.output || 'webview';

    // If no explicit output format, prompt user
    if (!metadata.output) {
        const formatOptions = mode === 'records'
            ? [
                { label: 'Webview', value: 'webview', description: 'Interactive HTML table view' },
                { label: 'Table', value: 'table', description: 'Text table (file)' },
                { label: 'JSON', value: 'json', description: 'JSON format (file)' },
                { label: 'CSV', value: 'csv', description: 'CSV format (file, records only)' }
              ]
            : [
                { label: 'Webview', value: 'webview', description: 'Interactive HTML table view' },
                { label: 'Table', value: 'table', description: 'Text table (file)' },
                { label: 'JSON', value: 'json', description: 'JSON format (file)' }
              ];

        const formatChoice = await vscode.window.showQuickPick(formatOptions, {
            placeHolder: 'Select output format:',
            ignoreFocusOut: true
        });

        if (!formatChoice) {
            return; // User cancelled
        }
        outputFormat = formatChoice.value as 'table' | 'json' | 'csv' | 'webview';
    } else {
        // Validate that CSV is only used with records mode
        if (outputFormat === 'csv' && mode === 'messages') {
            vscode.window.showWarningMessage('CSV format is only available for records mode. Using table format instead.');
            outputFormat = 'table';
        }
    }

    const request: SearchJobRequest = {
        query: cleanedQuery,
        from: fromTime,
        to: toTime,
        timeZone: metadata.timeZone || 'UTC'
    };

    // Execute search with progress
    let jobId: string | undefined;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Running Sumo Logic query...',
        cancellable: false
    }, async (progress) => {
        progress.report({ message: 'Creating search job...' });

        // Create job
        const createResponse = await client.createSearchJob(request);
        if (createResponse.error || !createResponse.data) {
            vscode.window.showErrorMessage(`Failed to create search job: ${createResponse.error}`);
            return;
        }

        jobId = createResponse.data.id;
        progress.report({ message: `Job created: ${jobId}` });

        // Poll for completion
        const pollResponse = await client.pollForCompletion(jobId, (status: SearchJobStatus) => {
            progress.report({
                message: `State: ${status.state}, Records: ${status.recordCount}, Messages: ${status.messageCount}`
            });
        });

        if (pollResponse.error) {
            vscode.window.showErrorMessage(`Search job failed: ${pollResponse.error}`);
            return;
        }

        progress.report({ message: 'Fetching results...' });

        // Fetch results based on mode
        let results: any[];
        let resultCount: number;

        if (mode === 'messages') {
            const messagesResponse = await client.getMessages(jobId);
            if (messagesResponse.error || !messagesResponse.data) {
                vscode.window.showErrorMessage(`Failed to fetch messages: ${messagesResponse.error}`);
                await client.deleteSearchJob(jobId);
                return;
            }
            results = messagesResponse.data.messages;
            resultCount = results.length;
        } else {
            const recordsResponse = await client.getRecords(jobId);
            if (recordsResponse.error || !recordsResponse.data) {
                vscode.window.showErrorMessage(`Failed to fetch records: ${recordsResponse.error}`);
                await client.deleteSearchJob(jobId);
                return;
            }
            results = recordsResponse.data.records;
            resultCount = results.length;
        }

        // Clean up job
        await client.deleteSearchJob(jobId);

        // Display results
        if (results.length === 0) {
            vscode.window.showInformationMessage('Query completed: No results found');
            return;
        }


        // Add discovered fields to autocomplete
        const dynamicProvider = getDynamicCompletionProvider();
        if (dynamicProvider) {
            dynamicProvider.addFieldsFromResults(results);
            const fieldCount = dynamicProvider.getFieldCount();
            console.log(`Dynamic autocomplete now has ${fieldCount} discovered fields`);
        }

        // Handle webview output separately
        if (outputFormat === 'webview') {
            const panel = vscode.window.createWebviewPanel(
                'sumoQueryResults',
                `Query Results: ${metadata.name || cleanedQuery.split('\n')[0].substring(0, 30)}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            // Get page size from settings
            const config = vscode.workspace.getConfiguration('sumologic');
            const pageSize = config.get<number>('webviewPageSize') || 200;

            const htmlContent = formatRecordsAsHTML(results, {
                query: cleanedQuery,
                from: from,
                to: to,
                mode: mode,
                count: resultCount,
                pageSize: pageSize
            });

            panel.webview.html = htmlContent;

            // Handle messages from webview
            panel.webview.onDidReceiveMessage(
                async (message) => {
                    if (message.command === 'exportCSV') {
                        // Get workspace folder or use home directory
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                        const defaultUri = workspaceFolder
                            ? vscode.Uri.file(workspaceFolder.uri.fsPath)
                            : undefined;

                        // Prompt user for save location
                        const uri = await vscode.window.showSaveDialog({
                            defaultUri: defaultUri,
                            filters: {
                                'CSV Files': ['csv'],
                                'All Files': ['*']
                            },
                            saveLabel: 'Export CSV'
                        });

                        if (uri) {
                            const fs = await import('fs');
                            fs.writeFileSync(uri.fsPath, message.csvData, 'utf-8');
                            vscode.window.showInformationMessage(`CSV exported to ${uri.fsPath}`);
                        }
                    }
                },
                undefined,
                context.subscriptions
            );

            vscode.window.showInformationMessage(`Query completed: ${resultCount} ${mode} found (webview)`);
        } else {
            // Format results based on selected format for file output
            let resultText: string;
            let fileExtension: string;

            switch (outputFormat) {
                case 'json':
                    resultText = formatResultsAsJSON(results);
                    fileExtension = 'json';
                    break;
                case 'csv':
                    resultText = formatRecordsAsCSV(results);
                    fileExtension = 'csv';
                    break;
                case 'table':
                default:
                    resultText = `Sumo Logic Query Results (${mode} - ${outputFormat})\n` +
                                 `====================================\n` +
                                 `Query: ${cleanedQuery.split('\n')[0]}...\n` +
                                 `From: ${from} (${fromTime})\n` +
                                 `To: ${to} (${toTime})\n` +
                                 `Results: ${resultCount} ${mode}\n` +
                                 `\n` +
                                 formatRecordsAsTable(results);
                    fileExtension = 'txt';
                    break;
            }

            // Write results to file
            const outputWriter = new OutputWriter(context);
            const queryIdentifier = metadata.name || cleanedQuery.split('\n')[0].substring(0, 50);
            const filename = `query_${queryIdentifier}_${mode}_${from}_to_${to}`;

            try {
                const filePath = await outputWriter.writeAndOpen('queries', filename, resultText, fileExtension);
                vscode.window.showInformationMessage(`Query completed: ${resultCount} ${mode} found (${outputFormat} format)`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to write results: ${error}`);
            }
        }
    });
}

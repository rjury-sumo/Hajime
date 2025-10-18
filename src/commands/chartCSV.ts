import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parse CSV file and detect chart type
 */
function parseCSV(csvContent: string): { headers: string[], data: any[], hasTimeslice: boolean } {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV file must have at least a header and one data row');
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'));

    // Check if _timeslice column exists
    const hasTimeslice = headers.includes('_timeslice');

    // Parse data rows
    const data: any[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parsing (handles quoted values)
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim().replace(/^"(.*)"$/, '$1'));
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim().replace(/^"(.*)"$/, '$1'));

        // Create row object
        const row: any = {};
        headers.forEach((header, idx) => {
            const value = values[idx] || '';
            // Try to parse as number
            const numValue = parseFloat(value);
            row[header] = isNaN(numValue) ? value : numValue;
        });
        data.push(row);
    }

    return { headers, data, hasTimeslice };
}

/**
 * Generate ECharts HTML for timeseries data
 */
function generateTimeseriesChart(headers: string[], data: any[]): string {
    const timesliceIndex = headers.indexOf('_timeslice');
    const valueColumns = headers.filter((h, idx) => idx !== timesliceIndex);

    const valueColumnsConfig = JSON.stringify(valueColumns);
    const dataConfig = JSON.stringify(data);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
        }
        #chart {
            width: 100%;
            height: 600px;
        }
        .toolbar {
            margin-bottom: 15px;
            padding: 10px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border-radius: 3px;
        }
        .toolbar button {
            padding: 4px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
            margin-right: 8px;
        }
        .toolbar button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .toolbar select {
            padding: 4px 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <label>Chart Type: </label>
        <select id="chartType" onchange="updateChart()">
            <option value="line">Line Chart</option>
            <option value="bar">Bar Chart</option>
        </select>
        <label style="margin-left: 15px;">
            <input type="checkbox" id="stackSeries" onchange="updateChart()">
            Stack Series
        </label>
        <label style="margin-left: 15px;">
            <input type="checkbox" id="areaStyle" onchange="updateChart()">
            Area Fill
        </label>
        <button onclick="chart.dispatchAction({type: 'restore'})">Reset Zoom</button>
        <button onclick="downloadChart()">Download PNG</button>
        <button onclick="toggleConfigEditor()">Show Configuration</button>
    </div>
    <div id="chart"></div>

    <script>
        const vscode = acquireVsCodeApi();
        const chartDom = document.getElementById('chart');
        const chart = echarts.init(chartDom, 'dark');

        const valueColumns = ${valueColumnsConfig};
        const allData = ${dataConfig};

        function getOption() {
            const chartType = document.getElementById('chartType').value;
            const stackEnabled = document.getElementById('stackSeries').checked;
            const areaEnabled = document.getElementById('areaStyle').checked;

            // Prepare series data
            const series = valueColumns.map(col => {
                const s = {
                    name: col,
                    type: chartType,
                    data: allData.map(row => [row._timeslice, row[col]])
                };

                if (stackEnabled) {
                    s.stack = 'total';
                }

                if (areaEnabled && chartType === 'line') {
                    s.areaStyle = {};
                }

                return s;
            });

            return {
                title: {
                    text: 'Time Series Data',
                    textStyle: {
                        color: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                    }
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'cross'
                    }
                },
                legend: {
                    data: valueColumns,
                    textStyle: {
                        color: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                    }
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '3%',
                    containLabel: true
                },
                toolbox: {
                    feature: {
                        dataZoom: {
                            yAxisIndex: 'none'
                        },
                        restore: {},
                        saveAsImage: {}
                    },
                    iconStyle: {
                        borderColor: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                    }
                },
                xAxis: {
                    type: 'time',
                    axisLabel: {
                        color: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                    }
                },
                yAxis: {
                    type: 'value',
                    axisLabel: {
                        color: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                    }
                },
                dataZoom: [
                    {
                        type: 'inside',
                        start: 0,
                        end: 100
                    },
                    {
                        start: 0,
                        end: 100,
                        textStyle: {
                            color: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                        }
                    }
                ],
                series: series
            };
        }

        function updateChart() {
            chart.setOption(getOption(), true);
        }

        // Initial render
        updateChart();

        // Resize chart on window resize
        window.addEventListener('resize', () => {
            chart.resize();
        });

        function downloadChart() {
            const url = chart.getDataURL({
                type: 'png',
                pixelRatio: 2,
                backgroundColor: getComputedStyle(document.body).getPropertyValue('--vscode-editor-background')
            });
            const link = document.createElement('a');
            link.download = 'chart.png';
            link.href = url;
            link.click();
        }

        function toggleConfigEditor() {
            const currentOption = chart.getOption();
            vscode.postMessage({
                command: 'toggleConfigEditor',
                config: currentOption
            });
        }

        // Listen for configuration updates from the editor
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateChart') {
                try {
                    chart.setOption(message.config, true);
                } catch (error) {
                    console.error('Failed to update chart:', error);
                }
            }
        });
    </script>
</body>
</html>`;
}

/**
 * Generate ECharts HTML for categorical data (bar chart)
 */
function generateCategoricalChart(headers: string[], data: any[]): string {
    // Default: use last string column as category, or last column if all numeric
    let defaultCategoryColumn = headers[headers.length - 1];

    // Try to find a good string column for categories (prefer non-numeric columns)
    for (let i = headers.length - 1; i >= 0; i--) {
        const col = headers[i];
        const firstValue = data[0][col];
        if (typeof firstValue === 'string' || isNaN(Number(firstValue))) {
            defaultCategoryColumn = col;
            break;
        }
    }

    const headersConfig = JSON.stringify(headers);
    const dataConfig = JSON.stringify(data);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
        }
        #chart {
            width: 100%;
            height: 600px;
        }
        .toolbar {
            margin-bottom: 15px;
            padding: 10px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border-radius: 3px;
        }
        .toolbar button {
            padding: 4px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
            margin-right: 8px;
        }
        .toolbar button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .toolbar select {
            padding: 4px 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <label>X-Axis: </label>
        <select id="xAxisColumn" onchange="updateChart()">
        </select>
        <label style="margin-left: 15px;">Chart Type: </label>
        <select id="chartType" onchange="updateChart()">
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
            <option value="pie">Pie Chart</option>
        </select>
        <label style="margin-left: 15px;">
            <input type="checkbox" id="stackSeries" onchange="updateChart()">
            Stack Series
        </label>
        <button onclick="downloadChart()">Download PNG</button>
        <button onclick="toggleConfigEditor()">Show Configuration</button>
    </div>
    <div id="chart"></div>

    <script>
        const vscode = acquireVsCodeApi();
        const chartDom = document.getElementById('chart');
        const chart = echarts.init(chartDom, 'dark');

        const allHeaders = ${headersConfig};
        const allData = ${dataConfig};
        const defaultCategoryColumn = '${defaultCategoryColumn}';

        // Populate X-axis dropdown
        const xAxisSelect = document.getElementById('xAxisColumn');
        allHeaders.forEach(header => {
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            if (header === defaultCategoryColumn) {
                option.selected = true;
            }
            xAxisSelect.appendChild(option);
        });

        function getOption() {
            const chartType = document.getElementById('chartType').value;
            const xAxisColumn = document.getElementById('xAxisColumn').value;
            const stackEnabled = document.getElementById('stackSeries').checked;

            // Get value columns (all columns except the x-axis)
            const valueColumns = allHeaders.filter(h => h !== xAxisColumn);

            // Get categories from selected column
            const categories = allData.map(row => String(row[xAxisColumn]));

            // Prepare series data
            const seriesData = valueColumns.map(col => {
                const series = {
                    name: col,
                    type: chartType === 'pie' ? 'pie' : chartType,
                    data: allData.map(row => row[col])
                };

                // Add stack property if enabled and not pie chart
                if (stackEnabled && chartType !== 'pie') {
                    series.stack = 'total';
                }

                return series;
            });

            const baseOption = {
                title: {
                    text: 'Categorical Data',
                    textStyle: {
                        color: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                    }
                },
                tooltip: {
                    trigger: chartType === 'pie' ? 'item' : 'axis',
                    axisPointer: chartType === 'pie' ? undefined : {
                        type: 'shadow'
                    }
                },
                legend: {
                    data: valueColumns,
                    textStyle: {
                        color: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                    }
                },
                toolbox: {
                    feature: {
                        saveAsImage: {}
                    },
                    iconStyle: {
                        borderColor: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                    }
                }
            };

            if (chartType === 'pie') {
                // For pie chart, use first value column
                return {
                    ...baseOption,
                    series: [{
                        name: seriesData[0].name,
                        type: 'pie',
                        radius: '50%',
                        data: categories.map((cat, idx) => ({
                            name: cat,
                            value: seriesData[0].data[idx]
                        })),
                        emphasis: {
                            itemStyle: {
                                shadowBlur: 10,
                                shadowOffsetX: 0,
                                shadowColor: 'rgba(0, 0, 0, 0.5)'
                            }
                        }
                    }]
                };
            } else {
                return {
                    ...baseOption,
                    grid: {
                        left: '3%',
                        right: '4%',
                        bottom: '3%',
                        containLabel: true
                    },
                    xAxis: {
                        type: 'category',
                        data: categories,
                        axisLabel: {
                            color: getComputedStyle(document.body).getPropertyValue('--vscode-foreground'),
                            rotate: 45
                        }
                    },
                    yAxis: {
                        type: 'value',
                        axisLabel: {
                            color: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                        }
                    },
                    series: seriesData
                };
            }
        }

        function updateChart() {
            chart.setOption(getOption(), true);
        }

        // Initial render
        updateChart();

        // Resize chart on window resize
        window.addEventListener('resize', () => {
            chart.resize();
        });

        function downloadChart() {
            const url = chart.getDataURL({
                type: 'png',
                pixelRatio: 2,
                backgroundColor: getComputedStyle(document.body).getPropertyValue('--vscode-editor-background')
            });
            const link = document.createElement('a');
            link.download = 'chart.png';
            link.href = url;
            link.click();
        }

        function toggleConfigEditor() {
            const currentOption = chart.getOption();
            vscode.postMessage({
                command: 'toggleConfigEditor',
                config: currentOption
            });
        }

        // Listen for configuration updates from the editor
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateChart') {
                try {
                    chart.setOption(message.config, true);
                } catch (error) {
                    console.error('Failed to update chart:', error);
                }
            }
        });
    </script>
</body>
</html>`;
}

/**
 * Command to chart CSV data
 */
export async function chartCSVCommand(context: vscode.ExtensionContext, uri?: vscode.Uri): Promise<void> {
    // Get file URI from active editor if not provided
    if (!uri) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active CSV file');
            return;
        }
        uri = editor.document.uri;
    }

    // Check if file is CSV
    if (path.extname(uri.fsPath) !== '.csv') {
        vscode.window.showErrorMessage('Selected file is not a CSV file');
        return;
    }

    try {
        // Read CSV file
        const csvContent = fs.readFileSync(uri.fsPath, 'utf-8');

        // Parse CSV
        const { headers, data, hasTimeslice } = parseCSV(csvContent);

        // Generate appropriate chart HTML
        const htmlContent = hasTimeslice
            ? generateTimeseriesChart(headers, data)
            : generateCategoricalChart(headers, data);

        // Create webview panel
        const panel = vscode.window.createWebviewPanel(
            'csvChart',
            `Chart: ${path.basename(uri.fsPath)}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = htmlContent;

        // Track config editor panel for this chart
        let configEditorPanel: vscode.WebviewPanel | undefined;

        // Handle messages from chart webview
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'toggleConfigEditor') {
                if (configEditorPanel) {
                    // Close existing editor
                    configEditorPanel.dispose();
                    configEditorPanel = undefined;
                } else {
                    // Create new config editor panel
                    configEditorPanel = vscode.window.createWebviewPanel(
                        'chartConfigEditor',
                        `Config: ${path.basename(uri.fsPath)}`,
                        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
                        {
                            enableScripts: true,
                            retainContextWhenHidden: true
                        }
                    );

                    configEditorPanel.webview.html = generateConfigEditorHTML(message.config);

                    // Handle messages from config editor
                    configEditorPanel.webview.onDidReceiveMessage((editorMessage) => {
                        if (editorMessage.command === 'runChart') {
                            // Update the chart with new configuration
                            panel.webview.postMessage({
                                command: 'updateChart',
                                config: editorMessage.config
                            });
                        }
                    });

                    // Clean up reference when editor is disposed
                    configEditorPanel.onDidDispose(() => {
                        configEditorPanel = undefined;
                    });
                }
            }
        });

        // Close config editor when chart is closed
        panel.onDidDispose(() => {
            if (configEditorPanel) {
                configEditorPanel.dispose();
            }
        });

        vscode.window.showInformationMessage(
            `Chart created for ${path.basename(uri.fsPath)} (${hasTimeslice ? 'timeseries' : 'categorical'})`
        );

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to chart CSV: ${error}`);
    }
}

/**
 * Generate HTML for chart configuration editor
 */
function generateConfigEditorHTML(config: any): string {
    const configJson = JSON.stringify(config, null, 2);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chart Configuration Editor</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .editor-toolbar {
            padding: 10px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .editor-toolbar button {
            padding: 6px 14px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        .editor-toolbar button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .editor-toolbar .status {
            margin-left: auto;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .editor-toolbar .error {
            color: var(--vscode-errorForeground);
        }
        .editor-toolbar .success {
            color: var(--vscode-testing-iconPassed);
        }
        #editor-container {
            flex: 1;
            overflow: hidden;
        }
    </style>
</head>
<body>
    <div class="editor-toolbar">
        <button onclick="runChart()">▶ Run</button>
        <button onclick="formatConfig()">Format JSON</button>
        <button onclick="copyConfig()">Copy to Clipboard</button>
        <span class="status" id="status"></span>
    </div>
    <div id="editor-container"></div>

    <script>
        const vscode = acquireVsCodeApi();
        let editor;

        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
        require(['vs/editor/editor.main'], function() {
            editor = monaco.editor.create(document.getElementById('editor-container'), {
                value: ${JSON.stringify(configJson)},
                language: 'json',
                theme: 'vs-dark',
                automaticLayout: true,
                minimap: { enabled: true },
                fontSize: 13,
                tabSize: 2,
                formatOnPaste: true,
                formatOnType: true
            });
        });

        function runChart() {
            try {
                const configText = editor.getValue();
                const config = JSON.parse(configText);

                vscode.postMessage({
                    command: 'runChart',
                    config: config
                });

                showStatus('Chart updated', 'success');
            } catch (error) {
                showStatus('Invalid JSON: ' + error.message, 'error');
            }
        }

        function formatConfig() {
            try {
                const configText = editor.getValue();
                const config = JSON.parse(configText);
                const formatted = JSON.stringify(config, null, 2);
                editor.setValue(formatted);
                showStatus('Formatted', 'success');
            } catch (error) {
                showStatus('Cannot format invalid JSON', 'error');
            }
        }

        function copyConfig() {
            const configText = editor.getValue();
            navigator.clipboard.writeText(configText).then(() => {
                showStatus('Copied to clipboard', 'success');
            }).catch(() => {
                showStatus('Failed to copy', 'error');
            });
        }

        function showStatus(message, type) {
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            statusEl.className = 'status ' + type;
            setTimeout(() => {
                statusEl.textContent = '';
                statusEl.className = 'status';
            }, 3000);
        }

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                runChart();
            }
        });
    </script>
</body>
</html>`;
}

"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chartCSVCommand = chartCSVCommand;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
/**
 * Parse CSV file and detect chart type
 */
function parseCSV(csvContent) {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV file must have at least a header and one data row');
    }
    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'));
    // Check if _timeslice column exists
    const hasTimeslice = headers.includes('_timeslice');
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line)
            continue;
        // Simple CSV parsing (handles quoted values)
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            }
            else if (char === ',' && !inQuotes) {
                values.push(current.trim().replace(/^"(.*)"$/, '$1'));
                current = '';
            }
            else {
                current += char;
            }
        }
        values.push(current.trim().replace(/^"(.*)"$/, '$1'));
        // Create row object
        const row = {};
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
function generateTimeseriesChart(headers, data) {
    const timesliceIndex = headers.indexOf('_timeslice');
    const valueColumns = headers.filter((h, idx) => idx !== timesliceIndex);
    // Prepare series data
    const series = valueColumns.map(col => ({
        name: col,
        type: 'line',
        data: data.map(row => [row._timeslice, row[col]])
    }));
    const seriesConfig = JSON.stringify(series);
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
    </style>
</head>
<body>
    <div class="toolbar">
        <button onclick="chart.dispatchAction({type: 'restore'})">Reset Zoom</button>
        <button onclick="downloadChart()">Download PNG</button>
    </div>
    <div id="chart"></div>

    <script>
        const chartDom = document.getElementById('chart');
        const chart = echarts.init(chartDom, 'dark');

        const option = {
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
                data: ${JSON.stringify(valueColumns)},
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
            series: ${seriesConfig}
        };

        chart.setOption(option);

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
    </script>
</body>
</html>`;
}
/**
 * Generate ECharts HTML for categorical data (bar chart)
 */
function generateCategoricalChart(headers, data) {
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
        <button onclick="downloadChart()">Download PNG</button>
    </div>
    <div id="chart"></div>

    <script>
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

            // Get value columns (all columns except the x-axis)
            const valueColumns = allHeaders.filter(h => h !== xAxisColumn);

            // Get categories from selected column
            const categories = allData.map(row => String(row[xAxisColumn]));

            // Prepare series data
            const seriesData = valueColumns.map(col => ({
                name: col,
                type: chartType === 'pie' ? 'pie' : chartType,
                data: allData.map(row => row[col])
            }));

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
    </script>
</body>
</html>`;
}
/**
 * Command to chart CSV data
 */
function chartCSVCommand(context, uri) {
    return __awaiter(this, void 0, void 0, function* () {
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
            const panel = vscode.window.createWebviewPanel('csvChart', `Chart: ${path.basename(uri.fsPath)}`, vscode.ViewColumn.Beside, {
                enableScripts: true,
                retainContextWhenHidden: true
            });
            panel.webview.html = htmlContent;
            vscode.window.showInformationMessage(`Chart created for ${path.basename(uri.fsPath)} (${hasTimeslice ? 'timeseries' : 'categorical'})`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to chart CSV: ${error}`);
        }
    });
}
//# sourceMappingURL=chartCSV.js.map
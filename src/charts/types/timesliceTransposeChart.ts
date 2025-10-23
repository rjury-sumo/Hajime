/**
 * Timeslice Transpose Chart Type
 * Handles data that has been transposed in Sumo Logic with _timeslice as rows
 * Example: | timeslice 1m | count by _timeslice, _sourceCategory | transpose row _timeslice column _sourceCategory
 *
 * In this chart type:
 * - _timeslice is the X-axis (time)
 * - All other columns are treated as separate series
 * - Each series represents a transposed column from the original query
 */

import { EChartsOption } from 'echarts';
import { ChartType, ChartConfig, ChartConfigOption } from '../chartTypes';
import { applyAdvancedSettings } from '../chartUtils';

/**
 * Parse timestamp to milliseconds
 */
function parseTimestamp(value: any): number {
    if (typeof value === 'number') {
        return value;
    }

    const str = String(value);

    // Epoch milliseconds (13 digits)
    if (/^\d{13}$/.test(str)) {
        return parseInt(str, 10);
    }

    // Epoch seconds (10 digits)
    if (/^\d{10}$/.test(str)) {
        return parseInt(str, 10) * 1000;
    }

    // ISO date string
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        return date.getTime();
    }

    return 0;
}

/**
 * Transform data for timeslice transpose charts
 * Data is already in the correct format from Sumo's transpose operation
 */
function transformTimesliceTransposeData(data: any[], config: ChartConfig, fieldMetadata?: any[]): EChartsOption {
    const { options } = config;

    // Get time field (should be _timeslice for transposed data)
    const timeField = options.timeField || '_timeslice';

    // Get value field to aggregate (optional - defaults to count behavior)
    const valueField = options.valueField;
    const aggregation = options.aggregation || 'sum';
    const chartType = options.chartType || 'line';
    const stacked = options.stacked || false;
    const topN = options.topN || 0; // 0 means show all series

    // Validate that timeField exists in data
    if (!data.some(record => record[timeField] !== undefined)) {
        throw new Error(`Time field "${timeField}" not found in data. Make sure your query uses "transpose row _timeslice"`);
    }

    // Get all series fields (all fields except the time field and optional value field)
    const allSeriesFields = Object.keys(data[0] || {}).filter(field =>
        field !== timeField && field !== valueField
    );

    // If topN is specified and > 0, calculate total values per series to determine top N
    let seriesFields = allSeriesFields;
    if (topN && topN > 0 && allSeriesFields.length > topN) {
        const seriesTotals = new Map<string, number>();

        allSeriesFields.forEach(seriesField => {
            let total = 0;
            data.forEach(record => {
                const value = parseFloat(record[seriesField]);
                if (!isNaN(value)) {
                    total += value;
                }
            });
            seriesTotals.set(seriesField, total);
        });

        // Sort by total and take top N
        seriesFields = Array.from(seriesTotals.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN)
            .map(([field]) => field);
    }

    // Sort data by time
    const sortedData = [...data].sort((a, b) => {
        const timeA = parseTimestamp(a[timeField]);
        const timeB = parseTimestamp(b[timeField]);
        return timeA - timeB;
    });

    // Build series data for each column
    const series = seriesFields.map(seriesField => {
        const seriesData = sortedData.map(record => {
            const time = parseTimestamp(record[timeField]);
            let value = parseFloat(record[seriesField]);

            // Handle missing or NaN values
            if (isNaN(value)) {
                value = 0;
            }

            return [time, value];
        });

        const seriesConfig: any = {
            name: seriesField,
            type: chartType === 'area' ? 'line' : chartType,
            data: seriesData,
            smooth: options.smooth || false
        };

        if (stacked) {
            seriesConfig.stack = 'total';
        }

        if (chartType === 'area') {
            seriesConfig.areaStyle = {};
        }

        return seriesConfig;
    });

    const baseOption: EChartsOption = {
        title: {
            text: `Timeslice Transpose: ${seriesFields.length} Series`,
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        legend: {
            data: seriesFields,
            right: 10,
            top: 'middle',
            orient: 'vertical',
            type: 'scroll'
        },
        grid: {
            left: '3%',
            right: '15%',
            bottom: '12%',
            top: '80px',
            containLabel: true
        },
        toolbox: {
            feature: {
                dataZoom: {
                    yAxisIndex: 'none'
                },
                restore: {},
                saveAsImage: {}
            }
        },
        xAxis: {
            type: 'time',
            name: 'Time'
        },
        yAxis: {
            type: 'value',
            name: aggregation || 'Value'
        },
        dataZoom: [
            {
                type: 'inside',
                start: 0,
                end: 100
            },
            {
                start: 0,
                end: 100
            }
        ],
        series
    };

    // Apply advanced settings if configured
    return applyAdvancedSettings(baseOption, options.advancedSettings);
}

/**
 * Configuration options for timeslice transpose charts
 */
const timesliceTransposeChartOptions: ChartConfigOption[] = [
    {
        id: 'timeField',
        label: 'Time Field',
        type: 'field-select',
        defaultValue: '_timeslice',
        description: 'Field to use as time axis (typically _timeslice for transposed data)',
        required: false
    },
    {
        id: 'chartType',
        label: 'Chart Type',
        type: 'select',
        defaultValue: 'line',
        options: [
            { value: 'line', label: 'Line Chart' },
            { value: 'area', label: 'Area Chart' },
            { value: 'bar', label: 'Bar Chart' }
        ],
        required: true
    },
    {
        id: 'stacked',
        label: 'Stack Series',
        type: 'checkbox',
        defaultValue: false,
        description: 'Stack multiple series on top of each other'
    },
    {
        id: 'smooth',
        label: 'Smooth Lines',
        type: 'checkbox',
        defaultValue: false,
        description: 'Apply smoothing to line/area charts'
    },
    {
        id: 'topN',
        label: 'Top N Series',
        type: 'number',
        defaultValue: 0,
        description: 'Show only the top N series by total value (0 = show all)'
    },
    {
        id: 'advancedSettings',
        label: 'Advanced Settings',
        type: 'advanced-settings',
        defaultValue: {},
        description: 'Configure title, legend, axes, and other display settings'
    }
];

/**
 * Timeslice Transpose Chart Type Definition
 */
export const timesliceTransposeChartType: ChartType = {
    id: 'timeslice-transpose',
    name: 'Timeslice Transpose',
    description: 'Chart data that has been transposed with _timeslice as rows and other fields as series (e.g., | transpose row _timeslice column _sourceCategory)',
    category: 'timeseries',
    minFields: 0,
    maxFields: 1,
    supportedDataTypes: ['any'],
    requiresTimeField: true,
    configOptions: timesliceTransposeChartOptions,
    transformer: transformTimesliceTransposeData,
    validate: (config: ChartConfig, fieldMetadata?: any[]) => {
        // Check if _timeslice field exists
        const hasTimeslice = fieldMetadata?.some(f => f.name === '_timeslice' || f.isTimeField);
        if (!hasTimeslice) {
            return {
                valid: false,
                error: 'No _timeslice field found. This chart type requires data transposed with "_timeslice" as the row field (e.g., | transpose row _timeslice column _sourceCategory)'
            };
        }

        // Check if there are at least 2 columns (timeslice + at least one series)
        if (!fieldMetadata || fieldMetadata.length < 2) {
            return {
                valid: false,
                error: 'At least 2 fields required: _timeslice and at least one series column from transpose'
            };
        }

        return { valid: true };
    }
};

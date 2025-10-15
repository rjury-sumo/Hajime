/**
 * Timeseries Chart Type
 * Supports time-based line, area, and bar charts
 */

import { EChartsOption } from 'echarts';
import { ChartType, ChartConfig, ChartConfigOption } from '../chartTypes';

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
 * Transform data for timeseries charts
 */
function transformTimeseriesData(data: any[], config: ChartConfig, fieldMetadata?: any[]): EChartsOption {
    const { fields, options } = config;
    const timeField = options.timeField || fields.find((f: string) => {
        const meta = fieldMetadata?.find(m => m.name === f);
        return meta?.isTimeField;
    }) || fields[0];

    const valueFields = fields.filter(f => f !== timeField);
    const chartType = options.chartType || 'line';
    const stacked = options.stacked || false;

    // Parse and sort data by time
    const timeData = data
        .map(record => ({
            time: parseTimestamp(record[timeField]),
            values: valueFields.reduce((acc, field) => {
                acc[field] = parseFloat(record[field]) || 0;
                return acc;
            }, {} as Record<string, number>)
        }))
        .filter(item => item.time > 0)
        .sort((a, b) => a.time - b.time);

    // Build series for each value field
    const series = valueFields.map(field => {
        const seriesData = timeData.map(item => [item.time, item.values[field]]);

        const seriesConfig: any = {
            name: field,
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

    return {
        title: {
            text: `${valueFields.join(', ')} over Time`,
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        legend: {
            data: valueFields,
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '10%',
            top: '15%',
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
            type: 'time'
        },
        yAxis: {
            type: 'value'
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
}

/**
 * Configuration options for timeseries charts
 */
const timeseriesChartOptions: ChartConfigOption[] = [
    {
        id: 'timeField',
        label: 'Time Field',
        type: 'field-select',
        defaultValue: null,
        description: 'Field to use as time axis (auto-detected if not specified)',
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
    }
];

/**
 * Timeseries Chart Type Definition
 */
export const timeseriesChartType: ChartType = {
    id: 'timeseries',
    name: 'Timeseries Chart',
    description: 'Visualize data over time with line, area, or bar charts',
    category: 'timeseries',
    minFields: 1,
    maxFields: 10,
    supportedDataTypes: ['number', 'string', 'any'],
    requiresTimeField: true,
    configOptions: timeseriesChartOptions,
    transformer: transformTimeseriesData,
    validate: (config: ChartConfig, fieldMetadata?: any[]) => {
        // Check if we have at least one time field available
        const hasTimeField = fieldMetadata?.some(f => f.isTimeField);
        if (!hasTimeField) {
            return {
                valid: false,
                error: 'No time field available in the data. Timeseries charts require a time field like _timeslice, _messagetime, or _receipttime.'
            };
        }
        return { valid: true };
    }
};

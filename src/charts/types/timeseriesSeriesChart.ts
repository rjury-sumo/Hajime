/**
 * Timeseries with Series Chart Type
 * Supports aggregation of values over time, grouped by a categorical field
 * Example: "count by status_code over time"
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
 * Transform data for timeseries with series aggregation
 */
function transformTimeseriesSeriesData(data: any[], config: ChartConfig, fieldMetadata?: any[]): EChartsOption {
    const { fields, options } = config;

    // Get time field (auto-detect or from config)
    const timeField = options.timeField || fields.find((f: string) => {
        const meta = fieldMetadata?.find(m => m.name === f);
        return meta?.isTimeField;
    }) || '_timeslice';

    const seriesField = options.seriesField; // The categorical field to group by (e.g., collector, status_code)
    const valueField = options.valueField; // The field to aggregate (e.g., bytes) - optional for count
    const aggregation = options.aggregation || 'count';
    const chartType = options.chartType || 'line';
    const stacked = options.stacked || false;
    const topN = options.topN || 10;

    // Group data by time and series
    const timeSeriesMap = new Map<number, Map<string, number[]>>();
    const seriesValueCounts = new Map<string, number>(); // Track total count per series for topN

    data.forEach(record => {
        const timeValue = parseTimestamp(record[timeField]);
        if (timeValue === 0) return;

        const seriesValue = String(record[seriesField] || '(empty)');
        const value = valueField ? parseFloat(record[valueField]) : 1;

        if (!timeSeriesMap.has(timeValue)) {
            timeSeriesMap.set(timeValue, new Map());
        }

        const seriesMap = timeSeriesMap.get(timeValue)!;
        if (!seriesMap.has(seriesValue)) {
            seriesMap.set(seriesValue, []);
        }

        seriesMap.get(seriesValue)!.push(isNaN(value) ? 0 : value);

        // Track total for this series
        seriesValueCounts.set(seriesValue, (seriesValueCounts.get(seriesValue) || 0) + 1);
    });

    // Get top N series by count (if topN is specified and > 0)
    const includeOther = options.includeOther || false;
    let topSeries: string[];
    let otherSeriesNames: string[] = [];

    if (topN && topN > 0) {
        const sortedSeries = Array.from(seriesValueCounts.entries())
            .sort((a, b) => b[1] - a[1]);

        topSeries = sortedSeries.slice(0, topN).map(([series]) => series);

        if (includeOther && sortedSeries.length > topN) {
            otherSeriesNames = sortedSeries.slice(topN).map(([series]) => series);
        }
    } else {
        // Show all series
        topSeries = Array.from(seriesValueCounts.keys());
    }

    // Sort time points
    const sortedTimes = Array.from(timeSeriesMap.keys()).sort((a, b) => a - b);

    // Build series data for each unique series value
    const allSeriesData: Array<{ name: string; data: Array<[number, number]> }> = [];

    topSeries.forEach(seriesValue => {
        const seriesData: Array<[number, number]> = [];

        sortedTimes.forEach(time => {
            const seriesMap = timeSeriesMap.get(time)!;
            const values = seriesMap.get(seriesValue) || [];

            let aggregatedValue = 0;

            if (values.length > 0) {
                switch (aggregation) {
                    case 'count':
                        aggregatedValue = values.length;
                        break;
                    case 'sum':
                        aggregatedValue = values.reduce((a, b) => a + b, 0);
                        break;
                    case 'avg':
                        aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
                        break;
                    case 'min':
                        aggregatedValue = Math.min(...values);
                        break;
                    case 'max':
                        aggregatedValue = Math.max(...values);
                        break;
                    default:
                        aggregatedValue = values.length;
                }
            }

            seriesData.push([time, aggregatedValue]);
        });

        allSeriesData.push({
            name: seriesValue,
            data: seriesData
        });
    });

    // Add "Other" series if requested
    if (includeOther && otherSeriesNames.length > 0) {
        const otherSeriesData: Array<[number, number]> = [];

        sortedTimes.forEach(time => {
            const seriesMap = timeSeriesMap.get(time)!;
            let otherAggregatedValue = 0;

            // Aggregate all "other" series for this time
            otherSeriesNames.forEach(otherSeriesName => {
                const values = seriesMap.get(otherSeriesName) || [];
                if (values.length > 0) {
                    let seriesValue = 0;
                    switch (aggregation) {
                        case 'count':
                            seriesValue = values.length;
                            break;
                        case 'sum':
                            seriesValue = values.reduce((a, b) => a + b, 0);
                            break;
                        case 'avg':
                            seriesValue = values.reduce((a, b) => a + b, 0) / values.length;
                            break;
                        case 'min':
                            seriesValue = Math.min(...values);
                            break;
                        case 'max':
                            seriesValue = Math.max(...values);
                            break;
                        default:
                            seriesValue = values.length;
                    }
                    otherAggregatedValue += seriesValue;
                }
            });

            otherSeriesData.push([time, otherAggregatedValue]);
        });

        allSeriesData.push({
            name: 'Other',
            data: otherSeriesData
        });
    }

    // Build ECharts series
    const series = allSeriesData.map(s => {
        const seriesConfig: any = {
            name: s.name,
            type: chartType === 'area' ? 'line' : chartType,
            data: s.data,
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
            text: `${aggregation} ${valueField ? 'of ' + valueField : ''} by ${seriesField} over Time`,
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        legend: {
            data: allSeriesData.map(s => s.name),
            bottom: 0,
            type: 'scroll'
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
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
            type: 'value',
            name: aggregation
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
 * Configuration options for timeseries with series charts
 */
const timeseriesSeriesChartOptions: ChartConfigOption[] = [
    {
        id: 'timeField',
        label: 'Time Field',
        type: 'field-select',
        defaultValue: null,
        description: 'Field to use as time axis (auto-detected if not specified)',
        required: false
    },
    {
        id: 'seriesField',
        label: 'Series Field',
        type: 'field-select',
        defaultValue: null,
        description: 'Categorical field to group by (e.g., collector, status_code, tier)',
        required: true
    },
    {
        id: 'valueField',
        label: 'Value Field',
        type: 'field-select',
        defaultValue: null,
        description: 'Numeric field to aggregate (e.g., bytes, response_time). Leave empty for count.',
        required: false
    },
    {
        id: 'aggregation',
        label: 'Aggregation',
        type: 'select',
        defaultValue: 'count',
        options: [
            { value: 'count', label: 'Count' },
            { value: 'sum', label: 'Sum' },
            { value: 'avg', label: 'Average' },
            { value: 'min', label: 'Minimum' },
            { value: 'max', label: 'Maximum' }
        ],
        description: 'How to aggregate values for each series over time'
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
        defaultValue: 10,
        description: 'Show only the top N series by total count (leave 0 or blank for all)'
    },
    {
        id: 'includeOther',
        label: 'Include "Other" Series',
        type: 'checkbox',
        defaultValue: false,
        description: 'Group series outside Top N into an "Other" series'
    }
];

/**
 * Timeseries with Series Chart Type Definition
 */
export const timeseriesSeriesChartType: ChartType = {
    id: 'timeseries-series',
    name: 'Timeseries by Series',
    description: 'Aggregate data over time, grouped by a categorical field (e.g., sum(bytes) by collector over time)',
    category: 'timeseries',
    minFields: 0,
    maxFields: 1,
    supportedDataTypes: ['number', 'string', 'any'],
    requiresTimeField: true,
    configOptions: timeseriesSeriesChartOptions,
    transformer: transformTimeseriesSeriesData,
    validate: (config: ChartConfig, fieldMetadata?: any[]) => {
        // Check if we have at least one time field available
        const hasTimeField = fieldMetadata?.some(f => f.isTimeField);
        if (!hasTimeField) {
            return {
                valid: false,
                error: 'No time field available in the data. Timeseries charts require a time field like _timeslice, _messagetime, or _receipttime.'
            };
        }

        // Check if series field is provided
        if (!config.options.seriesField) {
            return {
                valid: false,
                error: 'Series field is required. Please select a categorical field to group by.'
            };
        }

        return { valid: true };
    }
};

/**
 * Timeseries Chart Type
 * Supports time-based line, area, and bar charts
 */

import { EChartsOption } from 'echarts';
import { ChartType, ChartConfig, ChartConfigOption } from '../chartTypes';
import { applyAdvancedSettings, bucketTimeValues, TimeBucketConfig } from '../chartUtils';

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
 * Calculate bucket size in milliseconds
 */
function calculateBucketSize(unit: string, value: number): number {
    const multipliers: Record<string, number> = {
        millisecond: 1,
        second: 1000,
        minute: 60 * 1000,
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000, // Approximate
        year: 365 * 24 * 60 * 60 * 1000 // Approximate
    };

    return (multipliers[unit] || 1) * value;
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

    // Use valueFields from options if specified, otherwise use all non-time fields from config.fields
    let valueFields: string[];
    if (options.valueFields && Array.isArray(options.valueFields) && options.valueFields.length > 0) {
        valueFields = options.valueFields;
    } else {
        valueFields = fields.filter(f => f !== timeField);
    }

    const chartType = options.chartType || 'line';
    const stacked = options.stacked || false;

    // Parse value fields to extract aggregation and field name
    // Format: "agg(fieldName)" or "__count__" or just "fieldName" (defaults to sum)
    interface FieldSpec {
        key: string;           // Original key like "sum(bytes)"
        field: string;         // Field name like "bytes"
        aggregation: string;   // Aggregation like "sum"
        displayName: string;   // Display name like "sum(bytes)"
    }

    const fieldSpecs: FieldSpec[] = valueFields.map(f => {
        if (f === '__count__') {
            return { key: '__count__', field: '__count__', aggregation: 'count', displayName: 'count' };
        }

        // Try to parse "agg(field)" format
        const match = f.match(/^(\w+)\((.+)\)$/);
        if (match) {
            const [, agg, fieldName] = match;
            return { key: f, field: fieldName, aggregation: agg, displayName: f };
        }

        // Default to sum if no aggregation specified
        return { key: f, field: f, aggregation: 'sum', displayName: f };
    });

    // Check if count is requested
    const hasCount = fieldSpecs.some(spec => spec.field === '__count__');
    const dataFieldSpecs = fieldSpecs.filter(spec => spec.field !== '__count__');

    // Parse and sort data by time
    // Store raw values for each field so we can aggregate them later
    let timeData = data
        .map(record => ({
            time: parseTimestamp(record[timeField]),
            values: dataFieldSpecs.reduce((acc, spec) => {
                // Try to find the field in the record using the full key first (e.g., "sum(bytes)"),
                // then fall back to just the field name (e.g., "bytes")
                // This handles both pre-aggregated query results and raw data
                const value = record[spec.key] !== undefined ? record[spec.key] : record[spec.field];
                acc[spec.key] = parseFloat(value) || 0;
                return acc;
            }, {} as Record<string, number>)
        }))
        .filter(item => item.time > 0)
        .sort((a, b) => a.time - b.time);

    // Apply time bucketing with aggregations if configured
    if (options.timeBucket && options.timeBucket.enabled) {
        const bucketMs = calculateBucketSize(options.timeBucket.unit, options.timeBucket.value);

        // Group data by bucket
        const buckets = new Map<number, Array<{ time: number; values: Record<string, number> }>>();

        timeData.forEach(item => {
            const bucketTime = Math.floor(item.time / bucketMs) * bucketMs;
            if (!buckets.has(bucketTime)) {
                buckets.set(bucketTime, []);
            }
            buckets.get(bucketTime)!.push(item);
        });

        // Aggregate values within each bucket based on the specified aggregation
        const aggregatedData: Array<{ time: number; values: Record<string, number> }> = [];

        buckets.forEach((items, bucketTime) => {
            const aggregated: Record<string, number> = {};

            dataFieldSpecs.forEach(spec => {
                const values = items.map(item => item.values[spec.key]).filter(v => !isNaN(v));

                if (values.length === 0) {
                    aggregated[spec.key] = 0;
                    return;
                }

                switch (spec.aggregation) {
                    case 'sum':
                        aggregated[spec.key] = values.reduce((a, b) => a + b, 0);
                        break;
                    case 'avg':
                        aggregated[spec.key] = values.reduce((a, b) => a + b, 0) / values.length;
                        break;
                    case 'min':
                        aggregated[spec.key] = Math.min(...values);
                        break;
                    case 'max':
                        aggregated[spec.key] = Math.max(...values);
                        break;
                    case 'count':
                        aggregated[spec.key] = values.length;
                        break;
                    default:
                        aggregated[spec.key] = values.reduce((a, b) => a + b, 0);
                }
            });

            aggregatedData.push({ time: bucketTime, values: aggregated });
        });

        // Sort by time
        timeData = aggregatedData.sort((a, b) => a.time - b.time);
    }

    // If count is requested, we need to aggregate by counting records per time bucket
    let countData: Array<[number, number]> = [];
    if (hasCount) {
        // Group by time and count records
        const timeCounts = new Map<number, number>();
        data.forEach(record => {
            const time = parseTimestamp(record[timeField]);
            if (time > 0) {
                timeCounts.set(time, (timeCounts.get(time) || 0) + 1);
            }
        });

        // If time bucketing is enabled, re-bucket the counts
        if (options.timeBucket && options.timeBucket.enabled) {
            const bucketMs = calculateBucketSize(options.timeBucket.unit, options.timeBucket.value);
            const bucketCounts = new Map<number, number>();

            timeCounts.forEach((count, time) => {
                const bucketTime = Math.floor(time / bucketMs) * bucketMs;
                bucketCounts.set(bucketTime, (bucketCounts.get(bucketTime) || 0) + count);
            });

            countData = Array.from(bucketCounts.entries()).sort((a, b) => a[0] - b[0]);
        } else {
            countData = Array.from(timeCounts.entries()).sort((a, b) => a[0] - b[0]);
        }
    }

    // Build series for each value field
    const series: any[] = [];

    // Add count series if requested
    if (hasCount) {
        const seriesConfig: any = {
            name: 'count',
            type: chartType === 'area' ? 'line' : chartType,
            data: countData,
            smooth: options.smooth || false
        };

        if (stacked) {
            seriesConfig.stack = 'total';
        }

        if (chartType === 'area') {
            seriesConfig.areaStyle = {};
        }

        series.push(seriesConfig);
    }

    // Add data field series
    dataFieldSpecs.forEach(spec => {
        const seriesData = timeData.map(item => [item.time, item.values[spec.key]]);

        const seriesConfig: any = {
            name: spec.displayName,
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

        series.push(seriesConfig);
    });

    // Build legend data from actual series names
    const legendData = series.map(s => s.name);

    const baseOption: EChartsOption = {
        title: {
            text: `${legendData.join(', ')} over Time`,
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        legend: {
            data: legendData,
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

    // Apply advanced settings if configured
    return applyAdvancedSettings(baseOption, options.advancedSettings);
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
        id: 'valueFields',
        label: 'Value Fields',
        type: 'multi-field-select',
        defaultValue: [],
        description: 'Select one or more numeric fields to display as series. Leave empty to use all non-time fields.',
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
        id: 'timeBucket',
        label: 'Time Bucket',
        type: 'time-bucket',
        defaultValue: { enabled: false, unit: 'minute', value: 1 },
        description: 'Re-bucket time series data to a different time interval'
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

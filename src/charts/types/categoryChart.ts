/**
 * Category Chart Type
 * Supports bar, pie, line charts for categorical data
 */

import { EChartsOption } from 'echarts';
import { ChartType, ChartConfig, ChartConfigOption } from '../chartTypes';
import { applyAdvancedSettings } from '../chartUtils';

/**
 * Transform data for category charts
 */
function transformCategoryData(data: any[], config: ChartConfig, fieldMetadata?: any[]): EChartsOption {
    const { fields, options } = config;
    const categoryField = options.seriesField || fields[0]; // Support both old and new format
    const valueField = options.valueField || (fields.length > 1 ? fields[1] : null);
    const chartType = options.chartType || 'bar';
    const aggregation = options.aggregation || 'count';
    const sortOrder = options.sortOrder || 'desc';
    const includeOther = options.includeOther || false;

    // Aggregate data
    const aggregated = new Map<string, number[]>();

    data.forEach(record => {
        const categoryValue = String(record[categoryField] || '(empty)');

        if (!aggregated.has(categoryValue)) {
            aggregated.set(categoryValue, []);
        }

        if (valueField) {
            // Collect values for aggregation
            const value = parseFloat(record[valueField]) || 0;
            aggregated.get(categoryValue)!.push(value);
        } else {
            // For count, just push 1
            aggregated.get(categoryValue)!.push(1);
        }
    });

    // Apply aggregation
    const aggregatedValues = new Map<string, number>();
    aggregated.forEach((values, category) => {
        let result = 0;
        switch (aggregation) {
            case 'count':
                result = values.length;
                break;
            case 'sum':
                result = values.reduce((a, b) => a + b, 0);
                break;
            case 'avg':
                result = values.reduce((a, b) => a + b, 0) / values.length;
                break;
            case 'min':
                result = Math.min(...values);
                break;
            case 'max':
                result = Math.max(...values);
                break;
            default:
                result = values.length;
        }
        aggregatedValues.set(category, result);
    });

    // Convert to array and sort
    let categories = Array.from(aggregatedValues.entries())
        .map(([category, value]) => ({ category, value }));

    if (sortOrder === 'asc') {
        categories.sort((a, b) => a.value - b.value);
    } else if (sortOrder === 'desc') {
        categories.sort((a, b) => b.value - a.value);
    } else {
        // alphabetical
        categories.sort((a, b) => a.category.localeCompare(b.category));
    }

    // Handle top N and "Other" category
    const topN = options.topN;
    let categoryLabels: string[];
    let values: number[];

    if (topN && topN > 0 && categories.length > topN) {
        const topCategories = categories.slice(0, topN);

        if (includeOther) {
            // Calculate "Other" by summing remaining categories
            const otherCategories = categories.slice(topN);
            const otherValue = otherCategories.reduce((sum, cat) => sum + cat.value, 0);

            categoryLabels = [...topCategories.map(c => c.category), 'Other'];
            values = [...topCategories.map(c => c.value), otherValue];
        } else {
            // Just limit to top N
            categoryLabels = topCategories.map(c => c.category);
            values = topCategories.map(c => c.value);
        }
    } else {
        // Show all categories
        categoryLabels = categories.map(c => c.category);
        values = categories.map(c => c.value);
    }

    // Generate chart based on type
    let baseOption: EChartsOption;

    if (chartType === 'pie') {
        baseOption = {
            title: {
                text: `${categoryField} Distribution`,
                left: 'center'
            },
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c} ({d}%)'
            },
            legend: {
                orient: 'vertical',
                left: 'left',
                type: 'scroll'
            },
            series: [
                {
                    name: categoryField,
                    type: 'pie',
                    radius: '50%',
                    data: categories.map(c => ({
                        name: c.category,
                        value: c.value
                    })),
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                }
            ]
        };
    } else {
        // Bar or line chart
        baseOption = {
            title: {
                text: `${categoryField} by ${aggregation}${valueField ? ' of ' + valueField : ''}`,
                left: 'center'
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: chartType === 'bar' ? 'shadow' : 'cross'
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: categoryLabels,
                axisLabel: {
                    rotate: categoryLabels.length > 10 ? 45 : 0,
                    interval: 0
                }
            },
            yAxis: {
                type: 'value'
            },
            dataZoom: categoryLabels.length > 20 ? [
                {
                    type: 'inside',
                    start: 0,
                    end: 100
                },
                {
                    start: 0,
                    end: 100
                }
            ] : undefined,
            series: [
                {
                    name: valueField || 'Count',
                    type: chartType === 'line' ? 'line' : 'bar',
                    data: values,
                    smooth: chartType === 'line' ? options.smooth || false : undefined,
                    areaStyle: chartType === 'line' && options.areaStyle ? {} : undefined
                }
            ]
        };
    }

    // Apply advanced settings if configured
    return applyAdvancedSettings(baseOption, options.advancedSettings);
}

/**
 * Configuration options for category charts
 */
const categoryChartOptions: ChartConfigOption[] = [
    {
        id: 'seriesField',
        label: 'Category Field',
        type: 'field-select',
        defaultValue: null,
        description: 'Field to use for categories (e.g., collector, status_code, tier)',
        required: false
    },
    {
        id: 'valueField',
        label: 'Value Field',
        type: 'field-select',
        defaultValue: null,
        description: 'Numeric field to aggregate (e.g., bytes). Leave empty for count.',
        required: false
    },
    {
        id: 'chartType',
        label: 'Chart Type',
        type: 'select',
        defaultValue: 'bar',
        options: [
            { value: 'bar', label: 'Bar Chart' },
            { value: 'line', label: 'Line Chart' },
            { value: 'pie', label: 'Pie Chart' }
        ],
        required: true
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
        description: 'How to aggregate values'
    },
    {
        id: 'sortOrder',
        label: 'Sort Order',
        type: 'select',
        defaultValue: 'desc',
        options: [
            { value: 'desc', label: 'Descending (Highest First)' },
            { value: 'asc', label: 'Ascending (Lowest First)' },
            { value: 'alpha', label: 'Alphabetical' }
        ]
    },
    {
        id: 'topN',
        label: 'Top N Values',
        type: 'number',
        defaultValue: 20,
        description: 'Show only the top N categories (leave 0 or blank for all)'
    },
    {
        id: 'includeOther',
        label: 'Include "Other" Category',
        type: 'checkbox',
        defaultValue: false,
        description: 'Group values outside Top N into an "Other" category'
    },
    {
        id: 'smooth',
        label: 'Smooth Line',
        type: 'checkbox',
        defaultValue: false,
        description: 'Apply smoothing to line charts'
    },
    {
        id: 'areaStyle',
        label: 'Area Fill',
        type: 'checkbox',
        defaultValue: false,
        description: 'Fill area under line chart'
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
 * Category Chart Type Definition
 */
export const categoryChartType: ChartType = {
    id: 'category',
    name: 'Category Chart',
    description: 'Visualize distribution of categorical data with bar, line, or pie charts',
    category: 'category',
    minFields: 1,
    maxFields: 2,
    supportedDataTypes: ['string', 'number', 'any'],
    configOptions: categoryChartOptions,
    transformer: transformCategoryData
};

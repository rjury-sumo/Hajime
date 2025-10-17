/**
 * Chart Utilities
 * Helper functions for chart generation and customization
 */

import { EChartsOption } from 'echarts';

/**
 * Apply advanced settings to an ECharts option object
 * Merges user-configured settings with default chart settings
 */
export function applyAdvancedSettings(
    option: EChartsOption,
    advancedSettings: any
): EChartsOption {
    if (!advancedSettings || Object.keys(advancedSettings).length === 0) {
        return option;
    }

    const result = { ...option };

    // Apply title settings
    if (advancedSettings.title) {
        result.title = {
            ...result.title,
            ...advancedSettings.title
        };
    }

    // Apply legend settings and adjust grid accordingly
    if (advancedSettings.legend) {
        // Merge legend settings
        result.legend = {
            ...result.legend,
            ...advancedSettings.legend
        } as any;

        // Determine legend position
        const legendPos = advancedSettings.legend;

        // Clear conflicting position properties based on which position is set
        // This ensures switching positions works correctly
        if (legendPos.top !== undefined) {
            delete (result.legend as any).bottom;
        }
        if (legendPos.bottom !== undefined) {
            delete (result.legend as any).top;
        }
        if (legendPos.left !== undefined) {
            delete (result.legend as any).right;
        }
        if (legendPos.right !== undefined) {
            delete (result.legend as any).left;
        }

        // When legend is at top, also adjust title position to avoid overlap
        if (legendPos.top !== undefined && (legendPos.top === 'top' || legendPos.top === 0)) {
            result.title = {
                ...result.title,
                top: 40  // Push title down when legend is at top
            } as any;
        }

        // Adjust grid spacing based on legend position to prevent overlap
        // Only adjust if grid is a single object (not array)
        if (result.grid && !Array.isArray(result.grid)) {
            // Preserve existing grid values
            result.grid = { ...result.grid } as any;

            if (legendPos.top !== undefined) {
                // Legend at top - need space for both title and legend
                if (legendPos.top === 'top' || legendPos.top === 0) {
                    (result.grid as any).top = '120px'; // More room for title + legend
                }
            }

            if (legendPos.bottom !== undefined) {
                // Legend at bottom - need space for legend and dataZoom slider
                if (legendPos.bottom === 'bottom' || legendPos.bottom === 0) {
                    (result.grid as any).bottom = '22%'; // More room for legend + dataZoom slider
                }
            }

            if (legendPos.left !== undefined) {
                // Legend at left
                if (legendPos.left === 'left' || legendPos.left === 0) {
                    (result.grid as any).left = '15%'; // Make room for vertical legend on left
                }
            }

            if (legendPos.right !== undefined) {
                // Legend at right
                if (legendPos.right === 'right' || legendPos.right === 0) {
                    (result.grid as any).right = '15%'; // Make room for vertical legend on right
                }
            }
        }
    }

    // Apply xAxis settings
    if (advancedSettings.xAxis) {
        result.xAxis = {
            ...result.xAxis,
            ...advancedSettings.xAxis
        };
    }

    // Apply yAxis settings
    if (advancedSettings.yAxis) {
        result.yAxis = {
            ...result.yAxis,
            ...advancedSettings.yAxis
        };
    }

    // Apply grid settings (user-specified grid settings override auto-adjustments)
    if (advancedSettings.grid) {
        result.grid = {
            ...result.grid,
            ...advancedSettings.grid
        };
    }

    return result;
}

/**
 * Time bucket configuration
 */
export interface TimeBucketConfig {
    enabled: boolean;
    unit: 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
    value: number;
}

/**
 * Bucket time values according to configuration
 */
export function bucketTimeValues(
    timeData: Array<{ time: number; values: Record<string, number> }>,
    config: TimeBucketConfig
): Array<{ time: number; values: Record<string, number> }> {
    if (!config.enabled || !config.unit || !config.value) {
        return timeData;
    }

    // Calculate bucket size in milliseconds
    const bucketMs = calculateBucketSize(config.unit, config.value);

    // Group data by bucket
    const buckets = new Map<number, Array<Record<string, number>>>();

    timeData.forEach(item => {
        const bucketTime = Math.floor(item.time / bucketMs) * bucketMs;
        if (!buckets.has(bucketTime)) {
            buckets.set(bucketTime, []);
        }
        buckets.get(bucketTime)!.push(item.values);
    });

    // Aggregate values within each bucket
    const result: Array<{ time: number; values: Record<string, number> }> = [];

    buckets.forEach((valuesList, bucketTime) => {
        const aggregated: Record<string, number> = {};

        // Get all field names
        const fieldNames = new Set<string>();
        valuesList.forEach(values => {
            Object.keys(values).forEach(field => fieldNames.add(field));
        });

        // Aggregate each field (sum for now, could be configurable)
        fieldNames.forEach(field => {
            aggregated[field] = valuesList.reduce((sum, values) => sum + (values[field] || 0), 0);
        });

        result.push({ time: bucketTime, values: aggregated });
    });

    // Sort by time
    result.sort((a, b) => a.time - b.time);

    return result;
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

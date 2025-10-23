/**
 * Charts Module Entry Point
 * Initializes and exports chart registry and types
 */

import { ChartRegistry } from './chartRegistry';
import { categoryChartType } from './types/categoryChart';
import { timeseriesChartType } from './types/timeseriesChart';
import { timeseriesSeriesChartType } from './types/timeseriesSeriesChart';
import { timesliceTransposeChartType } from './types/timesliceTransposeChart';

/**
 * Initialize chart registry with built-in chart types
 */
export function initializeChartRegistry(): ChartRegistry {
    const registry = ChartRegistry.getInstance();

    // Register built-in chart types
    registry.registerChartType(categoryChartType);
    registry.registerChartType(timeseriesChartType);
    registry.registerChartType(timeseriesSeriesChartType);
    registry.registerChartType(timesliceTransposeChartType);

    return registry;
}

// Export registry and types
export { ChartRegistry } from './chartRegistry';
export * from './chartTypes';
export { categoryChartType } from './types/categoryChart';
export { timeseriesChartType } from './types/timeseriesChart';
export { timeseriesSeriesChartType } from './types/timeseriesSeriesChart';
export { timesliceTransposeChartType } from './types/timesliceTransposeChart';

/**
 * Chart Registry
 * Central registry for all available chart types
 */

import { ChartType } from './chartTypes';
import { FieldMetadata } from '../services/fieldAnalyzer';

export class ChartRegistry {
    private static instance: ChartRegistry;
    private chartTypes: Map<string, ChartType> = new Map();

    private constructor() {}

    /**
     * Get singleton instance
     */
    static getInstance(): ChartRegistry {
        if (!ChartRegistry.instance) {
            ChartRegistry.instance = new ChartRegistry();
        }
        return ChartRegistry.instance;
    }

    /**
     * Register a chart type
     */
    registerChartType(chartType: ChartType): void {
        this.chartTypes.set(chartType.id, chartType);
    }

    /**
     * Get a chart type by ID
     */
    getChartType(id: string): ChartType | undefined {
        return this.chartTypes.get(id);
    }

    /**
     * Get all registered chart types
     */
    getAllChartTypes(): ChartType[] {
        return Array.from(this.chartTypes.values());
    }

    /**
     * Get chart types by category
     */
    getChartTypesByCategory(category: 'category' | 'timeseries' | 'statistical'): ChartType[] {
        return this.getAllChartTypes().filter(ct => ct.category === category);
    }

    /**
     * Get compatible chart types for given fields
     */
    getCompatibleChartTypes(fields: FieldMetadata[]): ChartType[] {
        return this.getAllChartTypes().filter(chartType => {
            // Check field count
            if (fields.length < chartType.minFields || fields.length > chartType.maxFields) {
                return false;
            }

            // Check if time field is required
            if (chartType.requiresTimeField) {
                const hasTimeField = fields.some(f => f.isTimeField);
                if (!hasTimeField) {
                    return false;
                }
            }

            // Check data types
            const fieldTypes = fields.map(f => f.dataType);
            const hasCompatibleType = fieldTypes.some(ft =>
                chartType.supportedDataTypes.includes(ft) ||
                chartType.supportedDataTypes.includes('any')
            );

            return hasCompatibleType;
        });
    }

    /**
     * Get compatible chart types for a single field
     */
    getCompatibleChartTypesForField(field: FieldMetadata, allFields: FieldMetadata[]): ChartType[] {
        return this.getAllChartTypes().filter(chartType => {
            // Check if this field's data type is supported
            if (!chartType.supportedDataTypes.includes(field.dataType) &&
                !chartType.supportedDataTypes.includes('any')) {
                return false;
            }

            // For timeseries charts, check if we have time fields available
            if (chartType.requiresTimeField) {
                const hasTimeField = allFields.some(f => f.isTimeField);
                if (!hasTimeField) {
                    return false;
                }
            }

            // Check min fields (we're providing at least 1)
            if (chartType.minFields > 1) {
                // For charts requiring multiple fields, check if we have enough compatible fields
                const compatibleFields = allFields.filter(f =>
                    chartType.supportedDataTypes.includes(f.dataType) ||
                    chartType.supportedDataTypes.includes('any')
                );
                return compatibleFields.length >= chartType.minFields;
            }

            return true;
        });
    }
}

/**
 * Chart Type System
 * Defines interfaces and types for extensible chart configurations
 */

import { EChartsOption } from 'echarts';

/**
 * Configuration option for a chart type
 */
export interface ChartConfigOption {
    id: string;
    label: string;
    type: 'select' | 'checkbox' | 'number' | 'field-select' | 'multi-field-select';
    defaultValue: any;
    options?: Array<{ value: any; label: string }>;
    description?: string;
    required?: boolean;
}

/**
 * Chart configuration instance
 */
export interface ChartConfig {
    chartTypeId: string;
    fields: string[];
    options: Record<string, any>;
}

/**
 * Chart type definition
 */
export interface ChartType {
    id: string;
    name: string;
    description: string;
    category: 'category' | 'timeseries' | 'statistical';
    icon?: string;

    // Field requirements
    minFields: number;
    maxFields: number;
    supportedDataTypes: string[];
    requiresTimeField?: boolean;

    // Configuration options
    configOptions: ChartConfigOption[];

    // Transformer function
    transformer: (data: any[], config: ChartConfig, fieldMetadata?: any[]) => EChartsOption;

    // Validation
    validate?: (config: ChartConfig, fieldMetadata?: any[]) => { valid: boolean; error?: string };
}

/**
 * Result of chart type compatibility check
 */
export interface CompatibilityResult {
    compatible: boolean;
    reason?: string;
}

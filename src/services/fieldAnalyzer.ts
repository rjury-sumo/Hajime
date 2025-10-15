/**
 * Field Analysis Service
 * Analyzes query results to extract field metadata and statistics
 */

export interface FieldMetadata {
    name: string;
    dataType: 'string' | 'number' | 'timestamp' | 'boolean' | 'mixed';
    nonNullCount: number;
    distinctCount: number;
    totalCount: number;
    fillPercentage: number;
    sampleValues: any[];
    isTimeField: boolean;
    isNumericString: boolean; // True if dataType is string but values are numeric
    numericStats?: {
        min: number;
        max: number;
        avg: number;
        sum: number;
    };
}

export interface FieldAnalysisResult {
    fields: FieldMetadata[];
    totalRecords: number;
    mode: 'records' | 'messages';
}

/**
 * Analyzes query results and extracts field metadata
 */
export class FieldAnalyzer {
    /**
     * Analyze results array to extract field metadata
     * @param results Array of result objects (Records or Messages)
     * @param mode Result mode ('records' or 'messages')
     */
    static analyze(results: any[], mode: 'records' | 'messages' = 'records'): FieldAnalysisResult {
        if (!results || results.length === 0) {
            return {
                fields: [],
                totalRecords: 0,
                mode
            };
        }

        // Extract all unique field names
        const fieldNames = new Set<string>();
        results.forEach(result => {
            Object.keys(result.map || {}).forEach(key => fieldNames.add(key));
        });

        // Analyze each field
        const fields: FieldMetadata[] = Array.from(fieldNames).map(fieldName =>
            this.analyzeField(fieldName, results)
        );

        // Sort fields by name
        fields.sort((a, b) => a.name.localeCompare(b.name));

        return {
            fields,
            totalRecords: results.length,
            mode
        };
    }

    /**
     * Analyze a single field across all results
     */
    private static analyzeField(fieldName: string, results: any[]): FieldMetadata {
        const totalCount = results.length;
        const values: any[] = [];
        const distinctValues = new Set<string>();
        const numericValues: number[] = [];
        const typeSet = new Set<string>();

        let nonNullCount = 0;

        // Collect values and analyze types
        results.forEach(result => {
            const value = result.map?.[fieldName];

            if (value !== null && value !== undefined && value !== '') {
                nonNullCount++;
                values.push(value);

                // Track distinct values (stringified for comparison)
                const stringValue = String(value);
                distinctValues.add(stringValue);

                // Determine value type
                const valueType = this.detectValueType(value);
                typeSet.add(valueType);

                // Collect numeric values for stats
                if (valueType === 'number') {
                    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                    if (!isNaN(numValue)) {
                        numericValues.push(numValue);
                    }
                }
            }
        });

        // Determine overall data type
        const dataType = this.determineDataType(typeSet, fieldName);

        // Calculate fill percentage
        const fillPercentage = totalCount > 0 ? (nonNullCount / totalCount) * 100 : 0;

        // Get sample values (first 5 unique)
        const uniqueValues = Array.from(distinctValues);
        const sampleValues = uniqueValues.slice(0, 5);

        // Check if this is a time field
        const isTimeField = this.isTimeField(fieldName, dataType, sampleValues);

        // Check if this is a numeric string (string type but all values are parseable as numbers)
        let isNumericString = false;
        if (dataType === 'string' && values.length > 0) {
            // Check if most values (>90%) are parseable as numbers
            let numericCount = 0;
            values.forEach(val => {
                const strVal = String(val);
                const numVal = parseFloat(strVal);
                if (!isNaN(numVal) && strVal.trim() !== '') {
                    numericCount++;
                    // Also collect for potential stats
                    if (numericValues.indexOf(numVal) === -1 || numericValues.length < 1000) {
                        numericValues.push(numVal);
                    }
                }
            });
            isNumericString = (numericCount / values.length) > 0.9;
        }

        // Calculate numeric statistics if applicable (for numbers or numeric strings)
        let numericStats: FieldMetadata['numericStats'];
        if ((dataType === 'number' || isNumericString) && numericValues.length > 0) {
            numericStats = {
                min: Math.min(...numericValues),
                max: Math.max(...numericValues),
                avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
                sum: numericValues.reduce((a, b) => a + b, 0)
            };
        }

        return {
            name: fieldName,
            dataType,
            nonNullCount,
            distinctCount: distinctValues.size,
            totalCount,
            fillPercentage,
            sampleValues,
            isTimeField,
            isNumericString,
            numericStats
        };
    }

    /**
     * Detect the type of a single value
     */
    private static detectValueType(value: any): string {
        if (value === null || value === undefined) {
            return 'null';
        }

        if (typeof value === 'boolean') {
            return 'boolean';
        }

        if (typeof value === 'number') {
            return 'number';
        }

        if (typeof value === 'string') {
            // Try to parse as number
            const numValue = parseFloat(value);
            if (!isNaN(numValue) && String(numValue) === value.trim()) {
                return 'number';
            }

            // Check if it looks like a timestamp (epoch milliseconds)
            if (/^\d{13}$/.test(value)) {
                return 'timestamp';
            }

            // Check if it looks like an ISO date
            if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(value)) {
                return 'timestamp';
            }

            return 'string';
        }

        return 'string';
    }

    /**
     * Determine overall data type from a set of observed types
     */
    private static determineDataType(
        typeSet: Set<string>,
        fieldName: string
    ): 'string' | 'number' | 'timestamp' | 'boolean' | 'mixed' {
        // Remove null from consideration
        typeSet.delete('null');

        if (typeSet.size === 0) {
            return 'string';
        }

        if (typeSet.size === 1) {
            const type = Array.from(typeSet)[0];
            return type as any;
        }

        // Mixed types - check for common patterns
        if (typeSet.has('number') && typeSet.has('string')) {
            // If mostly numbers, treat as number
            return 'number';
        }

        if (typeSet.has('timestamp')) {
            return 'timestamp';
        }

        return 'mixed';
    }

    /**
     * Check if a field is a time field
     */
    private static isTimeField(
        fieldName: string,
        dataType: string,
        sampleValues: any[]
    ): boolean {
        // Known time field names in Sumo Logic
        const timeFieldNames = [
            '_messagetime',
            '_timeslice',
            '_receipttime',
            '__timeslice_end',
            '_searchabletime',
            'timestamp',
            'time',
            'datetime',
            'created_at',
            'updated_at'
        ];

        // Check if field name matches known time fields
        const lowerName = fieldName.toLowerCase();
        if (timeFieldNames.some(tf => lowerName.includes(tf))) {
            return true;
        }

        // Check if data type is timestamp
        if (dataType === 'timestamp') {
            return true;
        }

        // Check if sample values look like timestamps
        if (sampleValues.length > 0) {
            const firstValue = String(sampleValues[0]);

            // Epoch milliseconds (13 digits)
            if (/^\d{13}$/.test(firstValue)) {
                return true;
            }

            // ISO date format
            if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(firstValue)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get value distribution for a specific field
     */
    static getValueDistribution(
        fieldName: string,
        results: any[],
        limit: number = 100
    ): Array<{ value: any; count: number; percentage: number }> {
        const valueCounts = new Map<string, number>();
        const totalCount = results.length;

        // Count occurrences of each value
        results.forEach(result => {
            const value = result.map?.[fieldName];
            if (value !== null && value !== undefined && value !== '') {
                const key = String(value);
                valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
            }
        });

        // Convert to array and sort by count (descending)
        const distribution = Array.from(valueCounts.entries())
            .map(([value, count]) => ({
                value,
                count,
                percentage: (count / totalCount) * 100
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);

        return distribution;
    }

    /**
     * Format numeric value with appropriate precision
     */
    static formatNumber(value: number, decimals: number = 2): string {
        if (Number.isInteger(value)) {
            return value.toString();
        }
        return value.toFixed(decimals);
    }

    /**
     * Format percentage value
     */
    static formatPercentage(value: number, decimals: number = 1): string {
        return value.toFixed(decimals) + '%';
    }
}

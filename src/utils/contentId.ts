/**
 * Utility functions for converting Sumo Logic content IDs between hex and decimal formats
 *
 * Sumo Logic content IDs are stored as 16-character hexadecimal strings (e.g., "00000000005E5403")
 * but the web UI uses decimal format in URLs (e.g., "6181891")
 */

/**
 * Convert a hexadecimal content ID to decimal
 * @param hexId Hexadecimal content ID (e.g., "00000000005E5403")
 * @returns Decimal string representation (e.g., "6181891")
 * @throws Error if hexId is invalid
 */
export function hexToDecimal(hexId: string): string {
    if (!hexId || typeof hexId !== 'string') {
        throw new Error('Invalid hex ID: must be a non-empty string');
    }

    // Remove any whitespace
    const cleanHex = hexId.trim();

    // Validate hex format (allowing optional 0x prefix)
    const hexPattern = /^(0x)?[0-9A-Fa-f]+$/;
    if (!hexPattern.test(cleanHex)) {
        throw new Error(`Invalid hex ID format: ${hexId}`);
    }

    // Remove 0x prefix if present
    const hex = cleanHex.replace(/^0x/i, '');

    // Convert to decimal using BigInt to handle large numbers
    try {
        const decimal = BigInt('0x' + hex);
        return decimal.toString(10);
    } catch (error) {
        throw new Error(`Failed to convert hex to decimal: ${hexId}`);
    }
}

/**
 * Convert a decimal content ID to hexadecimal
 * @param decimalId Decimal content ID (e.g., "6181891")
 * @returns Hexadecimal string representation, zero-padded to 16 characters (e.g., "00000000005E5403")
 * @throws Error if decimalId is invalid
 */
export function decimalToHex(decimalId: string): string {
    if (!decimalId || typeof decimalId !== 'string') {
        throw new Error('Invalid decimal ID: must be a non-empty string');
    }

    // Remove any whitespace
    const cleanDecimal = decimalId.trim();

    // Validate decimal format
    const decimalPattern = /^[0-9]+$/;
    if (!decimalPattern.test(cleanDecimal)) {
        throw new Error(`Invalid decimal ID format: ${decimalId}`);
    }

    // Convert to hex using BigInt
    try {
        const decimal = BigInt(cleanDecimal);
        const hex = decimal.toString(16).toUpperCase();

        // Pad to 16 characters (standard Sumo Logic ID length)
        return hex.padStart(16, '0');
    } catch (error) {
        throw new Error(`Failed to convert decimal to hex: ${decimalId}`);
    }
}

/**
 * Format a content ID showing both hex and decimal representations
 * @param hexId Hexadecimal content ID
 * @returns Formatted string (e.g., "00000000005E5403 (6181891)")
 */
export function formatContentId(hexId: string): string {
    try {
        const decimal = hexToDecimal(hexId);
        return `${hexId} (${decimal})`;
    } catch (error) {
        return hexId; // Return original if conversion fails
    }
}

/**
 * Validate if a string is a valid Sumo Logic hex content ID
 * @param hexId String to validate
 * @returns True if valid hex ID format
 */
export function isValidHexId(hexId: string): boolean {
    if (!hexId || typeof hexId !== 'string') {
        return false;
    }

    const cleanHex = hexId.trim();

    // Sumo Logic IDs are typically 16 characters hex
    const hexPattern = /^[0-9A-Fa-f]{16}$/;
    return hexPattern.test(cleanHex);
}

/**
 * Validate if a string is a valid decimal content ID
 * @param decimalId String to validate
 * @returns True if valid decimal ID format
 */
export function isValidDecimalId(decimalId: string): boolean {
    if (!decimalId || typeof decimalId !== 'string') {
        return false;
    }

    const cleanDecimal = decimalId.trim();
    const decimalPattern = /^[0-9]+$/;
    return decimalPattern.test(cleanDecimal);
}

/**
 * Normalize a content ID to hex format, accepting either hex or decimal input
 * @param id Content ID in either hex or decimal format
 * @returns Hexadecimal content ID
 * @throws Error if ID is invalid or format cannot be determined
 */
export function normalizeToHex(id: string): string {
    if (!id || typeof id !== 'string') {
        throw new Error('Invalid ID: must be a non-empty string');
    }

    const cleanId = id.trim();

    // Check if it's already valid hex
    if (isValidHexId(cleanId)) {
        return cleanId.toUpperCase();
    }

    // Try to parse as hex with 0x prefix
    if (cleanId.startsWith('0x') || cleanId.startsWith('0X')) {
        const hex = cleanId.substring(2);
        if (/^[0-9A-Fa-f]+$/.test(hex)) {
            return hex.toUpperCase().padStart(16, '0');
        }
    }

    // Try as decimal
    if (isValidDecimalId(cleanId)) {
        return decimalToHex(cleanId);
    }

    throw new Error(`Cannot normalize ID - invalid format: ${id}`);
}

import * as assert from 'assert';
import {
    hexToDecimal,
    decimalToHex,
    formatContentId,
    isValidHexId,
    isValidDecimalId,
    normalizeToHex
} from '../../utils/contentId';

suite('ContentId Utils Test Suite', () => {
    suite('hexToDecimal', () => {
        test('should convert standard hex ID to decimal', () => {
            assert.strictEqual(hexToDecimal('00000000005E5403'), '6181891');
        });

        test('should convert hex with leading zeros', () => {
            assert.strictEqual(hexToDecimal('0000000000000001'), '1');
            assert.strictEqual(hexToDecimal('0000000000000010'), '16');
        });

        test('should handle all zeros', () => {
            assert.strictEqual(hexToDecimal('0000000000000000'), '0');
        });

        test('should handle large hex values', () => {
            assert.strictEqual(hexToDecimal('FFFFFFFFFFFFFFFF'), '18446744073709551615');
        });

        test('should handle hex with 0x prefix', () => {
            assert.strictEqual(hexToDecimal('0x00000000005E5403'), '6181891');
        });

        test('should handle lowercase hex', () => {
            assert.strictEqual(hexToDecimal('00000000005e5403'), '6181891');
        });

        test('should throw error for invalid hex', () => {
            assert.throws(() => hexToDecimal('not-hex'), /Invalid hex ID format/);
            assert.throws(() => hexToDecimal('GGGGGGGG'), /Invalid hex ID format/);
        });

        test('should throw error for empty string', () => {
            assert.throws(() => hexToDecimal(''), /Invalid hex ID/);
        });

        test('should throw error for null/undefined', () => {
            assert.throws(() => hexToDecimal(null as any), /Invalid hex ID/);
            assert.throws(() => hexToDecimal(undefined as any), /Invalid hex ID/);
        });

        test('should handle whitespace', () => {
            assert.strictEqual(hexToDecimal('  00000000005E5403  '), '6181891');
        });
    });

    suite('decimalToHex', () => {
        test('should convert standard decimal to hex', () => {
            assert.strictEqual(decimalToHex('6181891'), '00000000005E5403');
        });

        test('should pad small numbers to 16 characters', () => {
            assert.strictEqual(decimalToHex('1'), '0000000000000001');
            assert.strictEqual(decimalToHex('16'), '0000000000000010');
        });

        test('should handle zero', () => {
            assert.strictEqual(decimalToHex('0'), '0000000000000000');
        });

        test('should handle large decimal values', () => {
            assert.strictEqual(decimalToHex('18446744073709551615'), 'FFFFFFFFFFFFFFFF');
        });

        test('should throw error for invalid decimal', () => {
            assert.throws(() => decimalToHex('not-a-number'), /Invalid decimal ID format/);
            assert.throws(() => decimalToHex('12.34'), /Invalid decimal ID format/);
            assert.throws(() => decimalToHex('-123'), /Invalid decimal ID format/);
        });

        test('should throw error for empty string', () => {
            assert.throws(() => decimalToHex(''), /Invalid decimal ID/);
        });

        test('should handle whitespace', () => {
            assert.strictEqual(decimalToHex('  6181891  '), '00000000005E5403');
        });
    });

    suite('Round-trip conversions', () => {
        test('should convert hex to decimal and back', () => {
            const original = '00000000005E5403';
            const decimal = hexToDecimal(original);
            const back = decimalToHex(decimal);
            assert.strictEqual(back, original);
        });

        test('should convert decimal to hex and back', () => {
            const original = '6181891';
            const hex = decimalToHex(original);
            const back = hexToDecimal(hex);
            assert.strictEqual(back, original);
        });

        test('should handle multiple round trips', () => {
            let value = '00000000005E5403';
            for (let i = 0; i < 10; i++) {
                const dec = hexToDecimal(value);
                value = decimalToHex(dec);
            }
            assert.strictEqual(value, '00000000005E5403');
        });
    });

    suite('formatContentId', () => {
        test('should format hex ID with decimal in parentheses', () => {
            assert.strictEqual(formatContentId('00000000005E5403'), '00000000005E5403 (6181891)');
        });

        test('should return original if conversion fails', () => {
            assert.strictEqual(formatContentId('invalid'), 'invalid');
        });
    });

    suite('isValidHexId', () => {
        test('should validate correct 16-character hex IDs', () => {
            assert.strictEqual(isValidHexId('00000000005E5403'), true);
            assert.strictEqual(isValidHexId('0000000000000000'), true);
            assert.strictEqual(isValidHexId('FFFFFFFFFFFFFFFF'), true);
        });

        test('should reject invalid hex IDs', () => {
            assert.strictEqual(isValidHexId('not-hex'), false);
            assert.strictEqual(isValidHexId('GGGGGGGGGGGGGGGG'), false);
            assert.strictEqual(isValidHexId('12345'), false); // Too short
            assert.strictEqual(isValidHexId('0000000000000000000000'), false); // Too long
            assert.strictEqual(isValidHexId(''), false);
            assert.strictEqual(isValidHexId(null as any), false);
        });

        test('should accept mixed case hex', () => {
            assert.strictEqual(isValidHexId('00000000005e5403'), true);
            assert.strictEqual(isValidHexId('AbCdEf0123456789'), true);
        });
    });

    suite('isValidDecimalId', () => {
        test('should validate correct decimal IDs', () => {
            assert.strictEqual(isValidDecimalId('6181891'), true);
            assert.strictEqual(isValidDecimalId('0'), true);
            assert.strictEqual(isValidDecimalId('123456789'), true);
        });

        test('should reject invalid decimal IDs', () => {
            assert.strictEqual(isValidDecimalId('not-a-number'), false);
            assert.strictEqual(isValidDecimalId('12.34'), false);
            assert.strictEqual(isValidDecimalId('-123'), false);
            assert.strictEqual(isValidDecimalId(''), false);
            assert.strictEqual(isValidDecimalId(null as any), false);
        });
    });

    suite('normalizeToHex', () => {
        test('should pass through valid hex IDs', () => {
            assert.strictEqual(normalizeToHex('00000000005E5403'), '00000000005E5403');
        });

        test('should convert valid decimal to hex', () => {
            assert.strictEqual(normalizeToHex('6181891'), '00000000005E5403');
        });

        test('should handle hex with 0x prefix', () => {
            assert.strictEqual(normalizeToHex('0x5E5403'), '00000000005E5403');
        });

        test('should normalize case to uppercase', () => {
            assert.strictEqual(normalizeToHex('00000000005e5403'), '00000000005E5403');
        });

        test('should throw error for invalid input', () => {
            assert.throws(() => normalizeToHex('not-valid'), /Cannot normalize ID/);
            assert.throws(() => normalizeToHex(''), /Invalid ID/);
        });

        test('should handle whitespace', () => {
            assert.strictEqual(normalizeToHex('  00000000005E5403  '), '00000000005E5403');
        });
    });

    suite('Real-world Sumo Logic IDs', () => {
        const testCases = [
            { hex: '00000000005E5403', decimal: '6181891', name: 'Personal Folder' },
            { hex: '0000000000000000', decimal: '0', name: 'Root' },
            { hex: '00000000005EB9EE', decimal: '6207982', name: 'Admin Recommended' },
            { hex: '0000000001E6FB2B', decimal: '31914795', name: 'Metadata Explorer Dashboard' }, // Fixed: was 32046891
            { hex: '000000000080946D', decimal: '8426605', name: 'Search Item' },
            { hex: '00000000020E7ECB', decimal: '34504395', name: 'Log Portal Folder' } // Fixed: was 34635467
        ];

        test('should convert all real-world hex IDs to decimal', () => {
            testCases.forEach(tc => {
                assert.strictEqual(hexToDecimal(tc.hex), tc.decimal, `Failed for ${tc.name}`);
            });
        });

        test('should convert all real-world decimal IDs to hex', () => {
            testCases.forEach(tc => {
                assert.strictEqual(decimalToHex(tc.decimal), tc.hex, `Failed for ${tc.name}`);
            });
        });

        test('should format all real-world IDs correctly', () => {
            testCases.forEach(tc => {
                const formatted = formatContentId(tc.hex);
                assert.ok(formatted.includes(tc.hex), `Should include hex for ${tc.name}`);
                assert.ok(formatted.includes(tc.decimal), `Should include decimal for ${tc.name}`);
            });
        });
    });
});

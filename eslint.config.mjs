import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: ['out', 'dist', '**/*.d.ts', 'node_modules']
    },
    {
        rules: {
            '@typescript-eslint/naming-convention': [
                'warn',
                {
                    selector: 'variable',
                    modifiers: ['const'],
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase']
                },
                {
                    selector: 'property',
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
                    // Allow HTTP headers and other special cases
                    filter: {
                        regex: '^(Authorization|Content-Type|Accept|Cookie|Set-Cookie|User-Agent)$',
                        match: false
                    }
                },
                {
                    selector: 'classProperty',
                    modifiers: ['static', 'readonly'],
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase']
                }
            ],
            'curly': 'warn',
            'eqeqeq': 'warn',
            'no-throw-literal': 'warn',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],
            'prefer-const': 'error'
        }
    }
);

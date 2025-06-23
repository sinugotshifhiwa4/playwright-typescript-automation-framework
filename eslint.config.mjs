/***
 * ESLint configuration for Playwright + TypeScript test automation framework.
 *
 * This setup includes:
 * - Base ESLint recommendations for general JavaScript
 * - TypeScript-aware linting via @typescript-eslint
 * - Prettier integration to avoid stylistic rule conflicts
 * - Custom rules for production code and relaxed rules for test files
 * - Scoped configuration per file type (JS, TS, tests)
 * - Ignores for generated/output folders and declaration files
 */

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

const config = tseslint.config(
  eslint.configs.recommended,

  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-empty-pattern': 'off',
    },
  },

  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-empty-pattern': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'warn',
    },
  },

  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/tests/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    ignores: [
      'src/testData/**',
      'node_modules/**',
      'logs/**',
      'playwright-report/**',
      'ortoni-report/**',
      'dist/**',
      '*.d.ts',
    ],
  },

  prettierConfig,
);

export default config;

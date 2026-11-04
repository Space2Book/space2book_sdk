import js from '@eslint/js';
import ts from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'work/**', 'release/**', 'node_modules/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ['**/*.mjs'], languageOptions: { globals: {
    console: 'readonly', document: 'readonly', window: 'readonly', process: 'readonly',
    setTimeout: 'readonly', URL: 'readonly', Buffer: 'readonly',
    URLSearchParams: 'readonly', location: 'readonly', parent: 'readonly', getComputedStyle: 'readonly',
  } } },
];

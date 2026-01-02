import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // JavaScript recommended rules
  js.configs.recommended,
  
  // Svelte plugin configs
  ...svelte.configs['flat/recommended'],
  ...svelte.configs['flat/prettier'],
  
  // Global configuration
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
    },
    rules: {
      // Strict rules for code quality
      'no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'prefer-spread': 'error',
      'prefer-rest-params': 'error',
      'prefer-destructuring': ['error', {
        array: false,
        object: true,
      }],
      'no-implicit-coercion': 'error',
      'no-param-reassign': 'error',
      'no-shadow': 'error',
      'no-use-before-define': ['error', { functions: false, classes: true }],
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'all'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
      'no-await-in-loop': 'warn',
      'array-callback-return': 'error',
      'no-loop-func': 'error',
      'consistent-return': 'error',
      'default-case': 'error',
      'default-case-last': 'error',
      'dot-notation': 'error',
      'no-else-return': 'error',
      'no-empty-function': 'error',
      'no-extra-bind': 'error',
      'no-floating-decimal': 'error',
      'no-lone-blocks': 'error',
      'no-multi-spaces': 'error',
      'no-new': 'error',
      'no-new-wrappers': 'error',
      'no-return-assign': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'prefer-promise-reject-errors': 'error',
      'radix': 'error',
      'yoda': 'error',
      
      // Best practices for modern JavaScript
      'no-duplicate-imports': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-constructor': 'error',
      'no-useless-rename': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-numeric-literals': 'error',
      'symbol-description': 'error',
    },
  },
  
  // Svelte-specific rules
  {
    files: ['**/*.svelte'],
    rules: {
      // Svelte best practices
      'svelte/no-at-html-tags': 'error',
      'svelte/no-target-blank': 'error',
      'svelte/no-reactive-reassign': 'error',
      'svelte/require-store-reactive-access': 'error',
      'svelte/valid-compile': 'error',
      'svelte/require-each-key': 'error',
      
      // Svelte 5 runes ($state, $derived) require 'let' even when not reassigned
      // This is a language requirement, not a style choice, so we disable prefer-const
      'prefer-const': 'off',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^(_|\\$)',
      }],
    },
  },
  
  // Test files and development utilities
  {
    files: ['test-server.js', '**/test/**', '**/tests/**', '**/*.test.js', '**/*.spec.js'],
    rules: {
      'no-console': 'off', // Allow console in test files
    },
  },
  
  // Prettier compatibility (disables conflicting rules)
  prettier,
  
  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '*.log',
      '.DS_Store',
      '.idea/**',
      'build/**',
      'coverage/**',
    ],
  },
];

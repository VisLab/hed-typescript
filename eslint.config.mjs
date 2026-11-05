import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier/flat'
import globals from 'globals'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist/**/*'], 'Ignore Build Directory'),
  globalIgnores(['docs/**/*'], 'Ignore Documentation Directory'),
  globalIgnores(['tests/bidsDemoData/**/*'], 'Ignore BIDS Demo Data Directory'),
  globalIgnores(['tests/otherTestData/**/*'], 'Ignore Other Test Data Directory'),
  globalIgnores(['src/data/*'], 'Ignore Source Data Directory'),
  globalIgnores(['spec_tests/hed-tests/**/*'], 'Ignore hed-tests Submodule'),
  globalIgnores(['.status/**/*'], 'Ignore Working Notes Directory'),

  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.ts'],
    plugins: {
      js,
    },

    extends: ['js/recommended'],

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        __VITE_ENV__: 'readonly',
      },

      ecmaVersion: 'latest',
    },

    rules: {
      'no-console': [
        'error',
        {
          allow: ['warn'],
        },
      ],

      'guard-for-in': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'array-callback-return': 'error',
      'no-constructor-return': 'error',
      'no-duplicate-imports': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'warn',
      'no-unmodified-loop-condition': 'warn',
      'no-unreachable-loop': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'PrivateIdentifier',
          message: 'Use private _x, not #x (issue https://github.com/hed-standard/hed-javascript/issues/946).',
        },
      ],

      'prefer-arrow-callback': [
        'error',
        {
          allowUnboundThis: false,
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
  {
    files: ['**/*.ts'],

    extends: [tseslint.configs.recommendedTypeChecked],

    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },

    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  prettier,
])

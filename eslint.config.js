import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

const correctnessRules = {
  'no-debugger': 'error',
  'no-dupe-args': 'error',
  'no-dupe-else-if': 'error',
  'no-duplicate-case': 'error',
  'no-dupe-keys': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-self-assign': 'error',
  'no-unreachable': 'error',
  'no-unreachable-loop': 'error',
  'no-unsafe-finally': 'error',
  'no-unsafe-negation': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }],
}

export default tseslint.config(
  { linterOptions: { reportUnusedDisableDirectives: false } },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-ssr/**',
      'coverage/**',
      'artifacts/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      '.cache/**',
      '.vite/**',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...correctnessRules,
      'react-hooks/rules-of-hooks': 'error',
      // Existing dependency debt is reported but does not block the first lint
      // gate. The warning ceiling in package.json prevents silent growth.
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,mjs,ts}'],
    ...js.configs.recommended,
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...correctnessRules,
    },
  },
)

// Shared ESLint rules for every workspace. Each app composes this with its own
// environment-specific config (Node/Jest for backend, browser/React for frontend).
export const sharedRules = {
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
  eqeqeq: ['error', 'smart'],
  'no-console': ['warn', { allow: ['warn', 'error'] }],
};

module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended'
  ],
  parser: '@typescript-eslint/parser',
  ignorePatterns: [
    '/lib/**/*',
    '/node_modules/**/*',
  ],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-console': 'off',
  },
};
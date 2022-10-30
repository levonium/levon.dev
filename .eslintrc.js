module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: 'standard',
  overrides: [
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    quotes: [
      'error',
      'single'
    ],
    semi: [
      'error',
      'never'
    ],
    'space-before-function-paren': [
      'error',
      {
        named: 'never',
        anonymous: 'always',
        asyncArrow: 'always'
      }
    ],
    'comma-dangle': 'only-multiline'
  }
}

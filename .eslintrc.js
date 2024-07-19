module.exports = {
  extends: ['@evan-yang', 'plugin:astro/recommended'],
  rules: {
    'no-console': ['warn', { allow: ['error'] }],
    'react/style-prop-object': 'off',
    'react/display-name': 'off',
    'react-hooks/rules-of-hooks': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    'curly': 'off',
  },
  overrides: [
    {
      files: ['*.astro'],
      parser: 'astro-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['.astro'],
      },
      rules: {
        'no-mixed-spaces-and-tabs': ['warn', 'smart-tabs'],
        'react/jsx-key': 'off',
      },
    },
    {
      // Define the configuration for `<script>` tag.
      // Script in `<script>` is assigned a virtual file name with the `.js` extension.
      files: ['**/*.astro/*.js', '*.astro/*.js'],
      parser: '@typescript-eslint/parser',
      rules: {
        'prettier/prettier': 'off',
      },
    },
  ],
}

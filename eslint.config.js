import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['assets/js/**/*.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser, marked: 'readonly' } },
        rules: { 'no-unused-vars': ['warn', { args: 'none' }] },
    },
    {
        files: ['scripts/**/*.mjs', 'eslint.config.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
    },
];

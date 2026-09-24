const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    { ignores: ['node_modules/', 'dist/', 'test-results/', 'playwright-report/'] },
    js.configs.recommended,
    {
        // Content scripts: обычные скрипты в браузере, общий globalThis.KPE; lib.js ещё и CommonJS для тестов.
        files: ['extension/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: { ...globals.browser, chrome: 'readonly', module: 'readonly' },
        },
    },
    {
        files: ['tests/**/*.js', '*.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            // Колбэки page.evaluate выполняются в браузере.
            globals: { ...globals.node, ...globals.browser },
        },
    },
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
    },
    {
        rules: {
            eqeqeq: ['error', 'smart'],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
];

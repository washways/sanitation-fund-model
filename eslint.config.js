/**
 * eslint.config.js — F-19.
 *
 * Deliberately three rules, no more, per docs/ROADMAP.md's S0 task list:
 *
 *   no-dupe-keys      — caught F-16 (duplicate object keys silently discarding values)
 *   no-undef          — the closest static check to F-01's class of bug (a reference
 *                       with no declaration anywhere in scope)
 *   no-unused-vars    — caught the class of bug behind F-13, F-15, F-25
 *
 * This is not a style linter. Do not add stylistic rules (semicolons, quotes,
 * indentation) without an ADR — see AGENTS.md "Do not add a dependency" and
 * CONTRIBUTING.md's code-style table, which is the actual style guide here.
 *
 * The app (`src/**`, see tools/app-source.js) runs in a browser with no bundler
 * and no module system: every top-level `const` is a global by construction
 * (ApiModule, ModelModule, UI, LDC_COUNTRIES, stakeholdersData, chartInstances,
 * runCalculation) — the S5 split (ADR-0033) spread these across files but kept
 * exactly this property, which is what makes the split safe. `no-undef` would
 * flag every one of them as undefined in every *other* file unless they're
 * declared as globals here — that is intentional and part of what F-19 is
 * capturing, not a false positive to silence.
 */
module.exports = [
    {
        ignores: ['vendor/**', 'node_modules/**'],
    },
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                // Browser environment the app runs in.
                window: 'readonly', document: 'readonly', fetch: 'readonly',
                console: 'readonly', navigator: 'readonly', alert: 'readonly',
                prompt: 'readonly', confirm: 'readonly', setTimeout: 'readonly',
                clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
                structuredClone: 'readonly', Intl: 'readonly', Event: 'readonly',
                Blob: 'readonly', URL: 'readonly', localStorage: 'readonly',
                // Loaded from a <script> tag before the app's own scripts, per index.html.
                Chart: 'readonly',
                // The app's own top-level bindings, each declared in one src/ file and
                // read (or, for ModelModule/UI, extended via Object.assign) from others —
                // see tools/app-source.js for the load order this depends on.
                ApiModule: 'readonly', ModelModule: 'writable', UI: 'writable',
                LDC_COUNTRIES: 'readonly', stakeholdersData: 'readonly',
                chartInstances: 'writable', runCalculation: 'writable',
            },
        },
        rules: {
            'no-dupe-keys': 'error',
            'no-undef': 'error',
            'no-unused-vars': 'error',
        },
    },
    {
        files: ['server.js', 'tools/**/*.js', 'tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly', module: 'readonly', exports: 'writable',
                __dirname: 'readonly', __filename: 'readonly', process: 'readonly',
                console: 'readonly', Buffer: 'readonly', globalThis: 'readonly',
                fetch: 'readonly', Intl: 'readonly', structuredClone: 'readonly',
                setTimeout: 'readonly', setImmediate: 'readonly', clearTimeout: 'readonly',
                setInterval: 'readonly', clearInterval: 'readonly',
                Event: 'readonly', URL: 'readonly',
            },
        },
        rules: {
            'no-dupe-keys': 'error',
            'no-undef': 'error',
            'no-unused-vars': 'error',
        },
    },
];

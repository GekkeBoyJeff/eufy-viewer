import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';
import next from 'ultracite/oxlint/next';
import react from 'ultracite/oxlint/react';

// JSX project (no TypeScript): extend the core/react/next presets but skip the `vitest`
// preset and all `typescript/*` rule overrides — they only apply to .ts files.
//
// This app predates the linter, so the baseline keeps correctness rules as errors and
// downgrades the stricter stylistic/pedantic rules to `warn` (a visible backlog) or `off`
// where they are simply wrong for a Node + ffmpeg server (e.g. the unicorn rules that
// assume the browser EventTarget API instead of Node's EventEmitter). Run `npm run lint`
// for a clean baseline; `npm run lint:fix` applies the safe auto-fixes.
export default defineConfig({
  extends: [core, react, next],
  rules: {
    'no-warning-comments': 'off', // Allow TODO and FIXME comments
    'no-inline-comments': 'off', // Allow nearby comments
    'sort-keys': 'off',
    'sort-vars': 'off',
    'func-style': 'off',
    'unicorn/filename-case': 'off', // Mixed conventions: PascalCase libs + lowercase Next files

    // --- Wrong for a Node + ffmpeg server (browser-oriented rules) ---
    'unicorn/prefer-event-target': 'off', // Node EventEmitter is correct here, not EventTarget
    'unicorn/prefer-add-event-listener': 'off', // .on() is the Node EventEmitter API
    'promise/avoid-new': 'off', // The bounded timeout/poll helpers legitimately use new Promise
    'no-eq-null': 'off', // Intentional `== null` / `!= null` nullish checks
    'require-unicode-regexp': 'off', // The few regexes do not need the /u flag
    'class-methods-use-this': 'off', // Some source-adapter methods are intentionally instance-bound
    'no-plusplus': 'off',
    complexity: 'off',
    'unicorn/no-nested-ternary': 'off', // Conflicts with oxfmt, which strips the parens this rule wants

    // --- Gradual-improvement backlog: warn, don't block a working app ---
    eqeqeq: 'warn',
    'no-empty': 'warn',
    'no-empty-function': 'warn',
    'no-nested-ternary': 'warn',
    'no-negated-condition': 'warn',
    'no-promise-executor-return': 'warn',
    'require-await': 'warn',
    'no-unused-vars': 'warn',
    'promise/prefer-await-to-then': 'warn',
    'promise/prefer-await-to-callbacks': 'warn',
    'promise/param-names': 'warn',
    'unicorn/no-negated-condition': 'warn',
    'unicorn/prefer-array-some': 'warn',
    'unicorn/consistent-function-scoping': 'warn',
    'unicorn/no-useless-undefined': 'warn',

    // --- JSDoc: encouraged, not required (warn) ---
    'jsdoc/require-param': 'warn',
    'jsdoc/require-param-description': 'warn',
    'jsdoc/require-returns': 'warn',
    'jsdoc/require-returns-description': 'warn',

    // --- Accessibility: warn for now (single-user LAN viewer) ---
    'jsx-a11y/control-has-associated-label': 'warn',
    'jsx-a11y/no-static-element-interactions': 'warn',
    'jsx-a11y/click-events-have-key-events': 'warn',
  },
  options: {
    reportUnusedDisableDirectives: 'warn',
  },
});

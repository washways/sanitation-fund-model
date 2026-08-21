# ADR-0020: ESLint is a devDependency — a narrow exception to ADR-0002

- **Status:** Accepted
- **Date:** 2026-08-21
- **Stage:** S0
- **Findings:** F-19
- **Amends:** [ADR-0002](0002-keep-the-app-buildless.md) — does not supersede it

## Context

[ADR-0002](0002-keep-the-app-buildless.md) commits the project to staying dependency-free, and its Decision section says development tooling "may use Node built-ins" — which `node:test` satisfies but ESLint does not: it is an npm package with its own dependency tree. `docs/ROADMAP.md`'s S0 task list has called for adding it since the original audit (F-19: "No ESLint/Prettier. `no-dupe-keys`, `no-undef` and `no-unused-vars` alone would have caught F-13, F-15, F-16 and F-25.") and AGENTS.md requires an ADR before any dependency is added. This is that ADR.

## Decision

Add `eslint` as a **devDependency only**. Nothing it depends on ships to the browser, is referenced by `index.html`, or is required to run the app — `python -m http.server` or `npm run serve` still work with `node_modules/` deleted. `package-lock.json` is committed so `npm ci` is reproducible in CI.

The rule ADR-0002 actually protects — **the shipped application has no runtime dependency and needs no build step** — is unchanged. This ADR narrows "development tooling may use Node built-ins" to "development tooling may use Node built-ins, or a devDependency that never ships," which is what F-19 asked for from the start.

## Prediction

No behaviour change to the running app. `npm test`, `npm run lint` and CI all require `npm ci` first; opening `index.html` directly does not.

## Alternatives considered

- **Write the three rules (`no-dupe-keys`, `no-undef`, `no-unused-vars`) as a hand-rolled Node script over `app.js`'s AST.** Rejected: reimplementing a fraction of a well-tested linter, for the sake of a dependency count, is the kind of maintenance liability ADR-0002 is actually worried about — a hand-rolled checker is more code to trust, not less.
- **Skip linting entirely.** Rejected: this is F-19, still open five ADRs into the project, and the very first real run found a live, Critical bug (F-36 — a duplicate key hiding a broken CSV export) that no test in the suite was checking for.

## Consequences

Easier: F-13/F-15/F-16/F-25-class defects (a duplicate key, an undeclared reference, a variable nobody reads) are caught before merge instead of by a user in a browser. Contributors need `npm ci` once, which they already need for `npm test`.

Harder: one more thing to keep patched (`npm audit`); CI has one more step that can fail for reasons unrelated to the model.

To reverse: `npm uninstall eslint`, delete `eslint.config.js` and the `lint` script and CI step. No app code depends on any of it.

## Verification

```bash
npm ci                 # installs eslint into node_modules/, nothing else changes
npm run lint            # 0 errors (16 baseline violations suppressed at file level — see app.js:6, F-19)
rm -rf node_modules && python -m http.server 8080   # the app still runs with no devDependencies installed
```

# ADR-0002: Keep the application buildless and dependency-free

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S0
- **Findings:** F-19, F-22

## Context

The application is a single HTML file, a stylesheet and a 3,667-line script. It has no `package.json`, no bundler, and one undeclared dependency (Chart.js from a CDN). Opening `index.html` runs it.

The obvious reaction to a 3,667-line file with no tests is "rewrite it in a framework". That reaction is wrong here, for reasons specific to this tool:

- It is used in workshops and field offices in low-income countries, on borrowed laptops, sometimes without reliable internet. It must run from a USB stick.
- The maintaining team is small and not primarily front-end developers. A toolchain is a maintenance liability that will rot.
- The asset worth protecting is the **financial model**, which is already pure and deterministic (INV-12 verifies it). A rewrite discards the sound part and retains all the risk.

The audit found nothing wrong with buildlessness. It found problems with the *absence of a test harness*, which is a separate thing — and Node's built-in `node:test` supplies one with zero dependencies.

## Decision

The shipped application stays buildless, framework-free and dependency-free.

- Source stays as ES modules loadable directly by the browser (stage S5).
- Development tooling (tests, linting) may use Node built-ins, but must never become a prerequisite for *running* the app.
- Chart.js is pinned to an exact version with SRI **and vendored locally** as a fallback (F-22), rather than removed.
- Adding a framework, bundler, transpiler or backend requires a new ADR superseding this one.

## Prediction

No behaviour change. `npm test` becomes available; opening `index.html` continues to work with no install step.

## Alternatives considered

- **Rewrite in React/Vue + Vite.** Rejected: discards a working model, adds a toolchain the team cannot maintain, and breaks offline USB-stick use.
- **Add TypeScript.** Tempting given the unit bugs (F-17, F-33) and the union-typed KPIs (F-28) — but it requires a build step. JSDoc annotations with `checkJs` give most of the benefit with no build; revisit at S5.
- **Bundle everything into one file.** Rejected: that is the current problem.

## Consequences

Easier: distribution, offline use, long-term maintainability, onboarding.

Harder: no compile-time type safety, so the unit-error class (F-02, F-17, F-33) must be caught by tests and by `PARAMETERS.md` discipline instead. That is exactly why `tests/wiring.test.js` exists.

To reverse: a new ADR, plus a demonstration that offline USB-stick use survives.

## Verification

`package.json` declares no dependencies. `npm test` runs on Node's built-in runner in about 0.7 s. `index.html` opens and runs with no install step.

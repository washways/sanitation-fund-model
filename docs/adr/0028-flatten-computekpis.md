# ADR-0028: Flatten computeKPIs; delete the render-time mutation (F-14)

- **Status:** Accepted
- **Date:** 2026-08-21
- **Stage:** S3 (carried from S2)
- **Findings:** F-14
- **Spec rules touched:** none (a return-shape refactor, not a modelling change)

## Context

`ModelModule.computeKPIs` returned `{ reach, impact: { impact, portfolio, financials, sustainability, value } }` — five logical groups all nested one level too deep, under a key that collides with one of the five (`impact.impact`). `UI.updateKPIs` compensated by destructuring `k.impact` on every render and overwriting `k.financials`, `k.sustainability`, `k.portfolio`, `k.value`, `k.impact` in place:

```js
const { financials, sustainability, portfolio, value, impact: impactMetrics } = k.impact || {};
k.financials = financials || {};
k.sustainability = sustainability || {};
k.portfolio = portfolio || {};
k.value = value || {};
k.impact = impactMetrics || {};
```

Two real defects, not just untidiness: this makes `updateKPIs` **not idempotent** — call it twice on the same object and the second call destructures a `k.impact` that has already been overwritten to the small `{dalys, valHours, ...}` group, so `financials`/`sustainability`/`portfolio`/`value` all silently reset to `{}`. And it creates a **hidden coupling**: `UI.downloadCSV()` (F-36) and other code that reads `k.financials.X` only works because a render already ran and mutated the object first — nothing in the shape says so.

## Decision

`computeKPIs` now returns the flat shape directly — `reach`, `impact`, `portfolio`, `financials`, `sustainability`, `value` as six top-level siblings, `impact` holding just the small DALYs/hours/carbon group it always should have. `UI.updateKPIs`'s destructure-and-reassign block is deleted outright; there is nothing left for it to do. The six call sites that read the old nested form (`kpis.impact.financials.X`, `kpis.impact.sustainability.X`) are updated to the flat form (`kpis.financials.X`, `kpis.sustainability.X`) — in `ModelModule.solveBreakEven`'s two internal solvers, `UI.generateSuggestions`'s advisor helpers, and the controller's post-run repayment check.

This is the minimum-diff version of the fix: the new shape is exactly what `updateKPIs`'s mutation already produced as its *output*, so every consumer that only ever ran after a render (CSV export, the render code itself) needed no change at all. Only consumers that read a `calculate()` result *before* any render — the solvers, the advisor, and every test/tool that drives the model headlessly — needed updating, because they were the ones actually depending on the old nested shape.

## Prediction

**No model output changes.** This reorganizes which JavaScript property a number lives under; it does not change how any number is computed. No golden scenario moves — this is provable rather than merely expected, because `tests/golden.scenarios.js`'s `summarise()` reads the same underlying values through updated property paths, and `golden:diff` against the existing `golden.json` is the actual test of that claim.

## Alternatives considered

- **Keep the mutation, just make it idempotent** (e.g., guard with a flag). Rejected: it treats the symptom. The hidden coupling — code silently depending on render order — is the more expensive defect, and it doesn't go away just because the mutation stops corrupting itself on a second call.
- **Fully flatten reach into the same top-level object too** (one object, no groups at all). Rejected: the six groups (`reach`, `impact`, `portfolio`, `financials`, `sustainability`, `value`) are a real, useful taxonomy for a reader, and several already-correct call sites use `k.reach.X` — regrouping everything into one 40-key object would touch far more call sites for no corresponding benefit. "Flat" here means "no *redundant* nesting", not "no structure at all".

## Consequences

`computeKPIs`'s return value is now what its docstring already claimed: a plain, idempotent, fully-formed object. `UI.updateKPIs` can be called any number of times on the same result without corrupting it — relevant the moment anything (a re-render, a second export, a future undo/redo) calls it more than once. The KPI shape is now documented by this ADR and by the six named groups themselves, rather than by "whatever `updateKPIs` happens to leave behind."

## Verification

```bash
npm test               # 0 failures — a new smoke assertion confirms computeKPIs is idempotent
npm run golden:diff    # "No behaviour change"
npm run lint            # clean
```

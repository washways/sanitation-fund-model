# ADR-0026: Restore the detailed monthly CSV export; delete the broken duplicate

- **Status:** Accepted
- **Date:** 2026-08-21
- **Stage:** S2
- **Findings:** F-36
- **Spec rules touched:** none (UI only, no model change)

## Context

`UI.downloadCSV()` was defined twice (F-36). Both throw when called, for unrelated reasons, and nothing in the test suite ever called either one. Tracing both:

- The **first** definition (a detailed monthly data table — constraint, cohort, per-toilet-cost columns) is shadowed and never runs. It has one bug: `paramRows` reads `s.economicCostPerLatrine` before `const s = this.lastResults.series` is declared two lines later — a temporal-dead-zone `ReferenceError`.
- The **second** definition is the one that actually runs. It opens by building a prose "Pro-Forma" summary string, using a KPI shape (`kpis.impact.toilets`, `kpis.impact.sroi`, `kpis.financials.ossRatio`) that predates the `computeKPIs`/`updateKPIs` split (F-14) and no longer exists — `kpis.impact.sroi.toFixed(2)` throws a `TypeError`. The prose string, once built, is never used (`report` is assigned and read nowhere — an `eslint no-unused-vars` finding in its own right). *After* that dead, throwing prose section, the same function has a second, working, differently-shaped CSV-table generator.
- Both definitions separately reference `inputs.grantFund`, which does not exist (`getInputs()` produces `investGrant`) — this doesn't throw, it silently prints `GrantFund,$undefined`.

Separately, `UI.copyAnalysisReport()` — a distinct method, bound to its own "Copy Report" button — already owns the prose-summary job. The dead code inside the second `downloadCSV` duplicates a feature that exists elsewhere under its own name; it isn't a second deliberate design.

## Decision

**Keep the first (detailed monthly table) definition, fixed. Delete the second definition entirely**, including its dead prose-report section.

Fixes applied to the surviving definition:

1. Move `const s = this.lastResults.series` above `paramRows`, which reads it.
2. `inputs.grantFund` → `inputs.investGrant`.
3. `s.dataMonthlyBadDebt`, which does not exist, → `(s.dataMonthlyDefaultsHh[i] || 0) + (s.dataMonthlyDefaultsMe[i] || 0)` — the combined write-off figure, which is exactly what the second (deleted) definition computed correctly for its own "Defaults" column.
4. Remove the unused `totalRow` local (an `eslint no-unused-vars` finding).

## Prediction

**No model output changes — this is a UI/export bug fix, not a modelling change.** No golden scenario moves. The user-visible change is that clicking "Export CSV" produces a file instead of throwing, and that file's `GrantFund` and defaults columns show real numbers instead of `$undefined` or a reference to a nonexistent field.

## Alternatives considered

- **Keep the second (currently-running) definition and just fix its bugs.** Rejected: its "report" prose section duplicates `copyAnalysisReport()`, and its CSV table has fewer columns (17 vs 24) than the first — no per-toilet unit costs, no constraint-binding column, no ME-count column. The first is the richer, more analyst-useful export and was clearly the more developed of the two before it got shadowed.
- **Merge both column sets into one export.** Rejected as unnecessary scope: nothing asked for more columns than the first definition already has, and merging two independently-evolved schemas risks introducing a third set of bugs. Revisit only if a specific missing column is requested.
- **Delete `downloadCSV` and point the button at `copyAnalysisReport` instead.** Rejected: a CSV data table and a prose report are different artefacts for different audiences (analysts vs. board papers) — the app already has both buttons for a reason; the bug was that one of the two backing functions was broken, not that the app has too many export features.

## Consequences

Easier: the Export button on the dashboard works. Harder: none — this removes code, it doesn't add any.

To reverse: restore the deleted block from git history; not expected to be needed.

## Verification

```bash
npm test    # tests/export.test.js: downloadCSV does not throw, produces one CSV,
            # contains no $undefined/NaN, is defined exactly once
npm run lint            # the F-19 baseline suppression's no-dupe-keys violation is gone
npm run golden:diff     # "No behaviour change"
```

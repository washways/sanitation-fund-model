# Architecture

## What this is

A **buildless, dependency-free, single-page browser application**. Open `index.html` and it runs. No npm install, no bundler, no backend, no database.

That is a deliberate and correct choice for the context: the tool is used in workshops and field offices in low-income countries, needs to run from a laptop or a USB stick, and must stay maintainable by a small team without a build pipeline. **Do not add a build step, a framework or a backend without an ADR.**

The one exception is Chart.js, loaded from a CDN — pinned to an exact version with an integrity hash, and vendored locally as a fallback, so it still works with no network.

---

## Current shape

```
index.html ──▶ style.css
           ──▶ https://cdn.jsdelivr.net/npm/chart.js@4.4.1   pinned, SRI-hashed
           │                                                  falls back to vendor/chart.umd.min.js offline
           ──▶ src/data/worldbank.js      ApiModule — World Bank + country-states fetching, no DOM
           ──▶ src/data/countries.js      LDC_COUNTRIES
           ──▶ src/data/stakeholders.js   static reference data (unused, F-19 baseline)
           ──▶ src/model/engine.js        ModelModule core — rate/annuity helpers, the month loop. Pure.
           ──▶ src/model/kpis.js          computeKPIs. Pure.
           ──▶ src/model/solvers.js       break-even rate, max sustainable grant. Pure.
           ──▶ src/model/invariants.js    integrity/viability checks, solvency advice. Pure.
           ──▶ src/ui/inputs.js           UI core — getInputs, init, formatting
           ──▶ src/ui/kpis.js             KPI rendering, integrity/viability banners
           ──▶ src/ui/charts.js           Chart.js rendering
           ──▶ src/ui/tables.js           the on-screen monthly data table
           ──▶ src/ui/export.js           CSV export, clipboard report
           ──▶ src/ui/advisor.js          solvency-advice rendering
           ──▶ src/app.js                 controller: DOMContentLoaded, runCalculation, wiring
methodology.html         user-facing explainer, standalone
server.js                dev static server
favicon.png
```

Split from a single 4,028-line `app.js` in stage S5 — see [ADR-0033](adr/0033-s5-structural-split.md) for what moved where and three deliberate deviations from this file's original S5 sketch. `tools/app-source.js` is the single source of truth for the file list and load order; `index.html`'s `<script>` tags must match it exactly, by hand — nothing can check the two against each other automatically, since one is markup and the other is code.

| Concern | Files | Pure? |
|---|---|---|
| `ApiModule` | `src/data/worldbank.js` | no — network |
| `ModelModule` — **the simulation, KPIs, solvers, invariant checks** | `src/model/*.js` | **yes**, and tested (`tests/purity.test.js`) |
| `UI` | `src/ui/*.js` | no — DOM |
| controller | `src/app.js` | no — DOM |

Line numbers shift with every fix, so they're not reproduced here — `grep -n "^const ModelModule\|^const UI" src/model/engine.js src/ui/inputs.js` finds the declaring files in seconds; `Object.assign(ModelModule,` / `Object.assign(UI,` finds the files that extend them.

**`ModelModule` is already pure, and now provably so.** INV-12 verifies `calculate()` is deterministic and does not mutate its input; `tests/purity.test.js` goes further and loads `src/model/*.js` with **zero** DOM stub — not even the minimal one `tools/load-model.js` provides — and confirms it still runs a full calculation. That is why `tools/load-model.js` can test it headlessly, and why stage S5's split was a low-risk move rather than a rewrite: `golden.json` came out byte-identical.

### Data flow

```
  index.html form
        │
        ▼
  UI.getInputs()                    ← a missing DOM id fails silently, falling back to
        │                              getRaw's default — tests/wiring.test.js guards this
        ▼
  ModelModule.calculate(inputs)     ← pure, deterministic
        │
        ├─▶ month loop  m = 1..duration*12
        │     dual ledger: grantCash | loanCash
        │     cohorts:     hhCohorts | meCohorts
        │
        ├─▶ computeKPIs(series, inputs)
        └─▶ verifyLedger(series, inputs, kpis)   ← two independent verdicts: integrity, viability (F-11, F-29 fixed)
        ▼
  { series, kpis }
        │
        ├─▶ UI.updateKPIs()      ← reads a flat, already-idempotent KPI object (F-14 fixed)
        ├─▶ UI.renderCharts()
        └─▶ UI.renderDataTable()
        │
        ▼
  runCalculation(isAutoAdjust)      ← advisory only; does not write back into the form (F-04, F-05 fixed)
```

**The write-back cycle described here at audit time is gone.** `runCalculation` used to rewrite the inputs it had just read and re-enter itself, up to five times, without telling the user — that broke reproducibility, A/B comparison and the meaning of an exported CSV. Stage S2 made the advisor advisory-only; `tests/smoke.test.js` asserts directly that `runCalculation` does not mutate any input. `UI.updateKPIs()` mutating the KPI object it was handed (F-14) is fixed too, 2026-08-21 — `computeKPIs` now returns the flat shape directly, so there is nothing left to mutate. [ADR-0028](adr/0028-flatten-computekpis.md).

---

## The ledger model

Two cash pools that never transfer to each other:

```
                    ┌─────────────────┐
   investGrant ────▶│   GRANT LEDGER  │────▶ household subsidies + their fees
   carbon revenue ─▶│                 │
                    └─────────────────┘

                    ┌─────────────────┐────▶ household loans  ──┐
   investLoan  ────▶│   LOAN LEDGER   │────▶ ME loans          ─┤
   repayments ─────▶│                 │────▶ fixed + variable ops│
   interest   ─────▶│                 │────▶ investor P&I       │
                    └─────────────────┘                          │
                             ▲                                   │
                             └───────── repayments + interest ───┘
```

`dataMonthlyCashBalance[i]` is their **sum**, which is why an overdrawn loan ledger can be masked by a healthy grant ledger in the headline chart. The separation is right; the reporting of it is not yet.

Write-offs reduce cohort balances but are **never** cash outflows — INV-11 verifies this across all 16 scenarios, and it holds.

---

## Design decisions worth preserving

| Decision | Why it is right |
|---|---|
| **Pure model core** | Testable headlessly, deterministic, no hidden state. The single best property this codebase has. |
| **Dual ledger** | Correct structure for blended finance; keeps subsidy and revolving capital from silently cross-subsidising. |
| **Cohort-based portfolios** | Vintages rather than a blended balance, so term structure and run-off behave correctly. |
| **Cash identity by construction** | `netFlow` is assembled from the same buckets that mutate the ledgers, so the two cannot drift. |
| **Self-verification after every run** | Unusual and valuable. Strengthened, not replaced — F-11, F-12 and F-29 are fixed; two independent verdicts (integrity, viability) now render on screen. |
| **Buildless** | Runs anywhere, forever, with no toolchain rot. |

## Design decisions already reversed

| Decision | Problem | Fixed in |
|---|---|---|
| Controller wrote back into inputs | Broke reproducibility (F-04, F-05) | S2, [ADR-0009](adr/0009-advisory-not-automatic.md) |
| `console.warn` as a reporting channel | Nobody has devtools open (F-29) | S1, [ADR-0008](adr/0008-integrity-versus-viability.md) |
| One flag controlled solvers *and* verification | Disabling one silently disabled the other (F-11) | S1 |
| Magnitude-guessing unit heuristics | Two of them, contradictory (F-17) | S1, [ADR-0012](adr/0012-percentage-entry-convention.md) |
| Unpinned CDN dependency | Non-reproducible; blank charts offline (F-22) | S0 |
| Renderer mutated the model's output | Non-idempotent; hidden coupling (F-14) | S3, [ADR-0028](adr/0028-flatten-computekpis.md) |

## Design decisions still to reverse

| Decision | Problem | Stage |
|---|---|---|
| `calculate()` is one ~715-line function | Cohort/annuity/write-down logic (envisioned as `portfolio.js`) and the senior debt schedule (envisioned as `investor.js`) are inline in the month loop, not separable functions — pulling them out is real refactoring, not a code move, and needs its own ADR and prediction. See [ADR-0033](adr/0033-s5-structural-split.md) "Consequences." | S5 (follow-up, not yet started) |

---

## Target shape (stage S5) — done, [ADR-0033](adr/0033-s5-structural-split.md)

Split along the seams that already existed. **Moved code; did not improve it** — the proof the S5 refactor was safe is a byte-identical `golden.json`, confirmed by `npm run golden:diff`.

```
src/
  model/            ← pure. No document, no window, no Chart. Enforced by tests/purity.test.js.
    engine.js         rate/annuity helpers + the month loop (790 lines — one function, see above)
    kpis.js           computeKPIs — flat output shape
    solvers.js        break-even, max-grant
    invariants.js     INV-1..INV-18, viability, solvency advice
  ui/
    inputs.js  kpis.js  charts.js  tables.js  export.js  advisor.js
  data/
    worldbank.js  countries.js  stakeholders.js
  app.js            ← controller and wiring only (637 lines — one function, the DOMContentLoaded handler)
```

`portfolio.js` and `investor.js`, in the original sketch above `engine.js`, were not built — see the "still to reverse" row above.

Rules, and how each was actually satisfied:

1. `src/model/` must not reference `document`, `window` or `Chart` — **done and tested**, `tests/purity.test.js`. `tools/load-model.js` was **not** deleted: it is still how every test gets `ModelModule` into Node, and doing without it would mean rewriting those tests' loading mechanism, which is a different, larger change than this rule asked for — see ADR-0033.
2. ES modules load natively in every target browser, no bundler needed — **built differently**: classic (non-module) scripts sharing one global scope, for test-harness compatibility. See ADR-0033's first deviation.
3. No file over 500 lines — **two exceptions**, both a single function moved whole (`engine.js`, `app.js`), documented above and in ADR-0033.
4. One directory per commit, `npm test` green after each — followed; `data/`, `model/`, `ui/` and the root `app.js`/`index.html`/`eslint.config.js` updates landed together as one reviewable change with the full suite green throughout, per the ADR.

---

## Constraints to design within

| Constraint | Consequence |
|---|---|
| **No backend** | All computation is client-side. Scenario sharing must be a file or a URL fragment, never a server. |
| **Offline capable** | Field use in LDCs. Every asset must be local or cached — Chart.js is vendored for this reason. |
| **No build step** | Classic `<script>` tags only (ADR-0033); no JSX, no TypeScript syntax, no transpilation. JSDoc types are fine. |
| **Auditable output** | Every headline number must be traceable to inputs through the CSV export. This is why the audit arrays in `series` exist. |
| **Numbers feed real decisions** | Silent wrongness is the primary risk, not crashes. Guards, invariants and unit discipline outrank features. |

# Architecture

## What this is

A **buildless, dependency-free, single-page browser application**. Open `index.html` and it runs. No npm install, no bundler, no backend, no database.

That is a deliberate and correct choice for the context: the tool is used in workshops and field offices in low-income countries, needs to run from a laptop or a USB stick, and must stay maintainable by a small team without a build pipeline. **Do not add a build step, a framework or a backend without an ADR.**

The one exception is Chart.js, loaded from a CDN — which is also [F-22](ANALYSIS.md#f-22--chartjs-is-loaded-unpinned-from-a-cdn), because it is unpinned, has no SRI, and makes the charts silently blank offline.

---

## Current shape

```
index.html ──▶ style.css
           ──▶ https://cdn.jsdelivr.net/npm/chart.js   ⚠️ unpinned, no SRI (F-22)
           ──▶ app.js  ─────────── 3,667 lines, six globals
methodology.html         user-facing explainer, standalone
server.js                dev static server ⚠️ path traversal (F-18)
favicon.png              286 KB — larger than app.js
```

`app.js` contains four concerns with no boundary between them:

| Lines | Module | Concern | Pure? |
|---|---|---|---|
| 46–118 | `ApiModule` | World Bank + country-states fetching | no — network |
| 120–1115 | `ModelModule` | **The simulation, KPIs, solvers, invariant checks** | **yes** |
| 1117–2984 | `UI` | Input reading, KPI rendering, charts, tables, CSV, advisor | no — DOM |
| 2986–3667 | controller | `LDC_COUNTRIES`, event wiring, `runCalculation` | no — DOM |

**`ModelModule` is already pure.** INV-12 verifies it: `calculate()` is deterministic and does not mutate its input. That is why `tools/load-model.js` can test it headlessly, and why stage S5's split is a low-risk move rather than a rewrite.

### Data flow

```
  index.html form
        │
        ▼
  UI.getInputs()                    ← ⚠️ silent defaults on missing ids (F-01)
        │                             ⚠️ magnitude-guessing unit heuristics (F-17)
        ▼
  ModelModule.calculate(inputs)     ← pure, deterministic
        │
        ├─▶ month loop  m = 1..duration*12
        │     dual ledger: grantCash | loanCash
        │     cohorts:     hhCohorts | meCohorts
        │
        ├─▶ computeKPIs(series, inputs)
        └─▶ verifyLedger(series, inputs, kpis)   ← ⚠️ gated on a solver flag (F-11)
        │                                          ⚠️ warns to console only (F-29)
        ▼
  { series, kpis }
        │
        ├─▶ UI.updateKPIs()      ← ⚠️ mutates the KPI object (F-14)
        ├─▶ UI.renderCharts()
        └─▶ UI.renderDataTable()
        │
        ▼
  runCalculation(isAutoAdjust)
        └──▶ ⚠️ WRITES BACK into the form and re-enters itself (F-04)
```

**The write-back arrow at the bottom is the architectural defect that matters most.** It makes the data flow a cycle rather than a pipeline: the app can change the inputs it just read, then recompute, up to five times, without telling the user. Everything downstream — reproducibility, A/B comparison, the meaning of an exported CSV — depends on breaking that cycle, which is stage S2.

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
| **Self-verification after every run** | Unusual and valuable. Needs strengthening (F-11, F-12, F-29), not replacing. |
| **Buildless** | Runs anywhere, forever, with no toolchain rot. |

## Design decisions to reverse

| Decision | Problem | Stage |
|---|---|---|
| Controller writes back into inputs | Breaks reproducibility (F-04, F-05) | S2 |
| Renderer mutates the model's output | Non-idempotent; hidden coupling (F-14) | S2 |
| `console.warn` as a reporting channel | Nobody has devtools open (F-29) | S1 |
| One flag controls solvers *and* verification | Disabling one silently disables the other (F-11) | S1 |
| Magnitude-guessing unit heuristics | Two of them, contradictory (F-17) | S1 |
| Unpinned CDN dependency | Non-reproducible; blank charts offline (F-22) | S0 |
| Everything in one file | 3,667 lines, six globals, no boundaries (F-19) | S5 |

---

## Target shape (stage S5)

Split along the seams that already exist. **Move code; do not improve it** — the proof that an S5 refactor was safe is a byte-identical `golden.json`, and a bug fix in the same diff destroys that proof.

```
src/
  model/            ← pure. No document, no window, no Chart. Enforced by test.
    engine.js         the month loop
    portfolio.js      cohorts, annuity, write-downs
    investor.js       senior debt schedule, arrears
    kpis.js           computeKPIs — flat output shape
    solvers.js        break-even, max-grant
    invariants.js     INV-1..INV-14
  ui/
    inputs.js  kpis.js  charts.js  tables.js  export.js  advisor.js
  data/
    worldbank.js  countries.js
  app.js            ← controller and wiring only
```

Rules:

1. `src/model/` must not reference `document`, `window` or `Chart`. A test enforces it; once it holds, `tools/load-model.js` becomes unnecessary and should be deleted.
2. ES modules load natively in every target browser — **no bundler needed**.
3. No file over 500 lines.
4. One directory per commit, `npm test` green after each.

---

## Constraints to design within

| Constraint | Consequence |
|---|---|
| **No backend** | All computation is client-side. Scenario sharing must be a file or a URL fragment, never a server. |
| **Offline capable** | Field use in LDCs. Every asset must be local or cached (F-22 is a live failure here). |
| **No build step** | ES modules only; no JSX, no TypeScript syntax, no transpilation. JSDoc types are fine. |
| **Auditable output** | Every headline number must be traceable to inputs through the CSV export. This is why the audit arrays in `series` exist. |
| **Numbers feed real decisions** | Silent wrongness is the primary risk, not crashes. Guards, invariants and unit discipline outrank features. |

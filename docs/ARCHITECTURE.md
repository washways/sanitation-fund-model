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
           ──▶ app.js  ─────────── one file, ~4,000 lines, six globals
methodology.html         user-facing explainer, standalone
server.js                dev static server
favicon.png
```

`app.js` still contains four concerns with no boundary between them, in this order top to bottom:

| Module | Concern | Pure? |
|---|---|---|
| `ApiModule` | World Bank + country-states fetching | no — network |
| `ModelModule` | **The simulation, KPIs, solvers, invariant checks** — the largest single block | **yes** |
| `UI` | Input reading, KPI rendering, charts, tables, CSV, advisor | no — DOM |
| controller | `LDC_COUNTRIES`, event wiring, `runCalculation` | no — DOM |

Line numbers shift with every fix, so they're not reproduced here — `grep -n "^const ApiModule\|^const ModelModule\|^const UI\|^const LDC_COUNTRIES" app.js` finds the current boundaries in seconds.

**`ModelModule` is already pure.** INV-12 verifies it: `calculate()` is deterministic and does not mutate its input. That is why `tools/load-model.js` can test it headlessly, and why stage S5's split is a low-risk move rather than a rewrite.

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
| Everything in one file | ~4,000 lines, six globals, no boundaries between concerns | S5 |

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
| **Offline capable** | Field use in LDCs. Every asset must be local or cached — Chart.js is vendored for this reason. |
| **No build step** | ES modules only; no JSX, no TypeScript syntax, no transpilation. JSDoc types are fine. |
| **Auditable output** | Every headline number must be traceable to inputs through the CSV export. This is why the audit arrays in `series` exist. |
| **Numbers feed real decisions** | Silent wrongness is the primary risk, not crashes. Guards, invariants and unit discipline outrank features. |

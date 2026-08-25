# Changelog

All notable changes to this project — anything that alters what the model produces, what a user sees, or how the project is worked on. Format loosely follows [Keep a Changelog](https://keepachangelog.com/); versions are dated working sessions, not formal releases (this project is pre-1.0).

**Rules for updating this file:**

1. Add the entry **in the same commit** as the change it describes.
2. If `tests/golden.json` moved, say so and say by how much — a reader needs to know whether their old numbers still stand.
3. Write for someone who was not there. "Fixed carbon" tells nobody anything; "carbon revenue was understated by roughly 250,000x because tonnes were treated as kilograms" does.
4. Link the decision record (`docs/adr/`) and the finding (`docs/ANALYSIS.md`) where one exists.

---

## [0.4.0] — 2026-08-25 — Findings register closed: 37 of 37 resolved

The last item in the findings register (F-27) is fixed, which surfaced one new, unrelated finding (F-37) — fixed in the same change. Nothing remains open in `docs/ANALYSIS.md`. Also fixed the CI matrix, which broke on the previous push.

### Fixed

- **Both solvers (`solveBreakEven`, `solveMaxGrant`) assumed a monotonicity the model does not guarantee.** Binary search converges on a wrong answer, silently, wherever `netAssets` isn't monotone in the swept parameter — measured across several regimes (nearby capital-tight scenarios, high default, grant-heavy/loan-light, and pervasively in the grant-support sweep even at the shipped baseline). Replaced with a grid-then-bisect approach: scan a 13-point grid for the true extremum across the whole range (not the first sign change found scanning one direction — correct regardless of monotonicity or how many feasible pockets exist), then bisect only the one adjacent grid cell. Both solvers now return `{ ok, value, reason }` instead of a bare number, so "no feasible answer exists" is distinguishable from "the answer is zero" — the old `solveMaxGrant` returned `0` for both. Validated to within ~0.1 percentage point against fine-resolution reference sweeps across 10 scenarios. Cost: up to ~47 simulations per recalculation with the solver panel enabled (was 22) — panel is opt-in and off by default, and the existing 500ms input debounce is unchanged. `tests/solver.test.js` added. ([ADR-0032](docs/adr/0032-grid-then-bisect-solvers.md))

- **"Max Sustainable Grant" displayed 100x too small** (found while fixing the above — unpacking the solver's new typed result touched this exact line). It skipped the `*100` conversion the CSV export path already applied: a real 99.9% answer showed on screen as "1.0%". Fixed in the same change. (F-37, [ADR-0032](docs/adr/0032-grid-then-bisect-solvers.md))

- **CI failed on the Node 20.x matrix leg.** `node --test "tests/*.test.js"`'s quoted glob only expands consistently on Node 22.x+; Node 20.x errored with "Could not find". Dropped the explicit glob — `node --test` with no arguments already discovers every `*.test.js` file by default, which is the same 7 files. No behaviour change.

### Added

- `tests/solver.test.js` — pins the typed solver result and the failure-is-not-zero distinction, including two scenarios with genuine non-monotonicity validated against fine-resolution reference sweeps.

---

**Summary:** `npm test` 68 → 75. Findings register 35/36 → 37/37 resolved (one new finding discovered and fixed along the way, same as last session). `golden.json` unchanged — no golden scenario exercises the solvers (`enableBreakEvenSolver: false` by default).

---

## [0.3.0] — 2026-08-21 — Audit closed out: 35 of 36 findings resolved, no open questions

Follow-up to the 2026-08-20 audit. Every remaining finding worth fixing now is fixed; every modelling question the audit raised is decided. One finding remains, deliberately (see below) — nothing is blocked on a decision.

**If you have output from before this date, re-run it.** Several fixes here move real numbers, some substantially — see *Fixed*, below.

### Fixed

- **CSV export was completely broken.** `UI.downloadCSV()` was defined twice; JavaScript ran the second, which threw on every click (it referenced KPI fields removed by an earlier refactor). The first, richer definition — a detailed monthly data table — is now the one that runs, with its own two bugs fixed. `tests/export.test.js` added; nothing tested this before. No model output changed. ([ADR-0026](docs/adr/0026-restore-the-detailed-csv-export.md))

- **The solvency reserve now accounts for debt coming due, not just operating costs.** It held back three months of ops cost but ignored investor principal due the next quarter, and used the ops figure *after* a hibernation cut — so the buffer shrank exactly when the fund was most fragile. Fixed: three months of full ops cost, plus the next three months of scheduled investor principal. **Baseline reach fell ~9%** as a direct, predicted result (fewer toilets, but no scenario's viability changed and minimum cash improved throughout). ([ADR-0027](docs/adr/0027-debt-service-lookahead-reserve.md))

- **Micro-enterprises are now financed for what they actually cost.** Three places in the model each computed "what does one enterprise cost to establish," and disagreed by 7.3x — the fund's own affordability check used the realistic figure (setup cost + working capital), but the loan it actually booked used setup cost alone. One function, `ModelModule.meCapitalRequirement()`, now used everywhere. **This is the largest single reach reduction in the project's history** (baseline toilets -19.5%, micro-enterprises -68.3%) and it flips one standard scenario (`with cost of capital`) from viable to insolvent — evidence the model was previously overstating viability wherever cost of capital bites. ([ADR-0031](docs/adr/0031-unify-me-capital-requirement.md))

- **`computeKPIs` no longer mutates itself on every render.** It returned a shape the renderer then destructured and overwrote in place — not idempotent, and callers only worked because a render had already run first. It now returns one flat, documented object directly. No model output changed. ([ADR-0028](docs/adr/0028-flatten-computekpis.md))

- **The realised-loss test for write-downs was missing.** Added (`tests/writedown.test.js`), which surfaced a documentation error in the process: the spec claimed realised loss on a written-down loan is "always less than the headline rate," which is only true below about 18 months — corrected with a measured table. No code changed.

### Changed

- **Grant Support % relabelled "Grant-Funded Pacing (% of Production)"**, with a live note showing when the grant fund runs out at the current pace. It was never a volume control — an 18x sweep of the old field moved total grant-funded output under 4% — but the label implied otherwise. UI-only; no model output changed. ([ADR-0029](docs/adr/0029-grant-support-relabel-and-runway.md))
- **The 30% value-of-time factor is now an explicit, documented convention** rather than an indefinitely open question — the model owner confirmed it's acceptable as a working default. The existing "confirm before publishing" caveat is unchanged. ([ADR-0030](docs/adr/0030-accept-30-percent-time-value-factor.md))
- **Toilet service life now gates health and time-saved benefits, not just carbon credit.** A retired toilet no longer averts disease or saves time in the model. No effect at the shipped 5-year default duration. ([ADR-0025](docs/adr/0025-service-life-gates-all-impact.md))
- Four smaller modelling questions resolved by keeping current behaviour, each recorded rather than left implicit: grant support stays a flat share of production, not means-tested ([ADR-0021](docs/adr/0021-grant-support-stays-flat-rate.md)); the grant and loan ledgers stay strictly separate ([ADR-0022](docs/adr/0022-ledgers-stay-separate.md)); one household gets one toilet, no repeat demand ([ADR-0023](docs/adr/0023-no-repeat-or-upgrade-demand.md)); the collections floor stops abruptly at wind-up rather than tapering ([ADR-0024](docs/adr/0024-collections-floor-stays-abrupt.md)).

### Added

- **ESLint** (3 rules: `no-dupe-keys`, `no-undef`, `no-unused-vars`) and **CI** (GitHub Actions, Node 20 & 22, runs on every push/PR). The project's first devDependency — scoped so nothing it depends on ships to the browser. ([ADR-0020](docs/adr/0020-eslint-is-a-devdependency.md))
- **`meExpansionBudgetShare`** and **`meMaxMonthlyGrowthRate`** inputs, replacing two hardcoded growth constants. Defaults unchanged, no behaviour change. ([ADR-0019](docs/adr/0019-expose-me-growth-constants.md))
- Three new test suites/checks: CSV export (`tests/export.test.js`), realised-loss pinning (`tests/writedown.test.js`), and a handful of new ledger invariants (INV-15 through INV-18) covering service-life gating, the debt-service reserve, grant-fund pacing, and ME capital consistency.

### Fixed (documentation)

The project's own status pages had drifted from the code and from each other — stale finding checkmarks, a stale baseline table, descriptions of already-fixed defects presented as current. All of `README.md`, `STATUS.md`, `docs/ANALYSIS.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/MODEL_SPEC.md`, `docs/PARAMETERS.md` and `docs/TESTING.md` reconciled against the actual code and test output.

---

**Summary:** `npm test` 53 → 68. Findings register 18/34 → 35/36 resolved (two new findings were discovered and fixed along the way). Every modelling question raised by the original audit is now decided. `golden.json` re-recorded twice, each time preceded by a measured prediction in the relevant ADR — see `docs/adr/0027` and `docs/adr/0031` for the two behaviour-changing fixes' full reasoning and measurements.

---

## [0.2.0] — 2026-08-20 — Initial audit and correction

The model was audited end to end against its own behaviour, a regression suite was built from nothing, and 18 of the 34 findings raised were fixed the same day. **Numbers produced before this date should be re-run**, and rate inputs re-entered rather than copied (see *Changed*, below).

### Fixed

- **The fund never charged itself the cost of its own senior debt.** `fundCostOfCapital` was read by the model but had no control in the form, so it silently defaulted to zero — every result the tool had ever produced omitted investor interest. Control added, defaults to 2% concessional. ([ADR-0004](docs/adr/0004-cost-of-capital-input.md))
- **A failing fund was reported as verified.** The tool printed "Model Integrity Verified" for its own demonstration scenario — a fund insolvent from year four, in default on 18.7% of its senior loan. Integrity (is the arithmetic sound) and viability (does the fund work) are now separate verdicts, both shown on screen. ([ADR-0008](docs/adr/0008-integrity-versus-viability.md))
- **Carbon revenue was understated by roughly 250,000×** — a stacked unit error (kilograms instead of tonnes, a percentage divided twice, credited once instead of annually). ([ADR-0005](docs/adr/0005-carbon-units-and-accrual.md))
- **The simulation billed operating costs against funds that had already collapsed**, for the rest of whatever horizon was requested. Funds now wind up when there's nothing left to do. ([ADR-0006](docs/adr/0006-wind-up-terminal-state.md))
- **The app rewrote the user's inputs while calculating** — Grant Support % silently cut up to five times per click, interest rates overwritten a second after page load. Nothing writes back to an input now; suggestions are offered, not applied. ([ADR-0009](docs/adr/0009-advisory-not-automatic.md))
- **Grace periods forgave investor interest** rather than deferring it, and arrears vanished instead of capitalising into the liability. ([ADR-0007](docs/adr/0007-investor-arrears-and-grace.md))
- **Two incompatible "hours saved" formulas** disagreed by 4.39x; the KPI layer used the wrong one.
- **Population growth was collected and never used**, so the model showed a fund closing a gap that was actually widening.
- **Micro-enterprises were immortal** — a 50% write-down rate left production capacity completely untouched. Business closure is now a separate parameter from loan write-down. ([ADR-0014](docs/adr/0014-me-attrition-is-separate-from-write-down.md))
- **The startup scenario was insolvent** — the country-data fetch overwrote the concessional cost of capital with the market commercial lending rate. The fetch now never overwrites a negotiated term. ([ADR-0018](docs/adr/0018-fetch-does-not-set-negotiated-terms.md))
- A 0% interest rate corrupted the ledger with `NaN`, invisibly, because `NaN` comparisons are always false and it passed every check.
- Dev server served arbitrary paths and lied about 404s; hardened.
- Several smaller defects: a dead advisor branch, duplicate object keys, dead wizard code, a doubled currency symbol in exports.

### Changed

- **Rates are entered as percentages** — type `40`, not `0.40`. The form used to teach both conventions at once; any rate above 100% was silently divided by 100. **Rate inputs from before this date must be re-entered, not copied.** ([ADR-0012](docs/adr/0012-percentage-entry-convention.md))
- **SROI redefined as social value only** — DALYs included (previously computed, shown, then silently excluded), ending cash removed (a fund that hoarded capital and built nothing used to score well), hourly value derived from local income rather than an uncited constant. **Not comparable to earlier SROI figures.** ([ADR-0011](docs/adr/0011-sroi-is-social-value-only.md), [ADR-0015](docs/adr/0015-value-of-saved-time.md))
- **The demonstration scenario redesigned to actually work** — repays its investor in full, stays solvent. Chosen by a grid search over five levers, stress-tested against six shocks. ([ADR-0013](docs/adr/0013-viable-default-scenario.md))
- **Solvency advice is model-tested**, not rule-of-thumb — each suggestion is scored by re-running the simulation.
- Chart.js pinned to an exact version with an integrity hash, vendored locally for offline use.
- Country selector now lists all countries in a real `<select>`, not a single-entry datalist.

### Added

- Carbon crediting life, ME annual closure rate, value of saved time, hours saved per person per day, fund cost of capital — all previously hardcoded or missing controls.
- The regression suite itself: input wiring, ledger invariants, characterisation scenarios, an application smoke test, and a startup test — 53 tests, zero dependencies, from nothing.
- The documentation set this changelog is part of: model specification, audit register, roadmap, parameter dictionary, testing guide, architecture note, decision records, and a working contract for AI agents.

---

## [0.1.0] — before 2026-08-20 — Pre-audit baseline

No changelog was kept. The git history contains 15 commits, 8 of them single-error hotfixes found by users in a browser rather than by a test — the pattern the regression suite (added in 0.2.0) exists to end.

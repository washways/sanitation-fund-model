# CLAUDE.md

**Read [AGENTS.md](AGENTS.md) in full.** It is the working contract. This file is a compact memory map, not a replacement.

## Start every session

```bash
export PATH="/c/Users/jrobertson/Repositories/node-v25.8.1-win-x64:$PATH"
cat STATUS.md
npm test
```

If the baseline is red, stop. Never re-record `tests/golden.json` unless an accepted ADR predicted the movement. The maths in [docs/MODEL_SPEC.md](docs/MODEL_SPEC.md) outranks the code; `[OPEN]` means ask, never implement.

## Stage memory

| Stage | What changed | What must remain true |
|---|---|---|
| S0 — safety net | Added package scripts, headless loading, invariants, golden scenarios, and the findings register. | A behavior move is visible in `golden:diff`; tests never fetch live data. |
| S1 — silent wrongness | Added the missing cost-of-capital control; fixed carbon units/share/accrual, 0% annuity NaNs, duplicate keys, and verification gating/opening reconciliation. | Test finiteness before arithmetic comparisons. Integrity and viability are separate verdicts. |
| S2 — user control | Removed calculation-time write-backs and broken wizard paths; made country selection usable; restored CSV export; added the startup test after discovering the fetch changed the real scenario. | Controller reads → calculates → renders. Suggestions never mutate inputs. Test the post-fetch startup state. |
| S3 — model correctness | Corrected arrears/grace accounting, demand growth, SROI, time value, ME attrition, service-life gating, terminal wind-up, reserves, ME capital requirements, and parameter units. | Grant and loan ledgers stay separate. A dead fund stops costing money. One unit convention at the boundary. |
| S4 — decision support (partial) | Replaced monotonic binary-search assumptions with grid-then-bisect typed solver results. | Solver failure is not the numeric answer zero. Caching, sensitivity, and scenario comparison remain open. |
| S5 — structure | Split the 4,028-line app into `src/model/`, `src/ui/`, `src/data/`, and the controller, with byte-identical goldens. | `src/model/` is pure and DOM-free. `tools/app-source.js` and `index.html` load order must match. |
| Post-S5 audit — 2026-10-20 | Recalibrated Malawi defaults from primary evidence; restricted country loading to dated observations; stopped local CPI, commercial lending, poverty, governance, and third-party district data from silently setting programme assumptions; honored explicit 0% write-downs; corrected demand recurrence order. | API data writes only target population, population growth, and income. Missing essentials clear fields and pause. DALYs/carbon default to zero without evidence. |
| S6 debt robustness — 2026-10-21 | Completed capitalised-interest catch-up and terminal senior settlement; added direct waterfall tests and liability reconciliation. | Pay old capitalised interest, then current interest, then original principal. At wind-up use loan cash only, never grant cash; freeze after the terminal transfer. INV-20/21 must remain green. |
| S6 input boundary — 2026-10-21 | Added pure fail-fast validation and one combined browser message; blank fields no longer restore hidden defaults, and failed reruns clear stale results. | Invalid inputs never enter month 1. Preserve `NaN` from blank/malformed fields until validation; never clamp, silently fall back, or add unsupported policy caps. |
| S6 export integrity — 2026-10-21 | Bound CSV/clipboard reports to each successful run's input snapshot and canonical liability/leverage KPIs. | Exports never reread the live form or reconstruct a KPI. Add a canonical model/KPI field first, then report it. |
| S6 advice integrity — 2026-10-21 | Removed the legacy rule-of-thumb advisor and routed the visible control through current-scenario recalculation plus model-tested options. | One advice path only. Every recommendation must carry a simulated result; never label deterministic rules as AI or suggest an untested lever. |
| S6 reporting integrity — 2026-10-21 | Added the exact monthly ME-launch series and realigned the implementation table's count/value headings. | `New MEs` comes from `dataMonthlyNewMes`; never reconstruct it from loan value or setup cost. Every row must match the header width. |
| S6 zero-input fidelity — 2026-10-21 | Removed the `mePerDistrict || 20` fallback that turned an explicit zero-capacity stress into the default Malawi network. | After `validateInputs()`, use supplied values directly. Never use truthiness to default a numeric input for which zero is valid. |
| S6 chart integrity — 2026-10-21 | Corrected annual grant bars that differenced yearly flows and created fictitious positive income. The smoke harness now captures Chart.js configs. | `dataGrants` is an annual flow: negate once. Reconcile chart datasets to canonical model series rather than inferring their semantics from comments. |
| S6 partial-period reporting — 2026-10-21 | Added one canonical annual-period recorder for complete years and the final partial year; sub-year scenarios now render charts. | Duration is month-granular. Never drop months after the last 12-month boundary; label partial periods explicitly and reconcile them to monthly series. |
| S4 constraint reporting — 2026-10-21 | Resolved R-7.6/Q14: monthly and headline constraints now derive from actual foregone production, retain mixed causes, and expose grant and loan capital separately. | `capacity + loanCapital` must reconcile demand to production. Grant-capital recovery overlaps loan-capital loss and must never be added to that partition. Viability remains a separate verdict. |
| S4 sensitivity — 2026-10-21 | Added a pure, deterministic one-at-a-time engine and JSON CLI for up to eight evidence-bounded parameters. | Every low/high pair must bracket base, pass normal validation, and carry a source. Never add built-in generic shocks, undocumented country ranges, timestamps, network fetches, or mutation. |

The detailed reasons and measured changes live in [CHANGELOG.md](CHANGELOG.md) and [docs/adr/](docs/adr/). Never edit an accepted ADR; supersede it.

## Current Malawi reference scenario

- Observed/default context: 9,244,139 rural people without basic sanitation, 2.56% population growth, $600 GNI per capita.
- Evidence-backed programme references: 4.4 people/household, 28 districts, $100 toilet planning cost, $3,000 enterprise capital, 12-month household and enterprise terms, 0.25 hours saved/person/day, 50% time-value factor.
- Unsupported health and carbon claims are off: DALYs/person = 0, DALY value = 0, CO2e/toilet = 0.
- Financing rates, write-downs, operating costs, capacity/productivity, contingency, and grant pacing are illustrative editable assumptions — not facts about Malawi and never country-derived.
- The model is USD-labelled. `inflationRate` means forward cost escalation in the model currency; local CPI is display-only without an FX path.

## Country-data contract

`src/data/worldbank.js` uses `mrnev=1` and retains indicator labels and years. It supplies only:

1. `popReqToilets` from rural population × the basic-sanitation gap;
2. `popGrowthRate`;
3. `avgAnnualIncome` from GNI per capita, with GDP per capita fallback.

CPI, commercial lending, poverty, Gini, and sanitation levels are context. Do not resurrect `countriesnow.space`, `PV.EST` heuristics, smart-rate formulas, poverty-to-grant mappings, cost tiers, or cross-country operating-cost formulas.

## Owner decisions — 2026-10-21

- R-7.6/Q14 is closed by [ADR-0044](docs/adr/0044-report-actual-production-constraints.md): rank actual foregone monthly output, show secondary causes, and use `Mixed` when constraints apply together.
- Sensitivity is evidence-bounded one-at-a-time analysis, implemented in [ADR-0045](docs/adr/0045-require-evidence-bounded-sensitivity.md). A bound must come from a documented source or explicit user input; never invent one uniform percentage shock.
- Keep the adverse 20-year Malawi result visible as a stress finding. Do not tune assumptions merely to force long-run viability.
- Keep the engine explicitly USD-only for now. Any later local-currency display needs dated user-supplied conversion logic and an ADR; never apply a live spot rate to the whole multi-year path.
- After sensitivity analysis, prioritize transparent JSON scenario save/load/compare before board-paper PDF or offline/mobile expansion.

## Known review traps

- A browser keeps every event listener. The startup DOM stub must do the same; a one-listener stub once hid a real 75% poverty-to-grant overwrite.
- `0` is a valid rate. Use nullish/presence checks, not `x || default`.
- Demand recurrence is grow carried backlog, then subtract current production. INV-19 pins it through `dataMonthlyBacklog`.
- Constraint reporting is production diagnostics, not viability. Do not restore the old ending-cash/insolvency heuristic or collapse secondary causes into one forced label.
- Sensitivity specifications are data provenance. Do not silently fill a missing source or range, and do not treat the synthetic test fixture as a Malawi assumption.
- Senior debt must reconcile as initial principal − principal repaid + interest capitalised − capitalised interest repaid. INV-20 pins this identity.
- Wind-up accelerates original principal and applies positive loan-ledger cash before freezing. The grant ledger remains ring-fenced. INV-21 pins this rule.
- `ModelModule.validateInputs()` owns structural validation. It rejects invalid scenarios before allocation; the UI must surface every field together and clear `UI.lastResults` on failure. Do not turn validation into an assumptions engine.
- `UI.lastResults.inputs` is the reporting provenance for a successful run. Exporting current DOM values can silently combine one scenario's assumptions with another scenario's results.
- `ModelModule.suggestSolvencyFix()` is the only financial-advice engine. The visible button calls `runCalculation(true)`; do not recreate `UI.generateSuggestions()` or rule-of-thumb recommendations.
- The monthly ME loan includes setup plus working capital. Use `series.dataMonthlyNewMes` for launch counts; dividing by `meSetupCost` overstates them and shifts reporting logic outside the model.
- `mePerDistrict = 0` is valid and means no enterprise network. The pure model has no hidden default after validation; use nullish/presence logic only at boundaries where absence is actually permitted.
- `series.dataGrants` contains yearly spending, not a cumulative balance. Annual cash-flow outflows are negative; declining spend must never become positive income.
- A valid duration may be any whole number of months. Annual reporting must include a labelled final partial period; a duration below one year must not produce an empty `series.labels` array.

This model informs funding decisions. A plausible wrong number is worse than an obvious crash.

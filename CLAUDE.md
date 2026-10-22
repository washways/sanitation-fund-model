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
| Post-S5 audit — 2026-10-20 | Recalibrated Malawi defaults from primary evidence; restricted country loading to dated observations; stopped local CPI, commercial lending, poverty, governance, and third-party district data from silently setting programme assumptions; honored explicit 0% write-downs; corrected demand recurrence order. | APIs write only target population, population growth, income, and the transparent DALY derivation added later. Missing essentials clear fields and pause; missing optional health evidence resets to not estimated. Carbon remains off without project evidence. |
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
| S6 country provenance — 2026-10-21 | Gave country-derived model inputs one blue, dated source state and made real user edits clear it. | Only `popReqToilets`, `popGrowthRate`, `avgAnnualIncome`, and `dalyPerPerson` may receive `country-observation`. Programme assumptions never do; extend the startup regression if the API boundary changes. |
| S3 rollout realism — 2026-10-21 | Replaced the cash-maximising month-zero cohort with an explicit 15% pilot share of the target ME network. | Opening enterprises are `min(target share, affordable, network cap)`. The pilot share is a visible programme assumption, never country-derived; zero must seed no hidden cohort. |
| S6 responsive results — 2026-10-21 | Replaced the fixed three-column programme summary and global no-wrap cells with an adaptive grid and scoped monthly-table scrolling. | Compact summary cards must wrap and fit the main panel. Only `#monthlyDataTable` may retain wide no-wrap cells inside its local scroll container. |
| S3 impact evidence — 2026-10-21 | Made jobs per active enterprise explicit, derived a conservative sanitation-burden proxy from WHO plus matching-year World Bank exposure, applied an explicit intervention-effect assumption, and relabelled zero carbon as not estimated. | Jobs are point-in-time jobs supported, not job-years. Never treat 100% of attributable burden as averted: apply the editable `dalyImpactRealisation` factor (21% interim basic non-sewered sanitation estimate). DALY value stays zero unless separately evidenced. Carbon needs a project baseline/technology factor. |
| S6 assumption context — 2026-10-21 | Put dated commercial lending and CPI context beside the financial assumptions they inform, and marked those controls amber. | Blue means API-derived value; amber means programme assumption. Never auto-fill HH/ME APRs from commercial lending, fixed operations from a macro heuristic, or USD escalation from local CPI without an FX and cost-basket forecast. |
| S6 cross-country robustness — 2026-10-21 | Made the live country audit run the full model with browser-equivalent derived observations for all selector countries; added a 384-case deterministic parameter grid. | Keep live API checks outside CI, but keep derivation logic pure and regression-tested. `npm run audit:countries` must validate and calculate, not merely count observations. |
| S6 monthly-table containment — 2026-10-22 | Gave the 22-column monthly audit table an auto-height card, bounded two-axis viewport, and sticky headings. | Never place the monthly table back inside the generic fixed-height chart contract. Preserve the month-level audit trail and contain it locally rather than clipping or shortening it. |
| S6 model transparency — 2026-10-22 | Added an on-site five-step model map, decision-use calibration checklist, and numeric-input documentation coverage. Removed claims the engine does not support. | Describe dated observations as evidence, not real-time forecasts. The model has no price-elastic demand, is not double-entry accounting, and cannot guarantee repayment. Keep all numeric UI inputs documented in `PARAMETERS.md`. |
| S6 scorecard integrity — 2026-10-22 | Bound Grant Equity Multiple, Capital Preservation, OSS, and FSS directly to canonical KPI fields and removed the unused competing summary renderer. | Grant equity is an `x` multiple; capital preservation is net assets / all initial capital; OSS excludes write-downs and finance cost; FSS includes them. Investor repayment never includes grant cash. |
| S6 need-versus-demand honesty — 2026-10-22 | Relabelled API sanitation need, the target backlog, and reach reporting so none imply observed borrower uptake or complete SDG 6 closure. | `popReqToilets` is rural population without basic sanitation: a maximum target under sufficient uptake. The model does not forecast willingness, affordability, eligibility, product choice, or adoption. Never invent an uptake rate from geographic coverage. |

The detailed reasons and measured changes live in [CHANGELOG.md](CHANGELOG.md) and [docs/adr/](docs/adr/). Never edit an accepted ADR; supersede it.

## Current Malawi reference scenario

- Observed/default context: 9,244,139 rural people without basic sanitation, 2.56% population growth, $600 GNI per capita.
- Evidence-backed programme references: 4.4 people/household, 28 districts, $100 toilet planning cost, $3,000 enterprise capital, 12-month household and enterprise terms, 0.25 hours saved/person/day, 50% time-value factor.
- Country loading derives 0.0096719 sanitation-attributable burden DALY per exposed person-year for Malawi 2019 from the WHO lower bound and matching World Bank exposure. The separate 21% `dalyImpactRealisation` programme assumption scales this to about 2,139 DALYs averted over five years. DALY value remains 0, so SROI does not silently monetise it. CO2e/toilet remains 0 and is displayed as not estimated pending project evidence.
- Jobs supported use an explicit three-per-active-enterprise Malawi reference (one owner/operator plus two FTE workers). This is editable and is not a country observation.
- Financing rates, write-downs, operating costs, capacity/productivity, contingency, and grant pacing are illustrative editable assumptions — not facts about Malawi and never country-derived.
- The opening ME cohort is an illustrative 15% of the target network: 84 enterprises in Malawi,
  capped by available loan capital. It scales through the separate monthly growth controls.
- The model is USD-labelled. `inflationRate` means forward cost escalation in the model currency; local CPI is display-only without an FX path.

## Country-data contract

`src/data/worldbank.js` uses `mrnev=1` and retains indicator labels and years. `src/data/who.js` selects the latest both-sex/all-age record with a valid lower uncertainty bound. Together they supply only:

1. `popReqToilets` from rural population × the basic-sanitation gap;
2. `popGrowthRate`;
3. `avgAnnualIncome` from GNI per capita, with GDP per capita fallback.
4. `dalyPerPerson`, a burden proxy from the WHO `WSH_30_SAN` lower bound divided by matching-year World Bank total population without basic sanitation. The separate `dalyImpactRealisation` assumption is never API-filled.

CPI, commercial lending, poverty, Gini, and sanitation levels are context. Do not resurrect `countriesnow.space`, `PV.EST` heuristics, smart-rate formulas, poverty-to-grant mappings, cost tiers, or cross-country operating-cost formulas.

Commercial lending must be shown beside HH and ME rates with its observation year, not applied to
them. Local CPI must be shown beside model-currency escalation with its year and USD/FX warning.
Annual fixed operations must request the actual programme budget; no country macro API derives it.
These four controls use amber `programme-assumption`, never blue `country-observation`.

`tools/country-runtime-audit.js` mirrors the browser's exact conversion rules and is pure enough for CI. `npm run audit:countries` uses it to run the full model against every complete current country observation set; as of 2026-10-21 all 44 pass validation and ledger integrity. `tests/robustness-audit.test.js` also holds a fixed-seed 384-case parameter grid. Do not replace either with random, network-dependent CI behavior.

After loading, all four model-driving country fields use the blue `country-observation` state and
carry a source description. Trusted user input removes that state. Do not use `auto-filled`, inline
background colours, or the obsolete `api-field` class to represent API provenance. Missing health
evidence resets the optional rate to zero/not estimated; never retain the previous country.

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

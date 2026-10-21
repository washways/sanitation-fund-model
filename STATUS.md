# STATUS

**Read this first. Update it last.** This is the current snapshot; history is in [CHANGELOG.md](CHANGELOG.md), the on-site [changelog](changelog.html), and [docs/adr/](docs/adr/).

## Current state

| | |
|---|---|
| **Release** | 0.18.1 — responsive programme summary |
| **Stages complete** | S0, S1, S2, S3, S5; S3 rollout realism complete; S4 solvers, constraint reporting and sensitivity complete; S6 country-input provenance and responsive results complete; caching/scenario comparison and remaining S6 work remain |
| **Tests** | ✅ 116 pass, 0 todo, 0 fail (`npm test`, ~4s) |
| **Lint** | ✅ ESLint, 0 errors and 0 warnings |
| **Goldens** | ✅ 21 scenarios current (`npm run golden:diff` → “No behaviour change”) |
| **Country audit** | ✅ 44/44 selector countries have current essential observations; returned values pass semantic ranges (`npm run audit:countries`) |
| **Findings register** | ✅ 55 of 55 resolved |
| **Open modelling questions** | None — all 14 owner decisions are recorded |

## What remains unresolved

| What | Why it matters | Recommended next action |
|---|---|---|
| Solver caching and scenario save/load/compare | S4 items 2 and 4 remain. | Build transparent JSON scenario comparison next; add caching when the browser exposes repeated analysis runs. |
| Real-browser chart/advisor click-through | Headless tests cover startup, calculation, export, and wiring, but not visual chart interaction. | Add a browser smoke pass during S6 accessibility/mobile work. |

## Malawi reference run

Static defaults and the recorded post-fetch Malawi startup now agree on the model-driving observations. Country loading no longer changes programme assumptions.

| Measure | Current result |
|---|---:|
| Toilets built | 83,350 |
| People reached | 366,740 (~4.0% of the target population) |
| Micro-enterprises at horizon | 267 |
| Ending / minimum cash | +$17,842 |
| Net assets | +$176,782 |
| Senior debt | Repaid in full |
| OSS / FSS | 1.65 / 1.06 |
| SROI | 2.73 (time value only by default; unsupported DALY and carbon inputs are zero) |
| Production constraints | ME capacity primary; loan and grant capital secondary |
| Verdict | Integrity OK; viability OK |

The 20-year stress scenario is **not viable** under the same assumptions: it winds up in month 101 after 86,076 toilets and ends with -$11,038 net assets. This is accepted and disclosed rather than hidden by inventing a higher portfolio rate or lower operating cost. The sourced 12-month Malawi household term turns capital faster but earns less interest per loan, so the illustrative 40% portfolio rate does not sustain indefinite operations.

## Assumptions and country data

- World Bank loading writes only target population, population growth, and GNI per capita (GDP fallback), using latest non-empty observations with dates.
- Those three fields share a blue `country-observation` state after loading; each records direct/derived provenance and observation year(s), and a real user edit removes the marker.
- CPI, commercial lending, poverty, Gini, and sanitation coverage are context only.
- Missing essential observations clear the field and pause automatic calculation; another country's value is never retained.
- Malawi references are documented in [docs/PARAMETERS.md](docs/PARAMETERS.md): 4.4 people/household, 28 districts, $100 toilet planning cost, $3,000 enterprise capital, 12-month loan terms, 0.25 hours saved/day, and a 50% time-value factor.
- Financing, operating, write-down, capacity, contingency, and grant-pacing defaults remain illustrative programme assumptions. They must be calibrated before an investment decision.
- The opening enterprise network is an explicit 15% pilot share: 84 of Malawi's 560-enterprise target, capped by available loan capital. It is not an observed country value and must be replaced with the recruitment plan.
- The engine remains explicitly USD-only. Do not apply a live spot rate to multi-year cashflows; a later dated, user-supplied reporting conversion needs an ADR.
- The adverse 20-year Malawi result stays visible as a stress finding. Assumptions will not be tuned merely to force viability.

## Production-constraint contract

- Monthly constraint reporting is calculated after final grant and loan allocations, from the same quantities that determine actual output.
- Capacity loss plus loan-capital loss reconciles whole-toilet demand to production. Grant-capital recovery overlaps the loan-capital loss and must not be added to it.
- The horizon headline ranks summed foregone monthly output, lists secondary causes, and uses `Mixed` when multiple causes suppress a month. It does not substitute insolvency for a production bottleneck; viability remains separate.
- Q14 / R-7.6 is resolved by [ADR-0044](docs/adr/0044-report-actual-production-constraints.md), with three dedicated regressions.

## Enterprise-rollout contract

- `initialMeNetworkShare` sets the month-zero pilot as a share of `districts * mePerDistrict`; the affordable cohort and network ceiling remain hard caps.
- The 15% interim default starts 84 Malawi enterprises, records about $7,603 of month-one enterprise interest, and grows through the separate monthly expansion controls.
- The former `opsReserveCap` / `Starting Capacity Throttle` is removed. It was a one-use cross-ledger holdback, not a liquidity reserve.
- A positive share uses `ceil` to seed small networks; explicit zero starts no enterprise and cannot create hidden percentage growth. See [ADR-0047](docs/adr/0047-start-with-a-pilot-enterprise-network.md).

## Sensitivity contract

- `ModelModule.runSensitivity()` accepts one to eight unique numeric inputs with explicit low/high values and a non-empty provenance source for each.
- Bounds must bracket the base case and every scenario must pass the normal input validator. Invalid or undocumented specifications return typed errors and no partial sensitivity result.
- The baseline runs once; each distinct low/high case runs once. Output is deterministic JSON with net assets, ending/minimum cash, toilets, senior repayment, SROI, and viability, ranked by the selected metric swing.
- There are no built-in generic shocks or undocumented Malawi ranges. `tests/fixtures/sensitivity-bounds-test.json` is synthetic and test-only.
- Run `npm run sensitivity -- <bounds.json> [inputs.json]`. The CLI reads only project-contained files and performs no network fetch. See [ADR-0045](docs/adr/0045-require-evidence-bounded-sensitivity.md).

## Country-input provenance contract

- `popReqToilets`, `popGrowthRate`, and `avgAnnualIncome` are the only model inputs written by country loading and the only controls that receive `country-observation`.
- The target population description names its rural-population/basic-sanitation derivation; growth and income name their direct observation year.
- Programmatic load events retain the World Bank marker. A trusted user edit clears it and records user provenance.
- Programme rates, costs, losses, capacity, contingency, and subsidy settings never receive the marker. See [ADR-0046](docs/adr/0046-mark-country-derived-inputs-consistently.md).

## Investor debt contract

- Debt service pays old capitalised interest, current interest, then original principal.
- Paying old interest reduces both outstanding interest arrears and the senior liability; cumulative capitalisation and later cures remain separately auditable.
- In the wind-up month, remaining original principal accelerates and positive loan-ledger cash is paid before the ledger freezes. Grant cash remains ring-fenced.
- INV-20 reconciles the liability; INV-21 prevents stranded terminal loan cash. See [ADR-0036](docs/adr/0036-complete-investor-debt-waterfall.md).

## Input contract

- `ModelModule.calculate()` validates every numeric input before allocating arrays or running month 1.
- Blank and malformed form values remain invalid; they never restore a hidden fallback.
- A failed browser rerun reports all detected fields together, clears the prior result, and leaves no scenario available for export or advice.
- Bounds are mathematical or definitional only. Do not add unsupported policy caps. See [ADR-0037](docs/adr/0037-fail-fast-input-validation.md).
- Valid zero values remain zero. In particular, `mePerDistrict = 0` disables the delivery network; the model must not restore a default after validation. See [ADR-0041](docs/adr/0041-honor-zero-enterprise-capacity.md).

## Export contract

- Every successful run retains the input snapshot that produced it; exports never reread a possibly edited form.
- Clipboard liability and leverage come directly from their canonical KPIs. Do not reconstruct model measures inside export code.
- The stressed export regression catches the former $1.328m liability understatement. See [ADR-0038](docs/adr/0038-export-the-calculated-scenario.md).

## Advice contract

- The visible control recalculates the current form and uses `ModelModule.suggestSolvencyFix()`.
- Every displayed option has a measured repayment and reach result from a one-at-a-time model rerun.
- No parallel rule-of-thumb advisor, modal advice, automatic input change, or “AI” claim. See [ADR-0039](docs/adr/0039-one-model-tested-advice-path.md).

## Monthly reporting contract

- `series.dataMonthlyNewMes` is the canonical count of enterprises launched inside each simulated month.
- `New MEs` is a count; `New ME Loans` is the working-capital-inclusive currency amount. Do not infer one from setup cost alone.
- Every monthly implementation row has exactly the same number of cells as its header. The render-path regression pins both alignment and the count/value reconciliation. See [ADR-0040](docs/adr/0040-report-exact-me-launches.md).

## Chart reporting contract

- `series.dataGrants` contains annual flows, not cumulative balances. The annual cash-flow chart negates each value once and never differences adjacent years.
- Chart inflows are positive and outflows are negative. The smoke harness captures the Chart.js configuration and reconciles the `Grants` dataset to the engine series. See [ADR-0042](docs/adr/0042-chart-annual-grants-as-flows.md).
- Month-granular horizons always retain a final partial reporting period, labelled with its month count. A sub-year scenario must still render charts. See [ADR-0043](docs/adr/0043-report-final-partial-year.md).
- Programme-summary cards use an auto-fitting grid and wrapping cells. Only the 22-column monthly audit table retains no-wrap cells, contained by its own horizontal scroller. See [ADR-0048](docs/adr/0048-fit-programme-summary-to-viewport.md).

## Environment

Node is not on `PATH` on the maintainer's machine:

```bash
export PATH="/c/Users/jrobertson/Repositories/node-v25.8.1-win-x64:$PATH"
npm test
npm run lint
npm run golden:diff
npm run audit:countries       # live, read-only; not a CI test
node tools/verify-findings.js
```

Run the app with `python -m http.server 8080` or `npm run serve`. `file://` works, but browsers may block World Bank calls from local files.

## Latest activity

On 2026-10-21 release 0.18.1 fixed programme-summary overflow under [ADR-0048](docs/adr/0048-fit-programme-summary-to-viewport.md). The three cards now reflow to the available width and wrap their contents; only the 22-column monthly audit table scrolls horizontally inside its own container. Model outputs and all 21 golden scenarios are unchanged. The suite now has 116 passing tests. Country-derived health estimates and the jobs/carbon impact displays are the next active assumptions review. The on-site [changelog](changelog.html) gives users the release history and remaining limitations as simple bullets.

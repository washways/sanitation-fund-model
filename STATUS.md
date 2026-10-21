# STATUS

**Read this first. Update it last.** This is the current snapshot; history is in [CHANGELOG.md](CHANGELOG.md), the on-site [changelog](changelog.html), and [docs/adr/](docs/adr/).

## Current state

| | |
|---|---|
| **Release** | 0.19.2 — cross-country and parameter robustness audit |
| **Stages complete** | S0, S1, S2, S3, S5; S3 rollout realism complete; S4 solvers, constraint reporting and sensitivity complete; S6 country-input provenance and responsive results complete; caching/scenario comparison and remaining S6 work remain |
| **Tests** | ✅ 126 pass, 0 todo, 0 fail (`npm test`, ~2s) |
| **Lint** | ✅ ESLint, 0 errors and 0 warnings |
| **Goldens** | ✅ 21 scenarios current (`npm run golden:diff` → “No behaviour change”) |
| **Country audit** | ✅ 44/44 selector countries have current essential observations and complete a full integrity-clean run; conservative sanitation DALYs derive for 42/44 (`npm run audit:countries`, `npm run audit:impact`) |
| **Findings register** | ✅ 60 of 60 resolved |
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
| Physical DALYs averted | ~2,139 after the Malawi country load; WHO/World Bank lower-bound burden × explicit 21% health effect |
| Jobs supported | 801 at horizon (267 active enterprises × explicit assumption of 3) |
| Carbon | Not estimated — a project baseline/technology factor is required |
| SROI | 2.73 (time value only by default; DALY value and carbon factor remain zero) |
| Production constraints | ME capacity primary; loan and grant capital secondary |
| Verdict | Integrity OK; viability OK |

The 20-year stress scenario is **not viable** under the same assumptions: it winds up in month 101 after 86,076 toilets and ends with -$11,038 net assets. This is accepted and disclosed rather than hidden by inventing a higher portfolio rate or lower operating cost. The sourced 12-month Malawi household term turns capital faster but earns less interest per loan, so the illustrative 40% portfolio rate does not sustain indefinite operations.

## Assumptions and country data

- Country loading writes only target population, population growth, GNI per capita (GDP fallback), and the conservative sanitation DALY derivation, using dated World Bank and WHO observations.
- Those four fields share a blue `country-observation` state after loading; each records direct/derived provenance and observation year(s), and a real user edit removes the marker.
- CPI, commercial lending, poverty, Gini, and sanitation coverage are context only.
- Household and enterprise APRs, annual fixed operations, and USD cost escalation are amber programme assumptions. Dated commercial lending and local CPI appear beside the relevant controls but never overwrite them; no macro API is used to invent an operating budget.
- Missing essential observations clear the field and pause automatic calculation; another country's value is never retained.
- Malawi references are documented in [docs/PARAMETERS.md](docs/PARAMETERS.md): 4.4 people/household, 28 districts, $100 toilet planning cost, $3,000 enterprise capital, 12-month loan terms, 0.25 hours saved/day, and a 50% time-value factor.
- Financing, operating, write-down, capacity, contingency, and grant-pacing defaults remain illustrative programme assumptions. They must be calibrated before an investment decision.
- Jobs supported use an editable three-per-active-enterprise Malawi reference: one owner/operator plus two FTE workers. It is not an observed country value and is not job-years.
- The health burden factor uses the WHO `WSH_30_SAN` lower uncertainty bound divided by matching-year World Bank population without basic sanitation. An explicit 21% programme-effect assumption from the 2022 basic non-sewered sanitation meta-analysis scales that burden to DALYs averted. DALY value remains zero. Eritrea and Tuvalu currently fall back to not estimated because a required API source is unavailable.
- Carbon remains not estimated until the programme supplies a project-specific baseline and technology factor; number of toilets or users alone is insufficient.
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

- `popReqToilets`, `popGrowthRate`, `avgAnnualIncome`, and `dalyPerPerson` are the only model inputs written by country loading and the only controls that receive `country-observation`.
- The target population description names its rural-population/basic-sanitation derivation; growth and income name their direct observation year.
- Programmatic load events retain the API marker. A trusted user edit clears it and records user provenance.
- Programme rates, costs, losses, capacity, contingency, and subsidy settings never receive the marker. See [ADR-0046](docs/adr/0046-mark-country-derived-inputs-consistently.md).
- `loanInterestRate_v2`, `meLoanInterestRate_v2`, `annualFixedOpsCost`, and `inflationRate` use the amber `programme-assumption` state. Country loading updates only their explanatory benchmark text, never their values. See [ADR-0050](docs/adr/0050-show-api-benchmarks-without-inventing-programme-terms.md).

## Impact-estimate contract

- `jobsPerMe` is explicit and drives both the annual jobs series and horizon headline. The output is jobs supported at a point in time; no monetary job value enters SROI.
- The country DALY rate uses WHO both-sex/all-age `WSH_30_SAN` lower-bound DALYs and World Bank `SP.POP.TOTL` plus `SH.STA.BASS.ZS` for the same year. Missing or invalid evidence resets to zero/not estimated and cannot retain another country.
- `dalyValue = 0` keeps the physical estimate out of SROI until a supported valuation is supplied.
- `dalyImpactRealisation = 21%` is an editable evidence-based point estimate, not a country API observation or a claim of programme-specific measured effect.
- `co2PerToilet = 0` means not estimated, not measured zero. A positive factor requires a project baseline and sanitation/wastewater technology methodology. See [ADR-0049](docs/adr/0049-derive-health-and-report-impact-honestly.md).

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
npm run audit:impact          # live WHO/World Bank impact coverage; not a CI test
node tools/verify-findings.js
```

Run the app with `python -m http.server 8080` or `npm run serve`. `file://` works, but browsers may block World Bank calls from local files.

## Latest activity

On 2026-10-21 release 0.19.2 strengthened verification without changing the model. The live country audit now mirrors the browser's exact API conversions and completes a full run for every selector country: 44/44 currently pass validation and ledger integrity. A permanent fixed-seed regression also covers 384 valid combinations across finance, demand, delivery, cost, loss, and impact inputs. The suite has 126 passing tests, all 60 findings are closed, and all 21 golden scenarios are unchanged. The next roadmap work is transparent scenario comparison or real-browser/accessibility checks. The on-site [changelog](changelog.html) gives users the release history and remaining limitations as simple bullets.

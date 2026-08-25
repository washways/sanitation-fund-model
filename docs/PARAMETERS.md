# Parameter Dictionary

**The canonical unit, source and meaning of every input.** Check this file before touching any field — it's the ground truth for what a default actually is and what happens to it once entered.

Columns:

- **id** — the `id` attribute in `index.html`, which is also the key `UI.getInputs()` reads.
- **Unit as entered** — what the user types into the box. Every rate is a **percentage**: type `12` for 12%, never `0.12`.
- **Unit in the model** — what `ModelModule` receives after `getInputs()` normalises it. For a rate, this is always the decimal form, converted exactly once at the boundary.
- **Source** — where a value comes from when the country data is fetched, if it does.

---

## Capital and structure

| id | Label | Default | Unit as entered | Unit in model | Source | Notes |
|---|---|---|---|---|---|---|
| `wiz-invest-grant-sidebar` | Initial Grant Capital | 1,000,000 | USD | USD | user | Seeds the **grant ledger**. Caps total subsidy for the whole run — see `grantSupportPct`, below. |
| `wiz-invest-loan-sidebar` | Initial Loan Capital | 4,000,000 | USD | USD | user | Seeds the **loan ledger**. Senior debt; must be repaid. |
| `wiz-duration-sidebar` | Duration (Years) | 5 | years | years | user | Simulation horizon. The fund winds up when there's nothing left to do, so extending the horizon past that point changes nothing. |
| `fundRepaymentTerm` | Fund Repayment (Years) | 5 | years | years | user | Flat principal amortisation. **Longer is not always safer** — a schedule that runs past the fund's productive life produces permanent arrears rather than more time to repay. |
| `investorGracePeriod` | Investor Grace Period (Months) | 6 | months | months | user | Defers **principal only** — interest accrues from month 1 regardless, and capitalises into the liability if the fund can't pay it. |
| `fundCostOfCapital` | Fund Cost of Capital (%) | 2 | percent | decimal | `FR.INR.LEND` on fetch (informational only — never overwrites this field) | Defaults to 2%, concessional ([ADR-0013](adr/0013-viable-default-scenario.md)). Accrues from month 1; unpaid interest capitalises. |

## Market and demand

| id | Label | Default | Unit as entered | Unit in model | Source | Notes |
|---|---|---|---|---|---|---|
| `popReqToilets` | Pop. Needing Toilets | 27,280,461 | people | people | `SP.RUR.TOTL` x sanitation gap | Divided by `avgHHSize` to get the toilet backlog. **People, not households.** |
| `popGrowthRate` | Annual Pop Growth (%) | 3 | percent | decimal | `SP.POP.GROW` | The unserved backlog compounds monthly at `(1+g)^(1/12)`, net of production. |
| `avgHHSize` | Avg Household Size (people) | 5 | people | people | user | One toilet serves one household. |
| `avgToiletCost` | Avg Toilet Cost ($ USD) | 100 | USD | USD | user | Base cost before inflation and the variable mark-up. |
| `avgAnnualIncome` | Avg Annual Income ($) | 1,020 | USD | USD | `NY.GNP.PCAP.CD` | Sets the value of saved time (R-8.6). Editing it changes the SROI. |

## Delivery network

| id | Label | Default | Unit as entered | Unit in model | Source | Notes |
|---|---|---|---|---|---|---|
| `districts` | Administrative Units | 50 | count | count | `countriesnow.space` states, else pop/500k | With `mePerDistrict`, sets the hard ME cap. |
| `mePerDistrict` | Micro-enterprises / Unit | 20 | count | count | derived from the sanitation gap | Cap is `districts x mePerDistrict` = 1,000 by default, and the baseline reaches it. |
| `toiletsPerMeMonth` | Toilets / ME / Month | 7 | count/month | count/month | user | No learning curve, no seasonality. |
| `meSetupCost` | ME Setup Cost ($ USD) | 2,000 | USD | USD | user | One of two components of `meCapitalRequirement(inputs)` — the other is working capital. Used consistently everywhere an ME's cost matters (`src/model/engine.js`). |

## Lending terms

| id | Label | Default | Unit as entered | Unit in model | Source | Notes |
|---|---|---|---|---|---|---|
| `loanInterestRate_v2` | HH Loan Interest Rate (%) | 40 | percent | decimal | `updateSmartRates` suggestion — a hint only, never overwrites what you typed | `0` is a valid, fully-handled concessional rate. |
| `meLoanInterestRate_v2` | ME Loan Interest Rate (%) | 10 | percent | decimal | `updateSmartRates` suggestion | Same. |
| `termHh` | HH Loan Term (Months) | 18 | months | months | user | Term changes the *realised* loss rate on write-downs, not just the headline — see `hhDefaultRate`, below. |
| `termMe` | ME Loan Term (Months) | 12 | months | months | user | |
| `hhDefaultRate` | HH Annual Write-down Rate (%) | 5 | percent | decimal | poverty-derived | **Not the share of loans that fail.** It's an annual write-down hazard on the outstanding balance — realised loss as a share of principal disbursed depends on the term, and isn't the headline number. At the shipped 18-month term, 5% headline realises ~4.1%; at 6 months it would realise ~1.5%; past ~24 months realised loss *exceeds* the headline. See `tests/writedown.test.js`. |
| `meDefaultRate` | ME Annual Write-down Rate (%) | 5 | percent | decimal | user | Same convention as the household rate. Reduces **loan value**. |
| `meExitRate` | ME Annual Closure Rate (%) | 10 | percent | decimal | user | Reduces **capacity**. Deliberately separate from loan write-down: a business can close having repaid in full, and a loan can be written down by a business that keeps trading. The 10% default is a convention, not a measurement. |
| `meExpansionBudgetShare` | ME Expansion Budget Share (%) | 10 | percent | decimal | user | Share of `lendable` cash committed each month to recruiting new MEs. |
| `meMaxMonthlyGrowthRate` | ME Max Monthly Growth Rate (%) | 10 | percent | decimal | user | Ceiling on ME-network growth per month, as a share of the current network. **The dominant driver of the recruitment curve** — 10%/month compounds to ~3.1x/year. |
| `grantSupportPct` | Grant-Funded Pacing (% of Production) | 10 | percent | decimal | affordability calc | **A pacing lever, not a volume lever.** Total grant-funded output is capped by the grant ledger (Initial Grant Capital), so this field controls *how fast* it's spent, not how much gets spent in total — a live `grantExhaustedMonth` note beside the field in the app shows the actual runway. |

## Costs

| id | Label | Default | Unit as entered | Unit in model | Source | Notes |
|---|---|---|---|---|---|---|
| `annualFixedOpsCost` | Annual Fixed Ops Cost ($) | 60,000 | USD/year | USD/year | `10000 + 500 x districts` | Inflated monthly. Falls to **30%** during hibernation (the collections floor), and stops entirely at wind-up. |
| `mgmtFeeRatio` | Mgmt Fee Ratio (%) | 1 | percent | decimal | fixed 2% on fetch | Part of `variableRate`, charged on every disbursement. |
| `meCostRate` | M&E Cost (%) | 2 | percent | decimal | user | Part of `variableRate`. Monitoring & evaluation — not micro-enterprise. |
| `contingencyRate` | Cost Contingency (% mark-up) | 5 | percent | decimal | political stability (`PV.EST`) | ✅ Relabelled. It is a **per-unit uplift on delivery cost**, not a reserve — the implementation was right and the name was wrong ([ADR-0017](adr/0017-contingency-is-a-cost-mark-up.md)). |
| `opsReserveCap` | Starting Capacity Throttle (%) | 15 | percent | percent, `/100` in model | user | Sizes the starting ME cohort at month 0, and applies **only then** — that is its whole, narrow job. Not the fund's ongoing solvency reserve, which is computed fresh every month regardless of this setting (below). Because it sets the starting network, it drives the entire growth path — sweep it to see the effect. |
| — | **Solvency reserve** (not a form field — computed every month) | 3 × full ops cost + next 3mo of scheduled investor principal | USD | USD | derived | The gate on new lending — R-5.4. Not the same thing as `opsReserveCap`, above, which only ever sizes the month-0 starting network. |
| `inflationRate` | Annual Inflation (%) | 3.32 | percent | decimal | `FP.CPI.TOTL.ZG` | Any rate, including well above 100%, is representable. Applies to unit cost and fixed ops, not to income. |

## Impact

| id | Label | Default | Unit as entered | Unit in model | Source | Notes |
|---|---|---|---|---|---|---|
| `dalyPerPerson` | DALYs Averted / Person | 0.005 | DALY/person/year | same | user | Accrued monthly against active toilets (area under curve) — R-8.3. |
| `dalyValue` | Value per DALY ($) | 500 | USD/DALY | same | user | ✅ Now **included** in SROI ([ADR-0011](adr/0011-sroi-is-social-value-only.md)); it previously dominated the impact card while being excluded from the ratio. |
| `co2PerToilet` | CO2e / Toilet (Tonnes/Yr) | 0.2 in HTML, overridden to 0.0 on load | tonnes/toilet/year | tonnes/toilet/year, accrued monthly against toilets in service | user | Carbon is switched off by default on the shipped demo — set it above 0 to see the carbon path. Accrual stops after `toiletLifespanYears`. |
| `co2Value` | Value per Tonne CO2e ($) | 15 | USD/tonne | USD/tonne | user | |
| `carbonCreditShare` | Fund Carbon Share (%) | 100 in HTML, overridden to 50 on load | percent | decimal | user | `co2PerToilet` and `carbonCreditShare` are deliberately overridden to a documented demo scenario by `setCarbonDefault` on page load, regardless of what `index.html` ships — see `src/app.js`'s `DOMContentLoaded` handler. |
| `timeValueFactor` | Value of Saved Time (% of wage) | 30 | percent | decimal | user | ✅ Replaces the hardcoded, uncited `$0.50`/hour. The hourly value is now `avgAnnualIncome / 2080 × factor` — $0.147 at the shipped defaults, shown beneath the input. The 0.30 factor is an accepted convention, not a verified figure — confirm against your programme's guidance before publishing. [ADR-0015](adr/0015-value-of-saved-time.md), [ADR-0030](adr/0030-accept-30-percent-time-value-factor.md) |
| `toiletLifespanYears` | Toilet Service Life (Years) | 5 | years | years | user | ✅ Carbon crediting, DALYs and time-saved all stop after this ([ADR-0016](adr/0016-toilet-service-life.md), [ADR-0025](adr/0025-service-life-gates-all-impact.md)). No effect at the shipped 5-year default duration; on longer runs, all three impact channels stop for a retired toilet. |
| `hoursPerPersonPerDay` | Hours Saved / Person / Day | 0.25 | hours | hours | user assumption | One definition, computed in the loop (R-8.2). |

## Not used by the model

| id | Why it is here |
|---|---|
| `countryInput` | Selects the country for the World Bank fetch. Passed to the model as a label only. |
| `enableBreakEvenSolver` | Read by the controller, not the maths — turns the solver panel on or off. |

Every other collected input reaches `ModelModule` — `tests/wiring.test.js` enforces this and fails if a new one goes in without being wired up.

---

## The unit convention

**Every rate is entered as a percentage.** `12` means 12%. Conversion to a decimal happens exactly once, at the input boundary, in `UI.getInputs()`:

```js
const getPercent = (id, def = 0) => getRaw(id, def) / 100;
```

Decided 2026-08-20 ([ADR-0012](adr/0012-percentage-entry-convention.md)), resolving F-17. Before that the form taught two conventions at once — nine fields labelled "(0.35 = 35%)" and one labelled "(%)" — under two heuristics that contradicted each other about the same DOM node:

```js
// getInputs        — "anything above 1 must be a percentage"    val > 1.0  -> val / 100
// updateSmartRates — "anything below 1 must be a decimal"       val < 1.0  -> val * 100
```

So 100% was ambiguous, and any rate **above** 100% was unrepresentable: a user modelling 150% inflation silently got 1.5%.

**No function may inspect a value's magnitude to infer its unit.** Both heuristics are deleted; do not reintroduce either. `tests/wiring.test.js` applies the same `/100` when checking defaults, so reverting a single field to decimal entry fails the drift test.

Anything saved or screenshotted before 2026-08-20 shows rate fields in the old decimal convention and must be re-entered rather than copied across.

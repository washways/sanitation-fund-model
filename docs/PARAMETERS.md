# Parameter Dictionary

**The canonical unit, source and meaning of every input.** Check this file before touching any field. Three of the audit's findings (F-02, F-17, F-33) were unit errors; all three are now fixed.

✅ marks a defect fixed and verified on 2026-08-20. ⚠️ marks one still open.

Columns:

- **id** — the `id` attribute in `index.html`, which is also the key `UI.getInputs()` reads.
- **Unit as entered** — what the user types into the box. Every rate is a **percentage** (R-2.3).
- **Unit in the model** — what `ModelModule` receives after `getInputs()` normalises it.
- **Source** — where a value comes from when the country data is fetched.

⚠️ = the label and the model disagree, or the unit convention is unsafe. Each links to its finding.

---

## Capital and structure

| id | Label | Default | Unit as entered | Unit in model | Source | Notes |
|---|---|---|---|---|---|---|
| `wiz-invest-grant-sidebar` | Initial Grant Capital | 1,000,000 | USD | USD | user | Seeds the **grant ledger**. Caps total subsidy — see F-30. |
| `wiz-invest-loan-sidebar` | Initial Loan Capital | 4,000,000 | USD | USD | user | Seeds the **loan ledger**. Senior debt; must be repaid. |
| `wiz-duration-sidebar` | Duration (Years) | 5 | years | years | user | Simulation horizon. ✅ [F-31](ANALYSIS.md#f-31--the-simulation-does-not-stop-when-the-fund-dies) fixed — the fund winds up when it has nothing left to do, so extending the horizon no longer changes the answer. |
| `fundRepaymentTerm` | Fund Repayment (Years) | 5 | years | years | user | Flat principal amortisation. ⚠️ Longer is **worse** — see [F-32](ANALYSIS.md#f-32--extending-the-repayment-term-reduces-repayment). |
| `investorGracePeriod` | Investor Grace Period (Months) | 6 | months | months | user | ✅ [F-06](ANALYSIS.md#f-06--grace-period-interest-never-accrues-and-arrears-never-come-due) fixed — defers **principal only**; interest accrues from month 1 and capitalises if unpaid. |
| `fundCostOfCapital` | Fund Cost of Capital (0.08 = 8%) | **0** | decimal | decimal | `FR.INR.LEND` on fetch | ✅ [F-01](ANALYSIS.md#f-01--fundcostofcapital-has-no-input-control-so-it-is-always-zero) fixed — the control now exists. ⚠️ **The default is still 0** pending Q12; [ADR-0004](adr/0004-cost-of-capital-input.md) declined to invent a rate. Accrues from month 1; unpaid interest capitalises. |

## Market and demand

| id | Label | Default | Unit as entered | Unit in model | Source | Notes |
|---|---|---|---|---|---|---|
| `popReqToilets` | Pop. Needing Toilets | 27,280,461 | people | people | `SP.RUR.TOTL` x sanitation gap | Divided by `avgHHSize` to get the toilet backlog. **People, not households.** |
| `popGrowthRate` | Annual Pop Growth | 0.03 | decimal | decimal | `SP.POP.GROW` | ✅ [F-09](ANALYSIS.md#f-09--population-growth-is-collected-but-the-demand-backlog-is-static) fixed — the backlog now compounds monthly at `(1+g)^(1/12)`, net of production. |
| `avgHHSize` | Avg Household Size (people) | 5 | people | people | user | One toilet serves one household. |
| `avgToiletCost` | Avg Toilet Cost ($ USD) | 100 | USD | USD | user | Base cost before inflation and the variable mark-up. |
| `avgAnnualIncome` | Avg Annual Income ($) | 1,020 | USD | USD | `NY.GNP.PCAP.CD` | ✅ [F-25](ANALYSIS.md#f-25--inputs-collected-and-never-used) fixed — now sets the value of saved time (R-8.6). Editing it changes the SROI. |

## Delivery network

| id | Label | Default | Unit as entered | Unit in model | Source | Notes |
|---|---|---|---|---|---|---|
| `districts` | Administrative Units | 50 | count | count | `countriesnow.space` states, else pop/500k | With `mePerDistrict`, sets the hard ME cap. |
| `mePerDistrict` | Micro-enterprises / Unit | 20 | count | count | derived from the sanitation gap | Cap is `districts x mePerDistrict` = 1,000 by default, and the baseline reaches it. |
| `toiletsPerMeMonth` | Toilets / ME / Month | 7 | count/month | count/month | user | No learning curve, no seasonality. |
| `meSetupCost` | ME Setup Cost ($ USD) | 2,000 | USD | USD | user | ✅ One of two components of `meCapitalRequirement` (the other is working capital); no longer three disagreeing notions of ME capital. [ADR-0031](adr/0031-unify-me-capital-requirement.md), [F-21](ANALYSIS.md#f-21--me-growth-magic-numbers-and-inconsistent-startup-capital). |

## Lending terms

| id | Label | Default | Unit as entered | Unit in model | Source | Notes |
|---|---|---|---|---|---|---|
| `loanInterestRate_v2` | HH Loan Interest Rate (0.35 = 35%) | 0.35 | **decimal** | decimal | `updateSmartRates` suggestion | ✅ [F-05](ANALYSIS.md#f-05--updatesmartrates-overwrites-the-interest-rates-the-user-typed) fixed — once you type in this field it is yours; the smart rate becomes a suggestion. ✅ [F-03](ANALYSIS.md#f-03--a-zero-interest-rate-produces-nan-across-the-entire-ledger) fixed — `0` is now a valid concessional rate. |
| `meLoanInterestRate_v2` | ME Loan Interest Rate (0.10 = 10%) | 0.10 | **decimal** | decimal | `updateSmartRates` suggestion | Same two fixes. |
| `termHh` | HH Loan Term (Months) | 6 | months | months | user | Short term ⇒ realised losses far below the headline default rate — [F-26](ANALYSIS.md#f-26--the-default-rate-definition-is-undocumented-and-counter-intuitive). |
| `termMe` | ME Loan Term (Months) | 12 | months | months | user | |
| `hhDefaultRate` | HH Default Rate (0.05 = 5%) | 0.05 | **decimal** | decimal | poverty-derived | ⚠️ **Not the share of loans that fail.** It is an annual write-down hazard on outstanding balance. 5% headline ⇒ 1.50% realised loss on disbursed at a 6-month term. [F-26](ANALYSIS.md#f-26--the-default-rate-definition-is-undocumented-and-counter-intuitive). |
| `meDefaultRate` | ME Annual Write-down Rate (%) | 5 | percent | decimal | user | Same convention as the household rate. Reduces **loan value**. |
| `meExitRate` | ME Annual Closure Rate (%) | 10 | percent | decimal | user | ✅ [F-20](ANALYSIS.md#f-20--micro-enterprises-are-immortal) fixed. Reduces **capacity**. Deliberately separate from write-down: a business can close having repaid, and a loan can be written down by a business that keeps trading. The 10% default is a convention, not a measurement. |
| `meExpansionBudgetShare` | ME Expansion Budget Share (%) | 10 | percent | decimal | user | Share of `lendable` cash committed each month to recruiting new MEs. Was a hardcoded `0.1` with no control ([F-21](ANALYSIS.md#f-21--me-growth-magic-numbers-and-inconsistent-startup-capital), [ADR-0019](adr/0019-expose-me-growth-constants.md)); default unchanged. |
| `meMaxMonthlyGrowthRate` | ME Max Monthly Growth Rate (%) | 10 | percent | decimal | user | Ceiling on ME-network growth per month, as a share of the current network. **The dominant driver of the recruitment curve** — 10%/month compounds to ~3.1x/year. Was a hardcoded `0.1` with no control ([F-21](ANALYSIS.md#f-21--me-growth-magic-numbers-and-inconsistent-startup-capital), [ADR-0019](adr/0019-expose-me-growth-constants.md)); default unchanged. |
| `grantSupportPct` | Grant Support (% of Households) | 0.10 | **decimal** | decimal | affordability calc | ⚠️ **A pacing lever, not a volume lever.** 5%→90% moves output 3.6%; it changes *when* the grant fund is spent (month 28 vs month 4), not how much — total subsidy is capped by the grant ledger. [F-30](ANALYSIS.md#f-30--grant-support--is-a-pacing-lever-not-a-volume-lever). ✅ No longer rewritten by the auto-solver ([F-04](ANALYSIS.md#f-04--the-auto-solver-rewrites-the-users-inputs-and-re-runs-itself)); the label still overstates what it does. |

## Costs

| id | Label | Default | Unit as entered | Unit in model | Source | Notes |
|---|---|---|---|---|---|---|
| `annualFixedOpsCost` | Annual Fixed Ops Cost ($) | 145,000 | USD/year | USD/year | `10000 + 500 x districts` | Inflated monthly. Falls to **30%** during hibernation (the collections floor), and stops entirely at wind-up — ✅ [F-31](ANALYSIS.md#f-31--the-simulation-does-not-stop-when-the-fund-dies) fixed. |
| `mgmtFeeRatio` | Mgmt Fee Ratio (0.01 = 1%) | 0.01 | **decimal** | decimal | fixed 2% on fetch | Part of `variableRate`, charged on every disbursement. |
| `meCostRate` | M&E Cost (0.02 = 2%) | 0.02 | **decimal** | decimal | user | Part of `variableRate`. Monitoring & evaluation — not micro-enterprise. |
| `contingencyRate` | Cost Contingency (% mark-up) | 5 | percent | decimal | political stability (`PV.EST`) | ✅ Relabelled. It is a **per-unit uplift on delivery cost**, not a reserve — the implementation was right and the name was wrong ([ADR-0017](adr/0017-contingency-is-a-cost-mark-up.md)). |
| `opsReserveCap` | Starting Capacity Throttle (%) | 15 | percent | percent, `/100` in model | user | ✅ Relabelled 2026-08-21 ([ADR-0027](adr/0027-debt-service-lookahead-reserve.md)) — it was called "Max Ops Reserve Cap" / "Liquidity Buffer", which invited confusion with the fund's actual ongoing solvency reserve (below). It applies **only in month 0**, sizing the starting ME cohort, and nothing thereafter — that is its whole, narrow job, not a defect. 0% ⇒ 645 MEs / 216,934 toilets; 90% ⇒ 0 MEs / 0 toilets, at pre-ADR-0027 figures. |
| — | **Solvency reserve** (not a form field — computed every month) | 3 × ops + next 3mo principal | USD | USD | derived | ✅ Added 2026-08-21 ([ADR-0027](adr/0027-debt-service-lookahead-reserve.md), [F-10](ANALYSIS.md#f-10--reserves-are-enforced-once-and-the-documented-debt-reserve-does-not-exist)). The README's long-claimed "3-month Debt Lookahead" now actually exists — R-5.4. Reduced baseline reach ~9% (133,469 → 121,358 toilets) because the fund now holds back cash it had previously been lending away. |
| `inflationRate` | Annual Inflation (0.0332 = 3.32%) | 0.0332 | **decimal** | decimal | `FP.CPI.TOTL.ZG` | ⚠️ Rates above 100% are unrepresentable — [F-17](ANALYSIS.md#f-17--two-opposing-percent-heuristics-hyperinflation-becomes-2). Applies to unit cost and fixed ops, not to income. |

## Impact

| id | Label | Default | Unit as entered | Unit in model | Source | Notes |
|---|---|---|---|---|---|---|
| `dalyPerPerson` | DALYs Averted / Person | 0.005 | DALY/person/year | same | user | Accrued monthly against active toilets (area under curve) — R-8.3. |
| `dalyValue` | Value per DALY ($) | 500 | USD/DALY | same | user | ✅ Now **included** in SROI ([ADR-0011](adr/0011-sroi-is-social-value-only.md)); it previously dominated the impact card while being excluded from the ratio. |
| `co2PerToilet` | CO2e / Toilet (Tonnes/Yr) | 0.0 (overridden) | tonnes/toilet/year | tonnes/toilet/year, accrued monthly against toilets in service | user | ✅ [F-33](ANALYSIS.md#f-33--the-carbon-input-is-labelled-tonnes-per-year-and-used-as-kilograms-once) fixed. ⚠️ Accrual is uncapped — Q11 asks whether a toilet lifespan should limit it. |
| `co2Value` | Value per Tonne CO2e ($) | 15 (overridden) | USD/tonne | USD/tonne | user | |
| `carbonCreditShare` | Fund Carbon Share (1.0 = 100%) | 1.0 in HTML, 50 at runtime | ambiguous | decimal | user | ✅ [F-02](ANALYSIS.md#f-02--carboncreditshare-is-percentage-divided-twice) fixed — the second `/100` is gone. ⚠️ The HTML default and the runtime override still use different conventions; that is part of Q10. |
| `timeValueFactor` | Value of Saved Time (% of wage) | 30 | percent | decimal | user | ✅ Replaces the hardcoded, uncited `$0.50`/hour. The hourly value is now `avgAnnualIncome / 2080 × factor` — $0.147 at the shipped defaults, shown beneath the input. The 0.30 factor is an accepted convention, not a verified figure — confirm against your programme's guidance before publishing. [ADR-0015](adr/0015-value-of-saved-time.md), [ADR-0030](adr/0030-accept-30-percent-time-value-factor.md) |
| `toiletLifespanYears` | Toilet Service Life (Years) | 5 | years | years | user | ✅ Carbon crediting, DALYs and time-saved all stop after this ([ADR-0016](adr/0016-toilet-service-life.md), [ADR-0025](adr/0025-service-life-gates-all-impact.md)). No effect at the shipped 5-year default duration; on longer runs, all three impact channels stop for a retired toilet. |
| `hoursPerPersonPerDay` | Hours Saved / Person / Day | 0.25 | hours | hours | user assumption | ✅ [F-07](ANALYSIS.md#f-07--two-incompatible-hours-saved-formulas) fixed — one definition, in the loop, and now a real control. |

## Not used by the model

| id | Why it is here |
|---|---|
| `countryInput` | Selects the country for the World Bank fetch. Passed to the model as a label only. |
| — | ✅ `wiz-tech` and the dead wizard handlers were removed ([F-15](ANALYSIS.md#f-15--wizard-functions-reference-dom-ids-that-were-deleted)). `avgAnnualIncome` is now the only input still collected and unused. |

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

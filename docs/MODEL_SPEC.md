# Model Specification

**Status:** Normative. This document, not the code (`src/model/`), is the source of truth for the financial mathematics.
**Version:** 1.2 (2026-10-22) — adds the open questions Q15–Q18 from the robustness review ([ANALYSIS.md §4B](ANALYSIS.md)) and corrects three rules whose wording no longer matched the code.

---

## How to read this document

Every rule carries a tag:

| Tag | Meaning |
|---|---|
| **[AS-BUILT]** | The code does exactly this today. Changing it is a behaviour change and needs an ADR. |
| **[TARGET]** | The code does *not* do this yet. The gap is a numbered finding in [ANALYSIS.md](ANALYSIS.md). Implement it in the stage named. |
| **[OPEN]** | Not yet decided. Do **not** implement until a human resolves it and the tag changes. |

Rules are numbered `R-n.m` and are referenced from tests. **If you change a rule, change its tests in the same commit.**

---

## 1. Scope and purpose

The model simulates a **blended-finance revolving fund** that finances market-based sanitation over a fixed horizon, at monthly resolution.

Capital flows in three hops:

```
Investors ──grant──▶  Grant ledger  ──subsidy──▶ Households (no repayment)
          ──loan───▶  Loan ledger   ──loan─────▶ Micro-enterprises (repay w/ interest)
                                    ──loan─────▶ Households (repay w/ interest)
                      Loan ledger   ──service──▶ Investors (principal + interest)
```

The model answers three questions:

1. **Solvency** — does the fund run out of cash, and when?
2. **Repayment** — is senior debt repaid in full within its term?
3. **Reach and impact** — how many toilets, people, DALYs and tonnes of CO2e, at what cost per unit?

**Out of scope** (do not add without an ADR): FX and multi-currency, taxation, secondary-market sale of the portfolio, individual borrower heterogeneity, spatial or district-level disaggregation, quality of construction, behavioural adoption dynamics.

---

## 2. Conventions

### R-2.1 Time **[AS-BUILT]**
Discrete monthly steps, `m = 1 .. duration * 12`. There is no month 0 in the output arrays; pre-loop initialisation (see R-6.1) is "month 0" conceptually and appears in the audit trail as the *startup row*. Array index `i` corresponds to month `i + 1`.

### R-2.2 Rate conversion **[AS-BUILT]**
All annual rates convert to monthly **geometrically**, never by dividing by 12:

```
r_monthly = (1 + r_annual)^(1/12) - 1
```

Implemented once in `ModelModule.getMonthlyRate`. Do not inline this formula anywhere else.

### R-2.3 Units at the boundary **[AS-BUILT]** (was F-17, fixed 2026-08-20)
There is **one** entry convention for rates, applied to every field, and conversion happens **exactly once**, at the boundary in `UI.getInputs()`.

**No function may inspect a value's magnitude to guess its unit.** This is the rule that matters; it is violated today by two heuristics that contradict each other about the same DOM node (`>1 means percent` in `getInputs`, `<1 means decimal` in `updateSmartRates`), which makes rates above 100% unrepresentable and 100% itself ambiguous.

**Percentages.** `12` means 12%, for every rate field without exception. Decided 2026-08-20 — see [ADR-0012](adr/0012-percentage-entry-convention.md). Implemented as `getPercent()` in `UI.getInputs()`; both magnitude heuristics are deleted.

Canonical unit for every parameter: [PARAMETERS.md](PARAMETERS.md).

### R-2.4 Currency **[AS-BUILT]**
Single nominal currency, labelled USD in the UI. All values are **nominal** (inflation-inclusive), not real. There is no discounting anywhere in the model — NPV and IRR are deliberately absent. See [ADR-0003](adr/0003-nominal-cashflows-no-discounting.md).

The `inflationRate` input is therefore **forward cost escalation in the model currency**, not automatically local CPI. A local-currency CPI observation cannot consistently escalate USD cashflows without an exchange-rate path. CPI is shown as dated context beside the amber programme assumption but never written into it; see [ADR-0034](adr/0034-observations-only-country-data.md) and [ADR-0050](adr/0050-show-api-benchmarks-without-inventing-programme-terms.md).

### R-2.5 Fractional units **[AS-BUILT]**
Toilets are integers (`Math.floor` at the point of production, R-7.5). Micro-enterprises are integers. Money, loan balances and the unserved-target backlog are continuous.

### R-2.6 Rounding tolerance **[AS-BUILT]**
Invariant checks tolerate $1.00 of floating-point drift per month. Never compare money with `===`.

### R-2.7 Country observations **[AS-BUILT]**
The country loader requests the World Bank API's latest non-empty observation and preserves its year. It may populate observed or transparently derived model inputs: rural population without basic sanitation, population growth, GNI per capita (falling back to GDP per capita), and the conservative sanitation-attributable DALY factor specified in R-8.3. The population field measures need, not forecast willingness, affordability, eligibility, or loan uptake. CPI, commercial lending, poverty, Gini, and sanitation coverage are dated context. They do not set financing terms, subsidy policy, write-downs, costs, or capacity. Commercial lending is repeated beside both borrower-rate assumptions and CPI beside model-currency escalation; fixed operating cost explains that no macro API can infer the programme budget. These contextual messages never alter a value.

If any essential observation for the target population, growth, or income is unavailable, the related field is cleared and automatic calculation pauses. A value from the previous country must never survive as if it belonged to the new one. See [ADR-0034](adr/0034-observations-only-country-data.md).

### R-2.8 Input validation **[AS-BUILT]** (F-46)

`ModelModule.calculate()` validates the complete input object before allocating output arrays or running month 1. Invalid inputs produce no result. The browser reports every detected field together and clears the prior result so it cannot be exported under changed assumptions.

The boundary enforces mathematical and definitional constraints only: numeric fields are finite; denominators, portfolio terms, duration, and service life are positive; capital, costs, counts, impact quantities, mark-ups, and the fund repayment term are non-negative; shares and annual hazards are within 0%–100%; compound rates exceed -100%; discrete counts and month fields are whole numbers; year-based duration and repayment terms resolve to whole months; saved time does not exceed 24 hours/day; and, when senior loan capital is positive, its repayment term is positive and grace does not exceed that term.

Blank or malformed form values remain invalid rather than restoring a hidden fallback. Validation does not impose unsupported policy caps on prices, interest rates, capital, or programme scale. See [ADR-0037](adr/0037-fail-fast-input-validation.md).

---

## 3. Portfolio mechanics

### R-3.1 Cohorts **[AS-BUILT]**
Each disbursement creates a **cohort**: `{ balance, monthlyPayment, termRemaining }`. Cohorts are never merged. Two cohort lists exist: `hhCohorts` and `meCohorts`.

### R-3.2 Annuity payment **[AS-BUILT]** (was F-03, fixed 2026-08-20)

```
pmt = r == 0
    ? principal / termMonths
    : (principal * r) / (1 - (1 + r)^(-termMonths))
```

Implemented as `ModelModule.annuityPayment(principal, r, termMonths)` and used at all three call sites. The `r == 0` branch is not optional: without it a 0% rate yields `0/0 = NaN`, which then passes every other invariant, because `NaN` comparisons are always false.

### R-3.3 Monthly cohort processing order **[AS-BUILT]**
For each cohort, in this exact order:

1. **Write-off:** `def = balance * probDefault`; `balance -= def`
2. **Interest:** `int = balance * r` (on the *post*-write-off balance)
3. **Principal:** `prin = (termRemaining == 1) ? balance : max(0, monthlyPayment - int)`, capped at `balance`
4. `balance -= prin`; `termRemaining -= 1`

Cohorts with `termRemaining <= 0` are dropped at the start of the next month.

### R-3.4 Default convention **[AS-BUILT — documented by F-26]**
The annual default input is converted to a **monthly hazard on outstanding balance**. An explicit 0% remains zero; it must not be replaced by a fallback rate:

```
probDefault_monthly = 1 - (1 - defaultRate_annual)^(1/12)
```

This is a *fractional continuous write-down*, not a discrete "x% of loans fail". Consequences a reader must understand:

- Realised loss as a share of **disbursed principal** is **not** the headline rate, and it is **not always less than it** — see [F-35](ANALYSIS.md#f-35--r-34s-always-less-than-headline-claim-is-wrong-past-about-18-months). Below roughly a year it is well below the headline (a 5% annual hazard on a 6-month loan realises ~1.5%, because only half a year of exposure applies and the balance is amortising down throughout). Past about 18–24 months the *cumulative* exposure across multiple years overtakes the amortisation effect and realised loss **exceeds** the single-year headline rate (a 5% hazard on a 36-month loan realises ~8%). There is no term at which "headline rate" is a correct estimate of realised loss; it is always either an over- or an under-estimate, and which one flips somewhere in the 18–24 month range.
- `monthlyPayment` is **not** re-amortised after a write-off, so the loss lands on the final payment rather than on a missed one.
- A defaulting loan also earns less interest, because interest is charged post-write-off.

**Label the UI field accordingly** — "Annual portfolio write-down rate", not "Default rate". `tests/writedown.test.js` (`T-DEF-1`) pins realised loss to disbursed principal at several terms so the crossover stays visible instead of silently drifting.

### R-3.5 Defaults are not cash **[AS-BUILT]**
Write-offs reduce cohort balances and are reported in `dataMonthlyDefaults*`, but they are **never** a cash outflow. They must not appear in `netFlow`. The variable still lives in the `outflows` object under the name `defaultsHh` / `defaultsMe` for reporting convenience only; the rename to `writeOffs` planned for Stage 3 was never done and is tracked under F-71. Read the name as "write-down", not "cash out".

---

## 4. Investor debt

### R-4.1 Instrument **[AS-BUILT]**
A single senior loan of `investLoan`, drawn in full at month 0, with **flat principal amortisation** over `fundRepaymentTerm * 12 - investorGracePeriod` months, plus interest on the outstanding balance.

### R-4.2 Cost of capital **[AS-BUILT]** (was F-01, fixed 2026-08-20)
`fundCostOfCapital` is an annual rate, converted per R-2.2, applied to `loanFundLiability`. The control exists in `index.html` and defaults to the agreed 2% illustrative concessional term (Q12). A dated World Bank commercial lending rate may be shown as context, but it must never overwrite the term sheet. See [ADR-0004](adr/0004-cost-of-capital-input.md) and [ADR-0034](adr/0034-observations-only-country-data.md).

### R-4.3 Grace period **[AS-BUILT]** (was F-06, fixed 2026-08-20)
A grace period defers **principal only**. Interest **accrues from month 1** regardless of grace.

Previously both principal and interest were gated on `m > investorGracePeriod`, silently forgiving $68,408 of interest on a 6-month grace at 8%. See [ADR-0007](adr/0007-investor-arrears-and-grace.md).

### R-4.4 Cash-aware service **[AS-BUILT]**
The fund never pays more than it holds. Older capitalised interest ranks ahead
of current interest, and all interest ranks ahead of principal ([ADR-0036](adr/0036-complete-investor-debt-waterfall.md)):

```
available        = max(0, loanCash)
paidOldInterest  = min(accruedInvestorInt, available)
paidCurrentInt   = min(currentInterest, available - paidOldInterest)
paidPrincipal    = min(principalDue, available - paidOldInterest - paidCurrentInt)
```

### R-4.5 Arrears **[AS-BUILT]** (was F-06, fixed 2026-08-20)
Unpaid amounts must not evaporate. Required behaviour:

1. Unpaid interest **capitalises** into `loanFundLiability` at the end of the month it was missed.
2. Unpaid principal remains in `loanFundLiability` (already true by construction).
3. Past-due capitalised interest is explicitly scheduled ahead of current interest; paying it reduces both `accruedInvestorInt` and `loanFundLiability`.
4. Past-due and current original principal is paid after interest. It cannot exceed the original principal still outstanding.
5. All debt service ranks **ahead of new lending** in the waterfall (R-5.1).
6. `investorLiabilityEnd` must be the **tracked** `loanFundLiability`, not the reconstruction `investLoan - totalRepaidPrincipal`, which ignores capitalised interest and overstates net assets.

`capitalisedInterest` is the cumulative amount ever rolled up and remains the
`INTEREST_CAPITALISED` viability signal. `capitalisedInterestRepaid` is the
cumulative amount later cured; `accruedInvestorInt` is the amount still unpaid.
Together they reconcile the ending liability under INV-20.

### R-4.6 There is exactly one interest calculation **[AS-BUILT]** (was F-06, fixed 2026-08-20)
`calculateInvestorSchedule` returns principal only. Interest is computed in the loop against the live, arrears-adjusted liability.

---

## 5. The monthly waterfall

### R-5.1 Order of operations **[AS-BUILT]**
Within month `m`, strictly in this order:

| # | Step | Ledger touched |
|---|---|---|
| 1 | Compute inflation factor and unit cost for `m` | — |
| 2 | Process HH cohorts (R-3.3) | `loanCash +=` interest + principal |
| 3 | Process ME cohorts (R-3.3) | `loanCash +=` interest + principal |
| 4 | Service investor debt (R-4.4) | `loanCash -=` |
| 5 | Pay fixed operations (R-5.3) | `loanCash -=` |
| 6 | Test solvency gate (R-5.4) | — |
| 7 | ME expansion lending (R-6.2) | `loanCash -=` |
| 8 | Toilet production: grants and loans (R-7) | `grantCash -=`, `loanCash -=` |
| 9 | Carbon revenue (R-8.1) | `grantCash +=` |
| 10 | Record impact, push all output arrays | — |

The order matters: debt service and operations are funded **before** the fund is allowed to lend, which is what makes the solvency gate meaningful.

### R-5.2 Ledger separation **[AS-BUILT]**

| | `grantCash` | `loanCash` |
|---|---|---|
| **Funded by** | `investGrant`, carbon revenue | `investLoan`, all loan repayments and interest |
| **Pays for** | Household grant subsidies + their variable fees | HH loans, ME loans, fixed ops, variable fees on loans, investor debt service |

The two never transfer to each other. `dataMonthlyCashBalance[i]` is their **sum**.

### R-5.3 Operating costs **[AS-BUILT]**
Fixed: `(annualFixedOpsCost / 12) * inflationFactor[m]`, paid from `loanCash`.
While the loan ledger is overdrawn (`loanCash < 0` after debt service) this drops to **30%** — the "collections floor", representing a skeleton team that still recovers loans. After wind-up (R-9.2) it is zero.

The code also tests an `isWindingDown` flag (`m > activeMonths`) for the same cut, but `activeMonths` always equals the full horizon, so that branch is unreachable: the floor is triggered only by an overdrawn loan ledger. Treat "winding-down" in older text as meaning that.

Variable ("fees"): `disbursedValue * variableRate`, where

```
variableRate = mgmtFeeRatio + meCostRate + contingencyRate
```

charged on grant and loan disbursements alike, and paid from whichever ledger funded the disbursement.

> **`contingencyRate` is a per-unit cost mark-up, not a drawable reserve** — decided 2026-08-20, [ADR-0017](adr/0017-contingency-is-a-cost-mark-up.md). It is driven by the political-stability indicator, which measures delivery risk rather than treasury policy; the model has no shock process for a reserve to be drawn against; and a percentage uplift on base cost is how contingency is treated in construction budgeting anyway. The field is relabelled "Cost Contingency (% mark-up)". Resolves Q5.

### R-5.4 Solvency gate **[AS-BUILT]** (debt-service lookahead added 2026-08-21, [ADR-0027](adr/0027-debt-service-lookahead-reserve.md), resolves F-10)
New lending is permitted only if:

```
loanCash >= requiredReserves  AND  grantCash >= 0  AND  not windingDown
lendable = max(0, loanCash - requiredReserves)
requiredReserves = windUpMonth !== null
    ? 0
    : (fullFixedOps * 3) + sum(next 3 months of scheduled investor principal)
```

`fullFixedOps` is the *current month's* fixed ops cost **before** the hibernation cut (`opsCost`) is applied — a buffer that shrinks by 70% exactly when the fund is most fragile was not a buffer. The scheduled-principal lookahead reads directly from `investorSchedule` (R-4.1), which already exists and is indexed by month, so this is a lookup, not new machinery. The README's long-standing claim of a "3-month Debt Lookahead" is now true.

The former `opsReserveCap` / "Starting Capacity Throttle" is removed. It subtracted a share of
combined grant and loan capital from the loan ledger only at month zero and was never an ongoing
reserve. The explicit pilot-network share in R-6.1 now controls opening scale; `requiredReserves`
remains the only liquidity/debt-service reserve. See [ADR-0047](adr/0047-start-with-a-pilot-enterprise-network.md).

---

## 6. Micro-enterprises

### R-6.1 Startup cohort (month 0) **[AS-BUILT]** (pilot share added 2026-10-21, [ADR-0047](adr/0047-start-with-a-pilot-enterprise-network.md), resolves F-54)

```
maxTotalMEs         = districts * mePerDistrict
meCapitalRequirement = meSetupCost + (toiletsPerMeMonth * avgToiletCost * max(6, termHh))
affordableStartMEs   = floor(max(0, loanCash) / meCapitalRequirement)
targetStartMEs       = initialMeNetworkShare == 0
                       ? 0
                       : ceil(maxTotalMEs * initialMeNetworkShare)
startMEs             = min(maxTotalMEs, affordableStartMEs, targetStartMEs)
startLoanVolume      = startMEs * meCapitalRequirement   // was meSetupCost alone
```

`meCapitalRequirement(inputs)` is now a single function (`ModelModule.meCapitalRequirement`), used here, in R-6.2's expansion budget, and in the loan R-6.2 books — the same number decides how many MEs the fund can afford and how much it lends them. Before this, the loan booked used setup cost alone — 7.3x less than the affordability check's own number at the shipped defaults — so the fund decided how many enterprises it could afford using the realistic figure, then only lent them a seventh of it.

`initialMeNetworkShare` defaults to 15% as an illustrative pilot-rollout assumption, not a country
observation. The Malawi reference therefore starts 84 of its 560-enterprise target rather than the
cash-maximising 285. Available loan capital remains a hard cap. A positive share uses `ceil` so a
small network can still receive one seed enterprise; an explicit zero starts none and cannot grow
later through a percentage of zero. Replace 15% with the programme's recruitment plan before use.

`mePerDistrict = 0` is a valid zero-capacity stress case: `maxTotalMEs` is then zero and the model starts and expands no enterprises. The validated model uses the value directly and never replaces zero with the default ([ADR-0041](adr/0041-honor-zero-enterprise-capacity.md), F-50).

### R-6.2 In-loop expansion **[AS-BUILT]** (constants exposed 2026-08-21, [ADR-0019](adr/0019-expose-me-growth-constants.md); cost unified same day, [ADR-0031](adr/0031-unify-me-capital-requirement.md))

```
expansionBudget = lendable * meExpansionBudgetShare
newMEs = min(floor(expansionBudget / meCapitalRequirement),
             ceil(currentMEs * meMaxMonthlyGrowthRate),
             floor(maxTotalMEs - currentMEs))
```

The headroom is **floored** because `currentMEs` is continuous after attrition (R-6.3). Without the floor a network at its cap relaunched a fraction of an enterprise every month (F-68). A capped network now runs slightly below its cap until a whole enterprise's worth of capacity has left. [ADR-0060](adr/0060-launch-whole-enterprises.md).

Both shares are user inputs, both defaulting to 10% — the values that were previously hardcoded, so no scenario's output moved when *that* landed. `meMaxMonthlyGrowthRate` is the dominant driver of the growth curve (10%/month compounds to about 3.1x/year); it was previously invisible to the user. The divisor was `meSetupCost` until 2026-08-21 — the same under-pricing as R-6.1, fixed in the same change.

See [CHANGELOG.md](../CHANGELOG.md) for the measured effect this had when it was corrected — enterprises became substantially more expensive to establish once working capital was included consistently.

### R-6.3 ME attrition **[AS-BUILT]** (was F-20, fixed 2026-08-20)
Business closure and loan write-down are **separate events with separate parameters**:

```
monthlyExit = 1 - (1 - meExitRate)^(1/12)
currentMEs  = currentMEs * (1 - monthlyExit)
```

`currentMEs` is continuous and floored only where a count is displayed. Exit reduces capacity; it does **not** touch the loan cohorts, which `meDefaultRate` already handles — combining them would double-count the same failure.

They are separate because they come apart in both directions: an enterprise can wind down having repaid in full, and an enterprise can fall behind on payments while continuing to build. `meDefaultRate` is a portfolio quantity (R-3.4); closure is operational. Default `meExitRate` is 10%/yr — a convention, not a measurement. See [ADR-0014](adr/0014-me-attrition-is-separate-from-write-down.md).

### R-6.4 Production capacity **[AS-BUILT]**
`capacity = currentMEs * toiletsPerMeMonth`. There is no learning curve, no seasonality and no supply-chain lag.

### R-6.5 Launch reporting **[AS-BUILT]** (corrected 2026-10-21, [ADR-0040](adr/0040-report-exact-me-launches.md), resolves F-49)

The simulation records the enterprises launched inside each simulated month directly:

```
dataMonthlyNewMes[m]        = newMEs[m]
dataMonthlyNewLoansMeVal[m] = newMEs[m] * meCapitalRequirement(inputs)
```

The monthly implementation table presents these as separate `New MEs` (count) and `New ME Loans` (currency) columns. It must not reconstruct the count by dividing loan value by `meSetupCost`: the loan includes the working-capital component in R-6.1, and active-enterprise changes also include attrition. The separate month-0 row reports `startMEs` and `startupCost` under the same two headings.

---

## 7. Toilet production

### R-7.1 Unserved target need **[AS-BUILT]** (was F-09, fixed 2026-08-20; clarified by F-64)
The target backlog grows with population, net of production:

```
backlog[m] = backlog[m-1] * (1 + popGrowthRate)^(1/12) - production[m]
```

`popReqToilets` is rural population without basic sanitation divided by household size. It is a maximum unserved target, not forecast borrower demand: the model does not estimate willingness to borrow, affordability, eligibility, product preference, or monthly uptake. Output is conditional on sufficient uptake to use the available delivery capacity. `popGrowthRate` used to be collected, auto-filled from the World Bank, and used nowhere — runs at 0% and 10% growth produced byte-identical output (F-09). The recurrence was also implemented in the reverse order until F-43: it subtracted production and then grew the remainder, understating target need by `production × monthlyGrowth`. `dataMonthlyBacklog` is now an audit series and INV-19 pins the specified order. See [ADR-0010](adr/0010-wire-up-collected-inputs.md), [ADR-0035](adr/0035-zero-writedowns-and-demand-order.md), and [ADR-0054](adr/0054-distinguish-population-need-from-borrower-demand.md).

### R-7.2 Unit cost **[AS-BUILT]**

```
inflationFactor[m] = (1 + inflationRate)^(m/12)
unitCost[m]        = avgToiletCost * inflationFactor[m]
grossUnitCost[m]   = unitCost[m] * (1 + variableRate)
```

`unitCost` is what the household receives; `grossUnitCost` is what the fund spends per unit including fees. Affordability tests use `grossUnitCost`; loan principal booked to the borrower uses `unitCost`.

### R-7.3 Constraint resolution **[AS-BUILT]**

```
capacity   = currentMEs * toiletsPerMeMonth     // supply
targetNeed = backlogToilets                     // maximum unserved target, not observed uptake
maxUnits  = floor(lendable / grossUnitCost)     // capital (loans only)
maxGrants = floor(grantCash / grossUnitCost)    // capital (grants only)
```

### R-7.4 Grant/loan split **[AS-BUILT]**
Grants are allocated **first**, then loans fill the remainder:

```
production      = min(capacity, targetNeed)
targetGrants    = floor(production * grantSupportPct)
grantCount      = min(targetGrants, maxGrants)
loanCount       = min(production - grantCount, maxUnits)
```

> **Consequence to be aware of:** because `production` is set from capacity and target need *before* capital is checked, and grants take priority, a grant-rich / loan-poor fund will build its grant quota in full and then build few loan units. Constraint reporting follows this same sequence and separately exposes capacity, loan-capital and grant-capital pressure (R-7.6).

> **`grantSupportPct` is a pacing control, not a volume control (F-30).** Total grant-funded output is capped by the grant ledger, so `maxGrants` binds long before the target percentage does. Measured: sweeping 5% to 90% moves grant-funded toilets from 8,894 to 9,214 (a 3.6% change) while moving the month the grant fund is exhausted from 28 to 4. Any UI copy, advisor rule or solver strategy that treats this parameter as a subsidy-depth dial is wrong. If a genuine depth-of-subsidy control is required, it must be a per-unit subsidy that draws proportionally from both ledgers — a spec change, not a relabel.

### R-7.5 Integerisation and backlog cap **[AS-BUILT]**
Both counts are floored to non-negative integers and jointly capped at `floor(backlogToilets)`, grants taking priority. `production = grantCount + loanCount`.

### R-7.6 Constraint reporting **[AS-BUILT]**

Constraint reporting is derived after the final grant and loan counts are known, using
the same quantities as R-7.4. For whole-toilet output in month `m`:

```
planned                = min(floor(targetNeed), floor(capacity))
capacityForegone       = floor(targetNeed) - planned
loanCapitalForegone    = planned - actualProduction
grantCapitalForegone   = output with the target grant allocation fully funded
                          (loan capacity unchanged) - actualProduction
```

`capacityForegone + loanCapitalForegone` exactly reconciles whole-toilet target need to
actual production. `grantCapitalForegone` is an overlapping diagnostic, not an
additive third component: loans backfill a missed grant target, so loan affordability
is the direct final capital limit while grant affordability can still be a material
contributor.

`dataConstraintBinding[m]` reports `"Target Need"` when nothing was foregone, a single
cause when only one applied, and `"Mixed: ..."` when capacity and capital suppressed
output together. `dataConstraintForegone[m]` retains the three quantities above for
audit and KPI aggregation.

The headline `dominantConstraint` ranks causes by summed foregone monthly output,
reports all other positive causes as secondary, and reports `Unserved Target Met` only when no
output was foregone. Because the same backlog can persist, the aggregate ranks monthly
production opportunities; it is not a count of unique unserved households. See
[ADR-0044](adr/0044-report-actual-production-constraints.md).

### R-7.7 Disbursement **[AS-BUILT]**

```
grantVal = grantCount * unitCost[m];  grantCash -= grantVal + grantVal * variableRate
loanVal  = loanCount  * unitCost[m];  loanCash  -= loanVal  + loanVal  * variableRate
```

The loan cohort is created for `loanVal` (excluding fees) — the household repays the toilet, not the fund's overhead.

---

## 8. Impact

### R-8.1 Carbon **[AS-BUILT]** (was F-02 and F-33, fixed 2026-08-20)

Three unit errors stack on this one parameter, and together they understate carbon revenue by roughly **250,000x** (measured: $6.34 against ~$1,584,878 taking the UI label at its word).

```
newTonnes[m] = activeToilets[m] * co2PerToiletPerYear / 12     // tonnes, accrued monthly
revenue[m]   = newTonnes[m] * co2Value * carbonCreditShare      // share is a decimal
```

Credits accrue **annually against toilets in service**, matching the input's own label of "Tonnes/Yr". Previously the input was divided by 1000 as if it were kilograms (F-33), the fund's share was divided by 100 a second time having already been normalised (F-02), and the credit was granted once at construction rather than each year the toilet operates — together understating carbon revenue by roughly **250,000x**.

Crediting is capped by the configurable `toiletLifespanYears` input (Q11, resolved by [ADR-0016](adr/0016-toilet-service-life.md)).

Revenue accrues to `grantCash`, on the reasoning that carbon finance is concessional. Gated on `co2PerToilet > 0`.

The default is `0.0` because the model has no programme-specific carbon evidence. A factor must come from a project methodology that compares baseline and project sanitation or wastewater systems; it cannot be derived from the number of toilets or people served alone. While the factor is zero, the interface says **Not estimated — project factor required**, rather than presenting zero as a measured result. With carbon priced correctly, the explicit `carbon enabled` scenario flips from *Capital Depleted (Insolvent)* to *Supply Chain (ME Capacity)* — a substantive change in what the model says about carbon-financed sanitation. See [ADR-0049](adr/0049-derive-health-and-report-impact-honestly.md).

### R-8.2 Time saved **[AS-BUILT]** (was F-07, fixed 2026-08-20; gated by service life 2026-08-21, [ADR-0025](adr/0025-service-life-gates-all-impact.md), resolves Q13)
**One** definition, computed monthly in the loop:

```
hoursSaved[m] = creditingToilets[m] * avgHHSize * hoursPerPersonPerDay * 30
totalHoursSaved = sum(hoursSaved)
```

`hoursPerPersonPerDay` is an input (default 0.25). `computeKPIs` sums this array; the second formula, which omitted `avgHHSize` and read annual snapshots, is deleted. The two disagreed by 4.39x and the KPI used the wrong one. `activeToilets[m]` here means `creditingToilets[m]` (R-8.5) — the same in-service count carbon (R-8.1) uses, not every toilet ever built. A toilet past its service life no longer saves time in the model, same as it no longer earns carbon.

### R-8.3 DALYs **[AS-BUILT]** (gated by service life 2026-08-21, [ADR-0025](adr/0025-service-life-gates-all-impact.md), resolves Q13)

```
dalys[m] = creditingToilets[m] * avgHHSize * dalyPerPerson
            * dalyImpactRealisation / 12
```

Accumulated monthly — an area-under-curve measure, so a toilet built in month 1 accrues more DALYs than one built in month 100, **while it remains in service.** `activeToilets[m]` here means `creditingToilets[m]` (R-8.5), same as R-8.2 — a retired toilet stops averting DALYs.

On country load, `dalyPerPerson` is derived from authoritative country observations for one matching year:

```
peopleWithoutBasicSanitation = WorldBankPopulation * (1 - WorldBankBasicSanitationPct / 100)
dalyPerPerson                = WHO sanitation-attributable diarrhoeal DALYs lower bound
                               / peopleWithoutBasicSanitation
```

The WHO record must be `WSH_30_SAN`, both sexes and all ages; the World Bank denominator must use `SP.POP.TOTL` and `SH.STA.BASS.ZS` for the WHO year. The lower uncertainty bound is used deliberately. This is a population-level burden proxy, not a programme effect. `dalyImpactRealisation` is therefore a separate editable share, defaulting to **21%** from the Wolf et al. 2022 point estimate for basic sanitation without sewer connection versus unimproved or limited sanitation (RR 0.79; 95% CI 0.61–1.03, moderate certainty). The assumption is applied proportionally to DALYs across all ages and should be replaced with programme evidence when available. Malawi 2019 resolves to `0.0096719` burden DALY per exposed person-year and about 2,139 physical DALYs averted in the default five-year run. If any API component is absent or invalid, the burden input resets to zero and is shown as not estimated; another country's value is never retained. `dalyValue` remains zero by default, so this physical estimate does not change SROI unless the user separately supplies a supported valuation. See [ADR-0049](adr/0049-derive-health-and-report-impact-honestly.md).

### R-8.4 Social value and the gross social value multiple **[AS-BUILT]** (was F-08; Q1 resolved 2026-08-20, Q2 accepted 2026-08-21; relabelled 2026-10-22, [ADR-0056](adr/0056-label-the-gross-social-value-multiple-honestly.md), F-65)
```
socialValue              = DALYs x dalyValue + hoursSaved x hourValue + carbonTonnes x co2Value
grossSocialValueMultiple = socialValue / capitalInvested        // kpis.value.grossSocialValueMultiple
                                                                 // kpis.value.sroi is an identical legacy alias
```

The multiple is **social value only**. DALY value is included; ending cash is not. It is **not a formal SROI** (R-10.12): no discounting, deadweight, attribution, displacement or drop-off is applied, and none may be invented. Financial performance is reported alongside as `capitalPreservation = netAssets / capitalInvested`, never folded in. See [ADR-0011](adr/0011-sroi-is-social-value-only.md).

Previously the DALY term was computed, displayed prominently, and then silently excluded — so the screen contradicted itself — while ending cash sat in a *social* numerator, letting a fund that hoards capital and builds nothing score well.

The *method* for the value of an hour is settled (R-8.6, derived from local income, not the inherited uncited `$0.50`). The Malawi reference factor is **0.50**, following the conservative opportunity-cost convention used in the World Bank Lilongwe Water and Sanitation Project appraisal. It remains editable and must be recalibrated when a programme reports against different guidance. [ADR-0034](adr/0034-observations-only-country-data.md) supersedes the 0.30 default accepted in [ADR-0030](adr/0030-accept-30-percent-time-value-factor.md).

### R-8.5 Toilet service life **[AS-BUILT]** (2026-08-20)

Toilets are retired `toiletLifespanYears` (default 5) after the month they were built, by vintage rather than from an undifferentiated stock:

```
creditingToilets[m] = toiletsBuiltCumulative[m] - retiredCumulative[m]
```

Only `creditingToilets` earn carbon (R-8.1). `dataMonthlyCreditingToilets` is exported so the gap between built and still-crediting is visible in the audit trail.

**Resolved 2026-08-21 — Q13.** Service life now stops DALYs and time saved (R-8.2, R-8.3), not just carbon — the same `creditingToilets[m]` gates all three. See [ADR-0025](adr/0025-service-life-gates-all-impact.md). At the shipped 5-year default duration this changes nothing (no toilet reaches 5 years of age within a 5-year run); it moves headline impact materially on any run longer than the service life.

### R-8.6 Value of saved time **[AS-BUILT]** (method resolved 2026-08-20; factor accepted 2026-08-21, ADR-0030)

```
hourValue = (avgAnnualIncome / 2080) * timeValueFactor
```

Derived from the country's own income rather than a global constant, and discounted below the market wage because the hour saved is household time, not forgone paid work. `timeValueFactor` defaults to 0.50 for the Malawi reference scenario.

This replaces a hardcoded `$0.50` of unknown provenance — almost certainly Malawi's income per working hour at the full wage rate, frozen into a multi-country tool. It also closes F-25: `avgAnnualIncome` was collected and never used.

The 0.50 Malawi factor and 0.25 hours saved per person per day are sourced to the World Bank Lilongwe appraisal; see [ADR-0015](adr/0015-value-of-saved-time.md) (method) and [ADR-0034](adr/0034-observations-only-country-data.md) (Malawi calibration).

### R-8.7 Jobs supported **[AS-BUILT]** (F-56, [ADR-0049](adr/0049-derive-health-and-report-impact-honestly.md))

```
jobsSupported[y] = floor(activeMEsAtPeriodEnd[y]) * jobsPerMe
headlineJobs     = floor(activeMEsAtHorizon) * jobsPerMe
```

`jobsPerMe` is an explicit, editable programme assumption. Its Malawi reference default is **3**: one owner/operator plus two full-time-equivalent workers per active micro-enterprise. The chart and headline use the same formula. The result is called **jobs supported**, not jobs created or job-years, because the model does not track individual workers or employment duration. Jobs have no monetary value in SROI; the former unsupported `$3,000/job` display is removed.

---

## 9. Terminal state **[AS-BUILT]** (was F-31, fixed 2026-08-20)

The model previously had **no terminal state**. Once `loanCash` falls below `requiredReserves` the solvency gate (R-5.4) closes permanently: no lending, so no new portfolio, so no repayments, so no recovery. The loop keeps running to `duration * 12`, paying the 30% collections-floor ops cost every month against zero income.

Measured on the shipped defaults: production ceases at month 47, the portfolio runs off by month 53, and a 20-year run then pays **$1,085,986** of ops costs with no income, reporting ending cash of **-$1,029,034** versus **-$36,351** for the identical fund run for 5 years.

### R-9.1 Wind-up condition **[AS-BUILT]**
The fund is wound up at the first month where **all** of the following hold:

```
portfolioHh + portfolioMe == 0        // nothing left to collect
production == 0                        // nothing being built
lendable == 0                          // gate closed, no capital to redeploy
```

### R-9.2 Wind-up behaviour **[AS-BUILT]**
In the wind-up month, no new interest or operating cost accrues. All remaining
original senior principal becomes due, and every positive dollar in the loan ledger
is applied through R-4.4: old capitalised interest first, then original principal.
Grant cash remains ring-fenced and is not used for repayment. This terminal transfer
is the only permitted wind-up ledger movement. After it, the ledger freezes and
remaining months are emitted as flat carry-forward rows. See
[ADR-0036](adr/0036-complete-investor-debt-waterfall.md).

### R-9.3 Reporting **[AS-BUILT]**
`cashEnd`, `netAssets`, `fundHealth` and `opsRunway` are measured **at wind-up**, not at the arbitrary end of the requested horizon. Extending `duration` must not change any of them.

### R-9.4 Invariant **[AS-BUILT]**
No month may post an operating cost when the portfolio is empty and production is zero. This becomes **INV-13**.

---

## 10. Integrity versus viability **[AS-BUILT]** (was F-29, fixed 2026-08-20)

The model conflates two claims that must be kept separate, and reports the weaker one in language that implies the stronger.

| | Question | Current state |
|---|---|---|
| **Ledger integrity** | Is the arithmetic self-consistent? | Checked by `verifyLedger`; reports `✅ Model Integrity Verified` |
| **Fund viability** | Does the fund actually work? | **Not reported at all** — solvency failures and investor defaults are `console.warn` only |

This describes the pre-fix state, historical since 2026-08-20 (F-29). On the shipped defaults at the time, the model printed `✅ Model Integrity Verified` for a run that went insolvent in year 4.1 and defaulted on **$749,981** of senior principal — the line that would have failed it was commented out and labelled "optional strictness". See [docs/ANALYSIS.md#f-29](ANALYSIS.md#f-29--the-integrity-check-passes-a-run-that-went-insolvent-and-defaulted) for the original citation; the file it pointed to (`app.js`) no longer exists post-S5 ([ADR-0033](adr/0033-s5-structural-split.md)).

### R-10.1 Two verdicts **[AS-BUILT]**
`calculate` returns two independent results:

```
integrity: { ok: boolean, violations: [...] }   // INV-1 .. INV-13
viability: { ok: boolean, issues: [...] }       // solvency, repayment, OSS
```

### R-10.2 Viability criteria **[AS-BUILT]**
A run is viable only if **all** hold:

| | Criterion |
|---|---|
| V1 | `min(loanCash) >= 0` — the loan ledger is never overdrawn. Judged on `dataMonthlyLoanCash`, not the pooled balance, because grant cash is ring-fenced (R-5.2) and cannot pay debt service or operations. [ADR-0057](adr/0057-judge-solvency-on-the-loan-ledger.md), F-66, Q15. |
| V2 | `seniorPrincipalPastDue <= $1,000` — no scheduled senior principal fell due inside the horizon and went unpaid. Principal scheduled after the horizon is *not yet due*, not a default; wind-up (R-9.2) makes all remaining principal due. Horizon and repayment term are independent inputs. [ADR-0058](adr/0058-separate-repayment-term-from-horizon.md), F-67, Q16. |
| V3 | `capitalisedInterest < $1,000` — no investor interest had to be rolled up when due; the warning also reports the amount still outstanding |
| V4 | `OSS >= 1.0` — loan interest covers operating cost. OSS is the **whole-horizon cumulative** ratio defined in R-11.1, not a steady-state figure. When operating cost is zero OSS is `null` and V4 is not applied. [ADR-0059](adr/0059-oss-counts-only-loan-ledger-income.md), F-69, Q17. |

### R-10.3 Reporting rules **[AS-BUILT]**
1. Both verdicts render **on screen**. The console is not a reporting channel.
2. No success message may be shown while any warning is outstanding.
3. The two are never merged into a single "model OK" indicator.
4. An integrity violation is a **defect in the model**; a viability failure is a **finding about the scenario**. The UI must not make them look alike.

### R-10.4 Advice provenance **[AS-BUILT]** (F-48)

Every financial recommendation shown by the application is produced by rerunning the model with that one candidate change. The visible advice control recalculates the current form and renders the same typed advice returned by `ModelModule.suggestSolvencyFix()`. No parallel rule-of-thumb advisor may recommend an untested change, and advice is never described as artificial intelligence.

### R-10.5 Annual cash-flow chart **[AS-BUILT]** (F-51)

Annual inflows plot above zero and annual outflows plot below zero. `dataGrants[y]` is already the grant spending flow for year `y`, so the grant dataset is `-dataGrants[y]`; it is never differenced as though cumulative. The chart configuration must reconcile to the engine's annual series.

### R-10.6 Final partial period **[AS-BUILT]** (F-52)

Duration is month-granular. Each complete 12-month period is labelled `Year N`; if months remain after the last complete year, one final period is labelled `Year N (M months)`. Its flow fields sum only those remaining months, while cumulative fields snapshot the final simulated month. A valid duration shorter than one year therefore still produces one period and renders every chart.

### R-10.7 Country-input provenance **[AS-BUILT]** (F-53)

Every model input written or derived from authoritative country observations is marked with the same
blue `country-observation` state and carries a human- and machine-readable source description. The
state survives programmatic input events during loading and is removed when the user edits the
value. Programme terms and policy assumptions must never carry that state. The four assumptions
covered by ADR-0050 use a separate amber `programme-assumption` state and retain their entered
values while dated context is rendered beside them. Context-only country indicators remain in the dated country strip and do not masquerade as model inputs. See
[ADR-0046](adr/0046-mark-country-derived-inputs-consistently.md), [ADR-0049](adr/0049-derive-health-and-report-impact-honestly.md), and [ADR-0050](adr/0050-show-api-benchmarks-without-inventing-programme-terms.md).

### R-10.8 Monthly audit-table containment **[AS-BUILT]** (F-61)

The 22-column Monthly Implementation Data table remains inside a dedicated auto-height card that
does not inherit the generic chart component or depend on a later height override. The card owns
its complete background and overflow box. Its viewport is bounded and scrolls on both axes; the
header row remains visible during vertical scrolling. See
[ADR-0051](adr/0051-contain-the-monthly-audit-table-vertically.md) and
[ADR-0055](adr/0055-decouple-the-monthly-audit-card-from-chart-sizing.md).

### R-10.9 On-site model explanation **[AS-BUILT]** (F-62)

The published application links directly to a concise five-step model map and a decision-use
calibration checklist. The explanation distinguishes dated country evidence from editable
programme assumptions, describes the separate grant and loan ledgers, and connects the monthly
waterfall, delivery constraints, loan cohorts, and results. It states that the tool is a
deterministic scenario model rather than a forecast, and that arithmetic integrity is not the same
as programme viability. The interface must not claim that rates create a demand response the
engine does not model or that any selected scenario guarantees repayment. See
[ADR-0052](adr/0052-put-the-model-flow-and-calibration-path-on-site.md).

### R-10.10 Sustainability scorecard mapping **[AS-BUILT]** (F-63)

Every scorecard value is rendered from its canonical KPI field, without reconstructing or renaming
the formula in the UI. Grant Equity Multiple is `grantEquityMultiple` formatted as `x`; Capital
Preservation is `capitalPreservation` formatted as a percentage; OSS is `oss`; and FSS is `fss`.
Senior repayment is reported separately as principal and percentage repaid. No recovery measure
may mix ring-fenced grant cash with senior principal. Public labels and help text state the exact
definitions in R-11.1. One renderer owns these mappings. See
[ADR-0053](adr/0053-use-canonical-sustainability-scorecard-metrics.md).

### R-10.11 Need is not forecast demand **[AS-BUILT]** (F-64)

The public application labels `popReqToilets` as rural population without basic sanitation and the
reach ratio as share of the unserved rural target reached. It does not call either value forecast
demand or SDG 6 gap closure. The methodology states the implicit full-uptake condition: World Bank
coverage data does not measure willingness to borrow, affordability, eligibility, product choice,
or monthly adoption. No uptake percentage is inferred without programme evidence. See
[ADR-0054](adr/0054-distinguish-population-need-from-borrower-demand.md).

### R-10.12 The social value ratio is labelled as a gross multiple, not an SROI **[AS-BUILT]** (F-65)

The public label for `socialValue / capitalInvested` is **Gross Social Value Multiple**. Every
place it appears (dashboard, export, methodology) states that it is undiscounted and unadjusted
and is not a formal SROI, and names the missing adjustments: deadweight, attribution,
displacement, drop-off and discounting. No generic percentage may be invented for any of them.
`kpis.value.grossSocialValueMultiple` is canonical; `kpis.value.sroi` and the `sroi` sensitivity
metric remain as identical legacy aliases for existing specification files. See
[ADR-0056](adr/0056-label-the-gross-social-value-multiple-honestly.md).

---

## 11. KPI definitions

### R-11.1 Export consistency **[AS-BUILT]** (F-47)

Every export must describe one successfully calculated scenario. Its parameter block uses the input snapshot retained with that result, never the current form state. Reported investor liability and leverage use the canonical KPI values defined below; export code must not reconstruct them with parallel formulas.

All are computed in `ModelModule.computeKPIs`, which is **pure**: no DOM access and no mutation of its arguments. The UI must not mutate the returned object; F-14 records the historical defect that did so.

| KPI | Definition | Status |
|---|---|---|
| `toilets` | `dataToiletsMonthlyLoan[last] + dataToiletsMonthlyGrant[last]` | AS-BUILT |
| `people` | `toilets * avgHHSize` (1 toilet = 1 household) | AS-BUILT |
| `jobs` | `floor(activeMEsAtHorizon) * jobsPerMe`; a point-in-time jobs-supported estimate, not job-years | AS-BUILT — [ADR-0049](adr/0049-derive-health-and-report-impact-honestly.md) |
| `OSS` | (household + enterprise loan interest) / (fixed + variable ops) over the whole horizon, or `null` when ops are zero. **Excludes** carbon (grant-ledger income that cannot pay operations), write-offs and finance cost | AS-BUILT — [ADR-0059](adr/0059-oss-counts-only-loan-ledger-income.md) |
| `FSS` | (loan interest + carbon) / (operating expenses + write-offs + investor interest) — carbon stays in this whole-fund ratio | AS-BUILT — investor interest is now real, given a non-zero cost of capital (F-01) |
| `netAssets` | `cashEnd + portfolioOutstanding - investorLiabilityEnd`, where the liability is the one the loop tracked | AS-BUILT — includes capitalised arrears since 2026-08-20 (F-06) |
| `grantEquityMultiple` | `netAssets / investGrant` | AS-BUILT |
| `capitalPreservation` | `netAssets / (investGrant + investLoan)` | AS-BUILT — a whole-fund balance-sheet ratio, not investor repayment |
| `investorRepaidPct` | `totalRepaidPrincipal / investLoan` | AS-BUILT — a share of the whole loan, including principal not yet due |
| `seniorPrincipalPastDue` | scheduled principal that fell due within the horizon and was not paid (`accruedInvestorPrin`, capped at unrepaid principal) | AS-BUILT — [ADR-0058](adr/0058-separate-repayment-term-from-horizon.md); drives V2 |
| `seniorPrincipalNotYetDue` | `investLoan - totalRepaidPrincipal - seniorPrincipalPastDue` | AS-BUILT — [ADR-0058](adr/0058-separate-repayment-term-from-horizon.md) |
| `costPerLatrine` | `(loansDisbursed + grants + ops + writeOffs + investorInterest) / toilets` | AS-BUILT — note this counts *disbursed* loan principal, most of which returns |
| `economicCostPerLatrine` | `(ops + writeOffs + grants + investorInterest) / toilets` — excludes recovered principal | AS-BUILT — this is the more defensible of the two |
| `effectiveCostPerLatrine` | `investGrant / toilets` — subsidy intensity of the whole programme | AS-BUILT |
| `depletionMonth` | first month with negative **loan-ledger** cash, or `null`; `monthsInsolvent` counts the same months | AS-BUILT — numeric; `isSustainable` carries the boolean. `depletionYear` is retained as a display string only. Loan ledger since [ADR-0057](adr/0057-judge-solvency-on-the-loan-ledger.md) |
| `opsRunway` | ending **loan-ledger** cash / `annualFixedOpsCost`, or `null` | AS-BUILT — the `99` sentinel is gone. Grant cash excluded since [ADR-0057](adr/0057-judge-solvency-on-the-loan-ledger.md) |
| `minLoanCash` | `min(dataMonthlyLoanCash)` | AS-BUILT — [ADR-0057](adr/0057-judge-solvency-on-the-loan-ledger.md) |
| `dominantConstraint` | user-facing primary and secondary production constraints; see R-7.6 | AS-BUILT |
| `constraintAnalysis` | machine-readable primary, ranked secondary causes, and foregone-output totals; see R-7.6 | AS-BUILT |

### R-11.2 Evidence-bounded sensitivity **[AS-BUILT]**

`ModelModule.runSensitivity(inputs, specification)` performs deterministic
one-at-a-time comparisons without mutating either argument. A specification contains
one to eight unique numeric input IDs. Every entry supplies `low`, `high`, and a
non-empty `source`; the bounds must bracket the base value and the base, low, and high
scenarios must all pass R-2.8 validation.

The base runs once. Each distinct bound runs once with solvers and console reporting
disabled. Every case reports net assets, ending cash, minimum cash, toilets, senior
repayment share, SROI, and viability. Results are ranked by the absolute low-to-high
swing in the selected supported metric. Invalid or undocumented specifications return
typed `{ ok: false, errors }` output and run no sensitivity scenarios.

No built-in low/high ranges exist. A uniform percentage shock, an unreferenced Malawi
range, or a probability distribution would invent evidence the model does not have.
The JSON CLI accepts project-contained files only and prints no timestamp, so identical
inputs are reproducible byte for byte. See
[ADR-0045](adr/0045-require-evidence-bounded-sensitivity.md).

---

## 12. Invariants

These must hold for **every** run. They are the contract that makes the model auditable, and each has a test in [TESTING.md](TESTING.md).

| ID | Invariant | Status |
|---|---|---|
| **INV-1** | `cash[i] = cash[i-1] + net[i]` for all `i >= 1`, within $1 | AS-BUILT |
| **INV-2** | `cash[0] = investGrant + investLoan - startupCost + net[0]` | AS-BUILT — enforced 2026-08-20 |
| **INV-3** | Output arrays have exactly `duration * 12` elements | AS-BUILT |
| **INV-4** | Cumulative toilet counts are monotonically non-decreasing | AS-BUILT |
| **INV-5** | `kpis.toilets` equals the final monthly cumulative total, within 1 | AS-BUILT |
| **INV-6** | Unit cost is strictly positive in any month with production | AS-BUILT |
| **INV-7** | Inflation factor is non-decreasing when `inflationRate >= 0` | AS-BUILT |
| **INV-8** | No output value is `NaN` or `±Infinity` | AS-BUILT — **checked first and short-circuits**, because `NaN` defeats every later check |
| **INV-9** | `loanFundLiability >= 0`, and `totalRepaidPrincipal <= investLoan` | AS-BUILT |
| **INV-10** | `grantCash >= 0` at every month end (the grant ledger may not go overdrawn) | AS-BUILT |
| **INV-11** | Write-offs never appear in `netFlow` | AS-BUILT |
| **INV-12** | Running `calculate(inputs)` twice with identical inputs yields identical output | AS-BUILT — and the controller no longer mutates inputs either ([ADR-0009](adr/0009-advisory-not-automatic.md)) |
| **INV-13** | No ops cost is posted in a month that *opens* with an empty portfolio and zero production | AS-BUILT |
| **INV-14** | Extending `duration` alone must not change `cashEnd`, `netAssets` or `investorRepaidPct` | AS-BUILT — 5y and 20y now both give -$6,717 |
| **INV-15** | `dalys[m]` and `hoursSaved[m]` are computed from `creditingToilets[m]`, the same in-service count carbon uses — a toilet past its service life must not keep averting DALYs or saving time | AS-BUILT — [ADR-0025](adr/0025-service-life-gates-all-impact.md), resolves Q13 |
| **INV-16** | `requiredReserves` includes the next 3 months of scheduled investor principal, not just ops cost | AS-BUILT — [ADR-0027](adr/0027-debt-service-lookahead-reserve.md), resolves F-10 |
| **INV-17** | `grantExhaustedMonth` responds to `grantSupportPct` (pacing) far more than `reach.grantToilets` does (volume) | AS-BUILT — [ADR-0029](adr/0029-grant-support-relabel-and-runway.md), resolves F-30 |
| **INV-18** | The month-0 loan, the in-loop expansion loan, and the affordability check all price one ME identically via `meCapitalRequirement(inputs)` | AS-BUILT — [ADR-0031](adr/0031-unify-me-capital-requirement.md), resolves F-21 |
| **INV-19** | Demand grows before current production is subtracted from the backlog | AS-BUILT — [ADR-0035](adr/0035-zero-writedowns-and-demand-order.md), resolves F-43 |
| **INV-20** | `investorLiabilityEnd = investLoan - principalRepaid + capitalisedInterest - capitalisedInterestRepaid`, and outstanding interest arrears cannot exceed the liability | AS-BUILT — [ADR-0036](adr/0036-complete-investor-debt-waterfall.md), resolves F-44 |
| **INV-21** | A wound-up fund cannot retain positive loan-ledger cash while senior liability remains | AS-BUILT — [ADR-0036](adr/0036-complete-investor-debt-waterfall.md), resolves F-45 |

**INV-8 deserves special emphasis.** A `NaN` slips past every other check in this list, because `NaN != NaN` and `Math.abs(NaN) > 1` is `false`. It is checked explicitly and first, and short-circuits the rest — everything downstream is meaningless once `NaN` is loose.

---

## 13. Modelling decisions

Q1–Q17 are decided. **Q18 is `[OPEN]`**, raised by the 2026-10-22 robustness review
([ANALYSIS.md §4B](ANALYSIS.md)); they must not be resolved in code without the model owner's
decision and an ADR first. New questions are recorded here the same way.

| # | Question | Decision |
|---|---|---|
| Q1 | Does SROI include financial return, or social value only? | Social value only — DALYs in, ending cash out, financial return reported separately. [ADR-0011](adr/0011-sroi-is-social-value-only.md) |
| Q2 | What share of the wage should value saved household time? | 50% for the Malawi reference scenario, following the World Bank Lilongwe appraisal; recalibrate for other programme guidance. [ADR-0034](adr/0034-observations-only-country-data.md), superseding the 30% default in ADR-0030. |
| Q3 | Should grant support be means-tested, or a flat share of production? | Stays flat — means-testing would need a household-level income distribution the model doesn't have. [ADR-0021](adr/0021-grant-support-stays-flat-rate.md) |
| Q4 | Should ME closure and loan write-down be the same parameter? | No — separate parameters, separate events. [ADR-0014](adr/0014-me-attrition-is-separate-from-write-down.md) |
| Q5 | Is cost contingency a mark-up or a drawable reserve? | A mark-up. [ADR-0017](adr/0017-contingency-is-a-cost-mark-up.md) |
| Q6 | May the grant and loan ledgers cross-lend? | No — stay strictly separate. [ADR-0022](adr/0022-ledgers-stay-separate.md) |
| Q7 | Should repeat or upgrade demand exist? | No — one household, one toilet, once. [ADR-0023](adr/0023-no-repeat-or-upgrade-demand.md) |
| Q8 | What should the shipped demo scenario be? | A viable one, chosen by grid search. [ADR-0013](adr/0013-viable-default-scenario.md) |
| Q9 | Should the collections floor taper at wind-up, or stop abruptly? | Stops abruptly — a taper rate would be an invented number. [ADR-0024](adr/0024-collections-floor-stays-abrupt.md) |
| Q10 | Should rates be entered as percentages or decimals? | Percentages. [ADR-0012](adr/0012-percentage-entry-convention.md) |
| Q11 | Should carbon crediting have a finite service life? | Yes, 5 years, configurable. [ADR-0016](adr/0016-toilet-service-life.md) |
| Q12 | What's a reasonable default cost of capital? | 2%, concessional. [ADR-0013](adr/0013-viable-default-scenario.md) |
| Q13 | Should service life gate DALYs and time-saved too, not just carbon? | Yes. [ADR-0025](adr/0025-service-life-gates-all-impact.md) |
| Q14 | Should constraint reporting derive from actual production limits and retain simultaneous causes? | Yes — partition actual foregone production into capacity and loan-capital loss, expose grant-capital recovery separately, and report secondary causes. [ADR-0044](adr/0044-report-actual-production-constraints.md) |
| Q15 | Should the solvency verdict (V1), `depletionMonth` and `opsRunway` test the loan ledger alone rather than the pooled balance? | Yes — loan ledger only; the pooled balance is an audit series. Decided 2026-10-22. [ADR-0057](adr/0057-judge-solvency-on-the-loan-ledger.md) |
| Q16 | Should a repayment term longer than the horizon be rejected, or reported as "not yet due"? Should the UI stop binding term to horizon? | Report as not yet due; V2 fails only on past-due principal; the inputs are independent. Decided 2026-10-22. [ADR-0058](adr/0058-separate-repayment-term-from-horizon.md) |
| Q17 | Should OSS exclude carbon, return `null` at zero operating cost, and use a trailing window? | Exclude carbon; `null` and skip V4 at zero cost; keep whole-horizon. Decided 2026-10-22. [ADR-0059](adr/0059-oss-counts-only-loan-ledger-income.md) |
| Q18 | **[OPEN]** Is the 6-month working-capital floor in `meCapitalRequirement` (`max(6, termHh)`) a sourced assumption, and should it be an input? | Not decided. It has no citation and it multiplies every enterprise loan; see [PARAMETERS.md](PARAMETERS.md#fixed-model-constants) and F-70. |

---

## 14. Change control

1. A change to any `R-n.m` rule requires an [ADR](adr/) explaining why.
2. The ADR must state the expected direction and rough magnitude of the effect on the golden scenarios **before** the code changes.
3. The change lands with its test in the same commit.
4. If a golden scenario's numbers move, the diff is reviewed against the ADR's prediction and the baseline is re-recorded with a note.

See [../AGENTS.md](../AGENTS.md) for the full working procedure.

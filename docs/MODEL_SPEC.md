# Model Specification

**Status:** Normative. This document, not the code (`src/model/`), is the source of truth for the financial mathematics.
**Version:** 1.0 (2026-08-20) — describes commit `2d81863` and the agreed target behaviour.

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

### R-2.5 Fractional units **[AS-BUILT]**
Toilets are integers (`Math.floor` at the point of production, R-7.5). Micro-enterprises are integers. Money, loan balances and demand backlog are continuous.

### R-2.6 Rounding tolerance **[AS-BUILT]**
Invariant checks tolerate $1.00 of floating-point drift per month. Never compare money with `===`.

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
The annual default input is converted to a **monthly hazard on outstanding balance**:

```
probDefault_monthly = 1 - (1 - defaultRate_annual)^(1/12)
```

This is a *fractional continuous write-down*, not a discrete "x% of loans fail". Consequences a reader must understand:

- Realised loss as a share of **disbursed principal** is **not** the headline rate, and it is **not always less than it** — see [F-35](ANALYSIS.md#f-35--r-34s-always-less-than-headline-claim-is-wrong-past-about-18-months). Below roughly a year it is well below the headline (a 5% annual hazard on a 6-month loan realises ~1.5%, because only half a year of exposure applies and the balance is amortising down throughout). Past about 18–24 months the *cumulative* exposure across multiple years overtakes the amortisation effect and realised loss **exceeds** the single-year headline rate (a 5% hazard on a 36-month loan realises ~8%). There is no term at which "headline rate" is a correct estimate of realised loss; it is always either an over- or an under-estimate, and which one flips somewhere in the 18–24 month range.
- `monthlyPayment` is **not** re-amortised after a write-off, so the loss lands on the final payment rather than on a missed one.
- A defaulting loan also earns less interest, because interest is charged post-write-off.

**Label the UI field accordingly** — "Annual portfolio write-down rate", not "Default rate". `tests/writedown.test.js` (`T-DEF-1`) pins realised loss to disbursed principal at several terms so the crossover stays visible instead of silently drifting.

### R-3.5 Defaults are not cash **[AS-BUILT]**
Write-offs reduce cohort balances and are reported in `dataMonthlyDefaults*`, but they are **never** a cash outflow. They must not appear in `netFlow`. (The variable lives in the `outflows` object for reporting convenience only — this naming is misleading and should be renamed to `writeOffs` in Stage 3.)

---

## 4. Investor debt

### R-4.1 Instrument **[AS-BUILT]**
A single senior loan of `investLoan`, drawn in full at month 0, with **flat principal amortisation** over `fundRepaymentTerm * 12 - investorGracePeriod` months, plus interest on the outstanding balance.

### R-4.2 Cost of capital **[AS-BUILT]** (was F-01, fixed 2026-08-20)
`fundCostOfCapital` is an annual rate, converted per R-2.2, applied to `loanFundLiability`. The control exists in `index.html` and is auto-filled from the World Bank `FR.INR.LEND` indicator on country fetch. **The static default is 0, pending Q12** — see [ADR-0004](adr/0004-cost-of-capital-input.md) for why no rate was invented.

### R-4.3 Grace period **[AS-BUILT]** (was F-06, fixed 2026-08-20)
A grace period defers **principal only**. Interest **accrues from month 1** regardless of grace.

Previously both principal and interest were gated on `m > investorGracePeriod`, silently forgiving $68,408 of interest on a 6-month grace at 8%. See [ADR-0007](adr/0007-investor-arrears-and-grace.md).

### R-4.4 Cash-aware service **[AS-BUILT]**
The fund never pays more than it holds. Interest ranks ahead of principal:

```
available = max(0, loanCash)
actualInt  = min(scheduledInt, available)
actualPrin = min(scheduledPrin, max(0, available - actualInt))
```

### R-4.5 Arrears **[AS-BUILT]** (was F-06, fixed 2026-08-20)
Unpaid amounts must not evaporate. Required behaviour:

1. Unpaid interest **capitalises** into `loanFundLiability` at the end of the month it was missed.
2. Unpaid principal remains in `loanFundLiability` (already true by construction).
3. Arrears rank **ahead of new lending** in the waterfall (R-5.1) — they are caught up automatically once cash allows, because scheduled interest is computed on the now-larger liability.
4. `investorLiabilityEnd` must be the **tracked** `loanFundLiability`, not the reconstruction `investLoan - totalRepaidPrincipal`, which ignores capitalised interest and overstates net assets.

`capitalisedInterest` is tracked separately and surfaced as the `INTEREST_CAPITALISED` viability issue, so a fund borrowing from its own lender to stay afloat is visible rather than silent.

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
During winding-down or insolvency (`loanCash < 0`) this drops to **30%** — the "collections floor", representing a skeleton team that still recovers loans.

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

`opsReserveCap` (the separate input formerly labelled "Liquidity Buffer %", now "Starting Capacity Throttle %") is **not** part of `requiredReserves` and was deliberately left that way — see R-6.1 and [ADR-0027](adr/0027-debt-service-lookahead-reserve.md)'s "Alternatives considered". It sizes the month-0 starting ME cohort only, which is its own well-defined (if narrow) job; folding it into the ongoing solvency reserve would conflate two different concepts under one input.

---

## 6. Micro-enterprises

### R-6.1 Startup cohort (month 0) **[AS-BUILT]** (unified 2026-08-21, [ADR-0031](adr/0031-unify-me-capital-requirement.md), resolves F-21)

```
maxTotalMEs         = districts * mePerDistrict
meCapitalRequirement = meSetupCost + (toiletsPerMeMonth * avgToiletCost * max(6, termHh))
affordableStartMEs   = floor(max(0, loanCash - currentReserve) / meCapitalRequirement)
startMEs             = min(maxTotalMEs, affordableStartMEs)
startLoanVolume      = startMEs * meCapitalRequirement   // was meSetupCost alone
```

`meCapitalRequirement(inputs)` is now a single function (`ModelModule.meCapitalRequirement`), used here, in R-6.2's expansion budget, and in the loan R-6.2 books — the same number decides how many MEs the fund can afford and how much it lends them. Before this, the loan booked used setup cost alone — 7.3x less than the affordability check's own number at the shipped defaults — so the fund decided how many enterprises it could afford using the realistic figure, then only lent them a seventh of it.

### R-6.2 In-loop expansion **[AS-BUILT]** (constants exposed 2026-08-21, [ADR-0019](adr/0019-expose-me-growth-constants.md); cost unified same day, [ADR-0031](adr/0031-unify-me-capital-requirement.md))

```
expansionBudget = lendable * meExpansionBudgetShare
newMEs = min(floor(expansionBudget / meCapitalRequirement),
             ceil(currentMEs * meMaxMonthlyGrowthRate),
             maxTotalMEs - currentMEs)
```

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

---

## 7. Toilet production

### R-7.1 Demand **[AS-BUILT]** (was F-09, fixed 2026-08-20)
The backlog grows with population, net of production:

```
backlog[m] = backlog[m-1] * (1 + popGrowthRate)^(1/12) - production[m]
```

`popGrowthRate` used to be collected, auto-filled from the World Bank, and used nowhere — runs at 0% and 10% growth produced byte-identical output (F-09). Over a 10-year run at 2.5%/year the backlog grows about 28%, which changes whether the fund is demand-constrained at all. See [ADR-0010](adr/0010-wire-up-collected-inputs.md).

### R-7.2 Unit cost **[AS-BUILT]**

```
inflationFactor[m] = (1 + inflationRate)^(m/12)
unitCost[m]        = avgToiletCost * inflationFactor[m]
grossUnitCost[m]   = unitCost[m] * (1 + variableRate)
```

`unitCost` is what the household receives; `grossUnitCost` is what the fund spends per unit including fees. Affordability tests use `grossUnitCost`; loan principal booked to the borrower uses `unitCost`.

### R-7.3 Constraint resolution **[AS-BUILT]**

```
capacity  = currentMEs * toiletsPerMeMonth      // supply
demand    = backlogToilets                      // market
maxUnits  = floor(lendable / grossUnitCost)     // capital (loans only)
maxGrants = floor(grantCash / grossUnitCost)    // capital (grants only)
```

### R-7.4 Grant/loan split **[AS-BUILT]**
Grants are allocated **first**, then loans fill the remainder:

```
production      = min(capacity, demand)
targetGrants    = floor(production * grantSupportPct)
grantCount      = min(targetGrants, maxGrants)
loanCount       = min(production - grantCount, maxUnits)
```

> **Consequence to be aware of:** because `production` is set from capacity and demand *before* capital is checked, and grants take priority, a grant-rich / loan-poor fund will build its grant quota in full and then build few loan units. The reported "primary constraint" is computed separately (R-7.6) and can disagree with what actually bound.

> **`grantSupportPct` is a pacing control, not a volume control (F-30).** Total grant-funded output is capped by the grant ledger, so `maxGrants` binds long before the target percentage does. Measured: sweeping 5% to 90% moves grant-funded toilets from 8,894 to 9,214 (a 3.6% change) while moving the month the grant fund is exhausted from 28 to 4. Any UI copy, advisor rule or solver strategy that treats this parameter as a subsidy-depth dial is wrong. If a genuine depth-of-subsidy control is required, it must be a per-unit subsidy that draws proportionally from both ledgers — a spec change, not a relabel.

### R-7.5 Integerisation and backlog cap **[AS-BUILT]**
Both counts are floored to non-negative integers and jointly capped at `floor(backlogToilets)`, grants taking priority. `production = grantCount + loanCount`.

### R-7.6 Constraint reporting **[AS-BUILT]**
`dataConstraintBinding[m]` is `"Demand"`, `"Capacity"` or `"Capital"`, computed from a separate set of comparisons than R-7.4 actually uses. **[OPEN]** Should this be derived from the actual binding term in R-7.4 rather than recomputed? Resolve before Stage 4; it affects the headline `dominantConstraint` KPI.

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

**[OPEN — Q11]** Credits currently accrue for as long as the simulation runs. Whether to cap that with a `toiletLifespanYears` input is undecided. See [ADR-0005](adr/0005-carbon-units-and-accrual.md).

Revenue accrues to `grantCash`, on the reasoning that carbon finance is concessional. Gated on `co2PerToilet > 0`.

The path went unexercised for a long time because `co2PerToilet` is overridden to `0.0` at startup. With carbon priced correctly, the `carbon enabled` scenario flips from *Capital Depleted (Insolvent)* to *Supply Chain (ME Capacity)* — a substantive change in what the model says about carbon-financed sanitation.

### R-8.2 Time saved **[AS-BUILT]** (was F-07, fixed 2026-08-20; gated by service life 2026-08-21, [ADR-0025](adr/0025-service-life-gates-all-impact.md), resolves Q13)
**One** definition, computed monthly in the loop:

```
hoursSaved[m] = creditingToilets[m] * avgHHSize * hoursPerPersonPerDay * 30
totalHoursSaved = sum(hoursSaved)
```

`hoursPerPersonPerDay` is an input (default 0.25). `computeKPIs` sums this array; the second formula, which omitted `avgHHSize` and read annual snapshots, is deleted. The two disagreed by 4.39x and the KPI used the wrong one. `activeToilets[m]` here means `creditingToilets[m]` (R-8.5) — the same in-service count carbon (R-8.1) uses, not every toilet ever built. A toilet past its service life no longer saves time in the model, same as it no longer earns carbon.

### R-8.3 DALYs **[AS-BUILT]** (gated by service life 2026-08-21, [ADR-0025](adr/0025-service-life-gates-all-impact.md), resolves Q13)

```
dalys[m] = creditingToilets[m] * avgHHSize * dalyPerPerson / 12
```

Accumulated monthly — an area-under-curve measure, so a toilet built in month 1 accrues more DALYs than one built in month 100, **while it remains in service.** `activeToilets[m]` here means `creditingToilets[m]` (R-8.5), same as R-8.2 — a retired toilet stops averting DALYs.

### R-8.4 Social value and SROI **[AS-BUILT]** (was F-08; Q1 resolved 2026-08-20, Q2 accepted 2026-08-21)
```
socialValue = DALYs x dalyValue + hoursSaved x hourValue + carbonTonnes x co2Value
SROI        = socialValue / capitalInvested
```

SROI is **social value only**. DALY value is included; ending cash is not. Financial performance is reported alongside as `capitalPreservation = netAssets / capitalInvested`, never folded in. See [ADR-0011](adr/0011-sroi-is-social-value-only.md).

Previously the DALY term was computed, displayed prominently, and then silently excluded — so the screen contradicted itself — while ending cash sat in a *social* numerator, letting a fund that hoards capital and builds nothing score well.

**Q2 accepted 2026-08-21, [ADR-0030](adr/0030-accept-30-percent-time-value-factor.md).** The *method* for the value of an hour is settled (R-8.6, derived from local income, not the inherited uncited `$0.50`). The **0.30 factor** — the share of the wage at which non-market time is valued — remains a conventional round number, not sourced against current published guidance; the model owner has accepted it as the working default rather than leaving it undecided. Treat it as provisional: confirm against your programme's own guidance before publishing an SROI derived from it.

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

Derived from the country's own income rather than a global constant, and discounted below the market wage because the hour saved is household time, not forgone paid work. `timeValueFactor` defaults to 0.30.

This replaces a hardcoded `$0.50` of unknown provenance — almost certainly Malawi's income per working hour at the full wage rate, frozen into a multi-country tool. It also closes F-25: `avgAnnualIncome` was collected and never used.

The 0.30 factor is a convention, accepted as the working default rather than verified against current published guidance — see [ADR-0015](adr/0015-value-of-saved-time.md) (method) and [ADR-0030](adr/0030-accept-30-percent-time-value-factor.md) (factor).

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
From the wind-up month onward: no ops cost accrues, no ledger changes, `windUpMonth` is recorded, and remaining months are emitted as flat carry-forward rows clearly flagged as post-wind-up.

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
| V1 | `min(cashBalance) >= 0` — never insolvent |
| V2 | `totalRepaidPrincipal >= investLoan - $1,000` — senior debt repaid in full |
| V3 | `accruedInvestorInt + accruedInvestorPrin < $1,000` — no arrears outstanding |
| V4 | `OSS >= 1.0` at steady state — operations cover themselves |

### R-10.3 Reporting rules **[AS-BUILT]**
1. Both verdicts render **on screen**. The console is not a reporting channel.
2. No success message may be shown while any warning is outstanding.
3. The two are never merged into a single "model OK" indicator.
4. An integrity violation is a **defect in the model**; a viability failure is a **finding about the scenario**. The UI must not make them look alike.

---

## 11. KPI definitions

All computed in `ModelModule.computeKPIs`, which must be **pure**: no DOM access, no mutation of its arguments. (Today `UI.updateKPIs` mutates the returned object — see F-14.)

| KPI | Definition | Status |
|---|---|---|
| `toilets` | `dataToiletsMonthlyLoan[last] + dataToiletsMonthlyGrant[last]` | AS-BUILT |
| `people` | `toilets * avgHHSize` (1 toilet = 1 household) | AS-BUILT |
| `OSS` | operating revenue / operating expenses, where revenue = loan interest + carbon and expenses = fixed + variable ops. **Excludes** write-offs and finance cost. | AS-BUILT |
| `FSS` | operating revenue / (operating expenses + write-offs + investor interest) | AS-BUILT — investor interest is now real, given a non-zero cost of capital (F-01) |
| `netAssets` | `cashEnd + portfolioOutstanding - investorLiabilityEnd`, where the liability is the one the loop tracked | AS-BUILT — includes capitalised arrears since 2026-08-20 (F-06) |
| `grantEquityMultiple` | `netAssets / investGrant` | AS-BUILT |
| `investorRepaidPct` | `totalRepaidPrincipal / investLoan` | AS-BUILT |
| `costPerLatrine` | `(loansDisbursed + grants + ops + writeOffs + investorInterest) / toilets` | AS-BUILT — note this counts *disbursed* loan principal, most of which returns |
| `economicCostPerLatrine` | `(ops + writeOffs + grants + investorInterest) / toilets` — excludes recovered principal | AS-BUILT — this is the more defensible of the two |
| `effectiveCostPerLatrine` | `investGrant / toilets` — subsidy intensity of the whole programme | AS-BUILT |
| `depletionMonth` | first month with negative total cash, or `null` | AS-BUILT — numeric; `isSustainable` carries the boolean. `depletionYear` is retained as a display string only |
| `opsRunway` | `cashEnd / annualFixedOpsCost`, or `null` | AS-BUILT — the `99` sentinel is gone |
| `dominantConstraint` | see R-7.6 | AS-BUILT |

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

**INV-8 deserves special emphasis.** A `NaN` slips past every other check in this list, because `NaN != NaN` and `Math.abs(NaN) > 1` is `false`. It is checked explicitly and first, and short-circuits the rest — everything downstream is meaningless once `NaN` is loose.

---

## 13. Modelling decisions

Every modelling question this specification has raised has been decided by the model owner and recorded as an ADR. **None are currently open.** If a new one comes up, it gets the next free `Qn` and goes in this table — do not resolve one by writing code; it needs a human decision, recorded as an ADR, first.

| # | Question | Decision |
|---|---|---|
| Q1 | Does SROI include financial return, or social value only? | Social value only — DALYs in, ending cash out, financial return reported separately. [ADR-0011](adr/0011-sroi-is-social-value-only.md) |
| Q2 | Is 0.30 the right share of the wage at which to value saved household time? | Accepted as the working default; method is sourced, the factor is a documented convention — confirm against your own programme's guidance before publishing. [ADR-0030](adr/0030-accept-30-percent-time-value-factor.md) |
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

---

## 14. Change control

1. A change to any `R-n.m` rule requires an [ADR](adr/) explaining why.
2. The ADR must state the expected direction and rough magnitude of the effect on the golden scenarios **before** the code changes.
3. The change lands with its test in the same commit.
4. If a golden scenario's numbers move, the diff is reviewed against the ADR's prediction and the baseline is re-recorded with a note.

See [../AGENTS.md](../AGENTS.md) for the full working procedure.

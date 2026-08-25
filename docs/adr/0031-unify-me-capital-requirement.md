# ADR-0031: One micro-enterprise capital requirement, used everywhere (F-21)

- **Status:** Accepted
- **Date:** 2026-08-21
- **Stage:** S3
- **Findings:** F-21 (second half — R-6.2's constant exposure was ADR-0019; this is R-6.1)
- **Spec rules touched:** R-6.1, R-6.2

## Context

Three places in the model each compute "what does it cost to establish one micro-enterprise," and they disagree:

1. **The month-0 affordability check** correctly prices a full launch — setup cost *plus* working capital to bridge production until loan repayments arrive: `startupCostPerMe = meSetupCost + (toiletsPerMeMonth * avgToiletCost * max(6, termHh))`. At the shipped defaults that is **$14,600/ME**.
2. **The month-0 loan actually booked** uses setup cost alone: `startLoanVolume = startMEs * meSetupCost` — **$2,000/ME**, 7.3x less than what the affordability check just used to decide how many MEs the fund could afford.
3. **In-loop expansion** (R-6.2) uses the same bare `meSetupCost` for both its budget divisor and the loan it books — the same under-pricing, every month, for the life of the run.

The fund decides how many enterprises it can afford using the realistic, working-capital-inclusive number, then only lends enterprises the cheap number. Measured effect of this gap: enterprises are running on roughly a seventh of the capital the model's own affordability logic says they need.

## Decision

One function, `ModelModule.meCapitalRequirement(inputs)`, returns `meSetupCost + (toiletsPerMeMonth * avgToiletCost * max(6, termHh))` — exactly the formula the affordability check already used. All three call sites now use it: the month-0 loan booked, the in-loop expansion budget divisor, and the in-loop expansion loan booked. The affordability check itself is unchanged (it already had the right number; it just wasn't the one used to write the loan).

## Prediction

**Measured before implementing**, by running the fix in a scratch copy against all 21 golden scenarios and comparing to the current code.

**Reach falls substantially — this is a big change, not a cleanup.** Enterprises that were previously launched and expanded on under-priced loans now cost 7.3x more to establish, so fewer of them fit inside the same lendable capital:

| Scenario | Toilets | MEs | Net assets |
|---|---|---|---|
| `baseline (index.html defaults)` | 121,358 → 97,744 (**-19.5%**) | 801 → 254 (**-68.3%**) | $1,174,828 → $914,174 (-22.2%) |
| `long horizon (20y)` | 570,026 → 351,462 (-38.3%) | 1,000 → 355 (-64.5%) | $9,670,294 → $5,276,295 (-45.4%) |
| `no ME attrition` | 125,184 → 104,331 (-16.7%) | 1,000 → 391 (-60.9%) | $1,214,157 → $1,002,341 (-17.4%) |

MEs fall much harder than toilets (60-68% vs 17-38%) — fewer, properly-capitalised enterprises rather than proportionally fewer toilets, because `toiletsPerMeMonth` is fixed per enterprise regardless of how it's financed.

**One viability verdict flips: `with cost of capital (8%)` goes from viable to insolvent** (net assets $146,724 → -$18,701, min cash $17,802 → -$5,819). This is the one to read carefully: **the model may currently be overstating viability in cost-of-capital-sensitive scenarios**, because it lets enterprises operate on less capital than the model's own affordability logic says they need. No other scenario's verdict changes — the five already-failing scenarios (`grant capital only`, `high defaults`, `capital constrained`, `demand constrained`, `capacity constrained`, `short horizon`) stay failing.

## Alternatives considered

- **Fix only the in-loop expansion, leave month-0 as-is.** Rejected: it's the same defect in two places; fixing one and not the other leaves the same internal contradiction, just smaller.
- **Lower the affordability check to match the cheap loan instead of raising the loan to match the affordability check.** Rejected: that direction removes the working-capital allowance the model already correctly identifies as necessary, rather than fixing the loan that ignores it. It would "solve" the disagreement by deleting the more correct of the two numbers.
- **Split working capital into its own loan, tracked separately from the setup-cost loan.** A more elaborate design (two cohorts per ME instead of one) that might better reflect how these facilities are actually structured in practice. Rejected for this pass: it's a bigger modelling decision than "make the existing numbers agree," and the single-cohort version is what R-6.1 already specified before this fix — reopen as its own ADR if a programme's actual loan structure needs it.

## Consequences

Micro-enterprises are now capitalised the way the model's own affordability math already assumed they were. Reach drops substantially at the shipped defaults and on every scenario that finances ME expansion — this is the fix working as intended, not a regression, but it is the largest single-scenario reach reduction of any fix in this project's history and should be read as such. Any board paper or funding proposal generated before this date should be re-run, same as after ADR-0027 (F-10).

The default parameter set (ADR-0013) was chosen by a grid search that predates both ADR-0027 and this ADR; it has not been re-run against either stricter rule, so "the chosen point survives six stress cases" (STATUS.md) describes the search that picked these defaults, not a guarantee that still holds today at full strength.

## Verification

```bash
npm test               # 0 failures — a new invariant confirms all three ME-cost call sites agree
npm run golden:diff    # matches the table above; one viability flip (with cost of capital (8%))
```

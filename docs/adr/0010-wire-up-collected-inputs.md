# ADR-0010: Connect the inputs that were collected and then ignored

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S3 (pulled forward with the rest of the correctness batch)
- **Findings:** F-09, F-07
- **Spec rules:** R-7.1, R-8.2

## Context

Two parameters were gathered from the user, displayed as though they mattered, and then dropped.

**Population growth.** `popGrowthRate` was read by `getInputs`, auto-filled from the World Bank `SP.POP.GROW` indicator, and referenced **nowhere else in the file**. The demand backlog was set once and only ever decreased. Runs at 0% and 10% population growth produced byte-identical output. Over a ten-year horizon at 2.5%/year the unserved backlog grows by about 28%, so the model was showing the fund closing a gap that is in fact widening.

**Hours saved.** Two incompatible formulas coexisted. The loop computed, per month:

```js
toiletsBuiltCumulative * avgHHSize * 0.25 * 30
```

and `computeKPIs` computed, from annual snapshots:

```js
sum(dataToilets) * 0.25 * 365
```

The second omits household size entirely. They disagreed by **4.39x** — and the array the loop so carefully built was never read. The KPI, the SROI and the headline impact figure all used the smaller, wrong one.

## Decision

**Demand grows.** The backlog compounds monthly at `(1 + popGrowthRate)^(1/12) - 1`, net of production.

**One hours definition**, in the loop, against toilets in service. `computeKPIs` sums that array. The annual-snapshot formula is deleted. The 0.25 hours/person/day assumption becomes a named input, `hoursPerPersonPerDay`, rather than a constant appearing twice.

## Prediction

Population growth: **no change to output at the shipped scale**, because the fund reaches only 3.9% of its target — it is nowhere near demand-constrained, so a larger backlog changes nothing it builds. It changes the *denominator* the fund is judged against, which is the point. Scenarios that are genuinely demand-constrained (`demand constrained`, `popReqToilets: 5000`) will move.

Hours: SROI up roughly 4.4x wherever the hours term dominates.

## Alternatives considered

- **Delete `popGrowthRate` instead of wiring it.** Rejected: a sanitation fund's central question is whether it outruns population growth. Removing the input would remove the question.
- **Keep the annual formula and fix it in place.** Rejected: the loop already computes the right thing monthly, and a monthly area-under-curve is the correct treatment for a stock that accumulates. Two definitions was the bug.
- **Leave 0.25 hardcoded.** Rejected: it is an assumption, and assumptions belong in `PARAMETERS.md` with a visible control, not buried in the loop twice.

## Consequences

The SDG-6 gap figure and `dominantConstraint` now respond to demographic pressure, so a fund that looks adequate against a static target may not be against a growing one.

SROI moves by a large multiple in every scenario. It was **wrong before and is right now**, but anyone comparing an SROI figure to one produced before this change is comparing two different metrics. This does not resolve the deeper SROI questions (Q1, Q2) — the uncited `$0.50`/hour is still uncited, and DALY value is still excluded. Those remain blocked on the model owner.

## Verification

```
node tools/verify-findings.js
FIXED  F-09  popGrowthRate now grows the demand backlog
FIXED  F-07  the KPI layer now sums the loop array instead of recomputing it
             loop array and KPI agree at 338,123,550 hours.
```

Observed: `baseline` sroi 7.70 → 33.81 (+339%), consistent with the 4.39x hours correction. `tests/wiring.test.js` no longer lists `popGrowthRate` as collected-but-unused; `avgAnnualIncome` is the last one left.

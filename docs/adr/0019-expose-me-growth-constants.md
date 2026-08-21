# ADR-0019: Expose the two hardcoded ME-expansion constants as inputs

- **Status:** Accepted
- **Date:** 2026-08-21
- **Stage:** S3
- **Findings:** F-21 (partial — R-6.2 only; R-6.1's `meCapitalRequirement` unification is a separate, behaviour-changing task, still open)
- **Spec rules touched:** R-6.2

## Context

In-loop micro-enterprise expansion ([app.js](../../app.js), `ModelModule.calculate`, the "A. ME Expansion" block) hardcodes two `0.1` constants:

```js
const expansionBudget = lendable * 0.1;
const potentialNew = Math.min(Math.floor(expansionBudget / meSetup), Math.ceil(currentMEs * 0.1));
```

Per R-6.2, the second constant is the dominant driver of the growth curve — 10%/month compounds to roughly 3.1x/year — and neither is visible to, or adjustable by, the user. A programme with real cohort-growth data has no way to enter it; a user modelling faster or slower business recruitment has no lever.

## Decision

Add two inputs, `meExpansionBudgetShare` and `meMaxMonthlyGrowthRate`, both percentages (R-2.3 convention), both defaulting to **10%** — the values already hardcoded. Replace the two `0.1` literals with `inputs.meExpansionBudgetShare` and `inputs.meMaxMonthlyGrowthRate`.

This is deliberately the *narrow* half of F-21. The finding also covers R-6.1 (three inconsistent ME-capital-requirement formulas across the startup cohort, in-loop expansion and affordability check), which is a real behaviour-changing unification left for a separate ADR — conflating the two would make this change's golden diff unreadable and its "no behaviour change" claim false.

## Prediction

**Defaults unchanged, so no golden scenario moves.** This is purely "name the constant and let it be set", not a modelling change. If any golden value moves, that is a bug in this change, not an expected consequence of it.

## Alternatives considered

- **Do the full R-6.1 + R-6.2 unification in one change.** Rejected here: it changes `startLoanVolume` (currently `meSetup` only; the reconciled formula would include working capital), which moves ME lending and downstream cash figures across every scenario. That deserves its own ADR with its own predicted golden diff, not to ride along with a zero-behaviour-change parameter exposure.
- **Leave the constants hardcoded and only document them in `PARAMETERS.md`.** Rejected: documentation without a control is exactly the gap F-24 already flagged elsewhere in this codebase — a user still cannot change what they can now at least see explained.

## Consequences

A user can now tune how aggressively the fund recruits new micro-enterprises without editing code. `docs/PARAMETERS.md` gains two rows. R-6.1's unification remains open and is now the entirety of what is left of F-21.

## Verification

```bash
npm test                # 0 failures, two new wiring assertions
npm run golden:diff     # "No behaviour change" — defaults are unchanged
```

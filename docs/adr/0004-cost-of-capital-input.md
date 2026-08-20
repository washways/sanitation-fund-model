# ADR-0004: Give the fund's cost of capital a control, and default it to zero

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S1
- **Findings:** F-01
- **Spec rules:** R-4.2

## Context

`UI.getInputs()` read `inputs.fundCostOfCapital`. No element with that id existed in
`index.html`. `getRaw()` returns its default when `getElementById` returns null, so the
value was **0 in every run the tool has ever produced**, and the fund paid its senior
investors no interest at all.

Nothing failed. The arithmetic was self-consistent, the invariants passed, and the
README described a "Senior Debt Service (Must be paid first)" waterfall that was, in
practice, a zero-interest amortisation.

## Decision

Add the control to `index.html`. On country fetch, seed it from the World Bank
commercial lending rate (`FR.INR.LEND`), which is already retrieved, and label it as
such.

**Ship the static default as 0**, not as a guessed rate. Concessional senior debt to a
sanitation fund prices below the commercial rate, but by a deal-specific margin we do
not have. Inventing one would replace a silent zero with a silent fiction, and would
change every existing scenario's numbers on our authority rather than the user's.
The viability banner now states plainly when the fund is paying no interest, so a zero
is visible rather than assumed.

**This leaves an open question for the model owner** (Q12): what the shipped default
should be.

## Prediction

| Scenario | Field | Direction | Magnitude |
|---|---|---|---|
| all, at default 0 | everything | unchanged | 0% |
| `with cost of capital (8%)` | totalInvestorInterest | up | large |
| `with cost of capital (8%)` | netAssets | down | 10–25% |
| `with cost of capital (8%)` | toilets | down | a few % (interest competes with lending for cash) |

## Alternatives considered

- **Default to 8%.** Rejected: it changes every historical scenario on a number we
  made up. Rule 5 of `AGENTS.md` exists for this.
- **Default to the commercial lending rate.** Rejected as a *static* default for the
  same reason, but adopted as the *fetched* default, where it is at least sourced and
  labelled.
- **Remove the parameter.** Rejected: a blended-finance model that cannot represent the
  cost of its senior tranche is not modelling blended finance.

## Consequences

The cost of capital becomes visible and settable. Every scenario built before this
change understated fund cost, and re-running old scenarios will now give different
answers once a rate is entered — which is the correct outcome, not a regression.

`tests/wiring.test.js` now fails if any input the model reads lacks a control, so this
class of defect cannot recur silently.

## Verification

```
node tools/verify-findings.js
FIXED  F-01  fundCostOfCapital has a control and produces investor interest
             input present in index.html: true. At 8%: $787,299 of interest paid,
             $163,120 capitalised.
```
Observed: `with cost of capital (8%)` netAssets -$1,348,902 → -$1,567,516 (-16.2%),
toilets 177,746 → 168,096 (-5.4%). Both within the predicted range.

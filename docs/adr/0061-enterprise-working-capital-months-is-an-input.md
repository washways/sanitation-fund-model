# ADR-0061: Enterprise working-capital months is an input

- **Status:** Accepted
- **Date:** 2026-10-23
- **Stage:** S6
- **Findings:** F-70
- **Questions:** Q18
- **Spec rules touched:** R-6.1, R-6.2

## Context

Every enterprise loan is sized by `meCapitalRequirement`:

```
meSetupCost + toiletsPerMeMonth * avgToiletCost * max(6, termHh)
```

The `6` is the minimum number of months of production an enterprise must be able to finance.
It has no citation, it is not in the parameter dictionary, and no user could see or change it.
It sizes every enterprise loan, the startup cohort and the affordable-network cap. Rule 4 of
AGENTS.md says every number must be an input, an indicator, or a documented assumption.

At the Malawi reference the household term is 12 months, so `max(6, 12) = 12` and the floor does
not bind. It binds only when the household term is shorter than 6 months.

## Decision

The model owner chose to make it an input (Q18):

- New input `meWorkingCapitalMonths`, labelled *ME Working Capital (Months)*, default `6`.
- `meCapitalRequirement` uses `max(meWorkingCapitalMonths, termHh)`. The household term stays as
  a floor because an enterprise cannot be paid faster than households repay.
- Validation requires a finite, non-negative value.
- The default is recorded in PARAMETERS.md as an **owner planning assumption with no external
  source**. Keeping 6 preserves every result; no new number is invented.

## Prediction

No golden scenario moves. The default equals the old literal, and no golden scenario has a
household term below 6 months. `npm run golden:diff` must report no behaviour change.

## Alternatives considered

- **Keep 6 fixed and document it.** Rejected by the owner: users could not test how sensitive
  results are to it.
- **Drop the floor and use the household term only.** Rejected: it shrinks enterprise loans in
  short-term scenarios on no evidence, which is a new unsourced assumption.

## Consequences

Users can test 3 or 9 months directly, and `runSensitivity` accepts it as a parameter. The value
remains unsourced until a programme supplies evidence; PARAMETERS.md says so.

## Verification

`tests/working-capital.test.js` fails before and passes after. `tests/wiring.test.js` checks the
control reaches the model and that `tools/baseline-inputs.js` matches `index.html`.

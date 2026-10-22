# ADR-0054: Distinguish population need from borrower demand

- **Status:** Accepted
- **Date:** 2026-10-22
- **Stage:** S6
- **Findings:** F-64
- **Spec rules touched:** R-2.5, R-2.7, R-7.1, R-7.3, R-7.4, R-7.6, R-10.11

## Context

`popReqToilets` is derived from rural population without basic sanitation, then divided by household
size to form the maximum remaining need. The interface calls it “Pop. Needing Toilets,” the model
and methodology call the resulting stock “demand,” and the results call progress “SDG6 Gap Closed.”
Those names imply more than the data and engine support. The API does not observe willingness to
borrow, affordability, eligibility, product preference, or monthly uptake; the cited UNICEF Malawi
pilot explicitly describes its target as low-income households that are willing and able to borrow.
The model also does not establish that every financed unit moves a household into the complete SDG
6.2 service definition.

## Decision

Describe the API value as rural population without basic sanitation and the model stock as unserved
target need, not forecast demand. Relabel the reach ratio as share of the unserved rural target
reached, state the full-uptake assumption prominently, and report target completion as “Unserved
Target Met” rather than “Demand Met.” Do not invent an uptake rate.

## Prediction

No numeric value or calculation changes. All 21 recorded golden scenarios retain the same numbers
and constraint labels because none exhausts the national target. The dedicated target-exhaustion
test changes one explanatory string from `Demand Met (Success)` to `Unserved Target Met`.

## Alternatives considered

- **Add a default uptake percentage.** Rejected: no evidence in the current sources supports one
  national rate, and inventing it would create a false sense of realism.
- **Use the pilot’s 80% geographic targeting figure as uptake.** Rejected: programme coverage of
  selected Traditional Authorities is not borrower willingness or eligibility.
- **Keep “demand” as shorthand.** Rejected: users reasonably read demand as expected take-up, which
  this model does not estimate.

## Consequences

Toilet output is explicitly a conditional delivery scenario under sufficient household uptake. A
decision-grade forecast must replace the implicit full-uptake assumption with programme evidence or
a separately specified adoption model. The existing backlog mathematics and country API boundary
remain unchanged.

## Verification

`tests/documentation.test.js` pins the public terminology and limitation;
`tests/constraint-reporting.test.js` pins the target-completion label. The full suite and golden
comparison must retain every numeric result.

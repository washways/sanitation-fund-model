# ADR-0035: Honor zero write-downs and the specified demand recurrence

- **Status:** Accepted
- **Date:** 2026-10-20
- **Stage:** Post-S5 audit
- **Findings:** F-42, F-43
- **Spec rules touched:** R-3.4, R-7.1

## Context

The model substitutes defaults with `inputs.hhDefaultRate || 0.05` and
`inputs.meDefaultRate || 0.10`. A valid zero is falsy, so a user entering 0% receives 5% and
10% write-downs. The existing zero test reimplements the recurrence instead of calling
`ModelModule.calculate()`, so it proves the formula but not the product.

R-7.1 specifies `backlog[m] = backlog[m-1] * growth - production[m]`. The loop instead
subtracts production and then grows the remainder. It therefore removes an extra
`production * monthlyGrowth` people-equivalent of demand every month.

## Decision

Use nullish/default-presence checks so an explicit zero write-down remains zero. Update demand
in the order specified by R-7.1 and expose the monthly backlog as an audit series so the
recurrence can be tested directly.

## Prediction

Written before implementation.

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| zero defaults | write-downs | down | to exactly zero |
| zero defaults | net assets | up | material, roughly $1m on the pre-change defaults |
| zero defaults | toilets | up | roughly 20-30% |
| demand constrained | demand/reach | up or unchanged | below 1%; corrected backlog is slightly larger |
| baseline and other capital/capacity constrained cases | headline outputs | unchanged | demand does not bind |

## Alternatives considered

- **Disallow 0% write-downs.** Rejected. Zero is a legitimate stress case and the UI already
  represents it.
- **Change the specification to match the demand code.** Rejected. Growing the population
  before subtracting current production is the stated and economically coherent recurrence.
- **Test another copied cohort loop.** Rejected. That is how the existing regression escaped;
  the new test must execute the full model.

## Consequences

The zero-default golden scenario finally means what its name says. Monthly backlog becomes an
explicit audit output. No new input or dependency is introduced.

## Verification

Measured after implementation: the full-model zero-default scenario reports exactly zero HH and
ME write-offs, 140,766 toilets, and $1,273,743 net assets. Relative to the new 5%/5% Malawi
baseline, removing write-downs adds 18.8% reach and about $801,000 of net assets, close to the
predicted direction and rough scale. INV-19 directly verifies the corrected backlog recurrence.
The combined golden diff also contains ADR-0034's default movements, so the demand-constrained
scenario's total change is not an isolated measure of this one-line ordering fix.


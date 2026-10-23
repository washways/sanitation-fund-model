# ADR-0060: Launch micro-enterprises in whole units

- **Status:** Accepted
- **Date:** 2026-10-23
- **Stage:** S4
- **Findings:** F-68
- **Spec rules touched:** R-2.5, R-6.2

## Context

R-2.5 says micro-enterprises are integers, and the monthly table reports `New MEs` as a count
(ADR-0040). Attrition (R-6.3) makes the active count continuous, which is deliberate. But the
expansion step computed its headroom as `maxTotalMEs - currentMEs` without flooring it. Once a
network reached its cap, attrition removed about 0.035 of an enterprise each month and expansion
launched 0.035 of one back, with a loan of about $400. In the `capacity constrained` golden
scenario (4-enterprise cap) 45 of 60 months recorded a fractional launch. Those fractional
enterprises built real toilets.

## Decision

Floor the headroom: `space = floor(maxTotalMEs - currentMEs)`. A network at its cap stays below
it until a whole enterprise's worth of capacity has left, then relaunches one whole enterprise.
Attrition stays continuous.

## Prediction

Measured with a headless probe that applied exactly this change to the shipped source.

| Scenario | Field | Before | After |
|---|---|---|---|
| capacity constrained | toilets | 1,394 | 1,220 (−12.5%) |
| capacity constrained | totalLoansMe | $52,727 | $45,600 |
| capacity constrained | netAssets | $472,753 | $471,115 |
| capacity constrained | minLoanCash | −$6,701 | −$8,478 |
| capacity constrained | costPerLatrine | $531 | $584 |
| other 20 | all fields | unchanged | unchanged |

The baseline never reaches its 560-enterprise cap and is unaffected.

## Alternatives considered

- **Round the active count after attrition.** Rejected: it would make attrition lumpy and change
  every scenario, and the continuous count is the documented convention (R-6.3).
- **Use `ceil(currentMEs)` for headroom.** Equivalent in effect; `floor` of the difference reads
  directly as "whole enterprises of room".
- **Do nothing.** Rejected: fractional enterprises produced 174 toilets with no enterprise behind
  them.

## Consequences

Capped networks run slightly below their cap between relaunches, which is how a real programme
with a fixed roster behaves. Reported reach falls in capacity-limited scenarios.

## Verification

`tests/whole-enterprises.test.js` fails before and passes after. `npm run golden:diff` must show
only the `capacity constrained` moves above.

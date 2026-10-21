# ADR-0047: Start with an explicit pilot share of the enterprise network

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S3
- **Findings:** F-54
- **Spec rules touched:** R-6.1

## Context

R-6.1 currently starts the largest enterprise cohort that available loan capital can afford after a
one-off capital holdback. In the Malawi reference scenario this launches **285 enterprises at month
zero**, lends them **$3.249m**, and records **$25,797 of enterprise interest plus $259,190 of
principal in month one**. No household interest exists yet. The programme therefore begins at 51%
of its eventual 560-enterprise network and has no mobilisation or pilot phase.

The input controlling this is labelled `Starting Capacity Throttle`, but its arithmetic is indirect:
15% of *combined grant and loan capital* is subtracted from the loan ledger for the sole purpose of
sizing month-zero enterprises. It is neither an operating reserve nor a readily interpretable rollout
target.

Measured alternatives, with every other Malawi assumption unchanged:

| Month-zero cohort | Month-one ME interest | MEs at month 12 / 24 | Five-year toilets | Senior repaid | Viable |
|---:|---:|---:|---:|---:|---|
| 28 (one per district) | $2,534 | 91 / 206 | 52,312 | 97.66% | No |
| 56 (10% of target network) | $5,069 | 168 / 271 | 70,212 | 100% | Yes, but FSS 0.995 |
| 84 (15% of target network) | $7,603 | 232 / 314 | 83,350 | 100% | Yes; FSS 1.064 |
| 285 (current affordable maximum) | $25,797 | 368 / 419 | 118,509 | 100% | Yes |

## Decision

Replace the indirect holdback with an explicit `Initial ME Network (% of Target)` input. Month-zero
enterprises are the lesser of the affordable cohort, the network ceiling, and the ceiling of the
network target multiplied by this share. Default the share to **15%** as a transparent interim pilot
assumption. This retains the existing documented 15% programme input while replacing its opaque
capital-holdback meaning with the operational claim it was intended to control. A 10% pilot was
tested but rejected as the default because five-year FSS is 0.995, leaving effectively no margin.
The value is not country data and must be recalibrated from an implementation plan before an
investment decision.

In-loop expansion, enterprise attrition, capital per enterprise, and the rolling solvency reserve do
not change.

## Prediction

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| Malawi baseline | startup enterprises | down | 285 to 84 (-71%) |
| Malawi baseline | month-one ME interest | down | $25.8k to $7.6k (-71%) |
| Malawi baseline | five-year toilets | down | 118.5k to about 83.4k (-30%) |
| Malawi baseline | net assets | down | $472.6k to about $176.8k (-63%) |
| Malawi baseline | senior repayment | unchanged | remains 100% |
| other delivery scenarios | startup cost and early ME income | generally down | scenario-dependent |

Golden movement is intentional and must be recorded with this ADR. Any loss of baseline viability,
ledger integrity, or full baseline senior repayment would contradict the decision and stop the change.

## Alternatives considered

- **One enterprise per district (28 in Malawi).** Operationally easy to explain and cuts first-month
  interest to $2.5k, but the current capital structure repays only 97.66% of senior principal over
  five years. Adopting it would require a second decision about investor terms or additional capital.
- **Keep the affordable maximum and add a repayment holiday.** Rejected: it changes the timing of
  receipts but still claims 285 enterprises were recruited, capitalised, and operating at time zero.
- **Use 10% of the target network.** This remains available to the user and preserves repayment, but
  its measured FSS is 0.995. The 15% default retains a modest operating margin without restoring the
  instant half-network rollout.
- **Use 10% of initial capital.** Rejected: capital share is not delivery-network share and changes
  unpredictably with enterprise cost. The operational claim should be stated in enterprises.
- **Keep `Starting Capacity Throttle`.** Rejected: a percentage of combined capital subtracted from
  one ledger is not an intelligible rollout assumption and caused the over-ambitious start.

## Consequences

The default describes a pilot that scales, rather than a half-built national network appearing before
month one. Early interest and principal fall materially, as does five-year reach. Baseline viability
is preserved, but with less headroom. Users can enter a sourced implementation target directly; for
example, with 20 enterprises per district, 5% corresponds to one starting enterprise per district.

## Verification

`npm test` passes 114/114 across 14 suites, lint is clean, and `npm run golden:diff` reports no
unrecorded movement after the reviewed golden update. Three rollout regressions pin the 15% target,
affordability cap, zero-seed case, baseline viability, FSS margin, and full senior repayment.

The actual baseline movement matches the prediction: 285 to 84 startup enterprises, $25,797 to
$7,603 month-one ME interest, 118,509 to 83,350 toilets, and $472,563 to $176,782 net assets. The
baseline remains internally consistent, viable, and fully repays senior principal. The 559-value
golden movement is recorded with this ADR.

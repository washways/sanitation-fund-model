# ADR-0041: Honor an explicit zero enterprise-capacity input

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S6 robustness follow-up
- **Findings:** F-50
- **Spec rules touched:** R-6.1

## Context

`mePerDistrict` is defined and validated as a non-negative whole-number capacity
assumption, so zero is a valid way to model a programme with no sanitation enterprise
network. The engine nevertheless calculates the ceiling as:

```js
inputs.districts * (inputs.mePerDistrict || 20)
```

JavaScript treats zero as false, so an explicit zero silently becomes the shipped
default of 20. Measured on the Malawi reference scenario, both 0 and 20 produce 285
startup enterprises, 345 at the horizon, 118,509 toilets, and a viable verdict. A
user's zero-capacity stress test is therefore replaced by a healthy default scenario.

## Decision

Use the validated `mePerDistrict` value directly when calculating `maxTotalMEs`. Do not
apply a model-layer fallback: missing and malformed values are already rejected by the
F-46 input boundary.

## Prediction

This ADR was written before implementation. A `districts: 0` run is mathematically
equivalent to the corrected zero-capacity ceiling and supplies the pre-change estimate.

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| all 21 golden scenarios | all outputs | unchanged | exactly; none uses zero `mePerDistrict` |
| Malawi startup | all outputs | unchanged | exactly; default remains 20 |
| Malawi with `mePerDistrict: 0` | startup/end MEs | down | 285/345 to 0/0 |
| Malawi with `mePerDistrict: 0` | toilets | down | 118,509 to 0 |
| Malawi with `mePerDistrict: 0` | investor repaid / verdict | down | 100%/viable to about 87.8%/not viable |

## Alternatives considered

- **Reject zero in validation.** Rejected: a zero-capacity stress case is meaningful,
  and zero is already documented as valid for a non-negative capacity ceiling.
- **Use a nullish fallback (`?? 20`).** Rejected: the pure model requires a complete
  input object and validates finiteness before simulation, so a hidden fallback would
  weaken the boundary and conceal caller errors.
- **Keep zero as an alias for the default.** Rejected: it directly contradicts the
  field's displayed meaning and makes an adverse capacity scenario look viable.

## Consequences

Zero capacity now means no startup cohort, no later expansion, and no toilet production.
The default and every non-zero scenario retain the same calculation. Future input
defaults belong at the UI/input-assembly boundary; the validated model must honor the
value it receives.

## Verification

- `npm test`: 99 pass. The F-50 regression requires zero startup enterprises, zero
  active enterprises, zero toilets, and a non-viable verdict.
- `npm run golden:diff`: no behaviour change across all 21 scenarios.
- `npm run lint`: zero errors and zero warnings.
- `node tools/verify-findings.js`: zero capacity starts and ends with 0 enterprises,
  builds 0 toilets, and reports viability `NOT OK`; F-50 fixed.

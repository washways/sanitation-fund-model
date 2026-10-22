# ADR-0056: Label the gross social value multiple honestly

- **Status:** Accepted
- **Date:** 2026-10-22
- **Stage:** S6
- **Findings:** F-65
- **Spec rules touched:** R-8.4, R-10.12, R-11.1

## Context

The dashboard and export call `socialValue / initialCapital` an SROI ratio. The numerator sums
monetised DALYs, time saved, and carbon over the simulation without discounting future benefits. It
does not adjust for the counterfactual (deadweight), attribution to other actors, displacement, or
drop-off beyond the toilet service-life rule. Social Value International's SROI guidance requires
an impact map, evidence and valuation of outcomes, establishment of impact including deadweight and
attribution, and discounting of future benefits. The UK Green Book likewise requires future social
benefits and costs to be discounted to present value. The current calculation can be useful, but
the SROI label overclaims what it establishes.

## Decision

Call the public metric **Gross Social Value Multiple** and define it as undiscounted, unadjusted
gross monetised social value divided by initial grant plus loan capital. State prominently that it
is not a formal SROI and list the omitted adjustments. Add `grossSocialValueMultiple` as the
canonical KPI property while retaining the identical `sroi` property and sensitivity metric as a
documented legacy machine alias.

Do not invent a social discount rate or generic deadweight, attribution, displacement, or drop-off
percentages. A later formal appraisal method requires an explicit standard and sourced programme
assumptions.

## Prediction

No numeric calculation changes. The Malawi reference remains 2.73x, every sensitivity result under
the legacy `sroi` key is identical, and all 21 golden scenarios remain byte-for-byte unchanged.
Only labels, documentation, export headings, and the additive canonical KPI field change.

## Alternatives considered

- **Keep “SROI” with a footnote.** Rejected: the headline label remains the claim most users will
  repeat, and a footnote cannot turn an unadjusted gross ratio into a formal SROI.
- **Add generic adjustment percentages now.** Rejected: cross-country constants without programme
  evidence would create false precision and violate the no-invented-number rule.
- **Remove the metric.** Rejected: the transparent gross multiple remains useful for scenarios when
  its numerator, denominator, and limitations are explicit.
- **Rename the machine key immediately.** Rejected: that would break existing sensitivity files and
  downstream consumers for no numeric benefit. The new canonical key and legacy alias can coexist.

## Consequences

Users can see what the ratio does and does not mean. Formal SROI publication remains unavailable
until the programme supplies a defined counterfactual, attribution, displacement, time profile,
discount rate, and valuation basis. Internal compatibility is preserved but new UI and export code
must use `grossSocialValueMultiple`.

## Verification

`tests/impact-estimates.test.js` pins the canonical calculation and legacy alias;
`tests/documentation.test.js` pins the public disclosure; `tests/export.test.js` pins the export
heading. The full suite and golden comparison must show no numeric movement.

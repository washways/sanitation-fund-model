# ADR-0055: Decouple the monthly audit card from chart sizing

- **Status:** Accepted
- **Date:** 2026-10-22
- **Stage:** S6
- **Findings:** F-61 (follow-up)
- **Spec rules touched:** R-10.8

## Context

ADR-0051 added a later `.monthly-table-card { height: auto; }` override, but the Monthly
Implementation Data section still retained the generic `.chart-card` class. Its appearance and box
contract therefore continued to depend on cascade order against a component designed for fixed-height
canvases. The user reports that the table still extends below its background even though horizontal
overflow is now contained. A presentation fix is not robust while the audit table remains a chart.

## Decision

Remove the generic chart class from the monthly audit section. Give `monthly-table-card` its own
complete background, spacing, radius, shadow, width, and overflow contract, and keep the wide table
inside the existing bounded two-axis scrolling viewport.

## Prediction

No model output, input, or table content changes. The card background encloses the heading and the
complete table viewport without depending on CSS cascade order. All 21 golden scenarios remain
byte-for-byte unchanged.

## Alternatives considered

- **Add a more specific height override.** Rejected: it would leave an audit table semantically and
  visually coupled to a fixed-height chart component and could regress with the next chart change.
- **Let the full table expand the page.** Rejected: a 20-year scenario would produce 240 visible
  rows and separate the user from the column headings.
- **Clip the table.** Rejected: the monthly audit trail is evidence, not decoration.

## Consequences

Chart sizing can change without affecting the audit table. The monthly section has a self-contained
card contract that can be checked statically and visually. The existing local horizontal and
vertical scrolling and sticky headings remain.

## Verification

`tests/layout.test.js` requires the monthly section not to use `chart-card` and requires its dedicated
class to define the full card box. The full suite and startup scenario must pass, and
`npm run golden:diff` must report no behaviour change.

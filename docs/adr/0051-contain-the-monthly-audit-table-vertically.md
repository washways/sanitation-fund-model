# ADR-0051: Contain the monthly audit table vertically

- **Status:** Accepted
- **Date:** 2026-10-22
- **Stage:** S6
- **Findings:** F-61
- **Spec rules touched:** None (presentation only)

## Context

The Monthly Implementation Data section uses the generic `.chart-card`, which has a fixed 400px
height. Its inner `.monthly-table-scroll` may grow to 500px before scrolling. A normal five-year
run renders 60 rows, so the table viewport extends below the card's white background even though
the earlier horizontal-overflow fix correctly contains its 22 columns.

## Decision

Give the monthly audit section a dedicated `monthly-table-card` class with automatic height. Bound
the inner viewport and scroll it on both axes, and keep the column headings visible while the user
scrolls through months.

## Prediction

No model output or table content changes. The card background and shadow enclose the complete table
viewport at every horizon; long tables scroll vertically inside the card and remain horizontally
scrollable. All 21 golden scenarios remain byte-for-byte unchanged.

## Alternatives considered

- **Increase the global chart-card height.** Rejected: that would make every graph unnecessarily
  tall and would still fail for longer horizons.
- **Remove the table height bound.** Rejected: a 20-year scenario would create a very long page and
  make comparison with the column headings difficult.
- **Shorten the table to annual rows.** Rejected: the month-level audit trail is deliberate and is
  used to reconcile model flows.

## Consequences

The audit card no longer shares the fixed-height chart assumption. The table has a local vertical
scrollbar as well as its existing horizontal scrollbar, and sticky headings preserve context.

## Verification

`tests/layout.test.js` requires the dedicated auto-height card, two-axis containment, and sticky
headings. The full suite and startup scenario must pass, and `npm run golden:diff` must report no
behaviour change.

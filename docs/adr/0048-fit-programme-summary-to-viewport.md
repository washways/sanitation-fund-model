# ADR-0048: Fit the programme summary to the available viewport

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S6
- **Findings:** F-55
- **Spec rules touched:** None (presentation only)

## Context

The three programme-summary cards are hard-coded as three equal columns in an inline style. A
second global rule gives every cell in every `.summary-table` a 100px minimum width and forbids
wrapping. On a normal laptop, the fixed sidebar leaves too little width for three padded cards, so
the summary tables extend beyond the page. The same selector also conflates compact summary cards
with the deliberately wide 22-column monthly audit table.

## Decision

Move the results-grid layout into CSS and use an auto-fitting grid whose cards have a 20rem preferred
minimum but may shrink to the viewport width. Summary tables use fixed layout and wrapping cells.
Scope the no-wrap/minimum-width behaviour to `#monthlyDataTable` only, inside its existing horizontal
scroll container. Ensure grid items and wrappers have `min-width: 0` so their contents cannot force
the page wider than the main panel.

## Prediction

No model output changes. At wide widths the cards retain three columns; at narrower desktop/tablet
widths they reflow to two or one column. Summary-card text wraps inside the card. The monthly audit
table remains wide and horizontally scrollable rather than compressing 22 columns into unreadable
cells.

## Alternatives considered

- **Reduce all fonts and padding.** Rejected: it delays rather than fixes overflow and harms
  readability.
- **Make the whole programme summary horizontally scroll.** Rejected: three small summary cards
  should adapt to the viewport; only the genuinely wide audit table needs horizontal scrolling.
- **Hard-code more breakpoints.** Rejected: auto-fit responds to the actual main-panel width,
  including the sidebar, without device-specific assumptions.

## Verification

A layout contract test requires the responsive grid, wrapping summary cells, and monthly-table-only
no-wrap rule. The full model and startup suites must remain unchanged, and the golden comparison must
report no behaviour change.

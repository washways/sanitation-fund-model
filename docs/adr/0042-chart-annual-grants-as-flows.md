# ADR-0042: Chart annual grant totals as annual outflows

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S6 robustness follow-up
- **Findings:** F-51
- **Spec rules touched:** R-10.5

## Context

The engine resets `yearGrants` after each year and pushes that year's spending into
`series.dataGrants`. The annual cash-flow chart incorrectly describes this array as
cumulative and differences adjacent years before negating the result.

On the Malawi reference run, actual annual grant spending is approximately $278k,
$356k, $292k, $0, and $0. The chart currently sends -$278k, -$78k, **+$64k**,
**+$292k**, and $0 to Chart.js. It therefore shows grant inflows in years 3 and 4,
including a $292k inflow in a year when no grant was spent. This is a presentation
error; the underlying grant ledger and KPIs are unchanged.

## Decision

Treat `series.dataGrants` as the annual flow it already is and negate each annual total
once for the outflow chart. Test the actual Chart.js configuration produced by the
render path against the engine's annual series.

Align the card heading with the chart's existing `Annual Cash Flow Breakdown` title;
the chart contains inflows, outflows, and net cash flow, not costs alone.

While touching the same calculation, remove the unused `meDef` placeholder and compute
the annual ME-default array once; neither change alters the displayed default totals.

## Prediction

This ADR was written before implementation.

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| all 21 golden scenarios | all model outputs | unchanged | exactly |
| Malawi startup | all model outputs | unchanged | exactly |
| Malawi cash-flow chart, grant bars | Year 1 | unchanged | about -$278k |
| Malawi cash-flow chart, grant bars | Years 2–4 | corrected | -$78k/+64k/+$292k to about -$356k/-$292k/$0 |

## Alternatives considered

- **Make `dataGrants` cumulative to match the chart comment.** Rejected: the annual
  table and engine aggregation already define it as a yearly flow, and changing the
  model series would break correct consumers.
- **Aggregate monthly grant disbursements again in the chart.** Rejected: it would be
  numerically correct but duplicate an annual series the model already supplies.
- **Hide the grant dataset.** Rejected: grant spending is material to the cash-flow
  explanation; it must be shown accurately.

## Consequences

Grant bars are always zero or negative outflows and reconcile to the annual results
table. Future chart regressions can inspect captured Chart.js configuration without a
pixel-level browser test.

## Verification

- `npm test`: 100 pass. The F-51 render-path regression captures Chart.js
  configuration and compares the `Grants` dataset with
  `series.dataGrants.map(value => -value)`.
- `npm run golden:diff`: no behaviour change across all 21 scenarios.
- `npm run lint`: zero errors and zero warnings; the old `meDef` suppression is gone.
- `node tools/verify-findings.js`: Malawi grant bars reconcile to -$277,973,
  -$355,684, -$292,161, $0, and $0; F-51 fixed.

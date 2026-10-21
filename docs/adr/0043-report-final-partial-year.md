# ADR-0043: Report the final partial year

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S6 robustness follow-up
- **Findings:** F-52
- **Spec rules touched:** R-10.6

## Context

Duration is valid whenever it resolves to a whole number of months, so 0.5 years and
1.5 years are accepted scenarios. Monthly calculation and KPIs cover all 6 or 18
months, but the engine emits annual labels and aggregates only when `month % 12 === 0`.

A 6-month Malawi run therefore builds 12,814 toilets but returns no annual labels or
rows; `renderCharts()` exits immediately and all charts are blank. An 18-month run
builds 43,802 toilets but its annual table and charts stop at month 12. The final valid
months are silently absent from every annual view.

## Decision

Use one annual-snapshot helper at each complete year-end and once more after the loop
when months remain. Label the latter `Year N (M months)` and include the partial
period's accumulated flows plus the end-of-period cumulative snapshots.

Add a pure regression for 6- and 18-month series and a render-path regression proving a
6-month scenario reaches Chart.js rather than returning early.

## Prediction

This ADR was written before implementation.

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| all 21 golden scenarios | all recorded outputs | unchanged | exactly; horizons are whole years |
| Malawi startup | all outputs | unchanged | exactly; five complete years |
| 6-month Malawi | annual rows/charts | up | 0 to 1 partial-year period |
| 18-month Malawi | annual rows/charts | up | 1 to 2 periods; final period covers months 13–18 |

## Alternatives considered

- **Reject fractional-year durations.** Rejected: month-granular horizons are useful
  for pilots and already valid throughout the simulation and input contract.
- **Let each UI aggregate monthly arrays.** Rejected: tables and charts would duplicate
  the same period-boundary logic and could disagree.
- **Leave partial months only in CSV.** Rejected: blank or truncated dashboard views
  are plausible-looking omissions on a valid scenario.

## Consequences

Every valid duration has at least one annual/period summary. Complete-year labels and
values remain byte-identical. Consumers must allow the final label to identify a
partial period instead of assuming every element covers 12 months.

## Verification

- `npm test`: 102 pass. Pure regressions reconcile 6- and 18-month period flows and
  final reach to monthly data; the smoke regression captures chart configurations for
  the 6-month scenario.
- `npm run golden:diff`: no behaviour change across all 21 scenarios.
- `npm run lint`: zero errors and zero warnings.
- `node tools/verify-findings.js`: 6 months reports `Year 1 (6 months)` and 12,814
  toilets; 18 months reports `Year 1`, `Year 2 (6 months)`, and 43,802 toilets; F-52
  fixed.

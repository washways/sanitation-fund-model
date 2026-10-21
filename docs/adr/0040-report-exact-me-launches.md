# ADR-0040: Report exact micro-enterprise launches in aligned columns

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S6 robustness follow-up
- **Findings:** F-49
- **Spec rules touched:** R-6.5

## Context

The monthly implementation table renders 25 cells in each data row but only 24
headers. The extra cell is intended to show the number of new micro-enterprises, but
there is no corresponding header. From that point onward, the ME loan value, ME
interest and principal, operating costs, investor payments, net cash flow, and ending
cash all appear under the wrong heading.

The unlabeled count is also reconstructed as `new ME loan value / meSetupCost`. Since
ADR-0031, every enterprise loan includes setup cost plus working capital through
`meCapitalRequirement(inputs)`. At the current Malawi defaults, the full requirement
is $11,400 and setup cost is $3,000, so the displayed count is 3.8 times the number
actually launched. Reconstructing the count in the UI also creates a second formula
for a fact the simulation already knows exactly.

## Decision

Record `newMes` for every simulated month as `series.dataMonthlyNewMes`. Give the
monthly table separate, explicit columns for `New MEs` (count) and `New ME Loans`
(value), and render the recorded count rather than deriving it from a cost input.

The month-0 startup row continues to report `startMEs` and `startupCost` in those same
two columns.

## Prediction

This ADR was written before implementation.

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| all 21 golden scenarios | financial, reach, impact and viability outputs | unchanged | exactly |
| Malawi startup | model outputs | unchanged | exactly |
| monthly table | columns from ME finance onward | realigned | every row has the same number of cells as headers |
| Malawi monthly table | new-ME count in expansion months | down | from 3.8x actual to the exact simulated count |

## Alternatives considered

- **Divide by `meCapitalRequirement(inputs)` in the UI.** Rejected: it duplicates a
  model rule in presentation code and can drift again if the loan convention changes.
- **Remove the count cell.** Rejected: the simulation knows the count and it is useful
  for auditing delivery-network growth; the defect is the missing label and invented
  reconstruction, not the measure itself.
- **Infer launches from changes in active enterprises.** Rejected: active enterprises
  also fall through attrition, so a net change is not a launch count.

## Consequences

The series gains one monthly audit array. It does not enter cashflow, KPI, viability,
or golden calculations. Any future report that needs launches must use this canonical
series rather than divide currency by a cost assumption.

## Verification

- `npm test`: 98 pass. The F-49 render-path regression checks all 60 monthly values,
  requires a scenario with in-loop expansion, and requires every rendered row to have
  the same cell count as the header.
- `npm run golden:diff`: no behaviour change across all 21 scenarios.
- `npm run lint`: zero errors and zero warnings.
- `node tools/verify-findings.js`: all 60 monthly launch values reconcile to the
  $11,400 Malawi capital requirement; F-49 fixed.

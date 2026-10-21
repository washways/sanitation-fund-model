# ADR-0038: Export the calculated scenario from canonical results

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S6 robustness follow-up
- **Findings:** F-47
- **Spec rules touched:** R-4.5, R-11.1

## Context

The clipboard analysis report reconstructs investor liability as initial senior capital
minus principal repaid. That omits capitalised interest even though R-4.5 and the KPI
layer require the loop's tracked liability. In a stressed run the copied balance sheet
therefore disagrees with both net assets and the dashboard. The same report ignores the
canonical leverage KPI and calculates a different ratio from disbursements and total
initial capital.

Both export paths also call `UI.getInputs()` at export time. If a user edits a valid
field and exports before the debounced recalculation runs, the parameter block describes
the new form while every result row still belongs to the old run. The file contains no
way to detect the mismatch.

## Decision

Store a shallow input snapshot on every successful controller result. Both export paths
must use that snapshot, never reread the live form. The clipboard balance sheet and unit
economics must use the canonical KPI values for ending senior liability and leverage;
they may not reconstruct either measure.

This changes reporting only. It does not change the simulation, KPI definitions, or the
model's inputs.

## Prediction

This ADR was written before implementation.

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| all 21 golden scenarios | all model outputs | unchanged | exactly |
| Malawi startup | all model outputs | unchanged | exactly |
| stressed copied report | investor liability | up | by net capitalised interest omitted by the old reconstruction |
| copied report | leverage | align to dashboard | exact equality with `k.financials.leverage` |
| edit-before-export | parameter block | retain calculated value | exact equality with the successful run, not the pending form edit |

## Alternatives considered

- **Recalculate automatically inside Export.** Rejected: export should not run solvers,
  trigger alerts, or silently choose a new scenario.
- **Keep reconstructing the fields but repair the formula.** Rejected: this duplicates
  canonical calculations and will drift again.
- **Disable export during the debounce window.** Rejected: it does not solve other ways
  live form state can diverge from the stored result, and is harder to explain and test.

## Consequences

`UI.lastResults` gains an `inputs` snapshot after a successful browser calculation.
Export code must obtain scenario parameters and headline results from `lastResults`.
Adding a new reported KPI creates an obligation to expose it canonically before export.

## Verification

- `npm test`: 96 pass. Two focused regressions edit the form after calculation and exercise the stressed clipboard balance sheet.
- `npm run golden:diff`: no behaviour change across all 21 scenarios.
- `npm run lint`: zero errors and zero warnings.
- In the 20% cost-of-capital / $900,000 operating-cost stress, the old report understated senior liability by $1,327,694 ($2,740,741 instead of $4,068,434) and displayed 0.8x leverage instead of the canonical 2.9x. Both now match their KPIs.

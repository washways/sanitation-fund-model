# ADR-0053: Use canonical sustainability scorecard metrics

- **Status:** Accepted
- **Date:** 2026-10-22
- **Stage:** S6
- **Findings:** F-63
- **Spec rules touched:** R-10.10, R-11.1

## Context

The live scorecard labels one row “Grant Equity Multiple” but renders
`k.financials.capitalPreservedPct`, a field that does not exist. It therefore shows `0.0%` instead
of the canonical `grantEquityMultiple` (about `0.18x` in the Malawi reference). A separate “Loan
Recovery Ratio” adds total ending cash—including ring-fenced grant cash—to senior principal repaid,
then divides by initial senior capital. That is neither investor repayment nor capital preservation,
and the exact principal-repaid share is already displayed. The OSS tooltip also describes a
denominator containing defaults and grants although the implemented OSS excludes both.

A second, unused `updateProgrammeSummary()` renderer contains different formulas and labels for
the same cells. Nothing calls it, but retaining a divergent mapping makes future reporting changes
needlessly unsafe.

## Decision

Render Grant Equity Multiple, Capital Preservation, OSS, and FSS from their canonical KPI fields,
with labels and definitions that match those fields. Remove the unused parallel summary renderer
so one code path owns the scorecard.

## Prediction

No engine, input, API, or golden-scenario values change. In the Malawi reference, the visible Grant
Equity Multiple changes from the erroneous `0.0%` to about `0.18x`; Capital Preservation shows
about `3.5%`; and FSS remains about `106%` but is named and defined explicitly.

## Alternatives considered

- **Repair the invented loan-recovery formula.** Rejected: exact senior principal repayment is
  already present, and mixing a second recovery proxy into the same card adds ambiguity.
- **Keep both renderers synchronized.** Rejected: the unused renderer has already drifted; one
  canonical path is easier to verify.
- **Leave the display unchanged.** Rejected: a plausible-looking zero beside the wrong unit is a
  silent reporting defect.

## Consequences

The scorecard exposes distinct concepts: operating cost coverage (OSS), full financial cost
coverage (FSS), whole-fund capital preservation, grant equity multiple, and senior repayment. A
regression must compare the rendered text with the exact KPI fields.

## Verification

`tests/smoke.test.js` runs the real controller and checks the three rendered values, the public
labels and definitions, and the absence of the parallel summary renderer. The full suite and golden
comparison must remain unchanged.

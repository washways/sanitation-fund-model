# ADR-0037: Reject invalid inputs before simulation

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S6 robustness follow-up
- **Findings:** F-46
- **Spec rules touched:** R-2.1, R-2.3, R-3.2, R-3.4, R-4.1

## Context

The UI parsed blanks and malformed text back to defaults, and the pure model accepted
values outside the domain of its equations. Reproduced examples:

- a 150% annual write-down generated dozens of `NaN` values while the independent
  viability verdict still returned true;
- household size zero created an infinite demand backlog while leaving the headline
  reach and financial results looking normal;
- a negative toilet cost passed every integrity check and reported zero production;
- a negative duration crashed with `Invalid array length`;
- a grace period longer than the repayment term silently scheduled no principal.

These are input errors, not scenarios. Letting the loop run makes them look like model
results and forces downstream invariants to diagnose corruption after it has spread.

## Decision

Validate at the pure `ModelModule.calculate()` boundary, before allocating arrays or
running a month. The browser controller uses the same validation and presents all
problems together; it clears `UI.lastResults` so exports and advice cannot reuse an
older valid run after a failed recalculation.

Use only bounds required by arithmetic or by the parameter's definition:

- every numeric input must be finite;
- denominators, loan terms, service life, and duration must be positive;
- capital, costs, counts, impact quantities, mark-ups, and the fund repayment term cannot be negative;
- shares and annual hazards must be within 0%–100%;
- compound rates must be greater than -100%;
- month/count fields that drive discrete loops must be whole numbers;
- duration and repayment years must resolve to whole months;
- when senior capital exists, repayment term must be positive and grace cannot exceed
  the term.

Do not impose policy caps such as a maximum interest rate, cost, or capital amount.
Those would be invented judgements rather than mathematical validation.

Blank form fields become invalid (`NaN`) rather than silently reverting to fallback
assumptions. Missing DOM elements retain the existing wiring-test fallback so a broken
page still fails the dedicated wiring suite.

## Prediction

This ADR was written before implementation.

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| all 21 golden scenarios | all fields | unchanged | exactly; every recorded input is valid |
| Malawi startup | all fields | unchanged | exactly |
| invalid-input probes | result | no result | fail before month 1 with field-specific messages |

## Alternatives considered

- **Rely on HTML `min`/`max`.** Rejected: text fields, programmatic callers, pasted
  values, and the pure model bypass browser constraints.
- **Clamp values.** Rejected: silently changing a decision input is the same class of
  failure as the old smart-rate and grant write-backs.
- **Let INV-8 catch corruption later.** Rejected: some invalid values pass integrity,
  and even a caught `NaN` has already generated misleading KPIs and viability output.
- **Add “reasonable” upper limits.** Rejected: they would be unsupported assumptions.

## Consequences

`calculate()` can now throw an input-validation error. Callers must treat that as no
result, not as an insolvent scenario. Solvers inherit the same boundary, which is
desirable: they must not optimize an invalid scenario.

## Verification

- `npm test`: 94 pass, including four pure-boundary regressions and a browser-controller regression that blanks a required field.
- `npm run golden:diff`: no behaviour change across all 21 valid scenarios.
- `npm run lint`: zero errors and zero warnings.
- Direct probes that previously produced `NaN`, `Infinity`, misleading viable output, or `Invalid array length` now throw `INVALID_INPUTS` before simulation with field-specific messages.


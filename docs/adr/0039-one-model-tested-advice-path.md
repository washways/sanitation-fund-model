# ADR-0039: Route all advice through model-tested scenarios

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S6 robustness follow-up
- **Findings:** F-48
- **Spec rules touched:** R-10.4

## Context

The application has two advice paths. `ModelModule.suggestSolvencyFix()` reruns the
model for every candidate and reports only changes that measurably improve repayment.
The visible `AI Advisor` button bypasses that path and calls the older
`UI.generateSuggestions()` rule set.

That legacy rule set still tells users to extend the fund repayment term. F-32 measured
that longer terms can reduce the proportion repaid in this model, and the model-tested
path was introduced specifically to prevent that recommendation. It also suggests
increasing `Grant Support %` to scale reach even though F-30 established that the field
paces a fixed grant ledger rather than setting total subsidy volume. Its output mixes a
stored result with live form inputs and presents multi-paragraph financial advice in a
modal alert.

The button is therefore a public route to advice already known to be unsafe, while the
tests exercise only the safe path.

## Decision

Keep one advice path. Rename the button to `Review model-tested advice` and make it run
the current form through `runCalculation(true)`, which computes
`ModelModule.suggestSolvencyFix()` and renders `UI.showAdvice()` beside the viability
result. Delete `UI.generateSuggestions()` so rule-of-thumb financial recommendations
cannot be called or accidentally restored.

If the scenario has no repayment shortfall, the recalculation's viability result is the
answer and no shortfall-advice panel is shown.

## Prediction

This ADR was written before implementation.

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| all 21 golden scenarios | all model outputs | unchanged | exactly |
| Malawi startup | all model outputs | unchanged | exactly |
| advisor button on a shortfall | advice source | rule-of-thumb to simulated | every displayed option has a measured repayment result |
| advisor button on a valid edited form | scenario provenance | current form | recalculates before giving advice |

## Alternatives considered

- **Keep both and add warnings to the legacy output.** Rejected: contradictory advice
  paths remain contradictory even when labelled.
- **Make the legacy function call the safe function.** Rejected: it preserves a second
  route, modal UI, and live/stored scenario ambiguity without adding value.
- **Remove the button.** Rejected: the model-tested advice is useful and already has an
  on-page renderer; the control should expose that path honestly.

## Consequences

Advice may take several simulations when explicitly requested, which is already the
behaviour of `runCalculation(true)` and is acceptable for a user click. No advice is
described as AI-generated. Future advice candidates belong in
`ModelModule.suggestSolvencyFix()` and must be verified by rerunning the model.

## Verification

- `npm test`: 97 pass. The wiring regression requires the honest label, current-scenario recalculation, absence of the legacy function, and absence of its unsafe longer-term recommendation.
- `npm run golden:diff`: no behaviour change across all 21 scenarios.
- `npm run lint`: zero errors and zero warnings.
- `node tools/verify-findings.js`: F-48 fixed; the only remaining advice implementation is `ModelModule.suggestSolvencyFix()` plus its renderer.

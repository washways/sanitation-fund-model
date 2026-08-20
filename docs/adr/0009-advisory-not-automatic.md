# ADR-0009: The tool advises; it does not edit the user's assumptions

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S2
- **Findings:** F-04, F-05, F-30, F-32
- **Spec rules:** R-10.3

## Context

Two mechanisms silently rewrote what the user had entered.

**The auto-solver.** `runCalculation(true)` — which both the Recalculate button and the country fetch invoke — reduced **Grant Support %** by 10–20% relative, wrote the new value into the DOM, and re-entered itself on a 200 ms timer, up to five times per click, until the investor was repaid. The scenario displayed was not the scenario entered, and no record was kept of what had changed.

**The smart-rate updater.** `updateSmartRates` overwrote both interest-rate fields unconditionally — on page load, after every country fetch, and on every edit to inflation or either default rate — then dispatched a synthetic `input` event that scheduled yet another recalculation. The `dataset.manual` flag that was supposed to protect a user's typing was set but never read. Its own comments were candid: *"Bypass locks... we prioritize Correctness over User Edits if they are confused."*

Two things follow. First, a financial model that edits its own assumptions to reach a desired conclusion cannot be audited. Second, and more damning: **the lever did not work.** Grant Support % is a pacing control, not a volume control — total subsidy is capped by the grant ledger, so sweeping it from 5% to 90% moves output by 3.6% while moving the month the grant fund runs dry from 28 to 4 (F-30). The shortfall sits in the *loan* ledger, which grant spending barely touches. The solver was burning five recursions and rewriting the user's headline policy input to no effect.

Meanwhile the text advisor recommended *extending the repayment term*. Measurement shows that makes repayment **worse** in this model — 86.4% repaid at a 1-year term, 67.3% at 10 years (F-32) — because principal amortises flat while the fund's productive life ends at month 47 regardless, so stretching the schedule past that converts scheduled principal into permanent arrears. The advice was written from an intuition about amortisation and never checked against the model it was advising on.

## Decision

**Nothing writes to an input the user did not ask it to write.**

1. The auto-adjuster is deleted. In its place, `ModelModule.suggestSolvencyFix()` computes what *would* close a repayment shortfall and returns it for display. It applies nothing.
2. Every suggested option is **scored by re-running the simulation** with that one change, and is offered only if it measurably improves repayment. Advice about a model is derived from the model.
3. `updateSmartRates` honours `dataset.manual`. Where the user has typed, the smart rate is recorded as a suggestion on the element and the value is left alone.
4. Grant Support % is no longer used as a tuning lever anywhere.

## Prediction

No change to any computed value — this is the controller, not the maths. `golden.json` must be byte-identical.

## Alternatives considered

- **Keep the auto-adjust but show a diff of what changed.** Rejected: it still means the exported CSV, the screenshot and the board paper describe a scenario nobody chose.
- **Keep it behind a checkbox.** Rejected for now; it can be reconsidered as an explicit "optimise for me" action that names its objective and shows its working.

## Consequences

Results become reproducible: the same inputs give the same outputs, and the inputs stay put. That is the precondition for every later stage — while the app edited itself, no A/B comparison of a model change was trustworthy.

Users of failing scenarios now see a ranked list of tested remedies instead of having one silently applied. On the shipped defaults the top suggestion is to raise initial loan capital to $5,000,000, which repays in full; extending the repayment term is not offered at all.

## Verification

`tests/smoke.test.js` asserts it directly:

```
✔ the controller does not write back into the user's inputs (F-04, F-05)
✔ solvency advice is model-tested and never suggests a longer term (F-32)
```

The first captures the value of every headline input, runs `runCalculation(true)`, and fails if any of them moved. `golden.json` unchanged, as predicted.

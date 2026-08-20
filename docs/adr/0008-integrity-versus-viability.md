# ADR-0008: Report "the arithmetic is sound" and "the fund works" as separate verdicts

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S1
- **Findings:** F-29, F-11, F-03
- **Spec rules:** R-10

## Context

Running the model on its own shipped defaults produced this, verbatim:

```
Investor payments accrued (not yet paid): Int=$0, Prin=$749981
WARNING: Cash Balance went negative! -36350.60855488197
✅ Model Integrity Verified.
```

The fund was insolvent from year 4.1 and had defaulted on 18.7% of its senior loan. The check reported success. The line that would have failed it was commented out and labelled "optional strictness":

```js
if (minCash < -100) {
    console.warn("WARNING: Cash Balance went negative!", minCash);
    // errors.push("Cash Balance Negative"); // Optional strictness
}
```

In a browser the `console.warn` lines are invisible unless devtools is open. A user, or a board paper, saw "Model Integrity Verified" and reasonably concluded the scenario was sound.

This is the finding that let the other thirty-two survive: every number in that run had a green tick next to it.

## Decision

`calculate()` returns two independent verdicts:

```
integrity: { ok, violations }   // INV-1..INV-14 — a DEFECT IN THE MODEL
viability: { ok, issues }       // V1..V4        — a FINDING ABOUT THE SCENARIO
```

Viability criteria: never insolvent; senior debt repaid in full; no interest forced to capitalise; operating self-sufficiency at or above 1.0.

Both render **on screen** in distinct banners. The console is not a reporting channel. No success message is shown while any warning stands. The two are never merged into one "model OK" indicator, because they mean entirely different things — one is our fault, the other is the answer.

`verify` also becomes its own flag. It used to be gated on `enableBreakEvenSolver`, so turning off the solver silently turned off every guard in the model (F-11).

Additionally, **INV-8 (no NaN or Infinity) runs first and short-circuits**. `NaN` defeats every other check in the file, because `Math.abs(NaN - NaN) > 1` is `false`. A `NaN` check placed anywhere but first catches nothing — which is exactly why a 0% interest rate could corrupt the entire ledger and still be "verified" (F-03).

## Prediction

No change to any computed value. New fields on the result object.

## Alternatives considered

- **Make insolvency an integrity error.** Rejected, and this is the crux: an insolvent fund is not a broken model. It is the model working correctly and delivering unwelcome news. Conflating the two either suppresses real answers or cries wolf.
- **Keep it in the console but log louder.** Rejected: nobody has devtools open.

## Consequences

The tool now tells users when their scenario fails, which it previously did not. The shipped defaults display three viability issues on load. That is a significant change in what a first-time user sees, and it raises Q8: whether the demonstration scenario should be a failing one.

## Verification

```
node tools/verify-findings.js
  integrity ............. OK
  viability ............. 3 issue(s)
      - The fund runs out of cash from month 50, reaching -$13,825 at its worst.
      - Senior debt is not repaid in full: $749,981 of $4,000,000 outstanding (18.7% default).
      - Operating self-sufficiency is 81% — revenue does not cover operating costs.
```

Asserted by `tests/smoke.test.js`: "a scenario that fails is reported as failing, not verified".

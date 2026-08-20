# ADR-0012: Every rate is entered as a percentage, converted once

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S1
- **Findings:** F-17
- **Spec rules:** R-2.3
- **Resolves:** Q10

## Context

The form taught two conventions at once: nine fields were labelled "(0.35 = 35%)" and expected decimals, while Ops Reserve was labelled "(%)" and expected `15`. Underneath sat two heuristics that contradicted each other about the same DOM node:

```js
// UI.getInputs().getDecimal   — "anything above 1 must be a percentage"
if (val > 1.0) { val = val / 100; }

// UI.updateSmartRates().getVal — "anything below 1 must be a decimal"
if (val > 0 && val < 1.0) val = val * 100;
```

Consequences: 100% was ambiguous (`1.0` and `100` both worked, by luck); any rate **above** 100% was unrepresentable, so a user modelling 150% inflation — not hypothetical in the countries this tool targets — silently got 1.5%; and 0.5% could not be entered in the smart-rate path. The code comment above `getDecimal` acknowledged the hyperinflation failure and shipped it anyway.

## Decision

**Percentages everywhere.** `12` means 12%. Conversion happens exactly once, at the input boundary, in `UI.getInputs()`:

```js
const getPercent = (id, def = 0) => getRaw(id, def) / 100;
```

Both heuristics are deleted. **No function may inspect a value's magnitude to infer its unit.** Every rate label now ends in `(%)`; every rate default in `index.html` was multiplied by 100; `opsReserveCap` — the one field already entered as a percentage — is now converted at the boundary like everything else rather than inside the model.

## Prediction

**No change to any computed value.** Every default was scaled by exactly 100 in the HTML and divided by exactly 100 in `getInputs`. If any golden moves for this reason, a field was missed.

## Alternatives considered

- **Decimals everywhere.** Smaller diff — nine labels already taught it, no default values would move. Rejected because `0.35` versus `35` is a classic 100x data-entry error, and this tool's outputs feed funding decisions. The "(0.35 = 35%)" hint labels existed precisely because users got it wrong; the right response is to remove the trap, not to annotate it.
- **Leave the mixed convention, delete only the heuristics.** Rejected: it fixes the silent rescaling but leaves two conventions on one form, which is where the confusion started.

## Consequences

Rates above 100% now work, which matters for hyperinflation scenarios.

The country-fetch path was **already** writing percentages (`fillParam('hhDefaultRate', 8)`, `fillParam('mgmtFeeRatio', 2)`) and relying on the heuristic to rescale them. Those calls are now correct by construction rather than by accident — the convention chosen is the one the data path already assumed.

**Any saved scenario or screenshot from before this change shows rate fields in the old decimal convention** and must be re-entered, not copied across.

`tests/wiring.test.js` now applies the same `/100` to the fields it checks, so reverting a single field to decimal entry fails the drift test.

## Verification

`npm test` — `baseline-inputs.js has not drifted from index.html defaults` passes with the percent conversion applied. Goldens moved only for the *other* decisions landing in the same batch (cost of capital, SROI, new defaults); no move was attributable to a missed conversion.

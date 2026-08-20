# ADR-0003: Model nominal cashflows; no discounting, NPV or IRR

- **Status:** Accepted (documenting existing behaviour)
- **Date:** 2026-08-20
- **Stage:** S0
- **Spec rules:** R-2.4

## Context

The model inflates costs (`unitCost`, fixed ops) by `(1 + inflationRate)^(m/12)` and reports every figure in nominal, inflation-inclusive terms. There is no discount rate anywhere, and no NPV or IRR is produced.

This was never a recorded decision — it is simply what the code does. Because it is unrecorded, someone will eventually "add NPV" as an obvious improvement, and the resulting figure will be wrong in a way that is hard to see: applying a discount rate to already-inflated cashflows double-counts the time value of money unless the rates are handled as a matched real/nominal pair.

## Decision

The model works exclusively in **nominal** terms. No discounting, no NPV, no IRR, without a superseding ADR.

The question this tool answers is *"does the fund stay solvent and repay its investor?"* — a cash question, correctly asked in nominal terms against nominal obligations. Whether the fund is a good use of capital *relative to alternatives* is a different question, and would require discounting, a discount rate with a stated basis, and a far more careful treatment of inflation on the revenue side, which the model does not currently attempt: **inflation applies to costs only, not to household incomes**.

## Prediction

No behaviour change; this documents what already happens.

## Alternatives considered

- **Add a discount rate and report NPV.** Rejected for now: it requires deciding whose discount rate (the investor's? the concessional funder's? society's?), and it invites comparison across scenarios with different inflation assumptions, which nominal figures do not support.
- **Model in real terms.** Rejected: obligations to investors are nominal, and solvency is a nominal question. Real terms would make the central output harder to interpret, not easier.

## Consequences

Figures across scenarios with different inflation assumptions are **not comparable**. The UI should say so; it currently does not.

Anyone adding NPV must first supersede this ADR, and must decide whether inflation should also apply to household incomes and therefore to affordability. That it currently does not is itself a modelling assumption worth surfacing to users.

## Verification

No discount rate appears in `app.js`. R-2.4 in `MODEL_SPEC.md` states the convention.

# ADR-0058: Separate the repayment term from the horizon, and judge repayment against what was due

- **Status:** Accepted
- **Date:** 2026-10-23
- **Stage:** S4
- **Findings:** F-67
- **Spec rules touched:** R-10.2 (V2), R-11.1, Q16

## Context

Two defects hid each other.

1. `src/app.js` bound the simulation horizon and the senior repayment term together. One
   listener, inside `DOMContentLoaded`, copied the horizon into the term on a trusted edit. A
   second, inside `window` `load`, copied each into the other in both directions with no guard.
   The browser therefore could not express a 10-year fund with 7-year debt, although the engine,
   the validator and `PARAMETERS.md` treat the two as independent. No test saw this because both
   test harnesses stubbed `window.addEventListener` as a no-op, so `load` handlers never ran.
2. V2 compared principal repaid by the end of the horizon with the whole loan. With a horizon
   shorter than the term it reported principal that was not yet due as a default: a 5-year horizon
   with a 10-year term read "52.6% default" although no payment had been missed.

The model owner decided Q16 on 2026-10-22: unbind the inputs, and fail V2 only on past-due
principal.

## Decision

- Remove both binding listeners. Horizon and repayment term are independent inputs.
- The startup harness retains and fires `window` `load` listeners after `DOMContentLoaded`, as a
  browser does.
- Add `kpis.financials.seniorPrincipalPastDue`, the scheduled principal that fell due within the
  horizon and was not paid (the engine's existing `accruedInvestorPrin`, which wind-up already
  accelerates to the whole remaining balance), and `seniorPrincipalNotYetDue`, the remainder.
  The two sum to the unrepaid loan.
- V2 fails when past-due principal exceeds the $1,000 tolerance. The controller asks for solvency
  advice on the same basis.

## Prediction

Measured with a headless probe before the code changed.

| Scenario | Field | Before | After |
|---|---|---|---|
| short horizon (1y) | V2 `DEBT_UNREPAID` | fails ($3,555,556 unrepaid) | passes ($0 past due) |
| other 20 | V2 | unchanged | unchanged |
| all 21 | golden fingerprint | — | **no movement** (viability is not fingerprinted; `arrearsPrincipal` already records past-due principal) |

Wherever the term is no longer than the horizon and the fund has not wound up, past-due principal
equals unrepaid principal to the cent, so V2 is unchanged there. The Malawi startup scenario uses
a 5-year term and 5-year horizon and is unaffected.

## Alternatives considered

- **Validate `fundRepaymentTerm <= duration`.** Rejected by the owner: it forbids modelling a
  horizon shorter than the debt, which is a legitimate interim look.
- **Keep the binding.** Rejected: an input the user cannot set independently is not an input.
- **Keep only the guarded one-way copy as a convenience.** Rejected: it still silently overwrites a
  negotiated term whenever the horizon is edited.

## Consequences

A user who shortens the horizon now sees partial repayment with an explicit not-yet-due balance
instead of a default. A user who changes the horizon must change the term separately if they
want them equal. `investorRepaidPct` is unchanged and still reads as a share of the whole loan.

## Verification

`tests/repayment-window.test.js` and the new block in `tests/startup.test.js` fail before the
change and pass after. `npm run golden:diff` must report no behaviour change.

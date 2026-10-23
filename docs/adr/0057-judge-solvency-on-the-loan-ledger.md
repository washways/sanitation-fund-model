# ADR-0057: Judge solvency on the loan ledger

- **Status:** Accepted
- **Date:** 2026-10-23
- **Stage:** S4
- **Findings:** F-66
- **Spec rules touched:** R-10.2 (V1), R-11.1 (`depletionMonth`, `monthsInsolvent`, `opsRunway`), Q15

## Context

The grant and loan ledgers never transfer (R-5.2, [ADR-0022](0022-ledgers-stay-separate.md)).
The loan ledger pays investor debt service and fixed operations (R-5.1); grant cash pays only
grant-funded toilets. The in-loop lending gate (R-5.4) already tests the loan ledger alone.

The solvency verdict did not. V1, `depletionMonth` and `monthsInsolvent` scanned
`dataMonthlyCashBalance`, which is the pooled sum of both ledgers, and `opsRunway` divided pooled
ending cash by fixed operating cost. A large grant therefore hid an overdrawn loan ledger.
Measured on 2026-10-22: grant $5.0m with loan $0.5m reported *never insolvent* and a 79.7-year
runway while the loan ledger fell to -$32,588. The `grant capital only` golden scenario did the
same at -$5,014.

The model owner decided Q15 on 2026-10-22: use the loan ledger only.

## Decision

The engine emits `series.dataMonthlyLoanCash`. V1, `depletionMonth`, `monthsInsolvent` and
`opsRunway` use it. `kpis.sustainability.minLoanCash` is added. The pooled
`dataMonthlyCashBalance` stays as an audit series and still drives INV-1 and INV-2, but no verdict
reads it. The dashboard's minimum-cash, months-insolvent, depletion and ops-coverage rows are
relabelled to say they describe the loan ledger.

## Prediction

Measured with a headless probe before the code changed. Five scenarios flip V1 from pass to fail;
one fails earlier; every other scenario keeps its verdict.

| Scenario | Field | Before | After |
|---|---|---|---|
| grant capital only | depletionYear / monthsInsolvent | Sustainable / 0 | 0.0 / 60 |
| demand constrained | depletionYear / monthsInsolvent | Sustainable / 0 | 4.5 / 6 |
| capacity constrained | depletionYear / monthsInsolvent | Sustainable / 0 | 4.4 / 7 |
| high ME attrition | depletionYear / monthsInsolvent | Sustainable / 0 | 4.9 / 1 |
| high defaults (40%) | depletionYear / monthsInsolvent | 4.3 / 8 | 3.2 / 22 |
| all 21 | minLoanCash | absent | new field |
| baseline and 15 others | depletionYear, monthsInsolvent | unchanged | unchanged |

No cash flow, toilet count, net-asset or repayment figure moves: this changes which series a
verdict reads, not the simulation. `opsRunway` is not in the golden fingerprint; it falls sharply
wherever grant cash was large (carbon enabled: 10,039 to 0.3 years).

## Alternatives considered

- **Report both bases.** Rejected by the owner: it keeps a misleading verdict on screen beside the
  correct one.
- **Keep pooled.** Rejected: it contradicts R-5.2 and the engine's own lending gate.
- **Let grant cash cover loan-ledger shortfalls.** Rejected by Q6 / ADR-0022; that is a different
  fund structure, not a reporting fix.

## Consequences

Grant-heavy and demand- or capacity-limited scenarios will now show insolvency they previously
hid. That is the point. The scenarios that flip have one thing in common: production stops or
slows, so interest income falls while fixed operations continue, and only the loan ledger pays
for them. A user who wants such a fund to stay solvent must fund operations explicitly in the
loan ledger. The new `dataMonthlyLoanCash` series also lets INV-21 stop re-deriving loan cash.

## Verification

`tests/ledger-basis.test.js` fails on the pooled basis and passes on the loan-ledger basis.
`npm run golden:diff` must show exactly the moves in the table above before `golden:record`.

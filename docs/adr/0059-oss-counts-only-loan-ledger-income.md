# ADR-0059: OSS counts only loan-ledger income, and is undefined without operating cost

- **Status:** Accepted
- **Date:** 2026-10-23
- **Stage:** S4
- **Findings:** F-69
- **Spec rules touched:** R-10.2 (V4), R-11.1 (`OSS`), Q17

## Context

Operating self-sufficiency (OSS) was `(loan interest + carbon revenue) / (fixed + variable
operating cost)` over the whole horizon. Operations are paid from the loan ledger (R-5.3). Carbon
revenue accrues to the ring-fenced grant ledger (R-8.1) and can never pay them. With the
`carbon enabled` golden inputs OSS read 565x while the loan ledger was unchanged, so V4 passed on
income the operations never receive.

When operating cost was zero, the guard `operatingExpenses > 0 ? … : 0` returned 0 and V4 failed
with "Operating self-sufficiency is 0%". The ratio is undefined in that case, not zero;
`opsRunway` already uses `null` for the same situation (F-28).

The model owner decided Q17 on 2026-10-22: exclude carbon, return `null` at zero cost, keep the
whole-horizon basis.

## Decision

`OSS = (household + enterprise loan interest) / (fixed + variable operating cost)` over the whole
horizon, or `null` when operating cost is zero. V4 is skipped when OSS is `null`. FSS keeps carbon
in its numerator unchanged, because it is a whole-fund cost-coverage ratio, and its tooltip says
so. The dashboard and export render `null` as "n/a".

## Prediction

Measured with a headless probe before the code changed.

| Scenario | Field | Before | After |
|---|---|---|---|
| carbon enabled | oss | 565.47 | 1.61 |
| carbon, short crediting life | oss | 370.39 | 1.61 |
| other 19 | oss | unchanged | unchanged |
| all 21 | V4 verdict | unchanged | unchanged |

No cash flow or other KPI moves.

## Alternatives considered

- **Keep carbon, fix only the zero-cost case.** Rejected by the owner: OSS would still rise on
  income operations never see.
- **Trailing 12-month OSS.** Rejected for now: it changes every scenario and needs its own
  decision about short horizons. Whole-horizon remains; the spec says so plainly.
- **Report a second, loan-ledger OSS beside the current one.** Rejected: two OSS figures invite
  the wrong one to be quoted.

## Consequences

The scorecard used to replace OSS with "Insolvent (0%)" whenever the fund was insolvent, which
merged two verdicts (R-10.3). It now shows the ratio itself and notes insolvency in the tooltip;
insolvency keeps its own rows and banner.

OSS is now comparable with the microfinance convention it is named after. A carbon-financed
programme no longer looks operationally self-sufficient on carbon alone; its carbon income is
still visible in FSS, in the grant ledger and in the impact section.

## Verification

`tests/oss-definition.test.js` fails before and passes after. `npm run golden:diff` must show
only the two `oss` moves above.

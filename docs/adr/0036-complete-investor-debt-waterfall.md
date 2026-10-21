# ADR-0036: Complete the investor debt waterfall before freezing wind-up

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S6 robustness follow-up
- **Findings:** F-44, F-45
- **Spec rules touched:** R-4.4, R-4.5, R-5.1, R-9.1, R-9.2, R-9.3

## Context

The tracked senior liability includes unpaid interest, but the monthly payment rule
scheduled only current interest and original principal. `accruedInvestorInt` could
increase but never decrease. In a temporary shortfall, later cash therefore could not
pay the old interest even though R-4.5 said arrears were caught up automatically.

The wind-up test also ignored the senior liability. A no-demand run reaches wind-up
with about $172,000 of loan-ledger cash and about $593,000 still owed, then freezes
both figures. The cash is available to the senior investor but the model reports it as
fund cash. This overstates cash and understates repayment by the same amount.

These are one problem: the investor waterfall is incomplete during normal operation
and omitted at terminal settlement.

## Decision

Use this senior-debt payment order every operating month:

1. previously capitalised interest;
2. current-month interest;
3. overdue and currently scheduled original principal.

Paying capitalised interest reduces both its outstanding arrears balance and the
tracked senior liability. Interest newly missed in the current month capitalises at
month end. Keep cumulative `capitalisedInterest` as the historical service-breach
measure, and separately track `capitalisedInterestRepaid` so the liability can be
reconciled.

At wind-up, accrue no new interest and charge no operating cost. Accelerate all
remaining original principal, apply every positive dollar of **loan-ledger** cash
through the same waterfall, and then freeze the ledger. Grant cash remains ring-fenced
under ADR-0022 and is not used for senior repayment.

## Prediction

This ADR was written before the implementation.

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| baseline | all golden fields | unchanged | no arrears and debt already repays in full |
| with cost of capital (8%) | outstanding interest arrears | down | up to the current $6,638 balance if later cash permits |
| with cost of capital (8%) | total investor interest paid | up | low tens of thousands at most |
| wind-up scenarios with positive loan cash | investor principal repaid | up | by available terminal loan cash |
| same wind-up scenarios | cash and liability | both down | equal terminal transfer; net assets approximately unchanged |
| scenarios without arrears or wind-up cash | all fields | unchanged | exactly |

The dedicated no-demand regression should transfer roughly $172,000 at wind-up,
reducing both loan cash and liability by that amount without changing net assets.

## Alternatives considered

- **Treat capitalised interest as a memo item.** Rejected: it is already part of the
  liability; leaving it unpayable makes the balance internally inconsistent.
- **Pay current interest before old arrears.** Rejected: it indefinitely subordinates
  an older senior obligation and can make arrears impossible to clear.
- **Continue simulating after operations end until debt matures.** Rejected: it
  restores the horizon-dependent dead-fund behaviour fixed by ADR-0006 and keeps
  charging a modelled fund after there is no programme to operate.
- **Use grant cash at wind-up.** Rejected: ADR-0022 deliberately ring-fences the grant
  ledger for subsidy purposes.
- **Write off the remaining liability automatically.** Rejected: that would invent a
  lender concession and hide a default.

## Consequences

The senior balance becomes reconcilable as:

```
initial principal - principal repaid
+ interest capitalised - capitalised interest repaid
= ending senior liability
```

`investorRepaidPct` remains a principal-only measure and cannot exceed 100%.
Historical capitalisation remains a viability warning even when later cured, while
the separately reported outstanding arrears show what remains unpaid at the horizon.

## Verification

Implemented and measured on 2026-10-21.

- The baseline is byte-for-byte unchanged at the golden-summary level.
- In the no-demand regression, terminal settlement transfers $172,237 of loan
  cash, moves principal repaid from $3,407,407 to $3,579,645, and reduces the
  liability from $592,593 to $420,355. Net assets remain $579,645 because cash
  and liability fall by the same amount.
- At 8% cost of capital, $297 of old interest is cured. The same constrained cash
  then misses a similar amount of current interest, so ending interest arrears,
  cash, liability, net assets, and total debt service are unchanged. Cumulative
  capitalisation rises $297 (4.5%) and `capitalisedInterestRepaid` records the
  matching cure. The prediction that outstanding arrears might fall did not occur
  in this scenario; the waterfall worked, but no extra cash existed.
- In the demand-constrained scenario, $537 moves from original-principal service
  to older-interest service. Principal repaid falls 0.01%, investor interest paid
  rises 0.24%, and cost per latrine rises 0.01%. Ending cash, senior liability,
  and net assets do not move.
- High-default and capital-constrained wind-ups now classify the remaining
  accelerated original balance as principal arrears. No economic headline moves.

```
node --test                         # 89 pass after golden re-record
node tests/golden.record.js --diff # no behaviour change after re-record
node tools/verify-findings.js       # F-44/F-45 fixed; 45/45 resolved
```


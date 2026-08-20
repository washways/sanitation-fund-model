# ADR-0007: Interest accrues through grace, and unpaid interest capitalises

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S3 (pulled forward — it interacts with ADR-0006)
- **Findings:** F-06
- **Spec rules:** R-4.3, R-4.5, R-4.6

## Context

Three defects in one block.

**Grace forgave interest.** The condition `m > investorGracePeriod` gated *both* principal and interest, so a grace period did not defer interest, it deleted it. Measured at 8%: a 6-month grace forgave **$68,408**.

**Arrears evaporated.** When the fund could not pay, `accruedInvestorInt` and `accruedInvestorPrin` accumulated the shortfall — and were surfaced only as a `console.warn`. They were never added to the liability, never repaid from later surplus, never shown.

**The ending liability was reconstructed rather than tracked**, as `investLoan - totalRepaidPrincipal`, which by construction cannot know about arrears. In a cash-starved variant this overstated net assets by **$4,237,365** — more than the original loan.

There was also a second, unused interest calculation: `calculateInvestorSchedule` returned an `interest` field that the loop ignored in favour of computing its own.

## Decision

1. Interest accrues from month 1 on the outstanding liability. Grace defers **principal only**.
2. Unpaid interest **capitalises** into `loanFundLiability` in the month it is missed, and is tracked separately as `capitalisedInterest` so it can be reported.
3. Unpaid principal is carried forward and added to the next month's schedule, so the fund catches up automatically once cash allows.
4. `investorLiabilityEnd` is the liability the loop actually tracked, not a reconstruction.
5. `calculateInvestorSchedule` returns principal only. One definition, not two.

## Prediction

No change where `fundCostOfCapital` is 0, which is every scenario except one. In `with cost of capital (8%)`: interest charged up, arrears up, net assets down, toilets down slightly as interest competes with lending for cash.

## Alternatives considered

- **Pay interest current during grace** (no capitalisation). Rejected: the fund frequently cannot, and forcing it would push cash negative, contradicting the cash-aware service rule R-4.4.
- **Keep arrears as a memo item.** Rejected: an obligation that does not appear in the liability is not modelled, it is hidden.

## Consequences

Net assets become honest in stressed scenarios, and materially worse in them. A new viability issue, `INTEREST_CAPITALISED`, tells the user when the fund has effectively been borrowing from its own lender to stay afloat — a signal that previously existed nowhere.

## Verification

```
node tools/verify-findings.js
FIXED  F-06  grace defers principal only, and arrears enter the liability
       total interest charged — grace 0: $870,679, grace 6: $950,419.
       Ending liability $1,556,623 vs the old reconstruction $1,393,503: the
       difference is capitalised interest that used to vanish from net assets.
```

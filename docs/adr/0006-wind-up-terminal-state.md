# ADR-0006: Wind the fund up when it has nothing left to do

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S3 (pulled forward — it blocks meaningful comparison of any two runs)
- **Findings:** F-31
- **Spec rules:** R-9

## Context

The model had no terminal state. Once `loanCash` fell below the reserve floor the solvency gate closed permanently: no lending, so no new portfolio, so no repayments, so no recovery. The loop kept running to the requested horizon, paying the 30% collections floor every month against zero income.

Measured on the shipped defaults: production ceased at month 47, the portfolio ran off by month 53, and a 20-year run then paid **$1,085,986** of operating costs with no income at all — for sixteen years after the last loan was repaid.

The consequence was that **ending cash measured how long you left the simulation running, not how the fund performed**: -$36,351 at 5 years, -$314,909 at 10, -$1,029,034 at 20, for the identical fund. That number feeds net assets, fund health, operating runway and SROI.

## Decision

The fund is **wound up** at the first month that opens with all of:

```
portfolio == 0          nothing left to collect
production == 0         nothing being built
lendable  == 0          gate shut, no capital to redeploy
```

From that month: no operating cost accrues, the ledger is frozen, and `windUpMonth` is recorded and reported.

The test is evaluated at the **start** of the month against state carried from the previous one. A month that opens with loans outstanding and collects the last of them does incur a collections cost; a month that opens with nothing does not.

## Prediction

`totalOpsFixed` down in every scenario that dies before its horizon. `cashEnd`, `netAssets`, `oss` and `fss` all improve. `long horizon (20y)` should converge to exactly the `baseline` 5-year values — that convergence is the whole point, and is now asserted as INV-14.

## Alternatives considered

- **Truncate the output arrays at wind-up.** Rejected: it breaks INV-3 (arrays are `duration * 12` long) and every chart that assumes a fixed x-axis.
- **Keep billing ops and just document it.** Rejected: it makes two runs of the same fund incomparable, which defeats the purpose of a scenario tool.
- **Stop only on insolvency.** Rejected: a fund can wind up solvent, having repaid everything and simply run out of demand or capacity to deploy against.

## Consequences

Extending the horizon no longer changes the answer, so horizon becomes a free choice rather than a hidden assumption. Historical scenarios run over long horizons will look markedly better — because they were previously being charged for a fund that no longer existed.

Open question Q9 remains: whether the collections floor should taper before wind-up rather than stopping abruptly.

## Verification

```
node tools/verify-findings.js
FIXED  F-31  the fund winds up instead of billing operations forever
       ending cash at 5y -$6,717 and at 20y -$6,717 are now identical (wind-up at M54).
       They used to differ by $992,683 for the same fund.
```

`long horizon (20y)`: totalOpsFixed $1,692,651 → $670,334 (-60.4%); netAssets -$1,779,016 → -$756,698. INV-13 and INV-14 now pass and are no longer `todo`.

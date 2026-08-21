# ADR-0027: Implement the debt-service lookahead reserve (F-10)

- **Status:** Accepted
- **Date:** 2026-08-21
- **Stage:** S3
- **Findings:** F-10
- **Spec rules touched:** R-5.4

## Context

The solvency gate (R-5.4) required `3 * opsCost` before permitting new lending, where `opsCost` is already cut to 30% during hibernation/insolvency — so the buffer shrinks by 70% exactly when the fund is most fragile. It also ignored investor debt due in the next quarter entirely, despite the README promising a "3-month Debt Lookahead" that never existed. `docs/MODEL_SPEC.md` §R-5.4 already specified the target formula, tagged `[TARGET — F-10]`:

```
requiredReserves = 3 * fullFixedOps + sum(next 3 months of scheduled principal)
```

## Decision

Implement exactly that formula. `investorSchedule` (the precomputed flat-principal amortisation table) already exists and is indexed by month, so the lookahead is a direct lookup, not new machinery:

```js
const lookaheadPrincipal =
    (investorSchedule[m + 1]?.principal || 0) +
    (investorSchedule[m + 2]?.principal || 0) +
    (investorSchedule[m + 3]?.principal || 0);
const requiredReserves = windUpMonth !== null ? 0 : (currentFixedOps * 3) + lookaheadPrincipal;
```

`currentFixedOps` (the full, uninflated-for-hibernation figure) replaces `opsCost` (which is already cut) — this alone fixes the "buffer shrinks when fragile" half of the finding. `windUpMonth !== null` keeps the reserve at zero once the fund is wound up, consistent with R-9.2 (a dead fund holds no reserve because it does no further lending).

This finding's other half — relabelling `opsReserveCap`, the *separate* input that sizes the month-0 starting ME cohort — is **not** touched by this change. That parameter (`currentReserve`) is untouched code; only the label in `index.html` changes, in the same commit, so a reader does not conflate "the one-time capacity throttle" with "the ongoing solvency reserve" this ADR adds.

## Prediction

**Measured before recording**, by comparing the old and new formulas against identical inputs across all 21 golden scenarios (a scratch copy running the pre-change code, not a guess).

- **No scenario's viability verdict changes.** The same 5 scenarios fail before and after, with the identical issue codes (`grant capital only`, `high defaults (40%)`, `capital constrained`, `demand constrained`, `capacity constrained`, `short horizon (1y)`) — this is a pacing change, not a solvency-outcome change.
- **Every scenario that lends at all shows reduced reach**, because a properly-sized reserve holds back more cash from lending than the old, under-sized one did:

  | Scenario | Toilets | Net assets | Min cash |
  |---|---|---|---|
  | `baseline (index.html defaults)` | 133,469 → 121,358 (**-9.1%**) | $1,364,237 → $1,174,828 (**-13.9%**) | $16,075 → $17,742 (**+10.4%**) |
  | `long horizon (20y)` | 695,940 → 570,026 (**-18.1%**) | $12,316,157 → $9,670,294 (**-21.5%**) | unchanged |
  | `capacity constrained` | 1,472 → 1,419 (-3.6%) | $477,878 → $481,501 (+0.8%) | $980,556 → $981,627 (+0.1%) |

  Reach falls roughly 9-20% depending on how much the scenario relies on tight lending pacing; deeper falls on longer horizons, where the lookahead bites every quarter compounding over more quarters. **Minimum cash improves or holds** in every scenario checked — the fund is more conservative, not less safe.
- `dalys`, `sroi`, `capitalPreservation` move in the same direction and rough magnitude as reach, since they are downstream of toilets built.
- Investor repayment (`investorRepaidPct`) is unaffected in every scenario that was already repaying in full — the reserve changes how much gets lent, not the terms on which it's repaid.

476 individual golden values move across the 21 affected scenarios (every scenario except `grant capital only`, which has `investLoan: 0` and so no investor schedule to look ahead into).

## Alternatives considered

- **Only fix the hibernation-shrinkage half, skip the lookahead.** Rejected: the README already claims the lookahead exists, and half-implementing R-5.4 would leave the spec and the code disagreeing on the same rule, which is exactly the kind of drift this project's process exists to prevent.
- **Size the lookahead window from `investorGracePeriod` or `fundRepaymentTerm` instead of a fixed 3 months.** Rejected: `docs/MODEL_SPEC.md` already specified "3" months, matching the 3-month ops buffer it sits alongside — a coherent, already-decided convention, not a new number to invent.
- **Leave `opsReserveCap` as "Liquidity Buffer %" instead of relabelling it.** Rejected: leaving it as-is invites confusion now that a *real* liquidity reserve exists under this ADR — a reader would reasonably assume the two are the same mechanism. Renaming it to reflect what it actually does (start-of-run capacity sizing) is the minimum needed to keep the two concepts from being conflated.

## Consequences

Funds are somewhat less aggressive lenders under this model than before, and reach falls accordingly. This is not a downgrade in the fund's real-world prospects — it's a correction of a bug that was letting the model assume away debt the fund already knew it owed. Any board paper or funding proposal generated from a run before this date should be re-run.

## Verification

```bash
npm test               # 0 failures once golden.json is re-recorded (below)
npm run golden:diff    # 476 values across 21 scenarios; no viability verdict changes
npm run golden:record  # written, matching this ADR's prediction
```

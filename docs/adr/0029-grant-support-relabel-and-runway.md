# ADR-0029: Relabel Grant Support %; show grant-fund runway (F-30)

- **Status:** Accepted
- **Date:** 2026-08-21
- **Stage:** S2
- **Findings:** F-30
- **Spec rules touched:** none (labelling and a new derived readout, not a modelling change)

## Context

Sweeping `grantSupportPct` 5%→90% (18x) moves total grant-funded output by 3.6% — the label "Grant Support (% of Households)" implies a volume control, but total subsidy is capped by the grant ledger (`maxGrants = floor(grantCash / grossUnitCost)`), which binds long before the target percentage does. What the field actually controls is **how fast** the grant fund is spent: 4 months at 90% vs 28 months at 5%, on the pre-ADR-0027 measurements in the finding.

## Decision

1. Relabel the field "Grant-Funded Pacing (% of Production)", with an info tooltip stating plainly that total subsidy is set by Initial Grant Capital, not this dial.
2. Add `grantExhaustedMonth` to `computeKPIs`'s `sustainability` group: the month the grant ledger can no longer afford one more fully-burdened unit (`grantCash < grossUnitCost`), or `null` if it never runs out within the horizon. Tracked in the month loop as `dataMonthlyGrantCash[m]` crosses below that month's `grossUnitCost`, and reset to `null` if a later month affords a unit again (carbon revenue can top the ledger back up) — so it only reports once the fund is exhausted contiguously through to the end of the run, not on a transient dip.
3. Render it next to the field as a plain-language note: *"Grant capital runs out around month N at this pace"* or *"Grant capital lasts the full run at this pace."*

No existing computation changed — `grantExhaustedMonth` and `dataMonthlyGrantCash` are new, additive fields; nothing that already existed was recalculated differently.

## Prediction

**No golden scenario moves.** This adds a label, a tooltip, a new derived (not recomputed) field, and a UI text node. `golden.json`'s fingerprints do not include either, and the underlying arithmetic is unchanged — confirmed by `golden:diff` before recording anything.

## Alternatives considered

- **Enforce `grantSupportPct` as a hard volume cap** (stop it from being a pacing lever at all). Rejected: that changes real behaviour and is a different, larger decision than this ADR is scoped to — F-30's fix, as specified, is "relabel + show the runway," not "redesign the mechanism." If the model owner wants grant volume itself to be directly dialable, that is a new modelling decision, not a relabelling.
- **Report `grantExhaustedMonth` as a KPI card rather than inline help text.** Rejected for now: the finding specifically wants it "beside" the field so the trade-off is visible where the decision is made, not on a separate dashboard section a user might not correlate with this input.

## Consequences

A user changing this field now sees, immediately, what it actually does — paces spend-down, not total reach — instead of discovering it by noticing reach barely moved. `dataMonthlyGrantCash` is also now available to the CSV export and any future chart that wants to plot the grant ledger's own balance separately from the combined `dataMonthlyCashBalance`.

## Verification

```bash
npm test               # 0 failures — INV-17 confirms pacing changes exhaustion month, not volume
npm run golden:diff    # "No behaviour change"
```

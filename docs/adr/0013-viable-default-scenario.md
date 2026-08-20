# ADR-0013: Ship a default scenario that works

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S1
- **Findings:** F-29 (consequence of), Q8
- **Resolves:** Q8, Q12

## Context

The scenario a new user met on opening the tool went cash-negative in year 4.1, defaulted on **18.7%** of its $4M senior loan, ran at an operating self-sufficiency of 0.81, and required a **~50%** household interest rate to break even. It displayed `✅ Model Integrity Verified`.

Once [ADR-0008](0008-integrity-versus-viability.md) separated the two verdicts, that scenario began displaying three viability warnings on load. That is honest, but it is a poor first impression and it invites the reading that the *tool* is broken rather than the *parameters*.

The model owner's decision was to replace it with a viable demonstration.

## Decision

Three changes to the shipped defaults, plus the cost of capital:

| Parameter | Was | Now | Why |
|---|---|---|---|
| HH loan term | 6 months | **18 months** | $100 over 6 months at 40% is $18.40/month against a $85/month household income — 22%, which is not a credible sanitation loan. At 18 months it is **$7.18/month, 8.4% of income**. |
| HH interest rate | 35% | **40%** | Within observed LDC microfinance pricing; Malawi's commercial lending rate alone is above 20%. Buys the margin that makes the fund robust. |
| Annual fixed ops | $145,000 | **$60,000** | $1,200 per district per year across 50 districts. Still *more* than the app's own country-fetch formula produces (`10,000 + 500 × districts` = $35,000), so it is not an optimistic figure. |
| Fund cost of capital | *no control, 0* | **2%** | Concessional senior debt from a DFI or blended facility. Answers Q12. |

## Prediction

Every golden moves. The fund becomes viable: full repayment, positive cash throughout, OSS above 1. Reach falls, because a longer household term recycles capital more slowly and because the longer term also raises the working-capital allowance per micro-enterprise, so fewer are affordable at start-up.

## How the scenario was chosen

Not by hand. A grid over the five levers a fund manager actually controls (rate, ops cost, HH term, grant support, reserve) found **308 viable combinations of 675**. Those were then re-scored against six stress cases — 15% inflation, 12% household write-down, 8% cost of capital, $150 toilet cost, 30% grant support, and the base case — and ranked by how many they survived, then by affordability of the household rate, then by reach.

The chosen point **survives all six**. That mattered: the first candidate found (35% rate, $80k ops, 12-month term) passed the base case but broke under any of inflation, write-down or cost-of-capital shocks, because minimum cash sat at $21k on a $5M fund.

**Margin is structurally thin in this model regardless.** The solvency gate lends down to a three-month operating reserve, so minimum cash converges on exactly that floor — $15,935 here, against a $60k annual ops cost. That is a property of the lending rule, not of these parameters, and it is worth knowing before reading too much into the headroom.

## Alternatives considered

- **Keep the failing defaults with framing text.** The honest option, and defensible: market-rate sanitation lending genuinely is this hard. Rejected by the model owner in favour of a working demonstration.
- **Ship both, with a preset toggle.** More work; still available later, and now cheap to add since a viable parameter set is documented here.
- **Lower the interest rate instead of extending the term.** Tested: at 30% with a 12-month term the fund still defaults on 12% of senior debt. Term length does more for affordability than rate does, at these amounts.

## Consequences

A new user now opens a fund that repays its investor in full, stays solvent, and covers its operating costs at OSS 2.43 — while reaching 139,148 households, about 3.5% of the target population. The reach figure is the honest headline: **this fund works, and it is nowhere near closing the gap.** That is a more useful starting point for a policy conversation than either a green tick on a broken fund or a wall of warnings.

Reach fell 34% against the old defaults. Anyone comparing to a pre-2026-08-20 figure is comparing to a scenario that did not repay its investor.

Q8 and Q12 are closed. The stress results above are a candidate basis for the sensitivity work in Stage 4.

## Verification

```
viability       VIABLE (all four checks pass)
toilets         139,148 | people 695,740
min cash        $15,935          ending cash $17,790
investor repaid 100.0%           net assets  $1,426,422
OSS / FSS       2.43 / 1.58      cost/latrine $135
HH monthly pmt  $7.18 on a $100 toilet = 8.4% of monthly income
```

Asserted by `tests/smoke.test.js`: *the shipped defaults produce a viable fund*.

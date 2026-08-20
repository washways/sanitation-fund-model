# ADR-0015: Derive the value of saved time from income, not from a constant

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S3
- **Findings:** F-08, F-25
- **Spec rules:** R-8.6
- **Resolves:** Q2

## Context

Time saved was valued at exactly **$0.50 per hour**, hardcoded, in a tool that models forty-odd countries. The source comment asked where the number came from; nobody knew. It sat inside the SROI shown to funders.

The arithmetic gives it away. Malawi's GNI per capita is $1,020. Over a conventional 2,080-hour working year:

```
$1,020 / 2,080 = $0.49 per hour
```

So the constant was almost certainly **Malawi's income per working hour, valued at the full wage rate** — reasonable as a one-country figure, wrong as a global constant, and wrong again in valuing household time at the market wage.

Separately, `avgAnnualIncome` was collected from the World Bank GNI-per-capita indicator, displayed in the form, and **never read by the model** (F-25). The tool already had the input it needed.

## Decision

```
hourValue = (avgAnnualIncome / 2,080) × timeValueFactor
```

with `timeValueFactor` a user-editable input, defaulting to **30%**.

Two properties this buys:

1. **It scales with the country.** A $0.50 hour is roughly right for Malawi and badly wrong for a country at a third or triple that income. The tool models many countries; the constant modelled one.
2. **It values household time below the market wage.** The hour saved is not forgone paid employment — it is time spent walking to, queueing for, or managing sanitation. Valuing it at the full wage overstates the benefit. Discounting non-market time relative to the wage rate is standard practice in both WASH and transport cost-benefit analysis, where values in the region of a third of the wage are conventional for non-work time.

On the shipped defaults this resolves to **$0.147/hour**, and the figure is displayed under the input so it is visible rather than implied.

> **Confidence note, stated plainly.** The *method* — derive from local income, discount below the wage — is standard and well founded. The specific **0.30** is a conventional round number, not a value I verified against a current published source. Before an SROI from this model goes into a funding document, check the factor against whichever cost-benefit guidance the programme reports against (WHO and World Bank sanitation economics work are the usual references) and record the source here. The input exists precisely so that can be done without touching code.

## Prediction

SROI falls in every scenario, because $0.147 replaces $0.50 — roughly a 3.4x reduction in the time-saved term. DALY value now dominates the social total, which is the expected result of [ADR-0011](0011-sroi-is-social-value-only.md).

## Alternatives considered

- **Keep $0.50 and document it as an assumption.** Rejected: it is not an assumption, it is an accident — a Malawi figure frozen into a multi-country tool. Documenting it would legitimise it.
- **Value time at the full wage (factor 1.0).** Rejected: it treats every saved hour as forgone paid work, which for household sanitation time it plainly is not.
- **Make the hourly rate itself an input.** Rejected: it would need re-entering for every country, and it discards the income data the tool already fetches. The factor is the part that reflects judgement; the income is data.

## Consequences

Closes F-25 — `avgAnnualIncome` now does something, and editing it changes the SROI, which a user would reasonably have expected all along.

**SROI figures are not comparable across this change**, on top of the two earlier moves ([ADR-0010](0010-wire-up-collected-inputs.md), [ADR-0011](0011-sroi-is-social-value-only.md)). Baseline SROI went 19.51 → 6.28.

Q2 is closed as to method. The *number* remains a convention pending programme-specific evidence, and this ADR says so rather than pretending otherwise.

## Verification

Baseline: `hourValueUsd` $0.147, from $1,020 income over 2,080 hours at 30%. Shown beneath the input in the form. Recorded in `golden.json` so it cannot drift unnoticed.

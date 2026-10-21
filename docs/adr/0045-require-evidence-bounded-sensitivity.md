# ADR-0045: Require evidence-bounded one-at-a-time sensitivity

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S4
- **Findings:** None — roadmap task 3
- **Spec rules touched:** R-2.8, R-11.1

## Context

The roadmap calls for one-at-a-time sensitivity over up to eight parameters. A generic
percentage shock would be easy to implement but would create unsupported low and high
cases, contrary to the project's rule that every number must be an input, an observed
indicator, or a documented assumption. Monte Carlo would add still more unsupported
probability distributions before the deterministic sensitivities are understood.

On 2026-10-21 the model owner selected evidence-bounded one-at-a-time analysis. The
same decision prioritised transparent JSON scenario comparison after sensitivity.

## Decision

Add a pure `ModelModule.runSensitivity(inputs, specification)` method and a
reproducible JSON CLI. A specification contains one to eight unique numeric parameter
IDs, a low value, a high value, and a non-empty provenance string for each. Bounds must
bracket the base value and each resulting scenario must pass the model's normal input
validation.

Run the baseline once and each distinct low/high case once with solvers and console
verification disabled. Return the baseline and each case's net assets, ending and
minimum cash, toilets, senior repayment share, SROI, and viability. Rank parameters by
the absolute low-to-high swing in a supported selected metric. Refuse malformed,
undocumented, out-of-range, duplicate, unknown, or more-than-eight specifications with
a typed `{ ok: false, errors }` result.

The CLI accepts only files inside this repository. It prints deterministic JSON and
does not fetch sources or invent bounds.

## Prediction

This adds an opt-in analysis path and does not change `calculate()` or any existing
scenario.

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| all 21 golden scenarios | all fields | none | exactly zero |
| Malawi startup | all fields | none | exactly zero |

If a golden value moves, the implementation has changed the base model and must stop.

## Alternatives considered

- **Uniform percentage shocks.** Rejected because the percentage would be invented and
  equally inappropriate for capital, loan terms, write-down hazards, and delivery
  capacity.
- **Built-in Malawi low/high values.** Rejected until each bound has a programme or
  primary-source basis. A plausible-looking undocumented range is not evidence.
- **Monte Carlo.** Rejected because probability distributions are not available and
  false precision would be worse than a transparent deterministic comparison.
- **Mutate the browser form while sweeping.** Rejected because analysis must be pure,
  reproducible, and incapable of changing the user's scenario.

## Consequences

The tool cannot produce a sensitivity chart until the analyst supplies defensible
bounds. That is deliberate. The JSON result is suitable for audit, version control,
and the later scenario-comparison UI. A future browser interface may collect the same
schema, but it must not add silent default ranges.

## Verification

Observed after implementation:

```bash
npm test                  # 110 pass, 0 fail
npm run golden:diff       # No behaviour change; golden.json is current
npm run lint              # 0 errors, 0 warnings
node tools/sensitivity.js tests/fixtures/sensitivity-bounds-test.json
                          # ok; 2 ranked results; 0 errors
```

The CLI output was repeated through the pure test path and was byte-for-byte
deterministic after JSON serialization. Direct low/high calculations matched the
sensitivity metrics exactly. The synthetic fixture is labelled test-only and is not a
Malawi programme assumption.

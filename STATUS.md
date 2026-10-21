# STATUS

**Read this first. Update it last.** This is the current snapshot; history is in [CHANGELOG.md](CHANGELOG.md), the on-site [changelog](changelog.html), and [docs/adr/](docs/adr/).

## Current state

| | |
|---|---|
| **Release** | 0.6.0 — evidence-based Malawi defaults and observations-only country loading |
| **Stages complete** | S0, S1, S2, S3, S5; S4 solver correctness complete, other S4 work and S6 remain |
| **Tests** | ✅ 83 pass, 0 todo, 0 fail (`npm test`, ~1s) |
| **Lint** | ✅ ESLint, 0 errors and 0 warnings |
| **Goldens** | ✅ 21 scenarios current (`npm run golden:diff` → “No behaviour change”) |
| **Country audit** | ✅ 44/44 selector countries have current essential observations; returned values pass semantic ranges (`npm run audit:countries`) |
| **Findings register** | 43 of 45 resolved; F-44 and F-45 remain open |
| **Open modelling question** | MODEL_SPEC R-7.6: whether the headline constraint label should derive directly from the production minimum |

## What remains unresolved

| What | Why it matters | Recommended next action |
|---|---|---|
| **F-44 — capitalised-interest catch-up** | Missed interest increases investor liability but is not separately scheduled for later repayment. | High priority: write one debt-waterfall ADR defining arrears ordering and repayment. |
| **F-45 — terminal investor settlement** | Wind-up can freeze loan cash while investor liability remains outstanding. | Fix with F-44: pay available loan cash through a specified terminal waterfall before freezing state. |
| **R-7.6 constraint label** | The displayed dominant constraint is recomputed separately from actual production limits and can disagree. | Decide the reporting convention before changing code. |
| Solver caching, sensitivity analysis, scenario save/load | S4 items 2–4 remain. | Sensitivity analysis is the most useful next robustness feature. |
| Real-browser chart/advisor click-through | Headless tests cover startup, calculation, export, and wiring, but not visual chart interaction. | Add a browser smoke pass during S6 accessibility/mobile work. |

## Malawi reference run

Static defaults and the recorded post-fetch Malawi startup now agree on the model-driving observations. Country loading no longer changes programme assumptions.

| Measure | Current result |
|---|---:|
| Toilets built | 118,509 |
| People reached | 521,440 (~5.6% of the target population) |
| Micro-enterprises at horizon | 345 |
| Ending / minimum cash | +$17,898 |
| Net assets | +$472,563 |
| Senior debt | Repaid in full |
| OSS / FSS | 1.83 / 1.19 |
| SROI | 4.09 (time value only by default; unsupported DALY and carbon inputs are zero) |
| Verdict | Integrity OK; viability OK |

The 20-year stress scenario is **not viable** under the same assumptions: 164,749 toilets, -$11,751 net assets, and 40 insolvent months. This is accepted and disclosed rather than hidden by inventing a higher portfolio rate or lower operating cost. The sourced 12-month Malawi household term turns capital faster but earns less interest per loan, so the illustrative 40% portfolio rate does not sustain indefinite operations.

## Assumptions and country data

- World Bank loading writes only target population, population growth, and GNI per capita (GDP fallback), using latest non-empty observations with dates.
- CPI, commercial lending, poverty, Gini, and sanitation coverage are context only.
- Missing essential observations clear the field and pause automatic calculation; another country's value is never retained.
- Malawi references are documented in [docs/PARAMETERS.md](docs/PARAMETERS.md): 4.4 people/household, 28 districts, $100 toilet planning cost, $3,000 enterprise capital, 12-month loan terms, 0.25 hours saved/day, and a 50% time-value factor.
- Financing, operating, write-down, capacity, contingency, and grant-pacing defaults remain illustrative programme assumptions. They must be calibrated before an investment decision.

## Environment

Node is not on `PATH` on the maintainer's machine:

```bash
export PATH="/c/Users/jrobertson/Repositories/node-v25.8.1-win-x64:$PATH"
npm test
npm run lint
npm run golden:diff
npm run audit:countries       # live, read-only; not a CI test
node tools/verify-findings.js
```

Run the app with `python -m http.server 8080` or `npm run serve`. `file://` works, but browsers may block World Bank calls from local files.

## Latest activity

On 2026-10-20 the post-S5 review added F-38–F-45. F-38–F-43 were fixed under [ADR-0034](docs/adr/0034-observations-only-country-data.md) and [ADR-0035](docs/adr/0035-zero-writedowns-and-demand-order.md). The review made startup listener behavior browser-faithful, removed policy-generating API heuristics and mixed-level administrative data, recalibrated Malawi defaults from primary evidence, preserved explicit zero write-downs, and corrected demand recurrence order. F-44/F-45 are intentionally visible follow-up work.

# STATUS

**Read this first. Update it last.** This is the current snapshot; history is in [CHANGELOG.md](CHANGELOG.md), the on-site [changelog](changelog.html), and [docs/adr/](docs/adr/).

## Current state

| | |
|---|---|
| **Release** | 0.8.0 — fail-fast input validation |
| **Stages complete** | S0, S1, S2, S3, S5; S4 solver correctness complete, other S4 work and S6 remain |
| **Tests** | ✅ 94 pass, 0 todo, 0 fail (`npm test`, ~1s) |
| **Lint** | ✅ ESLint, 0 errors and 0 warnings |
| **Goldens** | ✅ 21 scenarios current (`npm run golden:diff` → “No behaviour change”) |
| **Country audit** | ✅ 44/44 selector countries have current essential observations; returned values pass semantic ranges (`npm run audit:countries`) |
| **Findings register** | ✅ 46 of 46 resolved |
| **Open modelling question** | MODEL_SPEC R-7.6: whether the headline constraint label should derive directly from the production minimum |

## What remains unresolved

| What | Why it matters | Recommended next action |
|---|---|---|
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

## Investor debt contract

- Debt service pays old capitalised interest, current interest, then original principal.
- Paying old interest reduces both outstanding interest arrears and the senior liability; cumulative capitalisation and later cures remain separately auditable.
- In the wind-up month, remaining original principal accelerates and positive loan-ledger cash is paid before the ledger freezes. Grant cash remains ring-fenced.
- INV-20 reconciles the liability; INV-21 prevents stranded terminal loan cash. See [ADR-0036](docs/adr/0036-complete-investor-debt-waterfall.md).

## Input contract

- `ModelModule.calculate()` validates every numeric input before allocating arrays or running month 1.
- Blank and malformed form values remain invalid; they never restore a hidden fallback.
- A failed browser rerun reports all detected fields together, clears the prior result, and leaves no scenario available for export or advice.
- Bounds are mathematical or definitional only. Do not add unsupported policy caps. See [ADR-0037](docs/adr/0037-fail-fast-input-validation.md).

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

On 2026-10-21 release 0.8.0 closed F-46 under [ADR-0037](docs/adr/0037-fail-fast-input-validation.md). Invalid scenarios now stop before simulation, all detected fields are reported together, and a failed rerun cannot leave an older result exportable. All valid goldens and the five-year Malawi reference headlines are unchanged. The on-site [changelog](changelog.html) gives users the release history and remaining limitations as simple bullets.

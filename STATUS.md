# STATUS

**Read this first. Update it last.** One page, always current. If it disagrees with reality, reality wins and you fix this file.

---

## Where the work is

| | |
|---|---|
| **Stages complete** | **S0** (scaffolding), **S1** (silent-wrongness fixes), **S2** (user control) — plus the S3 correctness items that S2 depended on |
| **Current stage** | **S3 — model correctness**, partially landed. See "What is left". |
| **Last updated** | 2026-08-20 |
| **Branch** | `audit-and-correction` — pushed to `origin`. |
| **Tests** | ✅ 53 tests — **53 pass, 0 todo, 0 fail** (`npm test`, ~0.5s) |
| **Goldens** | ✅ 22 scenarios, current |
| **Findings** | 19 of 34 fixed and verified (`node tools/verify-findings.js` → *18 fixed, 0 still present*) |

---

## What landed

An audit of commit `2d81863`, a regression suite, three stages of fixes, and eight modelling decisions taken by the model owner. Every source file has changed; `methodology.html` was fully rewritten to match.

### Verified fixed

| | Finding | What changed |
|---|---|---|
| 🔴 | **F-29** | "Model Integrity Verified" no longer appears on a failing fund. `calculate()` returns two verdicts — **integrity** (is the arithmetic sound: a defect in the model) and **viability** (does the fund work: a finding about the scenario) — and both render on screen. [ADR-0008](docs/adr/0008-integrity-versus-viability.md) |
| 🔴 | **F-01** | `fundCostOfCapital` has a control. It was read by the model, absent from the form, and therefore 0 in every run the tool ever produced. [ADR-0004](docs/adr/0004-cost-of-capital-input.md) |
| 🔴 | **F-02 + F-33** | Carbon was understated ~250,000x — divided by 1000 as if kilograms, share divided by 100 twice, credited once instead of annually. [ADR-0005](docs/adr/0005-carbon-units-and-accrual.md) |
| 🔴 | **F-31** | The fund now winds up instead of billing operations forever. Ending cash at 5y and 20y are identical; they used to differ by $992,683 for the same fund. [ADR-0006](docs/adr/0006-wind-up-terminal-state.md) |
| 🔴 | **F-04 / F-05 / F-30 / F-32** | Nothing writes back into the user's inputs. The auto-solver is advisory, and every suggestion is scored by re-running the model. [ADR-0009](docs/adr/0009-advisory-not-automatic.md) |
| 🔴 | **F-06** | Grace defers principal only; unpaid interest capitalises into the liability instead of vanishing. [ADR-0007](docs/adr/0007-investor-arrears-and-grace.md) |
| 🔴 | **F-07 / F-09** | One hours-saved definition (the two disagreed by 4.39x); population growth now reaches the demand backlog. [ADR-0010](docs/adr/0010-wire-up-collected-inputs.md) |
| | F-03 | A 0% interest rate no longer produces `NaN`. INV-8 is now the **first** integrity check and short-circuits. |
| | F-11, F-12 | `verify` is its own flag; the opening balance is an enforced invariant. |
| | F-13, F-15, F-16, F-23 | Dead branch reachable again (the same bug also wrote `$undefined` into two CSV exports); dead wizard code removed; duplicate keys removed; `$$1,234` fixed. |
| | F-18, F-22 | `server.js` contains requests to its own directory, binds loopback, returns real 404s. Chart.js pinned to 4.4.1 with SRI and vendored for offline use. |
| | UX | **The country selector showed one entry.** It was an `<input list="...">` pre-filled with "Malawi"; browsers filter a datalist by what is already typed, so the tool read as a single-country model. Now a `<select>` listing all 44 countries with ISO codes. |
| 🔴 | **F-34** | **The tested scenario was not the scenario that runs.** The app auto-fetches country data 500 ms after load and overwrites most of the form, so the carefully tuned defaults were a state nobody ever saw — and the fetch was setting the cost of capital to Malawi's 37.1% commercial lending rate, opening the app on an insolvent fund. Found by a user, after the whole suite reported green. [ADR-0018](docs/adr/0018-fetch-does-not-set-negotiated-terms.md) |
| 🔴 | **F-17** | **Rates are now entered as percentages** — type `40`, not `0.40`. Two contradictory heuristics are gone, so rates above 100% work. [ADR-0012](docs/adr/0012-percentage-entry-convention.md) |
| 🔴 | **F-08** | SROI is social value only: DALYs included, ending cash removed, financial return reported separately as `capitalPreservation`. The hourly value is derived from local income instead of an uncited `$0.50`. [ADR-0011](docs/adr/0011-sroi-is-social-value-only.md), [ADR-0015](docs/adr/0015-value-of-saved-time.md) |
| 🔴 | **F-20** | Enterprise closure is now its own parameter, so capacity responds to business failure. Previously a 50% write-down rate left 1,000 enterprises standing. [ADR-0014](docs/adr/0014-me-attrition-is-separate-from-write-down.md) |
| 🔴 | **F-25** | `avgAnnualIncome` finally does something — it sets the value of saved time. It was the last input collected and ignored. |
| | F-33 (part) | Carbon crediting stops after a configurable 5-year service life. [ADR-0016](docs/adr/0016-toilet-service-life.md) |
| | — | `contingencyRate` relabelled "Cost Contingency (% mark-up)": the implementation was right, the name was wrong. [ADR-0017](docs/adr/0017-contingency-is-a-cost-mark-up.md) |

### New in the safety net

- **`tests/smoke.test.js`** — drives the real controller against a DOM stub built from the actual ids and defaults in `index.html`. Eight of this project's first fifteen commits were "Fix TypeError" crashes in the render path; this catches those. It also asserts directly that `runCalculation` does **not** rewrite any input.
- **`tests/startup.test.js`** — drives the real country-fetch handler against recorded World Bank and administrative-unit responses for Malawi, and asserts the resulting scenario is viable. **This is the only test that answers "does the thing a user opens actually work?"** — and its absence is why F-34 shipped.
- All three previously-`todo` invariants (INV-8, INV-13, INV-14) now pass.

---

## Baseline today



The defaults themselves changed (ADR-0013), so this compares the old demo with the new one:

| | Before | After |
|---|---|---|
| Toilets | 211,317 | 139,148 |
| People reached | 1,056,585 | 695,740 (3.5% of target) |
| Ending cash | -$36,351 | **+$17,790** |
| Minimum cash | -$36,351 | **+$15,935** |
| Net assets | -$786,332 | **+$1,426,422** |
| Investor repaid | $3,250,019 of $4,000,000 (18.7% default) | **$4,000,000 — repaid in full** |
| Investor interest | $0 | $221,312 (at 2% cost of capital) |
| OSS / FSS | 0.80 / 0.70 | **2.43 / 1.58** |
| Verdict shown | `✅ Model Integrity Verified` | **integrity OK, viability OK — both stated** |

Reach fell 34%, which is the honest trade: the old scenario built more toilets *because* it was not repaying its investor. The new one works and reaches 3.5% of the target — a better starting point for a policy conversation than either a green tick on a broken fund or a wall of warnings.

The parameter set was not hand-picked. A grid over five levers found 308 viable combinations of 675; those were re-scored against six stress cases and ranked. The chosen point survives all six. Details and the stress table are in [ADR-0013](docs/adr/0013-viable-default-scenario.md).

### What the browser actually opens on

`tests/baseline-inputs.js` describes `index.html`; the app then fetches country data and overwrites most of it. The state a user sees, with recorded Malawi data:

| | |
|---|---|
| Inflation / HH rate / cost of capital | 28.4% / 48.4% / 2.0% |
| Districts / ops cost / grant support | 30 / $25,000 / 40% |
| Toilets | 196,264 (981,320 people) |
| Min cash / repaid / OSS | +$8,458 / 100% / 2.99 |
| Verdict | **viable** |

---

## What is left

### Blocked on a decision

| Finding | Blocked on |
|---|---|
| — | **Q13** — should service life stop DALYs and time saved too, not just carbon? |
| — | **Q2** — is 30% the right share of the wage for saved household time? Method settled, factor is a convention |
| F-10 | is `opsReserveCap` a real reserve or just a month-0 growth throttle? |
| — | **Q3, Q6, Q7, Q9** — see [MODEL_SPEC §13](docs/MODEL_SPEC.md) |

### Not blocked, just not done

| Finding | Task | Stage |
|---|---|---|
| F-19 | ESLint + CI | S0 |
| F-24 | ✅ Done — `methodology.html` fully rewritten and reconciled with the model | S0 |
| F-14 | `computeKPIs` still returns a nested shape that the renderer mutates | S2 |
| F-21 | One ME capital requirement; expose the two hardcoded `0.1` growth constants | S3 |
| F-26 | ✅ Labels changed; the realised-loss test is still to be written | S3 |
| F-27 | Solver bisection still assumes monotonicity it lacks in the capital-tight regime | S4 |
| F-30 | Relabel Grant Support % and show grant-fund runway beside it | S2 |
| — | **Browser click-through.** The startup path is now covered by a fixture test, but charts, CSV export and the advisor panel are still only verified as "does not throw". | now |

---

## Questions for the model owner

Each is a modelling decision, not a defect. An agent must not resolve one by writing code — Rule 1 of [AGENTS.md](AGENTS.md).

**Resolved 2026-08-20:** Q1, Q8, Q10, Q12 (first round) and Q2-method, Q4, Q5, Q11 (second round). Eight ADRs, 0004–0017.

Still open:

| | Question |
|---|---|
| **Q13** | *New, raised by the fix for Q11.* Service life stops carbon crediting but not DALYs or time saved, so a retired toilet keeps averting disease forever. Applying the lifespan to all three is the coherent position, and would move headline impact substantially. |
| **Q2** | The *method* for valuing saved time is settled — local income, discounted below the wage. The **0.30 factor** is a conventional round number, not a figure verified against current published guidance. Confirm it against whatever your programme reports against. |
| **Q9** | Should the collections floor taper as the portfolio runs off, rather than stopping abruptly at wind-up? |
| **Q3, Q6, Q7** | Means-tested grant support; whether the ledgers may cross-lend; repeat/upgrade demand. All Stage 4. |

---

## Environment

Node is **not** on `PATH`:

```bash
export PATH="/c/Users/jrobertson/Repositories/node-v25.8.1-win-x64:$PATH"
node --version                    # v25.8.1
npm test                          # 43 pass, 0 fail
node tools/verify-findings.js     # 17 fixed, 0 still present
```

Run the app: `python -m http.server 8080`, or `npm run serve`. Charts now work offline (vendored Chart.js). `file://` works too, but the World Bank fetch will be CORS-blocked.

---

## Log

| Date | Stage | What happened |
|---|---|---|
| 2026-08-20 | S0 | Repository cloned and audited. 33 findings raised, 16 reproduced by execution. Test suite, headless harness and documentation set added. No model behaviour changed. |
| 2026-08-20 | S1–S3 | 17 findings fixed across 7 ADRs. Goldens re-recorded; all three `todo` invariants closed; smoke suite added. |
| 2026-08-20 | S1–S3 | Model owner resolved Q1, Q8, Q10, Q12. Percentage entry convention (ADR-0012), SROI redefined (ADR-0011), viable default scenario and 2% cost of capital (ADR-0013). |
| 2026-08-20 | S3 | Model owner resolved Q2 (method), Q4, Q5, Q11. Value of saved time derived from income (ADR-0015), enterprise closure separated from write-down (ADR-0014), 5-year carbon crediting life (ADR-0016), contingency relabelled (ADR-0017). `methodology.html` rewritten. 18 findings fixed, 47 tests passing. |

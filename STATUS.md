# STATUS

**Read this first. Update it last.** One page, always current. If it disagrees with reality, reality wins and you fix this file.

---

## Where the work is

| | |
|---|---|
| **Stages complete** | **S0** (scaffolding), **S1** (silent-wrongness fixes), **S2** (user control, fully) — plus every S3 item except F-21's other half |
| **Current stage** | **S3 — model correctness**, one finding left (F-21, half — a real behaviour change, deliberately not bundled into today's work). F-27 is S4. **No open modelling questions.** See "What is left". |
| **Last updated** | 2026-08-21 |
| **Branch** | `s3-close-open-items` |
| **Tests** | ✅ 67 tests — **67 pass, 0 todo, 0 fail** (`npm test`, ~1s) |
| **Lint** | ✅ `npm run lint` (ESLint, 3 rules — F-19). CI on push/PR, Node 20 & 22 (`.github/workflows/ci.yml`). |
| **Goldens** | ✅ 21 scenarios, current |
| **Findings** | 34 of 36 resolved (`docs/ANALYSIS.md`); `node tools/verify-findings.js` exercises 19 of them programmatically — *18 checks, 0 still present* |

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
| | F-28 | KPI types fixed: `depletionMonth` is `number \| null` with `isSustainable: boolean` carrying the flag; `opsRunway` is `number \| null` — the `99`-year sentinel is gone. |
| | F-24 | `README.md` and `methodology.html` reconciled with the model. |
| | F-26 | Realised-loss test written (`tests/writedown.test.js`, `T-DEF-1`). Found and fixed a documentation defect while writing it — [F-35](docs/ANALYSIS.md#f-35--r-34s-always-less-than-headline-claim-is-wrong-past-about-18-months): `MODEL_SPEC.md` claimed realised loss is "always less than headline"; measured, it crosses over and exceeds headline between 18 and 24 months. |
| | F-21 *(half)* | `meExpansionBudgetShare` and `meMaxMonthlyGrowthRate` exposed as inputs, replacing two hardcoded `0.1` constants. [ADR-0019](docs/adr/0019-expose-me-growth-constants.md); defaults unchanged, zero behaviour change (confirmed by `golden:diff`). **Still open:** unifying the three inconsistent ME-capital-requirement formulas (R-6.1) — a behaviour-changing fix that needs its own ADR. |
| | F-19 | ESLint (3 rules: `no-dupe-keys`, `no-undef`, `no-unused-vars`) and GitHub Actions CI added. First lint run found 16 violations, suppressed at file level per the roadmap's own instruction not to fix findings while adding the linter — see [app.js:6](app.js#L6). One of the 16, a duplicate `downloadCSV` key, turned out to be F-36. |
| 🔴 | **F-36** | CSV export was completely broken — `UI.downloadCSV()` was defined twice, and *both* copies threw. Restored the detailed monthly table (the shadowed, richer definition), fixed its two reference bugs, deleted the broken duplicate (its prose-report content duplicated the separate, already-working `copyAnalysisReport()`). [ADR-0026](docs/adr/0026-restore-the-detailed-csv-export.md); `tests/export.test.js` now actually calls it. |
| 🔴 | **F-10** | The debt-service lookahead the README has always claimed now actually exists: the solvency gate reserves 3 months of full (not hibernation-cut) ops cost **plus the next 3 months of scheduled investor principal**. `opsReserveCap` relabelled "Starting Capacity Throttle (%)" rather than folded into the new reserve — it does a genuinely different, narrower job. [ADR-0027](docs/adr/0027-debt-service-lookahead-reserve.md). Baseline reach fell ~9% (133,469 → 121,358 toilets); no scenario's viability verdict changed, and minimum cash improved or held everywhere checked. |
| | Q13 | Service life now stops DALYs and time-saved credit, matching carbon. [ADR-0025](docs/adr/0025-service-life-gates-all-impact.md). No effect at the shipped 5-year duration; found and fixed a spec-prose error along the way — see F-35 above. |
| | Q3, Q6, Q7, Q9 | All four resolved by keeping current behaviour, each with a short ADR explaining why (flat grant support, separate ledgers, no repeat demand, no collections taper). [ADR-0021](docs/adr/0021-grant-support-stays-flat-rate.md)–[0024](docs/adr/0024-collections-floor-stays-abrupt.md). |
| 🔴 | **F-14** | `computeKPIs` now returns `{ reach, impact, portfolio, financials, sustainability, value }` directly — six flat groups, none nested inside another. `UI.updateKPIs`'s destructure-and-reassign mutation is deleted outright. [ADR-0028](docs/adr/0028-flatten-computekpis.md). No model output changed; a new smoke test confirms `updateKPIs` is now idempotent (it wasn't). |
| 🔴 | **F-30** | Grant Support % relabelled "Grant-Funded Pacing (% of Production)"; a new `grantExhaustedMonth` reads out beside it — "Grant capital runs out around month N at this pace." [ADR-0029](docs/adr/0029-grant-support-relabel-and-runway.md). UI-only; no model output changed. |
| | Q2 | Accepted, not resolved by evidence: 30% stays the default, documented as a convention the model owner has signed off on for now rather than a sourced figure. [ADR-0030](docs/adr/0030-accept-30-percent-time-value-factor.md). **This closes the open-questions list — nothing is currently blocked on the model owner.** |

### New in the safety net

- **`tests/smoke.test.js`** — drives the real controller against a DOM stub built from the actual ids and defaults in `index.html`. Eight of this project's first fifteen commits were "Fix TypeError" crashes in the render path; this catches those. It also asserts directly that `runCalculation` does **not** rewrite any input.
- **`tests/startup.test.js`** — drives the real country-fetch handler against recorded World Bank and administrative-unit responses for Malawi, and asserts the resulting scenario is viable. **This is the only test that answers "does the thing a user opens actually work?"** — and its absence is why F-34 shipped.
- All three previously-`todo` invariants (INV-8, INV-13, INV-14) now pass.

---

## Baseline today



The defaults themselves changed (ADR-0013), and the solvency gate got stricter since (ADR-0027 — F-10), so this compares the original pre-audit demo with today's:

| | Before (pre-audit) | After (today) |
|---|---|---|
| Toilets | 211,317 | 121,358 |
| People reached | 1,056,585 | 606,790 (2.2% of target) |
| Ending cash | -$36,351 | **+$17,742** |
| Minimum cash | -$36,351 | **+$17,742** |
| Net assets | -$786,332 | **+$1,174,828** |
| Investor repaid | $3,250,019 of $4,000,000 (18.7% default) | **$4,000,000 — repaid in full** |
| Investor interest | $0 | $221,312 (at 2% cost of capital) |
| OSS / FSS | 0.80 / 0.70 | **2.36 / 1.52** |
| Verdict shown | `✅ Model Integrity Verified` | **integrity OK, viability OK — both stated** |

Reach fell 43% from the pre-audit figure — three separate, honest reasons, not one: the old scenario built more toilets *because* it was not repaying its investor; ADR-0014's micro-enterprise closure rate (10%/yr) now takes a real bite out of capacity; and ADR-0027's debt-service lookahead reserve (2026-08-21) now holds back cash the fund used to lend away, dropping baseline reach a further ~9% (133,469 → 121,358) on its own. The fund works and stays safely solvent throughout — minimum cash now equals ending cash, i.e. it never dips below where it finishes.

The parameter set was not hand-picked. A grid over five levers found 308 viable combinations of 675; those were re-scored against six stress cases and ranked. The chosen point survives all six. Details and the stress table are in [ADR-0013](docs/adr/0013-viable-default-scenario.md). That grid search predates ADR-0027; it has not been re-run against the stricter reserve rule, so the "308 of 675" figure describes the search that chose these defaults, not a guarantee that still holds exactly today.

### What the browser actually opens on

`tests/baseline-inputs.js` describes `index.html`; the app then fetches country data and overwrites most of it. The state a user sees, with recorded Malawi data:

| | |
|---|---|
| Inflation / HH rate / cost of capital | 28.4% / 48.4% / 2.0% |
| Districts / ops cost / grant support | 30 / $25,000 / 40% |
| Toilets | 181,587 (907,935 people) |
| Min cash / repaid / OSS | +$21,919 / 100% / 2.95 |
| Verdict | **viable** |

---

## What is left

### Blocked on a decision

**None.** Every open modelling question is resolved — see the Log below and `docs/adr/0021` through `0025`, `0030`.

### Not blocked, just not done

| Finding | Task | Stage |
|---|---|---|
| F-21 | Unify the three inconsistent ME-capital-requirement formulas (R-6.1) into one `meCapitalRequirement(inputs)` — behaviour-changing, needs its own ADR and a measured prediction before recording, same treatment as F-10/Q13. Constant-exposure half (R-6.2) is done. | S3 |
| F-27 | Solver bisection still assumes monotonicity it lacks in the capital-tight regime | S4 |
| — | **Browser click-through.** The startup path is now covered by a fixture test, and CSV export now has a real test (F-36), but charts and the advisor panel are still only verified as "does not throw". | now |

That's it. F-21 is the only finding left, and it's deliberately not urgent — it's a real behaviour change, not a bug fix, and rushing it defeats the point of doing it carefully.

---

## Questions for the model owner

Each is a modelling decision, not a defect. An agent must not resolve one by writing code — Rule 1 of [AGENTS.md](AGENTS.md).

**All resolved.** Q1–Q13 (there is no Q14; numbering follows the order questions were raised, not answered).

- **2026-08-20:** Q1, Q8, Q10, Q12 (first round) and Q2-method, Q4, Q5, Q11 (second round). Eight ADRs, 0004–0017.
- **2026-08-21:** Q13, Q3, Q6, Q7, Q9 — each recommended by the model owner and implemented the same day. [ADR-0021](docs/adr/0021-grant-support-stays-flat-rate.md) through [ADR-0025](docs/adr/0025-service-life-gates-all-impact.md).
- **2026-08-21 (later):** Q2's remaining half — the 0.30 factor itself, not just the method — accepted as the working default rather than sourced. [ADR-0030](docs/adr/0030-accept-30-percent-time-value-factor.md). **Treat it as provisional**: confirm against your own programme's published cost-benefit guidance before publishing an SROI figure derived from it. This is the one place a "resolved" question still carries a caveat worth repeating to anyone reading only this summary.

If a new modelling question comes up, it becomes Q14 and goes here.

---

## Environment

Node is **not** on `PATH`:

```bash
export PATH="/c/Users/jrobertson/Repositories/node-v25.8.1-win-x64:$PATH"
node --version                    # v25.8.1
npm ci                            # installs ESLint — first time only, or after eslint.config.js changes
npm test                          # 67 pass, 0 fail
npm run lint                      # ESLint, F-19
node tools/verify-findings.js     # 18 fixed, 0 still present
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
| 2026-08-21 | — | Reconciliation pass, no model behaviour changed. `npm test` (53/53), `golden:diff` (clean) and `verify-findings.js` (18/0) confirmed green. Fixed drift the audit itself had accumulated: F-08, F-17 and F-24 were fixed on 2026-08-20 but never got their ✅ in `docs/ANALYSIS.md`, and `verify-findings.js`'s outstanding-findings footer still listed F-08, F-20, F-24, F-25 as open. This page's own "Baseline today" table predated ADR-0014 (ME closure) landing, so it was quoting toilets/cash/net-assets figures the model no longer produces; re-measured and corrected. README.md's status section, test-suite description and stage summary were stale in the same way; updated to match. `docs/ROADMAP.md` and `docs/ARCHITECTURE.md` had the same class of staleness — both described several already-fixed defects (F-01, F-04/F-05, F-11, F-17, F-18, F-22, F-29) as current, and cited `app.js`'s audit-time line count (3,667) rather than today's (4,028); corrected. |
| 2026-08-21 | S3/S0 | Agent-executable, low-risk items done in one pass. **F-26**: wrote the realised-loss test (`tests/writedown.test.js`); found it was pinning a spec claim that was itself wrong past ~18 months, registered and fixed as **F-35**. **F-21 (half)**: exposed `meExpansionBudgetShare`/`meMaxMonthlyGrowthRate` as inputs, [ADR-0019](docs/adr/0019-expose-me-growth-constants.md), zero behaviour change confirmed by `golden:diff`; R-6.1's capital-requirement unification (the behaviour-changing half) is still open. **F-19**: added ESLint (3 rules) and GitHub Actions CI. The first lint run surfaced **F-36** — `UI.downloadCSV()` is defined twice, and *both* copies throw when called; nothing ever tested it. Registered, not fixed — the two copies produce different report formats and picking one is a product decision, not a cleanup. `npm test`: 53 → 60. `golden:diff`: clean throughout. |
| 2026-08-21 (2) | S3/S2 | Model owner reviewed the open items and said: follow the recommendations. Implemented all of them. **F-36** fixed — kept the detailed CSV table, fixed its two reference bugs, deleted the broken duplicate ([ADR-0026](docs/adr/0026-restore-the-detailed-csv-export.md)); `tests/export.test.js` added, nothing tested this before. **F-10** fixed — the debt-service lookahead reserve now actually exists (3mo full ops + next 3mo scheduled investor principal), `opsReserveCap` relabelled "Starting Capacity Throttle (%)" rather than folded into it ([ADR-0027](docs/adr/0027-debt-service-lookahead-reserve.md)) — **the largest behaviour change of the day**: baseline reach 133,469 → 121,358 toilets (-9%), 476 golden values moved across 21 scenarios, but no scenario's viability verdict changed and minimum cash improved or held everywhere checked (verified by re-running the pre-change formula against the same 21 scenarios before recording). **Q13** resolved and implemented — service life now gates DALYs/time-saved, matching carbon ([ADR-0025](docs/adr/0025-service-life-gates-all-impact.md); zero effect at the shipped 5-year duration, ~50%/~38% impact reduction on the two scenarios that actually run past their service life). **Q3, Q6, Q7, Q9** resolved by keeping current behaviour, each with a short ADR ([0021](docs/adr/0021-grant-support-stays-flat-rate.md)–[0024](docs/adr/0024-collections-floor-stays-abrupt.md)) explaining why, so the decision is recorded rather than left implicit. **Q2 left open** — needs the model owner's own published-guidance source, which no agent can supply. Test-first throughout (`INV-15`, `INV-16`, `tests/export.test.js` all written and confirmed failing before their fixes landed). `npm test`: 60 → 65. Two full `golden:record` cycles, each preceded by a measured (not guessed) prediction in its ADR. Committed as one commit, `s3-close-open-items` branch (not pushed). |
| 2026-08-21 (3) | S2/S3 | Two remaining findings and Q2 closed out. **F-14** fixed — `computeKPIs` returns `{ reach, impact, portfolio, financials, sustainability, value }` directly; `UI.updateKPIs`'s mutation deleted ([ADR-0028](docs/adr/0028-flatten-computekpis.md)). Six call sites across the solvers, advisor and controller that read the old nested shape updated to match, along with every test/tool that drives the model headlessly (`tests/golden.scenarios.js`, `invariants.test.js`, `smoke.test.js`, `startup.test.js`, `tools/probe.js`, `tools/verify-findings.js`). Test-first: a new smoke assertion confirmed `updateKPIs` was NOT idempotent before the fix, and is after. **F-30** fixed — relabelled "Grant-Funded Pacing (% of Production)"; added `grantExhaustedMonth` (a new derived field, tracked in the month loop, reset if carbon revenue tops the ledger back up) and a runway note beside the field ([ADR-0029](docs/adr/0029-grant-support-relabel-and-runway.md)). A new INV-17 confirms the pacing story directly: 5% vs 90% moves the exhaustion month by ~7x but total grant-funded toilets by <10%. **Q2** — the model owner confirmed 30% is acceptable for now; recorded as an accepted-not-verified convention rather than left as an open question, with the existing "confirm before publishing" caveat kept intact everywhere it already appeared ([ADR-0030](docs/adr/0030-accept-30-percent-time-value-factor.md)). No modelling questions remain open. Both F-14 and F-30 confirmed zero golden movement — pure refactor and pure UI respectively. `npm test`: 65 → 67. |

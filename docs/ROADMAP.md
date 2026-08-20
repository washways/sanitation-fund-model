# Staged Improvement Roadmap

Each stage is a **self-contained unit of work with an entry gate and an exit gate**. A stage may be picked up cold by a new contributor — human or agent — who has read nothing but [AGENTS.md](../AGENTS.md), this file, and [MODEL_SPEC.md](MODEL_SPEC.md).

**Rules that apply to every stage:**

1. **Do not start a stage whose entry gate is not met.** The gates exist because the later stages assume the earlier ones landed.
2. **Do not work on two stages at once.** One stage, one branch, one review.
3. **The exit gate is not "I think it's done"** — it is a command that exits zero and a diff someone can read.
4. **Never widen scope mid-stage.** If you find something outside your stage, add it to the findings register in [ANALYSIS.md](ANALYSIS.md) and keep going.

Progress is tracked in [STATUS.md](../STATUS.md), which is the first file to read and the last to update.

---

## Stage map

| Stage | Theme | Findings closed | Risk | Depends on |
|---|---|---|---|---|
| ✅ **S0** | Scaffolding and safety net | F-19 (partial), F-22 ✅, F-18 ✅, F-24 (partial) | Very low | — |
| ✅ **S1** | Silent-wrongness fixes | F-29 ✅, F-01 ✅, F-02 ✅, F-33 ✅, F-03 ✅, F-11 ✅, F-12 ✅, F-16 ✅, F-17 (blocked on Q10) | Low | S0 |
| ✅ **S2** | Give the user back control | F-04 ✅, F-05 ✅, F-30 ✅, F-13 ✅, F-14, F-15 ✅, F-23 ✅ | Medium | S1 |
| 🔄 **S3** | Model correctness | F-06 ✅, F-07 ✅, F-09 ✅, F-31 ✅, F-32 ✅, F-28 ✅, F-10, F-20, F-21, F-25, F-26 | **High** | S2 |
| **S4** | Decision support | F-08, F-27, Q1–Q11 | Medium | S3 |
| **S5** | Structure | — (enables everything after) | Medium | S3 |
| **S6** | Presentation and reach | — | Low | S5 |

The ordering is deliberate and is not a priority ranking:

- **S0 before everything** because without a safety net every later change is a gamble. It changes no behaviour, so it cannot break anything.
- **S1 before S2** because S1 fixes numbers that are silently wrong. There is no point improving how the user controls a model that gives wrong answers.
- **S2 before S3** because while the controller rewrites the user's inputs (F-04, F-05), you cannot tell whether a change in output came from your edit or from the app editing itself. **S2 is what makes S3's results trustworthy.**
- **S3 before S4** because the advisor and the solvers give advice based on the model; fixing the advice before the model just produces confidently wrong guidance (this is exactly how F-32 happened).
- **S5 after S3** because restructuring code whose behaviour is still changing means doing the work twice. The golden tests from S0 make the restructure safe whenever it happens.

---

## S0 — Scaffolding and safety net

**Goal:** make it possible to change this codebase without fear. **Zero behaviour change.**

**Entry gate:** none.

**Status:** ✅ Complete except ESLint/CI (F-19) and reconciling `methodology.html` (F-24). See [STATUS.md](../STATUS.md).

### Done

- `package.json` with `npm test` (Node's built-in runner, zero dependencies).
- `tools/load-model.js` — loads `ModelModule` headlessly so the model can be tested without a browser.
- `tools/baseline-inputs.js` — the shipped defaults as a plain object, guarded against drift by a test.
- `tests/wiring.test.js` — catches the class of bug behind F-01 (a parameter the model reads that the UI cannot set).
- `tests/invariants.test.js` — INV-1..INV-14, with unmet invariants marked `todo` as an executable work queue.
- `tests/golden.test.js` + `golden.record.js` — 18 characterisation scenarios. Verified to detect change: a 1% perturbation of the ops-cost line moved 258 recorded values.
- Documentation set: this file, [ANALYSIS.md](ANALYSIS.md), [MODEL_SPEC.md](MODEL_SPEC.md), [TESTING.md](TESTING.md), [PARAMETERS.md](PARAMETERS.md), [ARCHITECTURE.md](ARCHITECTURE.md), [../AGENTS.md](../AGENTS.md), [../CONTRIBUTING.md](../CONTRIBUTING.md), rewritten README (closes F-24).

### Remaining

| Task | Finding | Notes |
|---|---|---|
| ~~Pin Chart.js, add SRI, vendor a local fallback~~ | F-22 | ✅ Done — 4.4.1, sha384 SRI, `vendor/chart.umd.min.js` fallback. |
| ~~Harden `server.js`~~ | F-18 | ✅ Done — containment check, real 404s, binds `127.0.0.1`. |
| Reconcile `methodology.html` with the model | F-24 | It still describes the old carbon, grace-period and reserve behaviour. |
| Add ESLint with `no-dupe-keys`, `no-undef`, `no-unused-vars` | F-19 | Expect a large first run. **Do not fix findings while adding the linter** — record the count, add `eslint-disable` at file level, and remove the suppressions stage by stage. |
| Add CI running `npm test` on push | F-19 | GitHub Actions, Node 20 and 22. |
| `.gitignore` | F-19 | ✅ Done. |

**Exit gate:**

```bash
npm test          # 0 failures
npm run golden:diff   # "No behaviour change"
```

…and the charts still render in a browser with the network disabled.

---

## S1 — Silent-wrongness fixes

**Goal:** stop the model producing confidently wrong headline numbers. Every item here is small, local, and independently testable.

**Entry gate:** S0 exit gate passes.

**Expected to change golden values.** That is the point. Each task below states the direction; check the actual move against it.

| # | Task | Finding | Predicted effect on goldens |
|---|---|---|---|
| 1 | **Split integrity from viability.** Two verdicts per R-10. Render viability on screen. Never print success with a warning outstanding. | **F-29** | None (reporting only). New fields in the result object. |
| 2 | **Add `NaN`/`Infinity` as the first integrity check.** | F-03 | None. |
| 3 | **Add the `r == 0` annuity branch** (R-3.2), via one shared `annuityPayment()` helper used in all three call sites. | F-03 | None on existing scenarios (all have non-zero rates). Un-todo INV-8. |
| 4 | **Add a `fundCostOfCapital` input to `index.html`**, defaulted from World Bank `FR.INR.LEND`. | **F-01** | **Large.** Every scenario gains investor interest. Net assets fall. At 8% the baseline moves -$786k to -$1,349k. |
| 5 | **Remove the double `/100` on `carbonCreditShare`** (R-8.1). | F-02 | Only `carbon enabled` moves — carbon revenue x100. |
| 5b | **Fix the carbon unit**: drop the `/1000` (the input is labelled tonnes, `co2Value` is per tonne). Decide annual-accrual vs once-at-construction as an ADR (Q11). | **F-33** | Only `carbon enabled` moves — a further x1000, plus whatever the accrual decision implies. Combined with task 5, ~250,000x. |
| 6 | **One percent convention** (R-2.3): everything entered as a percentage, converted once in `getInputs`. Update every label with a `%` suffix. | **F-17** | None if done correctly — this is the risky one. Verify each field individually against [PARAMETERS.md](PARAMETERS.md). |
| 7 | **Split `enableBreakEvenSolver` into `runSolvers` and `verify`.** | F-11 | None. |
| 8 | **Add INV-2 to `verifyLedger`** (opening balance). | F-12 | None — it already holds; this guards it. |
| 9 | **Remove duplicate object keys.** | F-16 | None. |

**Sequencing note:** do task 1 **first**. Until integrity and viability are separated, you cannot tell whether a change you made broke the model or merely exposed a scenario that was always failing.

Do tasks 4 and 6 **last**, and **each in its own commit** — they are the two with real blast radius.

**Exit gate:**

```bash
npm test    # 0 failures; INV-8 no longer todo
```

- `golden.json` re-recorded, with a commit message citing the ADR for tasks 4 and 5.
- The baseline scenario now displays an explicit viability verdict on screen: *insolvent from year 4.1, $749,981 of senior debt unrepaid*.
- A reviewer has confirmed the golden diff matches the predictions in the table above.

---

## S2 — Give the user back control

**Goal:** the scenario shown is the scenario entered. Nothing writes to an input the user did not ask it to write.

**Entry gate:** S1 exit gate passes.

**This stage is the precondition for trusting any result in S3.** While `runCalculation` mutates `grantSupportPct` and `updateSmartRates` overwrites the interest rates, an A/B comparison in S3 is measuring two unknown scenarios.

| # | Task | Finding |
|---|---|---|
| 1 | **Make the auto-solver advisory.** Compute the recommendation without mutating any DOM input; present as "grant support would need to fall from 20% to 13% — [Apply]". Delete the recursion entirely. | **F-04** |
| 2 | **Delete the grant-support auto-adjust strategy**, or replace it. Measurement shows it cannot close a repayment shortfall (grant % is a pacing lever — the shortfall is in the loan ledger). | **F-30** |
| 3 | **Make `updateSmartRates` a suggestion.** Honour `dataset.manual`; show the smart rate as a hint with an [Apply] control; never dispatch a synthetic `input` event. | **F-05** |
| 4 | **Relabel grant support** to reflect what it does, and show grant-fund runway ("grant fund exhausted at month 16") beside it. | **F-30** |
| 5 | **Flatten `computeKPIs`** to one flat, documented object. Stop mutating it in `updateKPIs`. | F-14 |
| 6 | **Fix `inputs.loanFund` -> `investLoan`**; add a test that the idle-cash hint fires on an over-capitalised scenario. | F-13 |
| 7 | **Delete `applyWizardSettings`, `showWizardStep`, `wizTech`** and the dead ids. | F-15 |
| 8 | **Replace `alert()` with an in-page panel**; fix the `$${fmt()}` double dollar sign. | F-23 |

**Exit gate:**

```bash
npm test    # 0 failures
```

- **New test:** entering a scenario, clicking Recalculate, and reading every input back returns exactly what was entered. This is the stage's whole point — write it first, watch it fail, then make it pass.
- INV-12 extended to cover the full controller path, not just `ModelModule`.
- `golden.json` unchanged (this stage should not move the maths).

---

## S3 — Model correctness

**Goal:** make the financial and impact mathematics match [MODEL_SPEC.md](MODEL_SPEC.md).

**Entry gate:** S2 exit gate passes — inputs are stable and results are reproducible.

⚠️ **This is the high-risk stage.** Every task changes published numbers. Each needs its own ADR, its own commit, and its own golden re-record. **Do not batch them.**

| # | Task | Finding | Rule |
|---|---|---|---|
| 1 | **Terminal state / wind-up.** Stop billing ops against a dead fund; measure end state at wind-up, not at the horizon. | **F-31** | R-9 |
| 2 | **Arrears.** Interest accrues during grace; unpaid interest capitalises; liability is tracked, not reconstructed. | **F-06** | R-4.3, R-4.5, R-4.6 |
| 3 | **One hours-saved formula**, in the loop, with `hoursPerPersonPerDay` as an input. | **F-07** | R-8.2 |
| 4 | **Population growth** in the demand backlog. | F-09 | R-7.1 |
| 5 | **Reserves.** Debt-service lookahead; enforce or remove `opsReserveCap`; rename it. | F-10 | R-5.4 |
| 6 | **ME attrition** on write-down. | F-20 | R-6.3 |
| 7 | **One ME capital requirement**; expose the two hardcoded `0.1` growth constants as inputs. | F-21 | R-6.1, R-6.2 |
| 8 | **Relabel the default rate** to "annual portfolio write-down rate"; add the realised-loss test. | F-26 | R-3.4 |
| 9 | **Fix KPI types**: `depletionMonth: number\|null`, `opsRunway: number\|null`. | F-28 | R-11 |
| 10 | **Ground the advisor in the model** — every recommendation re-runs the simulation and confirms it improves the objective before showing it. | **F-32** | — |
| 11 | Use `avgAnnualIncome` or delete it; rename `outflows.defaults*` to `writeOffs`. | F-25 | R-3.5 |

**Order matters:** do **1 and 2 first**. They interact — arrears only make sense once the fund has a defined end — and together they change what every other task is measured against. Task 10 must be **last**: the advisor can only be grounded in a model that is already correct.

**Exit gate:**

```bash
npm test    # 0 failures; INV-13 and INV-14 no longer todo
```

- One ADR per task, each predicting direction and magnitude before the code changed.
- `golden.json` re-recorded once per task, never in a batch.
- Re-run `node tools/verify-findings.js`: F-06, F-07, F-09, F-20, F-26 report NOT CONFIRMED (the defect is gone).
- [MODEL_SPEC.md](MODEL_SPEC.md) tags flipped from **[TARGET]** to **[AS-BUILT]** for every rule landed.

---

## S4 — Decision support

**Goal:** make the tool's advice trustworthy and its uncertainty visible.

**Entry gate:** S3 exit gate passes.

| # | Task | Finding |
|---|---|---|
| 1 | **Robust solvers.** Coarse grid to bracket a sign change, then bisect; return `{ ok, value, reason }`; never report failure as a value. | **F-27** |
| 2 | **Cache/debounce solvers.** 22 full simulations per recalculation is wasteful and will not survive a bigger model. | F-27 |
| 3 | **Resolve SROI** (Q1, Q2) — requires a human decision, then implement. | **F-08** |
| 4 | **Sensitivity analysis.** One-at-a-time tornado over the top 8 parameters. The `opsReserveCap` table in F-10 shows why: the master growth throttle was mislabelled as a liquidity buffer, and nobody noticed. | — |
| 5 | **Scenario save/load/compare** as JSON. Reproducibility for board papers. |  — |
| 6 | **Answer the open questions** Q3–Q9 in [MODEL_SPEC.md](MODEL_SPEC.md) §13, each as an ADR. (Q8, Q10, Q11 are needed earlier — see S1.) | — |

**Exit gate:** solvers return typed results and are tested against a known-non-monotonic scenario (`capital constrained`, which has 14 downward steps — see F-27). Sensitivity output is reproducible from the CLI.

---

## S5 — Structure

**Goal:** make the codebase one a new contributor can navigate. **Zero behaviour change** — the golden suite is the proof.

**Entry gate:** S3 exit gate passes. (S4 may run in parallel; they touch different files.)

Split `app.js` (3,667 lines) along the seams that already exist:

```
src/model/       engine.js  kpis.js  solvers.js  invariants.js   (pure — no DOM)
src/ui/          inputs.js  kpis.js  charts.js  tables.js  export.js  advisor.js
src/data/        worldbank.js  countries.js
src/app.js       controller / wiring
```

Rules for this stage:

1. **Move code; do not improve it.** Fixing a bug during a move makes the golden diff unreadable, which is the one thing that proves the move was safe.
2. **One directory per commit**, with `npm test` green after each.
3. `src/model/` must not reference `document`, `window` or `Chart`. Enforce it with a test (`tools/load-model.js` becomes unnecessary once this holds).
4. Keep the app dependency-free and buildless if possible — ES modules load natively in every target browser. **Do not add a bundler without an ADR.**

**Exit gate:** `npm test` green, `golden.json` **byte-identical**, no file over 500 lines, and `src/model/` loads in Node with no DOM stub.

---

## S6 — Presentation and reach

**Goal:** make the tool usable by the people it is for.

**Entry gate:** S5 exit gate passes.

| Task | Why |
|---|---|
| Print/PDF board-paper export | The current CSV is for analysts; funders need a document. |
| Offline-capable (service worker, vendored assets) | These are LDC field settings; F-22 shows the app currently shows blank charts offline. |
| Accessibility pass (contrast, labels, keyboard, screen reader) | Not assessed in this audit — assume it fails. |
| Mobile / small-screen layout | Not assessed. |
| Explicit "this is a model, not a forecast" framing with assumption provenance | Every parameter should show whether it came from the World Bank, a default, or the user. |
| Multi-currency / local currency display | Currently USD-labelled only. Needs an ADR (out of scope in R-1). |

---

## What is deliberately not on this roadmap

Recorded so they are not re-litigated. Adding any of these requires an ADR:

- **A rewrite in a framework.** The model works; the maths is the asset. A rewrite would discard the one thing that is sound and keep all the risk.
- **A build step / bundler.** Buildless is a feature for a tool that must run from a USB stick in a field office.
- **A backend.** No server means no hosting cost, no data protection surface, and no deployment story to maintain.
- **NPV/IRR and discounting.** See [ADR-0003](adr/0003-nominal-cashflows-no-discounting.md).
- **Monte Carlo / stochastic simulation.** Attractive, but meaningless until the deterministic model is correct (S3) and its sensitivities are understood (S4). Revisit after S4.

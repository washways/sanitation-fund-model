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

| Stage | Theme | Status | Risk | Depends on |
|---|---|---|---|---|
| **S0** | Scaffolding and safety net | ✅ Complete — 4 findings closed | Very low | — |
| **S1** | Silent-wrongness fixes | ✅ Complete — 9 findings closed | Low | S0 |
| **S2** | Give the user back control | ✅ Complete — 8 findings closed | Medium | S1 |
| **S3** | Model correctness | ✅ Complete — 12 findings closed | High | S2 |
| **S4** | Decision support | In progress — item 1 (F-27) done; items 2-4 not started | Medium | S3 |
| **S5** | Structure | Not started — enables everything after | Medium | S3 |
| **S6** | Presentation and reach | Not started | Low | S5 |

The ordering is deliberate and is not a priority ranking:

- **S0 before everything** because without a safety net every later change is a gamble. It changes no behaviour, so it cannot break anything.
- **S1 before S2** because S1 fixes numbers that are silently wrong. There is no point improving how the user controls a model that gives wrong answers.
- **S2 before S3** because while the controller rewrites the user's inputs (F-04, F-05), you cannot tell whether a change in output came from your edit or from the app editing itself. **S2 is what makes S3's results trustworthy.**
- **S3 before S4** because the advisor and the solvers give advice based on the model; fixing the advice before the model just produces confidently wrong guidance (this is exactly how F-32 happened).
- **S5 after S3** because restructuring code whose behaviour is still changing means doing the work twice. The golden tests from S0 make the restructure safe whenever it happens.

---

## S0–S3 — complete

Four stages, all closed: scaffolding and a safety net (S0), fixing outputs that were silently wrong (S1), stopping the app from rewriting the user's own inputs (S2), and correcting the financial and impact mathematics against the written spec (S3). Between them they closed 35 of the 36 findings in [docs/ANALYSIS.md](ANALYSIS.md) and every modelling question in [MODEL_SPEC.md §13](MODEL_SPEC.md).

**For what happened in each stage, read [CHANGELOG.md](../CHANGELOG.md) and the relevant [decision records](adr/).** Their detailed task-by-task history isn't repeated here — a stage that's done doesn't need to be picked up cold by anyone, which is the property this file exists to give the *upcoming* stages below.

The one thing worth restating because it shaped everything after it: **S2 had to land before S3 could be trusted.** While the controller could still rewrite the inputs it had just read, no A/B comparison through the browser meant anything — you couldn't tell whether a changed output came from your edit or from the app editing itself.

---

## S4 — Decision support

**Goal:** make the tool's advice trustworthy and its uncertainty visible.

**Entry gate:** S3 exit gate passes.

| # | Task | Finding |
|---|---|---|
| 1 | ✅ **Robust solvers.** Grid scan for the true extremum, then bisect the adjacent cell; return `{ ok, value, reason }`; never report failure as a value. Done 2026-08-25, [ADR-0032](adr/0032-grid-then-bisect-solvers.md). | **F-27** |
| 2 | **Cache/debounce solvers.** ADR-0032 roughly doubled simulation cost while fixing correctness (22 → up to 47 per recalc with the solver panel on). Still cheap in absolute terms at the shipped horizon, but caching across recalculations is not written. | F-27 |
| 3 | **Sensitivity analysis.** One-at-a-time tornado over the top 8 parameters — several past findings (the pacing-vs-volume confusion in what's now `grantExhaustedMonth`; the reserve that turned out to be a growth throttle) were only visible once someone swept a parameter and looked. | — |
| 4 | **Scenario save/load/compare** as JSON. Reproducibility for board papers. | — |

**Exit gate:** solvers return typed results and are tested against known-non-monotonic scenarios — done, see `tests/solver.test.js` and ADR-0032's measured sweep. Sensitivity output is reproducible from the CLI (items 2-4 still open).

---

## S5 — Structure

**Goal:** make the codebase one a new contributor can navigate. **Zero behaviour change** — the golden suite is the proof.

**Entry gate:** S3 exit gate passes. (S4 may run in parallel; they touch different files.)

Split `app.js` (~3,900 lines) along the seams that already exist:

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
| Offline-capable (service worker) | These are LDC field settings. Chart.js is already vendored for this reason (see `vendor/`) — extend the same principle to every other asset. |
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

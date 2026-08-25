# ADR-0033: S5 structural split — app.js becomes src/

- **Status:** Accepted
- **Date:** 2026-08-25
- **Stage:** S5
- **Findings:** F-19 (the "everything in one file" half — see docs/ARCHITECTURE.md's "Design decisions still to reverse")
- **Spec rules touched:** none — this changes file layout, not behaviour

## Context

`app.js` was 4,028 lines: four concerns (a World Bank API client, the pure calculation engine, a Chart.js/DOM-heavy UI layer, and an app controller) with no boundary between them, no way to load the model without a DOM stub, and no way to see the model's own size separately from the UI wrapped around it. `docs/ARCHITECTURE.md`'s S5 section specified a target shape (`src/model/`, `src/ui/`, `src/data/`, `src/app.js`) and four rules: move code, don't improve it; no `document`/`window`/`Chart` in `src/model/`; no file over 500 lines; one directory per commit with `npm test` green after each.

This ADR records what was actually built, and three deliberate deviations from what `ARCHITECTURE.md` originally specified — each made for a stated safety reason, not by oversight.

## Decision

### 1. Classic scripts, not ES modules

`ARCHITECTURE.md` and `ROADMAP.md` both said "ES modules load natively in every target browser — no bundler needed," implying literal `import`/`export` syntax. This was **not** what got built.

Instead, every `src/` file is a classic (non-module) script, exactly like the original single `app.js` — the first file for each shared object declares it (`const ModelModule = {...}`), and later files extend it (`Object.assign(ModelModule, {...})`). Classic scripts share one global Script Environment Record in a browser, so `<script src="src/model/engine.js"></script>` followed by `<script src="src/model/kpis.js"></script>` behaves identically to today's single `<script src="app.js">` — just spread across files. `index.html`'s 14 `<script>` tags must stay in the order `tools/app-source.js` declares.

**Why not real ES modules:** every existing test harness (`tools/load-model.js`, and the vm-bootstrap in `tests/{export,smoke,startup}.test.js`) loads the app synchronously via `vm.runInContext` on a concatenated source string. Real ES modules would require either Node's `--experimental-vm-modules` flag and `vm.SourceTextModule`, or rewriting every test to `await import(...)` — both far bigger changes than "move code," and both risk introducing the exact kind of subtle behavioural drift the golden suite exists to catch. Classic scripts need none of that: the same `vm.runInContext` pattern that already worked for one file works unchanged for fourteen, once concatenated. `tools/app-source.js` is the one place the file list and load order live; everything else — `index.html`, `tools/load-model.js`, every test — reads from it or must be kept in sync with it by hand (`index.html` is HTML; nothing can mechanically check it against the JS list).

### 2. Two files exceed 500 lines, on purpose

| File | Lines | Why |
|---|---|---|
| `src/model/engine.js` | 790 | Contains `calculate()`, a single ~715-line function (the month loop). Splitting a function's *body* across files is not "moving code" — it's restructuring control flow and shared local state (`hhCohorts`, `meCohorts`, the `outflows`/`inflows` accumulators) across a file boundary, which is real refactoring risk in the one function this entire audit is about getting right. `ARCHITECTURE.md`'s original sketch proposed decomposing this further into `portfolio.js` (cohorts, write-downs) and `investor.js` (debt schedule) — those concerns are genuinely inline in `calculate()`, not already-separate functions, so pulling them out is future work with its own ADR and its own prediction, not bundled into a zero-risk file move. |
| `src/app.js` | 637 | Contains the `DOMContentLoaded` handler, one large arrow function wiring up every form control. Same reasoning: one function, not sub-splittable without restructuring. |

Every other file is under 500 lines, most well under. `tests/purity.test.js` and the exit-gate checks below don't gate on line count — the four `ARCHITECTURE.md` rules are a target, and rule 1 (no DOM in `src/model/`) is the one actually enforced by a test, because it's the one a future contributor could silently violate without noticing.

### 3. `tools/load-model.js` is kept, not deleted

`ARCHITECTURE.md` said: "once [rule 1] holds, `tools/load-model.js` becomes unnecessary and should be deleted." Rule 1 does hold — `tests/purity.test.js` proves `src/model/*.js` loads and runs a full calculation with **zero** stub globals, not even a minimal one. But deleting `tools/load-model.js` would mean switching every test that does `require('../tools/load-model')` (`invariants.test.js`, `writedown.test.js`, `solver.test.js`, and others) to instead `vm.runInContext` the model files directly — which is what `load-model.js` *is*. The aspiration was "the model no longer needs a DOM stub to load," which is now true and tested; it was not "delete the loader," which conflated the DOM-stub requirement with the loader's existence. `load-model.js`'s docstring is updated to explain this.

## What actually shipped

```
src/
  data/    worldbank.js (ApiModule)  countries.js (LDC_COUNTRIES)  stakeholders.js
  model/   engine.js  kpis.js  solvers.js  invariants.js       — pure, no DOM
  ui/      inputs.js  kpis.js  charts.js  tables.js  export.js  advisor.js
  app.js                                                          — controller only
```

14 files, 4,123 lines total (up from 4,028 — the difference is per-file header comments and `Object.assign` wrapper lines, not new logic). `tools/app-source.js` is the single source of truth for the list and load order; `index.html`'s `<script>` tags, `tools/load-model.js`, and the vm-bootstrap in `tests/export.test.js` / `tests/smoke.test.js` / `tests/startup.test.js` / `tests/wiring.test.js` / `tools/verify-findings.js` all read from it (the first two structurally, the rest via its `concatenated()` helper, since HTML can't `require()` anything).

`eslint.config.js` now targets `src/**/*.js` instead of `app.js`, with `ModelModule`, `UI`, `ApiModule`, `LDC_COUNTRIES`, `stakeholdersData`, `chartInstances` and `runCalculation` declared as cross-file globals — exactly what the config's own comment anticipated when ESLint was first added (F-19). The split surfaced 3 new `no-unused-vars` findings that are a structural artifact of per-file static analysis (a value declared in one file and used only from another, which `no-unused-vars` can't see across files) — `ApiModule` and `LDC_COUNTRIES` are two of them, suppressed with an explanation at each declaration; `stakeholdersData` was already genuinely dead code (F-19 baseline) and stayed dead, moved verbatim. The other 14 `no-unused-vars` violations are the original F-19 baseline, now scattered across the files their variables landed in, each with a per-file suppression comment carrying the same count and the same "do not add a new one" instruction the original single comment gave.

## Prediction, then measurement

**Predicted:** a pure mechanical move changes no behaviour. `golden.json` should be byte-identical; every existing test should pass unmodified in intent (only their *source-loading* lines change, from reading one file to reading a concatenated list); `src/model/` should load and calculate correctly with zero DOM stub.

**Measured:**

- `npm test`: 75 → 77 (added `tests/purity.test.js`, 2 tests). All passing, including every test that existed before the split.
- `npm run golden:diff`: **"No behaviour change."** — byte-identical, all 21 scenarios.
- `npm run verify`: 20 of 20 fixes still hold — confirms F-27/F-37 (landed immediately before this split) survived intact.
- `npm run lint`: clean, 0 errors, 0 warnings.
- Manually confirmed `src/model/{engine,kpis,solvers,invariants}.js`, concatenated and run in a `vm` context with **no sandbox globals except `console` and `structuredClone`** (no `document`, `window`, `Chart`, `fetch`, `alert`), produces the exact same baseline result as before the split (97,744 toilets, $914,174 net assets) — this is now `tests/purity.test.js`'s second assertion, not just a one-off check.
- Manually confirmed every `src/*.js` file, plus `index.html`, serves correctly from `server.js`, and the deleted `app.js` correctly 404s.

## Consequences

- A new contributor can read `src/model/engine.js` (790 lines) to understand the simulation without also reading 1,800 lines of Chart.js rendering — the original problem this stage exists to fix.
- `src/model/` is now literally, testably free of DOM dependencies, not just believed to be.
- Two files still exceed the 500-line target, both single functions, both documented above with a stated reason and a named follow-up.
- `tools/app-source.js` is now a manual synchronization point between `index.html` and the JS file list — nothing can check them against each other automatically since one is markup and the other is code. A future contributor renaming or reordering a `src/` file must update both, or the split silently breaks in the browser while every Node test (which reads only `tools/app-source.js`) stays green. Worth a comment wherever this bites; not worth a build step to solve (`ARCHITECTURE.md`'s "no bundler without an ADR" stands).
- Decomposing `calculate()` itself (`engine.js` → `engine.js` + `portfolio.js` + `investor.js`, per `ARCHITECTURE.md`'s original sketch) remains open, deliberately deferred — it is real refactoring of the model's control flow, not a code move, and deserves its own ADR with its own predicted-then-measured golden comparison, done with the same care as ADR-0031 or ADR-0032.

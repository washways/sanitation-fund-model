# AGENTS.md — working contract for AI agents

**Read this file completely before your first tool call. It is short on purpose.**

This is a **financial model used to make investment and policy decisions about sanitation funding in low-income countries**. Numbers produced here end up in board papers and funding proposals. A plausible-looking wrong number is worse than an obvious crash, because nobody catches it. That single fact drives every rule below.

---

## 0. Orientation — do this first, every session

```bash
cat STATUS.md                 # where the work is right now
npm test                      # must be green before you touch anything
```

68 tests, about a second. `npm ci` first if `node_modules/` doesn't exist yet — ESLint
is the one devDependency. If you change anything a user touches — a default, a form
control, the country fetch — the suite that matters most is `tests/startup.test.js`,
because it is the only one that exercises the state the browser actually ends up in.

If `npm test` is **not** green when you arrive, **stop and report it**. Do not start your task on top of a broken tree; you will not be able to tell your breakage from the one you inherited.

Node lives at `C:\Users\jrobertson\Repositories\node-v25.8.1-win-x64` on the maintainer's machine and is not on `PATH` by default:

```bash
export PATH="/c/Users/jrobertson/Repositories/node-v25.8.1-win-x64:$PATH"
```

---

## 1. The five rules

### Rule 1 — The specification outranks the code

[docs/MODEL_SPEC.md](docs/MODEL_SPEC.md) is the source of truth for the maths, not `app.js`. If they disagree, the code is wrong — **unless** the spec rule is tagged `[AS-BUILT]`, in which case the code is right and the spec describes it.

Rules are tagged:

- `[AS-BUILT]` — the code does this. Changing it needs an ADR.
- `[TARGET]` — the code does not do this yet. Implementing it is a stage task.
- `[OPEN]` — **not decided.** Do not implement. Do not guess. Ask.

**Never resolve an `[OPEN]` question by writing code.** They are open because they need a human's judgement about what the model should claim, and a wrong answer is invisible in the output.

### Rule 2 — Behaviour changes only when you meant them to

`tests/golden.json` records what the model produces today across 21 scenarios. A golden test failure means behaviour moved.

- **Did not mean to move it?** You broke something. Fix the code.
- **Meant to move it?** Your ADR must **already** predict the direction and rough size. Compare, then re-record:

  ```bash
  npm run golden:diff      # show the move, write nothing
  npm run golden:record    # write it
  ```

  Commit the regenerated `golden.json` **in the same commit** as the change, citing the ADR.

**Re-recording a golden file to turn a red build green, without an ADR, is the single most damaging thing you can do in this repository.** It converts a caught regression into a silent one. The suite exists because eight of this project's fifteen commits are "Fix TypeError" hotfixes found by users.

### Rule 2b — Test the state that runs, not the state that ships

`index.html` defines the defaults. The app then **auto-fetches country data 500 ms after
load and overwrites most of the form.** The shipped defaults exist for about half a
second and are not what any user sees.

This has already caused a Critical finding. A viable demonstration scenario was tuned,
verified across the whole suite, committed — and a user opened the app and got an
insolvent fund, because the fetch was setting the cost of capital to Malawi's 37.1%
commercial lending rate (F-34).

So: **`tools/baseline-inputs.js` and the golden scenarios describe `index.html`.
`tests/startup.test.js` describes reality.** Both matter, and they are not the same
thing. If your change touches a default, `fillParam`, or the fetch handler, the startup
test is the one that tells you what a user will see.

The general rule that fell out of it, worth keeping: **the fetch fills observed data,
never negotiated terms or policy choices.** A market lending rate is not a term sheet; a
poverty headcount is not a subsidy policy. Evidence informs the user; it does not move
the dials.

### Rule 3 — One stage at a time

[docs/ROADMAP.md](docs/ROADMAP.md) defines stages S0–S6, each with an entry gate and an exit gate.

- Do not start a stage whose **entry gate** is not met.
- Do not touch files outside your stage's scope.
- Found something else broken? **Add it to the register in [docs/ANALYSIS.md](docs/ANALYSIS.md) and carry on.** Do not fix it. An unrelated fix inside a stage's diff is how a reviewer loses the ability to review.

### Rule 4 — Report what happened, not what you hoped

- Tests failed? Say so, and paste the output.
- Did part of the task and not the rest? Say which part, and why.
- Not sure a change is correct? Say that too, and say what would settle it.

An overstated "done" costs more than an honest "blocked", because someone builds on it.

### Rule 5 — Never invent a number

Every constant in this model is either a user input, a World Bank indicator, or a documented assumption in [docs/PARAMETERS.md](docs/PARAMETERS.md). If you need a value that is none of those, **stop and ask.**

This is not hypothetical. The codebase currently values an hour of a person's time at exactly `$0.50`, with a source-code comment asking where the number came from. Nobody knows. It is in the SROI that goes to funders.

---

## 2. Definition of done

A stage task is done when **all** of these hold. Not four of five.

- [ ] `npm test` — 0 failures. (`todo` entries are fine if they were already `todo`, or if your task un-todos one.)
- [ ] `npm run golden:diff` — either "No behaviour change", or a diff that matches your ADR's prediction and has been re-recorded.
- [ ] The `[TARGET]` tag in `MODEL_SPEC.md` flipped to `[AS-BUILT]` for anything you implemented.
- [ ] The finding in `ANALYSIS.md` marked resolved, with the commit hash. **Do not delete the row.**
- [ ] `STATUS.md` updated: what you did, what you did not, what the next agent should know.
- [ ] `CHANGELOG.md` updated **in the same commit**, if the change alters what the model produces or what a user sees.
- [ ] If you touched a default, a form control, or the fetch: `tests/startup.test.js` still passes, and you have read what it reports.
- [ ] A test exists that would fail if your change were reverted.

That last one is the real gate. A fix with no test is a fix that will be undone by the next refactor.

---

## 3. Where things are

| File | What it is |
|---|---|
| `app.js` | The whole application — model, KPIs, solvers, UI, controller. One file, ~3,900 lines and shifting as fixes land — don't trust a cited line number, re-grep. Split is stage S5, not yet started. |
| `index.html` | The form and the dashboard. Input `id`s here must match `UI.getInputs()` — a test enforces it. |
| `methodology.html` | User-facing explainer. Keep in sync with `MODEL_SPEC.md`. |
| `STATUS.md` | **Read first, write last.** Current stage, what's actually unresolved, known gotchas — a snapshot, not a history. |
| `CHANGELOG.md` | Dated, versioned record of every behaviour change. One entry per working session, in the same commit as the change. |
| `docs/ANALYSIS.md` | The original audit register — findings with evidence. Historical; stable IDs, never renumbered, never deleted. For current behaviour, use `MODEL_SPEC.md` instead. |
| `docs/MODEL_SPEC.md` | The maths. Normative — the current, authoritative description of what the model does. |
| `docs/ROADMAP.md` | Remaining stages with entry/exit gates. |
| `docs/PARAMETERS.md` | Every input: unit, range, source, meaning. |
| `docs/TESTING.md` | How the suite is built and how to add to it. |
| `docs/ARCHITECTURE.md` | Current code shape and the target shape. |
| `docs/adr/` | Decision records. One per behaviour change or modelling decision — the *why* behind a changelog entry. Never edit an old one; write a new one that supersedes it. |
| `tests/` | The safety net — 7 suites. |
| `tools/load-model.js` | Loads the model headlessly. Keep the DOM stub minimal — if it has to *do* something, the model grew a hidden DOM dependency and that is the bug. |
| `tests/fixtures/` | Recorded World Bank and administrative-unit responses. **Never fetch live in a test.** Re-record deliberately and treat the resulting move like a golden diff. |

---

## 4. Lessons already paid for

Every one of these was a real defect, found and fixed, with a test now guarding it. They're listed as **principles to not re-break**, not as current bugs — check `docs/ANALYSIS.md` if you want the original evidence for any of them.

| Principle | Why it matters |
|---|---|
| **Test `Number.isFinite` before anything else** | `Math.abs(NaN - NaN) > 1` is `false`, so a naive cash-identity check reports success on a fully corrupted ledger. `NaN` must be caught first, or it silently defeats every check after it. |
| **A missing DOM id must fail loudly, not silently** | `getRaw` returns its default when `getElementById` returns null — a renamed or deleted input becomes a hardcoded constant with no error. `tests/wiring.test.js` catches this; keep it passing when you touch `index.html` or `getInputs()`. |
| **One unit convention, enforced at the boundary** | Every rate field is a percentage, converted to a decimal exactly once, in `getInputs`. Never infer a field's unit by inspecting its value — two heuristics doing that once disagreed with each other by a factor of 100 on the same field. |
| **Nothing writes back into the user's inputs** | The controller reads inputs, computes, renders. Suggestions are offered with an explicit control to apply them, never applied automatically. If you're comparing two scenarios through the browser, confirm nothing changed under you — or better, compare through `ModelModule.calculate()` directly, which is pure. |
| **A dead fund must stop costing money** | Ending cash must depend on fund performance, not on how long you happened to simulate. Never compare runs of different `duration` without checking `windUpMonth` first — a fund that's already wound up should report identically regardless of horizon (INV-14 checks this). |
| **Two different verdicts, never merged** | "The arithmetic is internally consistent" (integrity) and "the fund actually works" (viability) are different claims. Never let a screen imply the first proves the second. |
| **The defaults in `index.html` are not what a user sees** | The app auto-fetches country data ~500ms after load and overwrites most of the form. `tools/baseline-inputs.js` mirrors the *static* defaults; `tests/startup.test.js` covers what a user actually gets. If you touch a default, a form control, or the fetch handler, run the startup test — the static defaults passing every other test proved nothing, once. |
| **The fetch fills observed data, never negotiated terms or policy choices** | A market lending rate is not a term sheet; a poverty headcount is not a subsidy policy. Evidence informs the user; it does not move the dials. |
| **DOM stubs must stay faithful to a real browser** | `tests/smoke.test.js` and `tests/startup.test.js` build element stubs by parsing `index.html` — real tag names, `value` coerced to a string, because the app branches on both. A stub that quietly differs from a browser produces green tests for code the browser never runs. If a stub needs to *do* something rather than merely exist, ask why the app needs it — don't just make the stub smarter. |
| **Duplicate object keys are silent** | JavaScript keeps the last, discards the first, with no warning. `no-dupe-keys` (ESLint) catches this now — one such duplicate was hiding a completely broken feature behind a working-looking one. |

---

## 5. How to make a change

```bash
export PATH="/c/Users/jrobertson/Repositories/node-v25.8.1-win-x64:$PATH"
cat STATUS.md
npm test                              # baseline: green?
git checkout -b s1-cost-of-capital    # one branch per task

# Write the test FIRST. Watch it fail for the right reason.
npm test

# Then make it pass. Smallest change that does so.
npm test
npm run golden:diff                   # expected? matches the ADR?
npm run golden:record                 # only if yes

# Update: MODEL_SPEC tag, ANALYSIS row, STATUS.md, ADR.
git commit
```

**Write the test first.** In a model, a test written after the fix tends to encode whatever the code now does — including the parts still wrong. A test written first encodes what you intended.

---

## 6. Commit and ADR conventions

Commit subject: `S<stage>: <what changed> (<finding>)`

```
S1: add fundCostOfCapital input, wire to World Bank lending rate (F-01)

The model read inputs.fundCostOfCapital but index.html had no such
control, so getRaw() returned its default of 0. Investor interest has
been $0 in every run the tool has ever produced.

Golden: net assets fall across all 18 scenarios (baseline -$786,332 ->
-$1,348,902 at the 8% default). Predicted in ADR-0004; direction and
magnitude match. golden.json re-recorded in this commit.

Refs: docs/adr/0004-cost-of-capital-input.md
```

Write an ADR ([template](docs/adr/0000-template.md)) whenever you:

- change a behaviour a user could observe,
- resolve an `[OPEN]` question,
- add or remove a parameter,
- choose between two defensible modelling conventions.

The ADR is written **before** the code, because its job is to record the prediction you are about to test.

---

## 7. When to stop and ask

Stop. Do not guess. Ask, and say what you would do if forced to choose.

- An `[OPEN]` question in `MODEL_SPEC.md` blocks your task.
- You need a constant that is not an input, a World Bank indicator, or a documented assumption.
- A golden value moves in a direction your ADR did not predict, or by an order of magnitude more than expected.
- Your task appears to require changing a rule tagged `[AS-BUILT]`.
- `npm test` was already failing when you arrived.
- A change makes the startup scenario non-viable and you cannot see why.
- The fix seems to need a rewrite. It almost certainly does not — see "What is deliberately not on this roadmap" in [ROADMAP.md](docs/ROADMAP.md).

The maintainer would far rather answer a question than review a diff built on a guess.

---

## 8. Things not to do

- **Do not run the solvers to "check" a change.** They run 22 full simulations and mutate nothing useful. Use `node tools/verify-findings.js`.
- **Do not add a dependency.** The app is deliberately buildless and dependency-free. Adding one needs an ADR. (ESLint is the one exception, a devDependency that never ships to the browser — [ADR-0020](docs/adr/0020-eslint-is-a-devdependency.md). It does not reopen the door to anything that runs in `index.html`.)
- **Do not "clean up while you're in there".** Unrelated changes in a stage diff destroy reviewability. Register it and move on.
- **Do not fix a bug during stage S5.** S5 moves code and proves it by a byte-identical `golden.json`. A fix makes that proof impossible.
- **Do not delete a row from the findings register.** Mark it resolved with a commit hash. The history is the point.
- **Do not trust the console.** Real problems used to be reported via `console.warn`, where nobody sees them. If something matters, it goes on screen.
- **Do not weaken a DOM stub to make a test pass.** The stub exists to imitate a browser. If it disagrees with one, fix the stub toward reality, never away from it.
- **Do not let the fetch set a policy parameter.** See Rule 2b.

# Testing

```bash
export PATH="/c/Users/jrobertson/Repositories/node-v25.8.1-win-x64:$PATH"   # Node is not on PATH
npm test              # 43 tests, ~0.9s, zero dependencies
npm run test:watch    # re-run on change
npm run golden:diff   # what would move, without writing
npm run verify        # reproduce the audit findings
```

No test framework, no bundler, no `node_modules`. The suite uses Node's built-in `node:test` and `node:assert`.

---

## Why four kinds of test

This codebase's git history contains eight "Fix TypeError" commits — each a defect found by a user in a browser. The suite is shaped around the four ways this particular model goes wrong.

| Suite | Catches | Question it answers |
|---|---|---|
| `wiring.test.js` | A parameter the model reads that the user cannot set | *Does the model receive what the user typed?* |
| `invariants.test.js` | An internally inconsistent ledger | *Is the arithmetic self-consistent?* |
| `golden.test.js` | An unintended change in any output | *Did I move something I did not mean to move?* |
| `smoke.test.js` | A crash or a write-back in the render path | *Does the whole app actually run?* |

None of the four subsumes the others. F-01 (cost of capital always zero) passed every invariant and every golden test — the model was perfectly self-consistent and perfectly stable at the wrong answer. Only a wiring test finds it. Equally, eight of this project's first fifteen commits were `TypeError` crashes in the render path, where the model was fine and the UI reading it was not; only a smoke test finds those.

---

## `wiring.test.js` — does the input reach the model?

The failure mode: `getRaw()` returns its default when `document.getElementById()` returns `null`. A renamed or deleted input silently becomes a hardcoded constant. Nothing throws, nothing warns, the model runs, the answer is wrong.

Four checks:

1. Every id read by `UI.getInputs()` exists in `index.html`.
2. Every id touched anywhere in `app.js` exists in `index.html`.
3. No parameter is collected from the user and then never read by `ModelModule`.
4. `tools/baseline-inputs.js` still mirrors the `value=""` attributes in `index.html`.

Check 4 matters more than it looks: if the golden scenarios drift from the shipped defaults, the whole golden suite is measuring a scenario no user will ever see.

### The `KNOWN_MISSING` pattern

Checks 1–3 carry an allow-list of the defects that exist today. It cuts both ways: the test fails if a **new** id goes missing, *and* it fails if a listed one is **fixed** without being removed from the list. The allow-list therefore cannot rot into a list of things nobody remembers.

`KNOWN_MISSING` for check 1 is now **empty** — F-01 and F-15 closed it — and must stay that way. Check 3's `KNOWN_UNUSED` is down to `avgAnnualIncome` (F-25) plus two names that are legitimately not model parameters.

**Remove an entry in the same commit that fixes it. Never add one to make a build green** — that is the exact failure mode this test exists to prevent.

---

## `invariants.test.js` — is the ledger self-consistent?

INV-1 to INV-14, defined normatively in [MODEL_SPEC.md §12](MODEL_SPEC.md). Each runs across a **16-scenario matrix** — no capital, no debt, zero inflation, 45% inflation, zero defaults, 40% defaults, 1-year and 20-year horizons, capital-tight, demand-exhausted, carbon on, and so on — and collects every failure before reporting, so one run tells you whether a break is universal or confined to one corner.

That distinction is the whole value of the matrix. "INV-1 fails" is a puzzle; "INV-1 fails only when `investLoan` is 0" is a diagnosis.

### `todo` is the work queue

> As of 2026-08-20 there are **no `todo` entries left** — INV-8, INV-13 and INV-14 were closed by the Stage 1–3 fixes. The mechanism below is documented because it is how the next batch of work should be staged, not because anything is currently outstanding.


Invariants the model does not yet satisfy are marked like this (the example is INV-8 as it stood before the Stage 1 fix):

```js
test('INV-8: no output is NaN or Infinity (F-03)',
  { todo: 'F-03 — a 0% interest rate corrupts the whole ledger' }, () => { ... });
```

Node reports `todo` separately from `fail`. So the suite is **green today** — it turns red only when something that *was* passing breaks — while the todo list stays visible as the outstanding work.

**When a stage fixes the finding, delete the `{ todo: true }` marker.** The test must then pass. That is the stage's exit gate, and it is executable rather than asserted.

Never mark a passing invariant as todo to make a build green. That is the same act as re-recording a golden file to hide a regression, and it is just as damaging.

### Adding an invariant

1. Write it in [MODEL_SPEC.md §12](MODEL_SPEC.md) with an INV number and a `[TARGET]` or `[AS-BUILT]` tag.
2. Add the test, naming the INV id in the test name.
3. If the model does not satisfy it yet, mark it `todo` with the finding id and add the finding to [ANALYSIS.md](ANALYSIS.md).

---

## `golden.test.js` — did anything move?

18 characterisation scenarios (`tests/golden.scenarios.js`), each recorded as a ~40-field fingerprint in `tests/golden.json`: reach, every flow total, end state, ratios, impact.

**These tests assert nothing about correctness.** They lock in what the model does today, bugs included. That is the point: they make it possible to restructure 3,667 lines of untested code and *prove* nothing moved.

### The suite is verified to work

A golden suite that cannot detect change is worse than none, because it manufactures confidence. This one was checked by injecting a 1% perturbation into the ops-cost line:

```
17 of 18 scenarios failed; 258 recorded values moved
  baseline :: toilets: 211317 -> 210980  (-0.16%)
  baseline :: totalLoansHh: 21296422.11 -> 21259392.10  (-0.17%)
```

A 1% change in one line of the model is caught in 258 places. Re-verify this whenever the summary shape changes.

It has since done real work: the Stage 1–3 fixes moved 148 recorded values, and each move was checked against the prediction in its ADR before being re-recorded.

### When a golden test fails

**Decide which case you are in. Never do step 2 before step 1.**

1. **Unintended.** You broke something. Fix the code, not the file.
2. **Intended.** Your ADR must **already** predict the direction and rough magnitude. Compare the diff against that prediction:

   ```bash
   npm run golden:diff
   ```

   If it matches, re-record and commit `golden.json` **in the same commit** as the change, citing the ADR:

   ```bash
   npm run golden:record
   ```

If the move does not match your prediction, **that is a finding, not a formality.** Either your mental model of the change is wrong or the code is. Stop and work out which.

> Re-recording a golden file to turn a red build green, without an ADR, converts a caught regression into a permanent silent one. It is the most damaging single action available in this repository.

### Choosing a scenario

Add scenarios that exercise a distinct **path**, not merely a different number. A scenario producing the same code path as an existing one adds runtime and catches nothing. The current set covers: each capital structure alone, both inflation extremes, both credit extremes, all three binding constraints (capital / demand / capacity), both horizon ends, the carbon path, and the grant-support extremes.

---

## `smoke.test.js` — does the whole app actually run?

The model suites cannot catch a crash in the render path, because in those crashes the model was fine and the UI reading it was not. That is what eight of this project's first fifteen commits were.

This suite builds a DOM stub from the **actual ids and default values parsed out of `index.html`**, loads `app.js` into it, and drives the real `runCalculation`. It asserts nothing about what appears on screen — it is not a rendering test — but it proves that clicking Recalculate on a fresh page does not throw.

Two of its tests earn their place beyond crash-catching:

- **`the controller does not write back into the user's inputs`** captures the value of every headline input, runs `runCalculation(true)`, and fails if any of them moved. This is the executable form of [ADR-0009](adr/0009-advisory-not-automatic.md), and the whole point of Stage 2.
- **`solvency advice is model-tested`** asserts that every offered remedy actually improves repayment when simulated, and that extending the repayment term is never offered — because measurement shows it makes repayment worse (F-32).

If a future change needs the DOM stub to *do* something rather than merely exist, that is a signal the model has grown a hidden UI dependency.

---

## The headless harness

`tools/load-model.js` evaluates `app.js` in a Node VM with the smallest DOM stub that lets it finish loading, then exports `ModelModule`.

**If a stub ever has to *do* something rather than merely exist, that is the bug** — the model has grown a hidden DOM dependency and it belongs in `src/model/` with no such dependency. After stage S5, this harness should become unnecessary.

The stub's `fetch` rejects. Tests must never touch the network: the World Bank API would make the suite slow, flaky, and dependent on an external service's uptime.

---

## What is not tested yet

Named honestly so nobody assumes coverage that does not exist.

| Gap | Why it matters | Stage |
|---|---|---|
| **The UI layer** | Charts, CSV export and the report builder are still uncovered. `smoke.test.js` proves they do not throw; nothing asserts what they produce. | S2 |
| **A real browser** | Everything is verified against a DOM stub. Nobody has opened the page since the fixes landed. | now |
| **`ApiModule`** | World Bank fetching, the LDC list, the auto-fill heuristics. Needs a fixture-based test with recorded responses. | S4 |
| **Charts** | No rendering assertions. F-22 (unpinned CDN) means charts can vanish offline with no error. | S6 |
| **Accessibility** | Not assessed at all. Assume it fails. | S6 |
| **`server.js`** | Untested, and has a path traversal (F-18). | S0 |

---

## Conventions

- **Money is never compared with `===`.** Tolerance is $1.00 (`R-2.6`), relative `1e-9` for goldens.
- **`Number.isFinite` is checked first.** `NaN` passes every other comparison — `Math.abs(NaN - NaN) > 1` is `false` — so a `NaN` check placed second catches nothing.
- **Tests name their rule or invariant** (`INV-1`, `R-3.2`, `F-01`) so a failure points straight at the spec.
- **No network, no filesystem writes, no randomness.** The suite must be deterministic; INV-12 asserts the model itself is.
- **Failures report all cases, not the first.** One run should tell you the shape of the problem.

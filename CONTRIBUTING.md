# Contributing

**[AGENTS.md](AGENTS.md) is the working contract, and it applies to humans too.** Read it first. This file covers the mechanics.

---

## Setup

No install. Node is needed only for tests and tooling.

```bash
export PATH="/c/Users/jrobertson/Repositories/node-v25.8.1-win-x64:$PATH"   # not on PATH by default
node --version      # v25.8.1 — anything >= 20 works
npm test            # 68 pass, 0 todo, 0 fail
```

To run the app: `python -m http.server 8080`, or `npm run serve`.

---

## The loop

```bash
cat STATUS.md                  # where the work is
npm test                       # green before you start? if not, stop and report

git checkout -b s1-<task>      # one branch per roadmap task

# 1. Write the ADR. Predict what will move, before you know.
# 2. Write the test. Watch it fail for the right reason.
npm test
# 3. Make it pass. Smallest change that does.
npm test
# 4. Check what moved.
npm run golden:diff
npm run golden:record          # only if the move matches the prediction

# 5. Update: MODEL_SPEC tag, ANALYSIS row, STATUS.md
git commit
```

### Why the test comes first

In a financial model, a test written after the fix tends to encode whatever the code now does — including the parts still wrong. A test written first encodes what you intended. The difference is invisible in the diff and decisive in six months.

### Why the ADR comes first

Its **Prediction** section is the review criterion for the golden diff. Written afterwards it is a rationalisation; written beforehand it is a hypothesis, and a golden move that contradicts it is information.

---

## Definition of done

All six. Not five.

- [ ] `npm test` — 0 failures.
- [ ] `npm run golden:diff` — "No behaviour change", or a diff matching the ADR's prediction, re-recorded.
- [ ] `[TARGET]` flipped to `[AS-BUILT]` in `MODEL_SPEC.md` for anything implemented.
- [ ] Finding marked resolved in `ANALYSIS.md` with the commit hash. **Row not deleted.**
- [ ] `STATUS.md` updated.
- [ ] `CHANGELOG.md` updated in the same commit, if behaviour or the user experience changed.
- [ ] If a default, a form control or the fetch changed: `tests/startup.test.js` passes.
- [ ] A test exists that would fail if the change were reverted.

---

## Commits

`S<stage>: <what changed> (<finding>)`

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

One logical change per commit. `golden.json` is committed **with** the change that moved it, never separately, and so is the `CHANGELOG.md` entry.

### What a commit message owes the reader

The subject line says what changed. The body says **why it was wrong**, in terms someone can verify a year from now. This repository's earlier history is eight commits reading "Fix TypeError: …", which record that something broke without recording what was actually wrong — and several of those defects came back.

Concretely: cite the finding id, state the measured before-and-after, and name the ADR if behaviour moved.

---

## Code style

Match the file you are in. Beyond that:

| | |
|---|---|
| **Money is never compared with `===`** | Tolerance $1.00 (R-2.6); `1e-9` relative for goldens. |
| **`Number.isFinite` is checked first** | `NaN` passes every other comparison — `Math.abs(NaN - NaN) > 1` is `false`. A `NaN` check placed second catches nothing. This is [F-03](docs/ANALYSIS.md#f-03--a-zero-interest-rate-produces-nan-across-the-entire-ledger). |
| **No magnitude-guessing** | Never inspect a value to infer its unit. That is [F-17](docs/ANALYSIS.md#f-17--two-opposing-percent-heuristics-hyperinflation-becomes-2). Units are declared in [PARAMETERS.md](docs/PARAMETERS.md) and converted once, at the boundary. |
| **The model core stays pure** | No `document`, no `window`, no `Chart`, no `fetch` inside `ModelModule`. INV-12 enforces determinism and non-mutation. |
| **Renderers do not mutate results** | [F-14](docs/ANALYSIS.md#f-14--the-kpi-object-is-destructively-mutated-by-the-renderer). Format at the render boundary; never write back into the model's output. |
| **The console is not a reporting channel** | If a user needs to know it, it goes on screen. [F-29](docs/ANALYSIS.md#f-29--the-integrity-check-passes-a-run-that-went-insolvent-and-defaulted) is what happens otherwise. |
| **No new constants** | Every number is an input, a World Bank indicator, or a documented assumption in [PARAMETERS.md](docs/PARAMETERS.md). If it is none of those, stop and ask. |
| **One definition per concept** | Two incompatible "hours saved" formulas once coexisted, disagreeing by 4.39x, and two investor-interest calculations once disagreed about whether grace-period interest accrued. Both were consolidated to one each — don't reintroduce a second definition of anything. |

---

## Reporting a defect

Add it to the register in [docs/ANALYSIS.md](docs/ANALYSIS.md):

1. Next free `F-nn`. **Never reuse or renumber an id.**
2. Severity per the key at the top of that file.
3. **Evidence.** A line citation is acceptable; a reproduction is better. To reproduce:

   ```js
   const { ModelModule } = require('./tools/load-model');
   const BASE = require('./tools/baseline-inputs');
   const result = ModelModule.calculate({ ...BASE, /* your override */ });
   ```

4. A stage from the [roadmap](docs/ROADMAP.md).
5. If it violates an invariant, add the test — marked `{ todo: true }` with the finding id.

Found it while working on something else? **Register it and carry on.** Do not fix it in the same diff — an unrelated fix inside a stage's changes is how a reviewer loses the ability to review.

---

## Review checklist

For the reviewer:

- [ ] Is this within the stage's scope? Anything unrelated in the diff?
- [ ] Is there a test that fails without the change?
- [ ] If `golden.json` moved: is there an ADR, and does the actual move match its prediction?
- [ ] If `golden.json` moved **without** an ADR: **reject.** This is the one thing that converts a caught regression into a silent one.
- [ ] Did a `{ todo: true }` marker disappear? The corresponding test must now pass.
- [ ] Was a `KNOWN_MISSING` entry removed in the same commit that fixed it?
- [ ] Are `MODEL_SPEC.md`, `ANALYSIS.md` and `STATUS.md` updated?
- [ ] Any new constant? Where is it documented?
- [ ] Does the change touch a default, a form control or the country fetch? If so, does `tests/startup.test.js` still describe a viable fund?
- [ ] Was a DOM stub changed? Did it move *toward* browser behaviour or away from it?

---

## Things that will get a change rejected

- Re-recording `golden.json` to make a red build green, without an ADR.
- Marking a passing invariant `todo` to make a build green.
- Adding to a `KNOWN_MISSING` allow-list instead of fixing the cause.
- Resolving an `[OPEN]` spec question by picking one and writing code.
- A new numeric constant with no documented source.
- Fixing a bug during stage S5, whose entire proof of safety is a byte-identical `golden.json`.
- Deleting a row from the findings register.
- Weakening a DOM stub so a test passes.
- Auto-filling a policy parameter or a negotiated term from fetched data.

# STATUS

**Read this first. Update it last.** One page, always current — a snapshot of where things stand, not a history. For what changed and when, see [CHANGELOG.md](CHANGELOG.md) and [docs/adr/](docs/adr/). If this page disagrees with reality, reality wins and you fix this file.

---

## Where the work is

| | |
|---|---|
| **Stages complete** | S0, S1, S2, S3, S5 — five of seven. S4 item 1 (solver robustness, F-27) done; items 2-4 and all of S6 not started. |
| **Not started** | S4 items 2–4 (solver caching, sensitivity analysis, scenario save/load) and S6 (presentation and reach) — see [docs/ROADMAP.md](docs/ROADMAP.md). |
| **Tests** | ✅ 77 pass, 0 todo, 0 fail (`npm test`, ~1s) |
| **Lint** | ✅ `npm run lint` — ESLint, 3 rules. CI runs it on every push/PR (`.github/workflows/ci.yml`). |
| **Goldens** | ✅ 21 scenarios, current (`npm run golden:diff` → "No behaviour change") |
| **Findings register** | 37 of 37 resolved — see [docs/ANALYSIS.md](docs/ANALYSIS.md). Nothing outstanding in the register. |
| **Open modelling questions** | **None.** |

---

## What's actually unresolved

| What | Why it's not done | Urgency |
|---|---|---|
| Solver caching/debouncing across recalculations (S4 item 2) | ADR-0032 (2026-08-25) fixed solver *correctness* (F-27) but roughly doubled its simulation cost (22 → up to 47 per recalc when the solver panel is enabled). The existing 500ms input debounce still applies; result caching across recalcs is not written. | Low — solver panel is opt-in and off by default; measured cost is well under 100ms at the shipped 5-year horizon. Worth revisiting if it's noticeable at long horizons. |
| Sensitivity ("tornado") analysis and scenario save/load (S4 items 3–4) | Not started. | Low — genuinely useful, not blocking anything. |
| Browser click-through for charts and the AI advisor panel | Covered only as "does not throw" via a headless DOM stub, not against a real browser. | Low — the startup path and CSV export both have real behavioural tests now; these two don't yet. |
| The shipped default scenario's parameter search predates three later correctness fixes (reserve sizing, ME capital pricing, solver robustness) | The grid search that chose the defaults (`docs/adr/0013`) hasn't been re-run against the model as it stands today. The defaults are still confirmed viable — just not re-optimised. | Low — nothing is wrong, it's just not freshly tuned. |

That's the complete list. Nothing is blocked on a decision — the model owner has ruled on every open modelling question the original audit raised.

---

## What the model produces today

Baseline run, shipped `index.html` defaults (`node tools/verify-findings.js` reproduces this):

| | |
|---|---|
| Toilets built | 97,744 (488,720 people, ~1.8% of the target population) |
| Micro-enterprises | 254 |
| Ending / minimum cash | +$17,741 (never dips below this) |
| Net assets | +$914,174 |
| Senior debt | repaid in full |
| OSS / FSS | 2.37 / 1.44 |
| Verdict | integrity OK, viability OK |

What a user actually sees on load differs from the above — the app auto-fetches country data and overwrites most of the form half a second after load (`tests/startup.test.js` is what covers this). With the recorded Malawi fixture: 175,340 toilets, +$21,931 minimum cash, still fully repaid, still viable.

---

## Environment

Node is **not** on `PATH` on the maintainer's machine:

```bash
export PATH="/c/Users/jrobertson/Repositories/node-v25.8.1-win-x64:$PATH"
node --version                    # v25.8.1 — anything >= 20 works
npm ci                             # installs ESLint, the one devDependency
npm test                           # 77 pass, 0 fail
npm run lint
node tools/verify-findings.js      # re-measures the audit's findings against the live model
```

Run the app: `python -m http.server 8080`, or `npm run serve`. Works offline (Chart.js is vendored). `file://` works too, but the World Bank fetch is CORS-blocked from there.

---

## Recent activity

See [CHANGELOG.md](CHANGELOG.md) for the full, dated record. In short: an initial audit (2026-08-20) found 34 defects and fixed most of them across three stages; a follow-up session (2026-08-21) closed everything that remained in S0-S3, including a debt-service reserve fix and a micro-enterprise capital-pricing fix, and every open modelling question. A third session (2026-08-25) closed the findings register (F-27, solver robustness — fixing it surfaced and fixed a second, unrelated display bug, F-37; register now 37 of 37) and then completed S5, splitting the 4,028-line `app.js` into 14 files under `src/` with a byte-identical `golden.json` ([ADR-0033](docs/adr/0033-s5-structural-split.md)). `docs/adr/` holds one decision record per change, each with its prediction and its measured result.

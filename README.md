# Sanitation Revolving Fund Model

A browser-based simulation of a **blended-finance revolving fund** that finances market-based sanitation in low-income countries. It models capital flowing from investors into a fund, out to micro-enterprises that build toilets and to households that borrow to buy them, and back again as repayments — month by month, over a chosen horizon.

It answers three questions:

1. **Solvency** — does the fund run out of cash, and when?
2. **Repayment** — is senior debt repaid in full within its term?
3. **Reach and impact** — how many toilets, people, DALYs and tonnes of CO2e, at what cost per unit?

---

## Status: mid-repair, and honest about it

An audit on 2026-08-20 found 34 defects; adding a linter on 2026-08-21 found two more (F-35, a spec-documentation error; F-36, a live crash in CSV export). Of **36 known defects, 34 are fixed** (see [docs/ANALYSIS.md](docs/ANALYSIS.md)); `node tools/verify-findings.js` re-measures 19 of them programmatically against the live model. The two left — F-21's ME-capital-requirement unification and F-27's solver robustness — are listed in [STATUS.md](STATUS.md); neither is blocked on anything.

What changed that a returning user will notice:

| | |
|---|---|
| **The fund now pays its investors interest.** | `fundCostOfCapital` had no control in the form, so it defaulted to 0 — every result the tool had ever produced omitted the cost of senior debt. The control now exists and defaults to 2% concessional. ([F-01](docs/ANALYSIS.md#f-01--fundcostofcapital-has-no-input-control-so-it-is-always-zero)) |
| **Rates are entered as percentages now.** | Type `40`, not `0.40`. The form used to teach both conventions at once, and any rate above 100% was silently divided by 100 — 150% inflation became 1.5%. Old scenarios must be re-entered, not copied. ([F-17](docs/ANALYSIS.md#f-17--two-opposing-percent-heuristics-hyperinflation-becomes-2)) |
| **The demo scenario now works.** | It used to go insolvent in year 4 and default on $749,981 of senior debt. It now repays in full, stays solvent and reaches 121,358 toilets — about 2.2% of the target population, which is the honest headline. ([ADR-0013](docs/adr/0013-viable-default-scenario.md)) |
| **A failing scenario is now labelled as failing.** | The tool used to print "Model Integrity Verified" on the shipped defaults — a fund that goes insolvent in year 4.1 and defaults on $749,981 of senior principal. There are now two separate verdicts: whether the arithmetic is sound, and whether the fund works. ([F-29](docs/ANALYSIS.md#f-29--the-integrity-check-passes-a-run-that-went-insolvent-and-defaulted)) |
| **Your inputs stay where you put them.** | Recalculate used to silently cut Grant Support % up to five times per click, and the interest rates you typed were overwritten a second after load. Suggestions are now offered, not applied. ([F-04](docs/ANALYSIS.md#f-04--the-auto-solver-rewrites-the-users-inputs-and-re-runs-itself)) |
| **Carbon revenue was ~250,000x too small.** | Divided by 1000 as if kilograms, share divided by 100 twice, credited once instead of annually. Now correct — which flips carbon-financed scenarios from capital-constrained to capacity-constrained. ([F-33](docs/ANALYSIS.md#f-33--the-carbon-input-is-labelled-tonnes-per-year-and-used-as-kilograms-once)) |
| **The fund now actually reserves against debt it owes.** | The solvency gate held back 3 months of ops cost but ignored investor principal due next quarter, despite the README's long-standing claim that it didn't. It does now — baseline reach fell a further ~9% as a direct result. ([F-10](docs/ANALYSIS.md#f-10--reserves-are-enforced-once-and-the-documented-debt-reserve-does-not-exist), [ADR-0027](docs/adr/0027-debt-service-lookahead-reserve.md)) |
| **CSV export works.** | It was defined twice; the copy that ran threw a `TypeError` on every click, and the copy that didn't run would also have thrown if it had. Nothing tested it before. ([F-36](docs/ANALYSIS.md#f-36--csv-export-is-completely-broken-both-copies), [ADR-0026](docs/adr/0026-restore-the-detailed-csv-export.md)) |
| **Grant Support % now tells you what it does.** | Relabelled "Grant-Funded Pacing (% of Production)", with a note beside it showing when the grant fund runs out at the current pace — sweeping this field 5%→90% barely changes total grant-funded reach, it just changes how fast the fund is spent. ([F-30](docs/ANALYSIS.md#f-30--grant-support--is-a-pacing-lever-not-a-volume-lever), [ADR-0029](docs/adr/0029-grant-support-relabel-and-runway.md)) |

**Numbers produced before 2026-08-21 should be re-run, and rate inputs re-entered** (percentages, not decimals). Everything found is listed with evidence, severity and a fix in the [audit](docs/ANALYSIS.md); nothing is hidden. Every modelling question the audit raised has been decided and recorded as an ADR — see [STATUS.md](STATUS.md).

[methodology.html](methodology.html) has been rewritten to match the current model; see [STATUS.md](STATUS.md) for what is still open.

---

## Live

<https://washways.org/sanitation-fund-model/> — published from `main` by GitHub Pages. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Running it

No install, no build step, no dependencies.

```bash
# Any static server works. Python needs no install on most machines:
python -m http.server 8080
# then open http://localhost:8080
```

Or with Node:

```bash
npm run serve      # http://localhost:8080
```

Opening `index.html` directly via `file://` also works, but the browser will block the World Bank API calls (CORS), so country auto-fill will be unavailable.

**Offline:** works. Chart.js is pinned to 4.4.1 with an integrity hash and vendored to `vendor/` as a fallback, so charts render with no network.

## Running the tests

```bash
npm test
```

67 tests in about 1 second (Node's built-in runner, Node ≥ 20; ESLint is the one devDependency — `npm ci` once to install it). Currently **67 pass, 0 todo, 0 fail**. Seven suites: golden (did any of 21 recorded scenarios move), invariants (16 ledger checks — is the ledger self-consistent), smoke (does the whole app actually run), startup (what does a user opening the page in a browser actually get, once the country fetch has run), wiring (does each input reach the model, and does it actually move the model's output), write-down (does realised loss on a written-down loan behave the way `MODEL_SPEC.md` says it does), and export (does clicking "Export CSV" actually produce a CSV instead of throwing — F-36).

```bash
npm run golden:diff   # would any model output change?
npm run verify        # reproduce the audit findings against the live model
npm run lint          # ESLint — no-dupe-keys, no-undef, no-unused-vars only (F-19)
```

CI (`.github/workflows/ci.yml`) runs `npm test`, `npm run lint` and `npm run golden:diff` on every push and PR against `main`, on Node 20 and 22.

---

## How it works, briefly

Each month the model runs a strict waterfall:

```
  collect repayments and interest  ─┐
                                    ├─▶  LOAN LEDGER  ──┐
  investor debt service            ◀─┤                  │
  fixed operating costs            ◀─┤                  │
                                    │                   │
  solvency gate ─── if reserves are covered ────────────┤
                                    │                   │
  new ME loans, new household loans ◀───────────────────┘
  grant-funded toilets             ◀───  GRANT LEDGER ◀── carbon revenue
```

Two cash pools that never transfer into each other — grant capital funds subsidies, loan capital funds lending, operations and debt service. Loans are tracked as **cohorts** (vintages with their own term and amortisation), not as one blended balance. After every run the model checks its own ledger against a set of invariants.

Full specification: **[docs/MODEL_SPEC.md](docs/MODEL_SPEC.md)**. It is normative — where it and the code disagree, the code is wrong.

---

## Documentation

| | |
|---|---|
| **[STATUS.md](STATUS.md)** | Where the work is right now. **Read first.** |
| **[AGENTS.md](AGENTS.md)** | Working contract for AI agents and contributors. |
| **[docs/ANALYSIS.md](docs/ANALYSIS.md)** | The audit: 33 findings with evidence, severity and fixes. |
| **[docs/MODEL_SPEC.md](docs/MODEL_SPEC.md)** | The maths. Normative. Source of truth. |
| **[docs/PARAMETERS.md](docs/PARAMETERS.md)** | Every input: unit, range, source, meaning. Check before touching a field. |
| **[docs/ROADMAP.md](docs/ROADMAP.md)** | Stages S0–S6, with entry and exit gates. |
| **[docs/TESTING.md](docs/TESTING.md)** | How the safety net works and how to extend it. |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Current shape, target shape, constraints. |
| **[docs/adr/](docs/adr/)** | Decision records. |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | How to make a change. |
| **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** | How to release, and what breaks under a subpath. |
| `methodology.html` | User-facing explainer, served with the app. |

## Repository layout

```
index.html          the form and dashboard
app.js              model + KPIs + solvers + UI + controller (3,935 lines; split in S5)
style.css
methodology.html    user-facing methodology note
server.js           dev static server
eslint.config.js    3 rules only — no-dupe-keys, no-undef, no-unused-vars (F-19)

tests/              wiring, invariants, smoke, startup, write-down, export, 21 golden scenarios
vendor/             pinned Chart.js, for offline use
tools/              headless model loader, finding verification, diagnostics
docs/               audit, spec, roadmap, parameters, testing, architecture, ADRs
.github/workflows/  CI — npm test + lint + golden:diff on push/PR, Node 20 & 22
```

## Data sources

World Bank Indicators API, used to calibrate a country's context: rural population (`SP.RUR.TOTL`), basic and safely-managed sanitation (`SH.STA.BASS.RU.ZS`, `SH.STA.SMSS.RU.ZS`), GDP and GNI per capita, inflation (`FP.CPI.TOTL.ZG`), population growth (`SP.POP.GROW`), lending rate (`FR.INR.LEND`), Gini, poverty headcount, and political stability (`PV.EST`). Administrative units come from `countriesnow.space`.

Fetched values are suggestions — every one is editable, and [docs/PARAMETERS.md](docs/PARAMETERS.md) records which indicator feeds which field.

## Contributing

Read [AGENTS.md](AGENTS.md) first — it applies to humans too. In short: the specification outranks the code, behaviour changes only when an ADR predicted them, one roadmap stage at a time, and never invent a number.

## Status

Pre-1.0. The model core is structurally sound — pure, deterministic, with a cash identity that holds by construction — and is being corrected stage by stage against a written specification and a regression suite. Stages S0–S2 are complete; S3 (model correctness) is partially landed. See [STATUS.md](STATUS.md).

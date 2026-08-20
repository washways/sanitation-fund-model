# Sanitation Revolving Fund Model

A browser-based simulation of a **blended-finance revolving fund** that finances market-based sanitation in low-income countries. It models capital flowing from investors into a fund, out to micro-enterprises that build toilets and to households that borrow to buy them, and back again as repayments — month by month, over a chosen horizon.

It answers three questions:

1. **Solvency** — does the fund run out of cash, and when?
2. **Repayment** — is senior debt repaid in full within its term?
3. **Reach and impact** — how many toilets, people, DALYs and tonnes of CO2e, at what cost per unit?

---

## Status: mid-repair, and honest about it

An audit on 2026-08-20 found **33 defects**, two of them Critical, and reproduced 16 by executing the model. **17 are now fixed and verified** (`node tools/verify-findings.js`). The rest are listed in [STATUS.md](STATUS.md) with what is blocking each.

What changed that a returning user will notice:

| | |
|---|---|
| **The fund now pays its investors interest.** | `fundCostOfCapital` had no control in the form, so it defaulted to 0 — every result the tool had ever produced omitted the cost of senior debt. The control now exists and defaults to 2% concessional. ([F-01](docs/ANALYSIS.md#f-01--fundcostofcapital-has-no-input-control-so-it-is-always-zero)) |
| **Rates are entered as percentages now.** | Type `40`, not `0.40`. The form used to teach both conventions at once, and any rate above 100% was silently divided by 100 — 150% inflation became 1.5%. Old scenarios must be re-entered, not copied. ([F-17](docs/ANALYSIS.md#f-17--two-opposing-percent-heuristics-hyperinflation-becomes-2)) |
| **The demo scenario now works.** | It used to go insolvent in year 4 and default on $749,981 of senior debt. It now repays in full, stays solvent and reaches 139,148 households — about 3.5% of the target population, which is the honest headline. ([ADR-0013](docs/adr/0013-viable-default-scenario.md)) |
| **A failing scenario is now labelled as failing.** | The tool used to print "Model Integrity Verified" on the shipped defaults — a fund that goes insolvent in year 4.1 and defaults on $749,981 of senior principal. There are now two separate verdicts: whether the arithmetic is sound, and whether the fund works. ([F-29](docs/ANALYSIS.md#f-29--the-integrity-check-passes-a-run-that-went-insolvent-and-defaulted)) |
| **Your inputs stay where you put them.** | Recalculate used to silently cut Grant Support % up to five times per click, and the interest rates you typed were overwritten a second after load. Suggestions are now offered, not applied. ([F-04](docs/ANALYSIS.md#f-04--the-auto-solver-rewrites-the-users-inputs-and-re-runs-itself)) |
| **Carbon revenue was ~250,000x too small.** | Divided by 1000 as if kilograms, share divided by 100 twice, credited once instead of annually. Now correct — which flips carbon-financed scenarios from capital-constrained to capacity-constrained. ([F-33](docs/ANALYSIS.md#f-33--the-carbon-input-is-labelled-tonnes-per-year-and-used-as-kilograms-once)) |

**Numbers produced before 2026-08-20 should be re-run, and rate inputs re-entered** (percentages, not decimals). Everything found is listed with evidence, severity and a fix in the [audit](docs/ANALYSIS.md); nothing is hidden. Six modelling questions still need the model owner's judgement — see [STATUS.md](STATUS.md).

`methodology.html` has not yet been reconciled with these changes and still describes the old carbon, grace-period and reserve behaviour.

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

53 tests in about 0.5 seconds, zero dependencies (Node's built-in runner, Node ≥ 20). Currently **53 pass, 0 todo, 0 fail**. Four suites: wiring (does each input reach the model), invariants (is the ledger self-consistent, across 16 scenarios), golden (did any output move), and smoke (does the whole app actually run).

```bash
npm run golden:diff   # would any model output change?
npm run verify        # reproduce the audit findings against the live model
```

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
app.js              model + KPIs + solvers + UI + controller (3,667 lines; split in S5)
style.css
methodology.html    user-facing methodology note
server.js           dev static server

tests/              wiring, invariants, smoke, 18 golden scenarios
vendor/             pinned Chart.js, for offline use
tools/              headless model loader, finding verification, diagnostics
docs/               audit, spec, roadmap, parameters, testing, architecture, ADRs
```

## Data sources

World Bank Indicators API, used to calibrate a country's context: rural population (`SP.RUR.TOTL`), basic and safely-managed sanitation (`SH.STA.BASS.RU.ZS`, `SH.STA.SMSS.RU.ZS`), GDP and GNI per capita, inflation (`FP.CPI.TOTL.ZG`), population growth (`SP.POP.GROW`), lending rate (`FR.INR.LEND`), Gini, poverty headcount, and political stability (`PV.EST`). Administrative units come from `countriesnow.space`.

Fetched values are suggestions — every one is editable, and [docs/PARAMETERS.md](docs/PARAMETERS.md) records which indicator feeds which field.

## Contributing

Read [AGENTS.md](AGENTS.md) first — it applies to humans too. In short: the specification outranks the code, behaviour changes only when an ADR predicted them, one roadmap stage at a time, and never invent a number.

## Status

Pre-1.0. The model core is structurally sound — pure, deterministic, with a cash identity that holds by construction — and is being corrected stage by stage against a written specification and a regression suite. Stages S0–S2 are complete and S3 is in progress. See [STATUS.md](STATUS.md).

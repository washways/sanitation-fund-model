# Sanitation Revolving Fund Model

A browser-based simulation of a **blended-finance revolving fund** that finances market-based sanitation in low-income countries. It models capital flowing from investors into a fund, out to micro-enterprises that build toilets and to households that borrow to buy them, and back again as repayments — month by month, over a chosen horizon.

It answers three questions:

1. **Solvency** — does the fund run out of cash, and when?
2. **Repayment** — is senior debt repaid in full within its term?
3. **Reach and impact** — how many toilets, people, DALYs and tonnes of CO₂e, at what cost per unit?

---

## Status

Pre-1.0, actively maintained. The model core is pure and deterministic — the same inputs always give the same answer, and every run checks its own ledger against a set of invariants before reporting a result. **105 automated tests and 21 characterisation scenarios.** Known limitations are listed in [STATUS.md](STATUS.md) and the on-site [changelog](changelog.html).

**What's genuinely unresolved:** all 52 registered defects and all 14 modelling questions are resolved. Evidence-bounded sensitivity analysis, scenario comparison, and real-browser chart/advisor checks remain roadmap work. See [STATUS.md](STATUS.md).

**If you have output from before 2026-08-21, re-run it.** Several corrections that session moved real numbers (see the changelog); a result generated earlier is not comparable to one generated now.

---

## Live

<https://washways.org/sanitation-fund-model/> — published from `main` by GitHub Pages. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Running it

No install, no build step, no runtime dependencies.

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

**Offline:** works. Chart.js is pinned to an exact version with an integrity hash and vendored to `vendor/` as a fallback, so charts render with no network.

## Running the tests

```bash
npm ci            # installs ESLint, the one devDependency — needed once
npm test
```

Twelve suites, zero flakiness, about four seconds: **constraint reporting**, **debt waterfall**, **golden** (did any of 21 recorded scenarios move), **input validation**, **invariants** (does the ledger stay internally consistent, across a scenario matrix), **purity** (is the model DOM-free), **smoke** (does the whole app run end to end without throwing), **solver**, **startup** (what does a user opening the page actually get once the country fetch has run), **wiring**, **write-down**, and **export**.

```bash
npm run golden:diff   # would any model output change, without writing anything?
npm run verify        # re-run the audit's original measurements against the live model
npm run lint           # ESLint
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push and PR against `main`, on Node 20 and 22.

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

Full specification: **[docs/MODEL_SPEC.md](docs/MODEL_SPEC.md)**. It is normative — where it and the code disagree, the code is wrong, unless the spec rule is explicitly tagged as describing existing behaviour.

---

## Documentation

Start with **[STATUS.md](STATUS.md)** — it's the one-page current snapshot, and every contributor (human or AI) is expected to read it first and update it last.

| | |
|---|---|
| **[STATUS.md](STATUS.md)** | Where the work stands right now: what's done, what isn't, what's blocked. **Read first.** |
| **[CHANGELOG.md](CHANGELOG.md)** | Dated record of every change that affects a result or a user-visible behaviour. |
| **[AGENTS.md](AGENTS.md)** | The working contract — process rules for making a change, human or AI. |
| **[docs/MODEL_SPEC.md](docs/MODEL_SPEC.md)** | The maths, current and normative. Source of truth for what the model does. |
| **[docs/PARAMETERS.md](docs/PARAMETERS.md)** | Every input: unit, range, source, meaning. Check before touching a field. |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Current code shape, the target shape, and the constraints that keep it buildless. |
| **[docs/TESTING.md](docs/TESTING.md)** | How the test suite is built and how to extend it. |
| **[docs/ROADMAP.md](docs/ROADMAP.md)** | Remaining stages (S4 items 2-4, S6), each with an entry and exit gate. |
| **[docs/adr/](docs/adr/README.md)** | One decision record per behaviour change or modelling choice — the *why* behind the changelog's *what*. Indexed. |
| **[docs/ANALYSIS.md](docs/ANALYSIS.md)** | The audit register: 52 findings with evidence and resolutions. Historical record — for current behaviour, use `MODEL_SPEC.md`. |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Mechanics of making a change: branch, test, commit. |
| **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** | How to release, and what breaks under a subpath. |
| `methodology.html` | User-facing explainer, served with the app, kept in step with `MODEL_SPEC.md`. |

## Repository layout

```
index.html          the form and dashboard — loads src/ as 14 classic <script> tags
src/                 model + KPIs + solvers + UI + controller, split S5 (ADR-0033)
  model/               pure — no DOM. engine.js, kpis.js, solvers.js, invariants.js
  ui/                  inputs.js, kpis.js, charts.js, tables.js, export.js, advisor.js
  data/                worldbank.js, countries.js, stakeholders.js
  app.js               controller and wiring only
style.css
methodology.html     user-facing methodology note
server.js             dev static server
eslint.config.js      3 rules: no-dupe-keys, no-undef, no-unused-vars

tests/                12 suites, 105 tests, 21 recorded golden scenarios
vendor/                pinned Chart.js, for offline use
tools/                 headless model loader, app-source file list, audit verification
docs/                  spec, parameters, architecture, testing, roadmap, ADRs, audit
.github/workflows/    CI — tests + lint + golden diff on every push and PR
```

## Data sources

World Bank Indicators API, used to calibrate dated country context: rural population (`SP.RUR.TOTL`), basic and safely-managed sanitation (`SH.STA.BASS.RU.ZS`, `SH.STA.SMSS.RU.ZS`), GDP and GNI per capita, inflation (`FP.CPI.TOTL.ZG`), population growth (`SP.POP.GROW`), lending rate (`FR.INR.LEND`), Gini, and poverty headcount.

Only directly observed target population, population growth, and income populate model fields. CPI, lending, poverty, Gini, and sanitation coverage are shown with their observation years as context. The fetch never overwrites a negotiated term, cost, capacity assumption, write-down, or policy choice; [docs/PARAMETERS.md](docs/PARAMETERS.md) records the boundary.

## Contributing

Read [AGENTS.md](AGENTS.md) first — it's the working contract and it applies to humans too. In short: the specification outranks the code, behaviour changes only when a decision record predicted them, and never invent a number.

# Sanitation Revolving Fund Model

A browser-based simulation of a **blended-finance revolving fund** that finances market-based sanitation in low-income countries. It models capital flowing from investors into a fund, out to micro-enterprises that build toilets and to households that borrow to buy them, and back again as repayments — month by month, over a chosen horizon.

It answers three questions:

1. **Solvency** — does the fund run out of cash, and when?
2. **Repayment** — is senior debt repaid in full within its term?
3. **Reach and impact** — how many toilets, people, DALYs and tonnes of CO₂e, at what cost per unit?

---

## Status

Pre-1.0, actively maintained. The model core is pure and deterministic — the same inputs always give the same answer, and every run checks its own ledger against a set of invariants before reporting a result. **68 automated tests, 21 characterisation scenarios, 0 known defects that affect a result you'd see today.**

**What's genuinely unresolved:** one low-priority finding (a solver that can misfire in an already-marginal capital-tight regime) and no open modelling questions — see [STATUS.md](STATUS.md) for specifics and [CHANGELOG.md](CHANGELOG.md) for what changed and when.

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

Seven suites, zero flakiness, about a second: **golden** (did any of 21 recorded scenarios move), **invariants** (does the ledger stay internally consistent, across a scenario matrix), **smoke** (does the whole app run end to end without throwing), **startup** (what does a user opening the page in a browser actually get, once the country fetch has run), **wiring** (does every input reach the model, and does it actually move the output), **write-down** (does a written-down loan behave the way the spec says it should), and **export** (does "Export CSV" produce a CSV instead of throwing).

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
| **[docs/ROADMAP.md](docs/ROADMAP.md)** | Remaining stages (S4, S5), each with an entry and exit gate. |
| **[docs/adr/](docs/adr/README.md)** | One decision record per behaviour change or modelling choice — the *why* behind the changelog's *what*. Indexed. |
| **[docs/ANALYSIS.md](docs/ANALYSIS.md)** | The original audit that started this work: 36 findings, evidence, fixes. Historical record — for current behaviour, use `MODEL_SPEC.md`. |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Mechanics of making a change: branch, test, commit. |
| **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** | How to release, and what breaks under a subpath. |
| `methodology.html` | User-facing explainer, served with the app, kept in step with `MODEL_SPEC.md`. |

## Repository layout

```
index.html          the form and dashboard
app.js               model + KPIs + solvers + UI + controller — one file, ~3,900 lines
style.css
methodology.html     user-facing methodology note
server.js             dev static server
eslint.config.js      3 rules: no-dupe-keys, no-undef, no-unused-vars

tests/                7 suites, 21 recorded golden scenarios
vendor/                pinned Chart.js, for offline use
tools/                 headless model loader, audit-finding verification, diagnostics
docs/                  spec, parameters, architecture, testing, roadmap, ADRs, audit
.github/workflows/    CI — tests + lint + golden diff on every push and PR
```

## Data sources

World Bank Indicators API, used to calibrate a country's context: rural population (`SP.RUR.TOTL`), basic and safely-managed sanitation (`SH.STA.BASS.RU.ZS`, `SH.STA.SMSS.RU.ZS`), GDP and GNI per capita, inflation (`FP.CPI.TOTL.ZG`), population growth (`SP.POP.GROW`), lending rate (`FR.INR.LEND`), Gini, poverty headcount, and political stability (`PV.EST`). Administrative units come from `countriesnow.space`.

Fetched values are suggestions — every one is editable, and [docs/PARAMETERS.md](docs/PARAMETERS.md) records which indicator feeds which field. The fetch never overwrites a negotiated term or a policy choice, only observed facts about the country.

## Contributing

Read [AGENTS.md](AGENTS.md) first — it's the working contract and it applies to humans too. In short: the specification outranks the code, behaviour changes only when a decision record predicted them, and never invent a number.

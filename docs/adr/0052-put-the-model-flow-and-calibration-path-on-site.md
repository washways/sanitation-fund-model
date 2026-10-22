# ADR-0052: Put the model flow and calibration path on site

- **Status:** Accepted
- **Date:** 2026-10-22
- **Stage:** S6
- **Findings:** F-62
- **Spec rules touched:** R-10.9

## Context

The methodology page contains the detailed monthly waterfall, cohort formulas, ledger rules, and
limitations, but it begins as a long reference document. The application links to it only as
“Method”. A user moving from assumptions to charts has no concise map showing which inputs feed
which mechanism, how the two ledgers interact, or which assumptions must be replaced before a
decision. The detail exists, but its entry point remains black-box-like.

## Decision

Add a short, numbered model-flow map and a decision-use calibration checklist near the start of the
on-site methodology. Link the application directly to that map as “How it works”. Add a regression
that requires every numeric input read by `UI.getInputs()` to retain a full row in the canonical
parameter dictionary.

## Prediction

No model, input, API, or output changes. Users gain a one-screen route from capital and country
evidence through the monthly waterfall, enterprise/toilet delivery, cohort repayments, and reported
outcomes. All 21 golden scenarios remain unchanged.

## Alternatives considered

- **Add more tooltips only.** Rejected: tooltips explain individual fields but cannot show how the
  parts connect, and they are poor primary documentation.
- **Duplicate the full methodology on the dashboard.** Rejected: it would overwhelm the working
  screen and create two long documents that could drift.
- **Rely on repository documentation.** Rejected: users of the published app should not need GitHub
  to understand or calibrate a decision model.

## Consequences

The on-site guide becomes the plain-language entry point, while `MODEL_SPEC.md` remains normative.
Adding a new numeric input now creates a failing documentation test until its unit, default, source,
and meaning are recorded in `PARAMETERS.md`.

## Verification

`tests/documentation.test.js` requires the app link, five-step flow, calibration checklist, and a
complete parameter-dictionary row for every numeric UI input. The full suite and golden comparison
must remain unchanged.

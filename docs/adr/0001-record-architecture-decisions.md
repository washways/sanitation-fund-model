# ADR-0001: Record decisions that change model behaviour

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S0

## Context

This model produces numbers used in investment and policy decisions. Its git history contains fifteen commits, eight of which are single-error hotfixes ("Fix TypeError…", "Fix ReferenceError…"). None records *why* a modelling choice was made — only that something broke and was patched.

The audit found the cost of that. `computeKPIs` contains a fifteen-line comment block in which the author argues with themselves about whether SROI should include DALY value, reaches no conclusion, and ships one branch anyway (F-08). A hardcoded `$0.50` per hour of a person's time sits in the SROI shown to funders, with a source comment asking where the number came from. Neither decision can now be reconstructed.

A model whose assumptions cannot be reconstructed cannot be defended, and a model that cannot be defended cannot be used for the decisions this one is used for.

## Decision

Every change to observable model behaviour is preceded by an Architecture Decision Record in `docs/adr/`, numbered sequentially, using [the template](0000-template.md).

An ADR is required to:

- change any rule in `MODEL_SPEC.md`,
- resolve an `[OPEN]` question,
- add, remove or redefine a parameter,
- choose between two defensible modelling conventions,
- add a dependency, a build step or a backend.

An ADR is **not** required for refactors that leave `golden.json` byte-identical, for documentation, or for test additions.

## Prediction

No behaviour change.

## Alternatives considered

- **Commit messages only.** Rejected: they are per-change, not per-decision, and are not discoverable by someone asking "why is SROI defined this way?".
- **Comments in the source.** Rejected: this is precisely what produced the unresolved fifteen-line argument in `computeKPIs`. Source comments record a train of thought; ADRs record a conclusion.
- **A wiki.** Rejected: not versioned with the code, so it drifts.

## Consequences

Changing model behaviour becomes slightly slower and considerably harder to do by accident. The ADR's **Prediction** section doubles as the review criterion for the golden-file diff, which turns "the numbers changed" from an alarm into a check.

Cost: an agent that skips the ADR can still change behaviour. The mitigation is procedural, not technical — the definition of done in `AGENTS.md` requires it, and reviewers reject diffs that re-record goldens without one.

## Verification

`docs/adr/` exists with a template; `AGENTS.md` §6 and `CONTRIBUTING.md` require it.

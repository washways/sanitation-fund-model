# ADR-0046: Mark every country-derived input consistently

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S6
- **Findings:** F-53
- **Spec rules touched:** R-10.7

## Context

Country loading writes exactly three model inputs: target population, population growth, and
income per person. The controller adds `auto-filled`, assigns an amber inline background, and
then dispatches an `input` event. The formatting listener responds to that same event by removing
`auto-filled` from formatted-number fields, but not from the unformatted growth field. The inline
background remains after a user edit. Three duplicate `.auto-filled` CSS rules then disagree about
the intended colour. The visible provenance is consequently inconsistent and can remain after the
value is no longer the API observation.

The household and enterprise interest controls also carry the unexplained class `api-field`, even
though ADR-0034 explicitly prohibits country data from setting either programme term.

## Decision

Use one `country-observation` state for all and only model inputs loaded or derived from World Bank
observations. Give it one blue visual treatment and an adjacent legend. Record a source description
on the element, retain the state across programmatic events, and remove it when the user edits the
value. Remove obsolete `api-field` labels from programme interest assumptions.

The target-population field is explicitly described as *derived* from two dated API observations;
growth and income are described as direct observations. Context-only indicators remain in the
dated country strip and do not receive input provenance because they do not write model inputs.

## Prediction

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| all 21 golden scenarios | every numeric result | none | exactly zero |
| Malawi post-fetch startup | every numeric result | none | exactly zero |

This is a presentation and provenance change only. Any golden or startup-number movement is an
unexpected regression and must stop the change.

## Alternatives considered

- **Keep amber and repair the class only.** Rejected because amber is already used for warnings and
  attention states; it does not communicate an external data source clearly.
- **Colour every assumption by category.** Desirable later, but broader than the reported defect.
  This change establishes the country-observation category without pretending all illustrative
  assumptions already have equivalent provenance metadata.
- **Leave the highlight after edits.** Rejected because it would falsely attribute a user-supplied
  value to the API.

## Consequences

Users can identify the values that country loading actually changed and can distinguish those
observations from programme choices. A new country-derived model input must use the same helper and
extend the startup regression. Reversing the colour is harmless; weakening the provenance state or
applying it to policy assumptions requires a superseding decision.

## Verification

`npm test` passes 111/111, `npm run lint` is clean, and `npm run golden:diff` reports no behaviour
change. The startup regression proves all three observed inputs retain the state after loading,
programme terms do not receive it, and trusted user input removes it. `tools/verify-findings.js`
also checks the single CSS definition, visible legend, loader boundary, and absence of obsolete
`api-field` labels.

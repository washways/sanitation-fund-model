# ADR-0062: Derive household size and administrative units from country data; mark every other input amber

- **Status:** Accepted
- **Date:** 2026-10-24
- **Stage:** S6
- **Supersedes in part:** [ADR-0034](0034-observations-only-country-data.md) (which kept district
  counts out of country loading because a third-party source mixed districts and regions)
- **Spec rules touched:** country-data contract (STATUS.md, CLAUDE.md), PARAMETERS.md

## Context

Country loading set four fields: target population, population growth, income and the DALY
burden. About 30 other inputs carried no source marker, so the legend's blue/amber key covered
only ten fields. Two of the unmarked fields were Malawi facts that stayed in place when a user
switched country:

- **Household size (4.4).** It converts the target population into households needing a toilet,
  and toilets into people reached, hours saved and DALYs averted. Rural household size in the
  selector countries runs from 3.1 (Lesotho) to 10.4 (The Gambia), so a Senegal run (9.5)
  roughly halved people reached.
- **Administrative units (28).** With enterprises per unit, it sets the enterprise-network
  ceiling.

The owner asked that every input be categorised and that country data be used wherever it can
be derived transparently.

## Decision

1. **Household size** comes from the DHS Program API, indicator `HC_MEMB_H_MNM` (mean number of
   household members), *Rural* residence breakdown, latest survey. Survey year and type (DHS or
   MIS) are shown on hover. It covers 35 of the 44 selector countries; CORS is open.
2. **Administrative units** come from the geoBoundaries API, `gbOpen/{ISO3}/ADM2`,
   `admUnitCount`. The unit type (`boundaryCanonical`, for example *district*, *county*,
   *cercle*), the year represented and the national source are shown on hover. It covers all 44
   countries; CORS is open; data are CC BY 3.0 IGO or similar open licences.
3. Both become essential country fields with the existing rule: if the value is missing, the field
   is cleared, the strip names it, no calculation runs and stale results are withdrawn (F-73).
   Another country's value is never retained.
4. **Every other numeric input is amber** (`programme-assumption`), including fund size, horizon
   and debt terms: anything the user must supply. A test fails if an input has neither marker.

DHS and geoBoundaries are added to the hosts the app may call.

## Why ADM2

Malawi's ADM2 is exactly its 28 official districts. ADM2 is the level at which most selector
countries organise district-level service delivery. It is not always called a district, and some
records are old (Nepal 2006, Uganda 2006), so the hover text shows the unit type and year and the
user can replace the number with the programme's actual operating units.

## Prediction

- Static default `avgHHSize` changes 4.4 → 4.3 to match the post-load Malawi value (DHS 2024
  rural), keeping static and loaded Malawi runs aligned. `districts` stays 28.
- Golden scenarios: household backlog rises 2.3% (people ÷ 4.3 instead of 4.4). Where production
  is capacity- or capital-limited, toilets do not move; people reached, hours saved, time value,
  DALYs and the gross social value multiple fall about 2.3%. Demand-limited scenarios build up to
  2.3% more toilets. Cash and repayment move only where toilet counts move.
- The Malawi startup run: people reached falls about 2.3%; toilets unchanged; verdict unchanged.

## Alternatives considered

- **Show DHS as context only.** Rejected by the owner: switching country would still run on
  Malawi's household size.
- **UN DESA household size database.** Authoritative but distributed as a spreadsheet, not an API.
- **ADM1.** Too coarse for enterprise-network planning (Malawi ADM1 is its three regions).

## Consequences

Two more external hosts. Nine countries without a DHS survey (for example South Sudan, Somalia,
Lao PDR) now pause until the user enters a cited household size. Old surveys are used with their
year shown (Central African Republic 1994, Eritrea 2002).

## Verification

`tests/startup.test.js` covers both derivations, both missing-data paths and the
every-input-categorised rule against recorded responses. `npm run golden:diff` must show only the
movements above.

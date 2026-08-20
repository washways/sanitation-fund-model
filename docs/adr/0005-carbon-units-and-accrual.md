# ADR-0005: Price carbon in tonnes and accrue it annually over the toilet's life

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S1
- **Findings:** F-02, F-33
- **Spec rules:** R-8.1

## Context

Three unit errors stacked on one parameter.

The input's label and tooltip say **"CO2e / Toilet (Tonnes/Yr)"** — "tonnes of CO2
equivalent emissions prevented per toilet **per year**". The code did this:

```js
const newCarbonTons = (production * inputs.co2PerToilet) / 1000;   // treats it as kg
carbonRev = newCarbonTons * co2Value * (carbonCreditShare / 100);  // already a decimal
```

so it (a) divided by 1000 as though the input were kilograms, (b) divided the fund's
share by 100 a second time having already normalised it in `getInputs`, and (c) granted
the credit **once, at construction**, against that month's new units — so the "per year"
in the label never happened.

Measured against the shipped default of 0.2: **$6.34** of carbon revenue where the
label promises roughly $1,584,878. About 250,000x understated. The whole component was
in effect switched off, and switched off in a way that produced a plausible small number
rather than a zero — so it read as "carbon doesn't move the needle" rather than as a bug.

It went unnoticed because `co2PerToilet` is overridden to 0.0 at startup, so the path
had never been exercised.

## Decision

```
newTonnes[m] = activeToilets[m] * co2PerToiletPerYear / 12
revenue[m]   = newTonnes[m] * co2Value * carbonCreditShare
```

Tonnes, because the label says tonnes and `co2Value` is "Value per Tonne CO2e".
Accrued monthly against toilets **in service**, because credits are earned for emissions
avoided each year a toilet operates, not for the act of building it — and because
`dataMonthlyActiveToilets` already tracks exactly that.

No `toiletLifespanYears` input is added yet: credits accrue for as long as the
simulation runs. That is a simplification and is recorded as Q11.

## Prediction

Only the `carbon enabled` scenario moves. Carbon revenue up by ~5 orders of magnitude;
grant-funded output up substantially, since carbon revenue accrues to the grant ledger.

## Alternatives considered

- **Relabel the input to kilograms** and keep the `/1000`. Rejected: tonnes is the
  conventional unit for carbon credits and matches the neighbouring `co2Value` field.
  The code was wrong, not the label.
- **Keep once-at-construction accrual.** Rejected: it contradicts the label, and no
  crediting methodology works that way.

## Consequences

Carbon becomes a material lever, which is the point — for container-based sanitation
and biogas models it is often the difference between viability and failure.

The `carbon enabled` scenario now flips from **"Capital Depleted (Insolvent)"** to
**"Supply Chain (ME Capacity)"**: with carbon priced correctly the fund stops running
out of money and starts running out of builders. That is a substantive change in what
the model says about carbon-financed sanitation, and it deserves review by the model
owner before it is relied on.

## Verification

```
node tools/verify-findings.js
FIXED  F-02 + F-33  carbon is priced in tonnes, accrued annually, share applied once
       1 t/toilet/yr at $10/t with a 50% share over 434,413 toilet-months
       -> expected $181,005, model gives $181,005.
```
Observed in `carbon enabled`: grants disbursed $930,751 → $4,458,895 (+379%),
grant-funded toilets 9,096 → 40,911, dominant constraint Insolvent → ME Capacity.

/**
 * Pure helpers for checking that current country observations produce the same
 * model inputs as the browser and survive a full calculation.
 *
 * The network-facing audit lives in audit-country-data.js. Keeping this part pure
 * lets CI verify the derivation without depending on either public API.
 */
const { ModelModule } = require('./load-model');
const BASE = require('./baseline-inputs');

function finiteRecord(record) {
  return record !== null && record !== undefined && Number.isFinite(Number(record.value));
}

function deriveCountryInputs(data) {
  const missing = [];
  if (!finiteRecord(data.ruralPopulation)) missing.push('rural population');
  if (!finiteRecord(data.basicRuralSanitation)) missing.push('basic sanitation');
  if (!finiteRecord(data.populationGrowth)) missing.push('population growth');
  if (!finiteRecord(data.gniPerCapita) && !finiteRecord(data.gdpPerCapita)) {
    missing.push('GNI/GDP per capita');
  }
  // ADR-0062: DHS rural household size and geoBoundaries ADM2 count are essential.
  if (!finiteRecord(data.householdSize)) missing.push('rural household size');
  if (!finiteRecord(data.adminUnits)) missing.push('administrative units');
  if (missing.length) return { inputs: null, missing };

  const ruralPopulation = Number(data.ruralPopulation.value);
  const basicSanitation = Number(data.basicRuralSanitation.value);
  const populationGrowth = Number(data.populationGrowth.value);
  const income = finiteRecord(data.gniPerCapita)
    ? Number(data.gniPerCapita.value)
    : Number(data.gdpPerCapita.value);

  // Mirror src/app.js exactly: whole unserved people, two displayed percentage
  // decimals before UI.getInputs() divides by 100, and whole-dollar income.
  return {
    inputs: {
      popReqToilets: Math.floor(ruralPopulation * ((100 - basicSanitation) / 100)),
      popGrowthRate: Number(populationGrowth.toFixed(2)) / 100,
      avgAnnualIncome: Math.round(income),
      avgHHSize: Number(data.householdSize.value),
      districts: Number(data.adminUnits.value),
    },
    missing: [],
  };
}

function auditCountryScenario(data, baseInputs = BASE) {
  const derived = deriveCountryInputs(data);
  if (derived.missing.length) {
    return { runnable: false, missing: derived.missing, inputs: null, validationErrors: [], integrity: null };
  }

  const inputs = { ...baseInputs, ...derived.inputs, verify: false, enableBreakEvenSolver: false };
  const validationErrors = ModelModule.validateInputs(inputs);
  if (validationErrors.length) {
    return { runnable: false, missing: [], inputs, validationErrors, integrity: null };
  }

  const result = ModelModule.calculate(inputs);
  const integrity = ModelModule.checkIntegrity(result.series, inputs, result.kpis);
  return {
    runnable: integrity.ok,
    missing: [],
    inputs,
    validationErrors: [],
    integrity,
    viability: result.viability,
  };
}

module.exports = { deriveCountryInputs, auditCountryScenario };

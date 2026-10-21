/**
 * Live, read-only coverage audit for every country in the selector.
 *
 * This is deliberately not an automated test: World Bank availability changes and
 * CI must not depend on the network. Run it when reviewing the country-data contract.
 */
const { LDC_COUNTRIES } = require('./load-model');
const { auditCountryScenario } = require('./country-runtime-audit');

const INDICATORS = {
  ruralPopulation: 'SP.RUR.TOTL',
  basicRuralSanitation: 'SH.STA.BASS.RU.ZS',
  populationGrowth: 'SP.POP.GROW',
  gniPerCapita: 'NY.GNP.PCAP.CD',
  gdpPerCapita: 'NY.GDP.PCAP.CD',
  cpi: 'FP.CPI.TOTL.ZG',
  commercialLending: 'FR.INR.LEND',
  gini: 'SI.POV.GINI',
  poverty: 'SI.POV.DDAY',
};

async function fetchLatest(countryCode, indicator) {
  const url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}` +
    '?format=json&mrnev=1&per_page=1';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const body = await response.json();
  const record = body?.[1]?.find(row => row.value !== null);
  return record ? { value: Number(record.value), year: record.date } : null;
}

function inRange(record, min, max) {
  return !record || (Number.isFinite(record.value) && record.value >= min && record.value <= max);
}

async function main() {
  const rows = await Promise.all(LDC_COUNTRIES.map(async country => {
    const entries = await Promise.all(Object.entries(INDICATORS).map(async ([name, code]) =>
      [name, await fetchLatest(country.code, code)]));
    return { country, data: Object.fromEntries(entries) };
  }));

  const invalid = [];
  const incomplete = [];
  const runtimeIssues = [];
  let runnable = 0;
  for (const { country, data } of rows) {
    if (!inRange(data.ruralPopulation, 0, Number.MAX_SAFE_INTEGER)) invalid.push(`${country.name}: rural population`);
    if (!inRange(data.basicRuralSanitation, 0, 100)) invalid.push(`${country.name}: basic sanitation`);
    if (!inRange(data.populationGrowth, -100, 100)) invalid.push(`${country.name}: population growth`);
    if (!inRange(data.gniPerCapita, 0, Number.MAX_SAFE_INTEGER)) invalid.push(`${country.name}: GNI`);
    if (!inRange(data.gdpPerCapita, 0, Number.MAX_SAFE_INTEGER)) invalid.push(`${country.name}: GDP`);

    const missing = [];
    if (!data.ruralPopulation) missing.push('rural population');
    if (!data.basicRuralSanitation) missing.push('basic sanitation');
    if (!data.populationGrowth) missing.push('population growth');
    if (!data.gniPerCapita && !data.gdpPerCapita) missing.push('GNI/GDP');
    if (missing.length) incomplete.push(`${country.name}: ${missing.join(', ')}`);

    try {
      const audit = auditCountryScenario(data);
      if (audit.runnable) {
        runnable += 1;
      } else if (audit.missing.length === 0) {
        const reasons = audit.validationErrors.length
          ? audit.validationErrors
          : audit.integrity?.violations || ['model did not report a reason'];
        runtimeIssues.push(`${country.name}: ${reasons.join('; ')}`);
      }
    } catch (error) {
      runtimeIssues.push(`${country.name}: ${error.message}`);
    }
  }

  console.log(`Countries checked: ${rows.length}`);
  for (const key of Object.keys(INDICATORS)) {
    const available = rows.filter(row => row.data[key]).length;
    console.log(`${key}: ${available}/${rows.length}`);
  }
  console.log(`Auto-runnable from current observations: ${rows.length - incomplete.length}/${rows.length}`);
  console.log(`Full model run with derived observations: ${runnable}/${rows.length}`);
  if (incomplete.length) console.log(`Incomplete (the app clears fields and pauses):\n- ${incomplete.join('\n- ')}`);
  if (runtimeIssues.length) {
    console.error(`Model runtime/integrity failures:\n- ${runtimeIssues.join('\n- ')}`);
  }
  if (invalid.length) console.error(`Invalid values:\n- ${invalid.join('\n- ')}`);
  if (invalid.length || runtimeIssues.length) {
    process.exitCode = 1;
  } else {
    console.log('All returned values pass semantic range checks and every complete country run preserves model integrity.');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

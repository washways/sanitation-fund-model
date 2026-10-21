/**
 * Live, read-only coverage audit for the country-derived sanitation DALY factor.
 *
 * This is deliberately not an automated test: WHO/World Bank availability can change
 * and CI must not depend on the network. It mirrors ADR-0049's browser derivation.
 */
const { LDC_COUNTRIES } = require('./load-model');

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function fetchWho(countryCode) {
  const filter = encodeURIComponent(
    `SpatialDim eq '${countryCode}' and Dim1 eq 'SEX_BTSX' and Dim2 eq 'AGEGROUP_YEARSALL'`
  );
  const body = await fetchJson(`https://ghoapi.azureedge.net/api/WSH_30_SAN?$filter=${filter}`);
  const records = Array.isArray(body?.value) ? body.value : [];
  const finiteValue = value => value !== null && value !== '' && Number.isFinite(Number(value));
  return records
    .filter(record => finiteValue(record.NumericValue)
      && finiteValue(record.Low)
      && finiteValue(record.TimeDim))
    .sort((a, b) => Number(b.TimeDim) - Number(a.TimeDim))[0] || null;
}

async function fetchWorldBank(countryCode, indicator, year) {
  const url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}` +
    `?format=json&date=${year}`;
  const body = await fetchJson(url);
  const record = body?.[1]?.find(row => row.value !== null);
  return record ? Number(record.value) : null;
}

async function auditCountry(country) {
  try {
    const who = await fetchWho(country.code);
    if (!who) return { country, reason: 'WHO sanitation DALYs unavailable' };
    const year = Number(who.TimeDim);
    const [population, sanitationPct] = await Promise.all([
      fetchWorldBank(country.code, 'SP.POP.TOTL', year),
      fetchWorldBank(country.code, 'SH.STA.BASS.ZS', year),
    ]);
    if (!Number.isFinite(population) || !Number.isFinite(sanitationPct)) {
      return { country, year, reason: 'matching World Bank exposure unavailable' };
    }
    const exposed = population * (1 - sanitationPct / 100);
    const lower = Number(who.Low);
    const rate = lower / exposed;
    return { country, year, population, sanitationPct, exposed, lower, rate };
  } catch (error) {
    return { country, reason: `API request failed (${error.message})` };
  }
}

async function main() {
  const rows = [];
  // Small batches avoid treating the public APIs like a load-testing target.
  for (let i = 0; i < LDC_COUNTRIES.length; i += 5) {
    rows.push(...await Promise.all(LDC_COUNTRIES.slice(i, i + 5).map(auditCountry)));
  }

  const available = rows.filter(row => Number.isFinite(row.rate));
  const unavailable = rows.filter(row => !Number.isFinite(row.rate));
  const invalid = available.filter(row => row.rate < 0 || row.rate > 1
    || row.sanitationPct < 0 || row.sanitationPct >= 100 || row.exposed <= 0);

  console.log(`Countries checked: ${rows.length}`);
  console.log(`Conservative sanitation DALY estimate available: ${available.length}/${rows.length}`);
  if (available.length) {
    const rates = available.map(row => row.rate).sort((a, b) => a - b);
    const malawi = available.find(row => row.country.code === 'MWI');
    console.log(`Rate range: ${rates[0].toFixed(7)} to ${rates.at(-1).toFixed(7)} DALY/person/year`);
    if (malawi) console.log(`Malawi ${malawi.year}: ${malawi.rate.toFixed(7)} DALY/person/year`);
  }
  if (unavailable.length) {
    console.log(`Unavailable (app resets DALY factor to zero):\n- ` +
      unavailable.map(row => `${row.country.name}: ${row.reason}`).join('\n- '));
  }
  if (invalid.length) {
    console.error(`Invalid derived values:\n- ` +
      invalid.map(row => `${row.country.name}: ${row.rate}`).join('\n- '));
    process.exitCode = 1;
  } else {
    console.log('All returned derivations pass semantic range checks.');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

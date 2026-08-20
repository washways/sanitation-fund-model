/**
 * startup.test.js — what does a user actually see on load?
 *
 * WHY THIS EXISTS
 * ---------------
 * The other suites test the model against `tools/baseline-inputs.js`, which mirrors the
 * `value=""` attributes in index.html. That turns out to be a scenario **no user ever
 * runs**: the app auto-fetches country data half a second after load and overwrites
 * most of the form with World Bank values and hardcoded heuristics.
 *
 * So a carefully tuned set of shipped defaults can be — and was — verified green in
 * every test while the browser opened on something entirely different, and failing.
 *
 * This suite drives the real fetch handler against recorded World Bank responses and
 * asserts on the scenario that results. It is the only test that answers "does the
 * thing a user opens actually work?".
 *
 * The fixture is recorded, never live: tests must not depend on an external API's
 * uptime, and country data changing under us should be a deliberate re-record with a
 * visible diff, not a silent test failure on a Tuesday.
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'worldbank-malawi.json'), 'utf8'));

/**
 * Boot the app with a DOM stub, a stubbed World Bank API, and controllable timers.
 * Returns handles plus a `runStartup()` that performs the load sequence the browser
 * performs: fire DOMContentLoaded, run the deferred timers, await the fetch.
 */
function bootApp() {
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  const ids = new Set([...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(m => m[1]));
  const values = {};
  for (const m of html.matchAll(/<input[^>]*id="([A-Za-z0-9_-]+)"[^>]*>/g)) {
    const v = m[0].match(/value="([^"]*)"/);
    values[m[1]] = v ? v[1] : '';
  }

  const store = {};
  const listeners = {};
  const el = (id) => store[id] || (store[id] = {
    id,
    // A real <input> coerces whatever you assign to a string. The app assigns numbers
    // in places, so the stub has to do the same or getInputs() sees a type it never
    // sees in a browser.
    _v: String(values[id] ?? ''),
    get value() { return this._v; },
    set value(x) { this._v = String(x); },
    innerText: '', innerHTML: '',
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, contains: () => false },
    dataset: {},
    addEventListener(type, fn) { (listeners[id] = listeners[id] || {})[type] = fn; },
    dispatchEvent() {},
    appendChild() {}, insertAdjacentElement() {}, remove() {},
    click() { const h = listeners[id] && listeners[id].click; if (h) return h({ isTrusted: true }); },
    querySelectorAll: () => [],
    getContext: () => ({}),
  });

  const timers = [];
  let domReady = null;

  const document = {
    body: el('body'),
    addEventListener(type, fn) { if (type === 'DOMContentLoaded') domReady = fn; },
    querySelector: (s) => (s === '.top-actions' ? el('__topActions') : null),
    querySelectorAll: () => [],
    getElementById: (id) => (ids.has(id) ? el(id) : null),
    createElement: () => el('__created' + Math.random()),
  };

  /** Serve the recorded indicator values; refuse anything else, loudly. */
  const stubFetch = (url) => {
    const m = String(url).match(/indicator\/([A-Z0-9.]+)\?/);
    if (m) {
      const rec = FIXTURE.indicators[m[1]];
      if (!rec) return Promise.reject(new Error(`no fixture for indicator ${m[1]}`));
      return Promise.resolve({
        json: () => Promise.resolve([{}, rec.value === null ? [] : [{ value: rec.value, date: rec.year }]])
      });
    }
    // countriesnow.space administrative units — this call SUCCEEDS in a browser and
    // sets both the district count and the operating-cost formula, so the fixture has
    // to include it or the test is not exercising what a user sees.
    if (String(url).includes('countriesnow.space')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          data: { states: FIXTURE.administrativeUnits.names.map(name => ({ name })) }
        })
      });
    }
    return Promise.reject(new Error('not in fixture'));
  };

  const sandbox = {
    document,
    window: { addEventListener() {} },
    console: { log() {}, warn() {}, error() {}, info() {} },
    fetch: stubFetch,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout() {},
    structuredClone, Intl,
    Event: function Event() {},
    alert() {},
    Chart: function Chart() { return { destroy() {}, update() {} }; },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;globalThis.__x = { UI, ModelModule, runCalculation };', sandbox, { filename: 'app.js' });

  async function runStartup() {
    if (domReady) domReady();
    // Drain deferred work in scheduled order, as the browser would.
    for (let pass = 0; pass < 5; pass++) {
      const batch = timers.splice(0).sort((a, b) => a.ms - b.ms);
      for (const t of batch) { try { await t.fn(); } catch { /* handler reports its own */ } }
      await new Promise(r => setImmediate(r));
      if (timers.length === 0) break;
    }
  }

  return { ...sandbox.__x, el, ids, runStartup };
}

describe('startup — the scenario a user actually opens', () => {
  let app, inputs, result;

  before(async () => {
    app = bootApp();
    await app.runStartup();
    inputs = app.UI.getInputs();
    result = app.ModelModule.calculate({ ...inputs, enableBreakEvenSolver: false, verify: true });
  });

  test('country data reaches the form', () => {
    // Observed data should land: these are facts about Malawi, not policy choices.
    assert.ok(Math.abs(inputs.inflationRate - 0.2837) < 0.001,
      `inflation ${inputs.inflationRate} should come from the fixture (28.37%)`);
    assert.ok(Math.abs(inputs.popGrowthRate - 0.0256) < 0.001,
      `population growth ${inputs.popGrowthRate} should come from the fixture (2.56%)`);
    assert.strictEqual(inputs.avgAnnualIncome, 600, 'income should come from GNI per capita');
    assert.ok(inputs.popReqToilets > 1e6, 'target population should be derived from rural population and the gap');
    assert.strictEqual(inputs.districts, FIXTURE.administrativeUnits.count,
      'district count should come from the administrative-units lookup');
  });

  test('the fetch does not overwrite negotiated terms with market observables', () => {
    // The fund's cost of capital is a term sheet, not a market rate. Seeding it from
    // the commercial lending rate (37.1% in Malawi) modelled a blended-finance vehicle
    // borrowing commercially, which contradicts the premise of the instrument.
    assert.ok(inputs.fundCostOfCapital <= 0.10,
      `fundCostOfCapital is ${(inputs.fundCostOfCapital * 100).toFixed(1)}% — the fetch must not ` +
      `overwrite the concessional default with the commercial lending rate ` +
      `(${FIXTURE.indicators['FR.INR.LEND'].value.toFixed(1)}%)`);

    // Grant support is a policy lever. The poverty headcount is evidence that subsidy
    // is needed, not an instruction to set the dial to 75%.
    assert.ok(inputs.grantSupportPct <= 0.50,
      `grantSupportPct is ${(inputs.grantSupportPct * 100).toFixed(0)}% — the poverty headcount ` +
      `should inform the user, not drive the parameter`);
  });

  test('the model is internally consistent on the startup scenario', () => {
    assert.strictEqual(result.integrity.ok, true,
      `integrity violations at startup: ${result.integrity.violations.join('; ')}`);
  });

  test('the fund a user opens on is viable', () => {
    const f = result.kpis.impact.financials;
    const minCash = Math.min(...result.series.dataMonthlyCashBalance);
    assert.strictEqual(result.viability.ok, true,
      `the startup scenario must work. Issues: ` +
      result.viability.issues.map(i => `${i.code} — ${i.text}`).join(' | ') +
      `\n  inflation ${(inputs.inflationRate * 100).toFixed(1)}%` +
      `  HH rate ${(inputs.loanInterestRate * 100).toFixed(1)}%` +
      `  CoC ${(inputs.fundCostOfCapital * 100).toFixed(1)}%` +
      `  ops $${inputs.annualFixedOpsCost.toLocaleString()}` +
      `  grant ${(inputs.grantSupportPct * 100).toFixed(0)}%` +
      `  termHh ${inputs.termHh}m` +
      `\n  minCash $${Math.round(minCash).toLocaleString()}` +
      `  repaid ${(f.investorRepaidPct * 100).toFixed(1)}%`);
  });

  test('the household rate stays inside plausible microfinance pricing', () => {
    // updateSmartRates derives this from inflation and the lending benchmark. In a
    // high-inflation country that arithmetic can run away; a rate no lender would
    // charge makes the whole scenario unbelievable even if it balances.
    assert.ok(inputs.loanInterestRate <= 0.80,
      `HH rate ${(inputs.loanInterestRate * 100).toFixed(1)}% is beyond credible microfinance pricing`);
    assert.ok(inputs.loanInterestRate > inputs.inflationRate,
      `HH rate ${(inputs.loanInterestRate * 100).toFixed(1)}% must exceed inflation ` +
      `${(inputs.inflationRate * 100).toFixed(1)}% or the fund erodes capital on every loan`);
  });
});

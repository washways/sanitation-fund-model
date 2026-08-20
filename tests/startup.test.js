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

  // Element tag names matter: the app branches on tagName to decide how to populate
  // the country selector, and a stub that reports the wrong tag silently skips code
  // the browser runs. Parse them out of the markup rather than assuming <input>.
  const tags = {};
  for (const m of html.matchAll(/<(input|select|textarea|button|canvas|div|span|small)\s[^>]*id="([A-Za-z0-9_-]+)"/g)) {
    tags[m[2]] = m[1].toUpperCase();
  }

  const values = {};
  for (const m of html.matchAll(/<input[^>]*id="([A-Za-z0-9_-]+)"[^>]*>/g)) {
    const v = m[0].match(/value="([^"]*)"/);
    values[m[1]] = v ? v[1] : '';
  }

  const store = {};
  const listeners = {};
  const timers = [];
  const pending = [];   // promises returned by handlers, which the app itself discards
  const el = (id) => store[id] || (store[id] = {
    id,
    tagName: tags[id] || 'DIV',
    children: [],
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
    appendChild(child) { this.children.push(child); },
    insertAdjacentElement() {}, remove() {},
    click() {
      const h = listeners[id] && listeners[id].click;
      if (!h) return;
      // The app fires this from a timer and discards the promise, so the harness has
      // to hold on to it or the drain finishes before the fetch does.
      const r = h({ isTrusted: true });
      if (r && typeof r.then === 'function') pending.push(r);
      return r;
    },
    querySelectorAll: () => [],
    getContext: () => ({}),
  });

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
    alert: (m) => { console.error('APP ALERT:', String(m)); },
    Chart: function Chart() { return { destroy() {}, update() {} }; },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;globalThis.__x = { UI, ModelModule, runCalculation };', sandbox, { filename: 'app.js' });

  /**
   * Reproduce the browser's load sequence: fire DOMContentLoaded, then drain the
   * deferred work in scheduled order until it stops producing more.
   *
   * Draining has to account for handlers the app fires and then forgets — the country
   * fetch is started from a timer with its promise discarded, so waiting only on the
   * timer callback returns before any data has arrived. `pending` captures those.
   */
  async function runStartup() {
    if (domReady) domReady();
    for (let pass = 0; pass < 12; pass++) {
      const batch = timers.splice(0).sort((a, b) => a.ms - b.ms);
      for (const t of batch) {
        try { await t.fn(); } catch { /* the app reports its own failures */ }
      }
      while (pending.length) {
        const inFlight = pending.splice(0);
        await Promise.allSettled(inFlight);
      }
      await new Promise(r => setImmediate(r));
      if (timers.length === 0 && pending.length === 0) break;
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

  test('the country selector offers every country, not just the default', () => {
    // This was an <input list="countryList"> with value="Malawi" pre-filled. Browsers
    // filter a datalist against whatever is already in the field, so the dropdown
    // showed a single entry and the tool read as a Malawi-only model. A user reported
    // it as "nothing in the drop down".
    const select = app.el('countryInput');
    assert.strictEqual(select.tagName, 'SELECT',
      'the country control must be a <select>; a datalist hides its own options');
    assert.ok(select.children.length >= 40,
      `only ${select.children.length} countries offered — the selector should list them all`);

    const labels = select.children.map(o => o.textContent);
    assert.ok(labels.some(l => l.startsWith('Malawi')), 'Malawi should be present');
    assert.ok(labels.some(l => l.startsWith('Bangladesh')), 'the list should reach beyond the default');
    assert.ok(labels.every(l => /\([A-Z]{3}\)$/.test(l)),
      'each option should show its ISO code, so the fetch target is unambiguous');
    assert.strictEqual(select.value, 'Malawi', 'the default selection should still be Malawi');
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

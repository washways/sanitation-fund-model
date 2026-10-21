/**
 * smoke.test.js — does the whole app actually run?
 *
 * Eight of this project's first fifteen commits are "Fix TypeError: ..." — each a
 * crash in the render path, found by a user in a browser. The model tests cannot
 * catch those, because the model was fine; the UI reading it was not.
 *
 * This suite drives the real controller (`runCalculation`) against a DOM stub built
 * from the actual ids and default values in index.html. It is not a rendering test —
 * it asserts nothing about what appears on screen — but it does prove that clicking
 * Recalculate on a fresh page does not throw, which is the failure this codebase has
 * shipped most often.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { concatenated } = require('../tools/app-source');

const ROOT = path.join(__dirname, '..');

/** Build a DOM stub whose ids and default values mirror index.html exactly. */
function makeApp() {
  const src = concatenated();
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  const ids = new Set([...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(m => m[1]));

  // The app branches on tagName (e.g. to populate the country <select>), so the stub
  // has to report the real tag or it silently skips code the browser runs.
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
  const el = (id) => store[id] || (store[id] = {
    id,
    tagName: tags[id] || 'DIV',
    children: [],
    _v: String(values[id] ?? ''),
    get value() { return this._v; },
    set value(x) { this._v = String(x); },
    innerText: '', innerHTML: '',
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, contains: () => false },
    dataset: {},
    addEventListener() {}, dispatchEvent() {},
    appendChild(child) { this.children.push(child); },
    insertAdjacentElement() {}, click() {}, remove() {},
    querySelectorAll: () => [],
    getContext: () => ({}),
  });

  const alerts = [];
  const chartConfigs = [];
  const document = {
    body: el('body'),
    addEventListener() {},
    querySelector: (s) => {
      if (s === '.top-actions') return el('__topActions');
      if (s === '#monthlyDataTable thead') return el('__monthlyDataHead');
      return null;
    },
    querySelectorAll: () => [],
    getElementById: (id) => (ids.has(id) ? el(id) : null),
    createElement: () => el('__created' + Math.random()),
  };

  const sandbox = {
    document,
    window: { addEventListener() {} },
    console: { log() {}, warn() {}, error() {}, info() {} },
    fetch: () => Promise.reject(new Error('no network in tests')),
    setTimeout: () => 0, clearTimeout() {},
    structuredClone, Intl,
    Event: function Event() {},
    alert: (m) => alerts.push(String(m)),
    Chart: function Chart(_context, config) {
      chartConfigs.push(config);
      return { destroy() {}, update() {} };
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;globalThis.__x = { UI, ModelModule, runCalculation };', sandbox, { filename: 'app-bundle.js' });

  return { ...sandbox.__x, alerts, chartConfigs, el, ids };
}

describe('application smoke', () => {
  test('getInputs() reads the shipped defaults out of index.html', () => {
    const { UI } = makeApp();
    const inputs = UI.getInputs();

    assert.strictEqual(inputs.investGrant, 1000000);
    assert.strictEqual(inputs.investLoan, 4000000);
    assert.strictEqual(inputs.duration, 5);
    // F-01: this used to be silently absent and therefore always 0.
    assert.ok('fundCostOfCapital' in inputs, 'fundCostOfCapital missing from inputs');
    // F-07: the hours assumption is now a real input, not a constant in two formulas.
    assert.strictEqual(inputs.hoursPerPersonPerDay, 0.25);

    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'number') {
        assert.ok(Number.isFinite(value), `${key} parsed as ${value}`);
      }
    }
  });

  test('runCalculation() completes without throwing', () => {
    const { runCalculation } = makeApp();
    assert.doesNotThrow(() => runCalculation(true));
  });

  test('runCalculation() does not pop an alert on a normal run', () => {
    // runCalculation catches its own exceptions and reports them via alert(), so an
    // alert here means something threw inside the render path.
    const { runCalculation, alerts } = makeApp();
    runCalculation(true);
    assert.deepStrictEqual(alerts, [], `unexpected alert: ${alerts[0]}`);
  });

  test('a blank required value stops calculation instead of restoring a hidden fallback (F-46)', () => {
    const app = makeApp();
    app.el('avgHHSize').value = '';
    app.runCalculation(true);

    assert.strictEqual(app.UI.lastResults, null,
      'an invalid recalculation must clear the previous result rather than leave it exportable');
    assert.strictEqual(app.alerts.length, 1, 'the user must receive one visible validation message');
    assert.match(app.alerts[0], /Avg Household Size/);
  });

  test('the controller does not write back into the user\'s inputs (F-04, F-05)', () => {
    // This is the whole point of Stage 2. The auto-solver used to cut grantSupportPct
    // up to five times per click, and updateSmartRates overwrote both interest rates,
    // so the scenario on screen was not the scenario entered.
    const app = makeApp();
    const watched = ['grantSupportPct', 'loanInterestRate_v2', 'meLoanInterestRate_v2',
      'fundRepaymentTerm', 'wiz-duration-sidebar', 'investGrant', 'annualFixedOpsCost'];

    const before = {};
    for (const id of watched) if (app.ids.has(id)) before[id] = app.el(id).value;

    app.runCalculation(true);

    const changed = Object.keys(before).filter(id => app.el(id).value !== before[id]);
    assert.deepStrictEqual(changed, [],
      `runCalculation rewrote the user's input(s): ` +
      changed.map(id => `${id}: "${before[id]}" -> "${app.el(id).value}"`).join(', '));
  });

  test('the shipped defaults produce a viable fund', () => {
    // Decided 2026-08-20 (ADR-0013): a new user should open the tool on a scenario
    // that works. The previous defaults went insolvent in year 4 and defaulted on
    // 18.7% of senior debt while displaying a green tick.
    const { ModelModule } = makeApp();
    const BASE = require('../tools/baseline-inputs');
    const r = ModelModule.calculate({ ...BASE, verify: true });

    assert.strictEqual(r.integrity.ok, true,
      `integrity violations on the shipped defaults: ${r.integrity.violations.join('; ')}`);
    assert.strictEqual(r.viability.ok, true,
      `the shipped defaults must be viable: ${r.viability.issues.map(i => i.code).join(', ')}`);
    assert.ok(r.kpis.financials.investorRepaidPct >= 0.999, 'senior debt must be repaid in full');
    assert.ok(Math.min(...r.series.dataMonthlyCashBalance) >= 0, 'the fund must never go cash-negative');
  });

  test('computeKPIs is flat and idempotent — calling UI.updateKPIs twice does not corrupt it (F-14, ADR-0028)', () => {
    // Before ADR-0028, updateKPIs destructured kpis.impact and overwrote k.financials /
    // k.sustainability / k.portfolio / k.value / k.impact on every call. The second call
    // destructured a k.impact that the FIRST call had already replaced with just the
    // small {dalys, valHours, ...} group, so everything reset to {}. Calling the render
    // path twice on the same result (a second recalculation, a second export) used to
    // corrupt it silently.
    const app = makeApp();
    app.runCalculation(true);
    const results = app.UI.lastResults;
    assert.ok(results && results.kpis, 'runCalculation should have produced a result');

    // The shape itself: no redundant nesting. financials/sustainability/portfolio/value
    // are direct properties of kpis, not of kpis.impact.
    assert.ok(results.kpis.financials, 'kpis.financials should exist directly');
    assert.ok(results.kpis.sustainability, 'kpis.sustainability should exist directly');
    assert.ok(!('financials' in results.kpis.impact),
      'kpis.impact should hold only dalys/hours/carbon, not a nested financials group');

    const netAssetsBefore = results.kpis.financials.netAssets;
    app.UI.updateKPIs(results); // second call, same object
    assert.strictEqual(results.kpis.financials.netAssets, netAssetsBefore,
      'calling updateKPIs a second time must not corrupt kpis.financials');
    assert.ok(Object.keys(results.kpis.financials).length > 0,
      'kpis.financials must not have been reset to {} by a second render');
  });

  test('a failing scenario is reported as failing, not verified (F-29)', () => {
    // The counterpart: the model must still say so when a fund does not work. This is
    // the defect that let the other 32 survive — a green tick on an insolvent fund.
    const { ModelModule } = makeApp();
    const BASE = require('../tools/baseline-inputs');
    const r = ModelModule.calculate({ ...BASE, annualFixedOpsCost: 900000, verify: true });

    // The arithmetic is still sound. The fund is not. Those are different claims.
    assert.strictEqual(r.integrity.ok, true, 'integrity should hold even on a failing fund');
    assert.strictEqual(r.viability.ok, false);
    assert.ok(r.viability.issues.some(i => i.code === 'INSOLVENT'));
    assert.ok(r.viability.issues.some(i => i.code === 'DEBT_UNREPAID'));
    for (const issue of r.viability.issues) {
      assert.ok(issue.text && issue.text.length > 20,
        `issue ${issue.code} has no human-readable explanation`);
    }
  });

  test('solvency advice is model-tested and never suggests a longer term (F-32)', () => {
    const { ModelModule } = makeApp();
    const BASE = require('../tools/baseline-inputs');
    const advice = ModelModule.suggestSolvencyFix({ ...BASE, verify: false }, 749981);

    assert.ok(advice.noneWork || advice.options.length > 0);
    for (const o of advice.options) {
      assert.notStrictEqual(o.field, 'fundRepaymentTerm',
        'extending the repayment term measurably reduces repayment in this model');
      assert.ok(o.repaidPct > advice.basePaidPct,
        `${o.label} was offered but does not improve repayment`);
      assert.ok(o.repaidPct <= 1.0001,
        `${o.label} reports ${(o.repaidPct * 100).toFixed(1)}% repaid — over 100% means the ` +
        `denominator is the wrong loan amount`);
    }
  });

  test('monthly table aligns its columns and reports exact ME launches (F-49, ADR-0040)', () => {
    const app = makeApp();
    app.runCalculation(true);
    const s = app.UI.lastResults.series;
    const inputs = app.UI.lastResults.inputs;

    assert.ok(Array.isArray(s.dataMonthlyNewMes),
      'the simulation must expose the exact monthly ME launch count');
    assert.strictEqual(s.dataMonthlyNewMes.length, s.monthlyLabels.length);

    const capitalPerMe = app.ModelModule.meCapitalRequirement(inputs);
    let expansionMonths = 0;
    for (let i = 0; i < s.monthlyLabels.length; i++) {
      if (s.dataMonthlyNewMes[i] > 0) expansionMonths++;
      assert.ok(Math.abs(
        s.dataMonthlyNewLoansMeVal[i] - (s.dataMonthlyNewMes[i] * capitalPerMe)
      ) < 0.01, `M${i + 1}: ME loan value must reconcile to the exact launch count`);
    }
    assert.ok(expansionMonths > 0, 'control scenario must exercise in-loop ME expansion');

    const header = app.el('__monthlyDataHead').innerHTML;
    const headerCells = (header.match(/<th\b/g) || []).length;
    assert.match(header, />New MEs</);
    assert.match(header, />New ME Loans</);

    const rows = [...app.el('monthlyDataBody').innerHTML.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
    assert.ok(rows.length > 1, 'monthly table should include startup and monthly rows');
    for (const [, row] of rows) {
      const dataCells = (row.match(/<td\b/g) || []).length;
      assert.strictEqual(dataCells, headerCells,
        `monthly table row has ${dataCells} cells under ${headerCells} headers`);
    }
  });

  test('annual cash-flow chart uses annual grant spending as an outflow (F-51, ADR-0042)', () => {
    const app = makeApp();
    app.runCalculation(true);

    const config = app.chartConfigs.find(c =>
      c.options?.plugins?.title?.text === 'Annual Cash Flow Breakdown');
    assert.ok(config, 'the annual cash-flow chart configuration must be rendered');
    const grants = config.data.datasets.find(dataset => dataset.label === 'Grants');
    assert.ok(grants, 'the annual cash-flow chart must include material grant spending');

    const actual = Array.from(grants.data);
    const expected = Array.from(app.UI.lastResults.series.dataGrants, value => -value);
    assert.deepStrictEqual(actual, expected,
      'annual grant spending must be negated once, not differenced as if cumulative');
    assert.ok(actual.every(value => value <= 0),
      'grant spending must never appear as a positive cash inflow');
  });

  test('impact selections report jobs and an unevidenced carbon factor honestly (F-56, F-58, ADR-0049)', () => {
    const app = makeApp();
    app.runCalculation(true);

    app.UI.renderCharts(app.UI.lastResults.series, 'jobs');
    const jobsChart = [...app.chartConfigs].reverse().find(config =>
      /Jobs Supported/.test(config.options?.plugins?.title?.text || ''));
    assert.ok(jobsChart, 'selecting jobs must render a jobs-supported impact chart');
    const jobsData = Array.from(jobsChart.data.datasets[0].data);
    assert.match(jobsChart.data.datasets[0].label, /Jobs Supported/);
    assert.strictEqual(jobsData.at(-1), app.UI.lastResults.kpis.reach.jobs,
      'the jobs chart must use the same explicit staffing assumption as the headline');
    assert.ok(jobsData.at(-1) > 0, 'the default jobs series must not be blank or zero');

    assert.strictEqual(app.el('sum-carbon').innerText, 'Not estimated',
      'a zero project carbon factor must not be presented as measured zero mitigation');
    assert.strictEqual(app.el('sum-val-carbon').innerText, 'Project factor required');

    app.UI.renderCharts(app.UI.lastResults.series, 'carbon');
    const carbonChart = [...app.chartConfigs].reverse().find(config =>
      /Carbon Not Estimated/.test(config.options?.plugins?.title?.text || ''));
    assert.ok(carbonChart, 'selecting carbon with no factor must render the limitation');
    assert.match(carbonChart.data.datasets[0].label, /Not Estimated.*Project Factor Required/i);
  });

  test('a valid six-month scenario still renders period charts (F-52, ADR-0043)', () => {
    const app = makeApp();
    app.el('wiz-duration-sidebar').value = '0.5';
    app.runCalculation(true);

    assert.deepStrictEqual(Array.from(app.UI.lastResults.series.labels), ['Year 1 (6 months)']);
    assert.ok(app.chartConfigs.length >= 4,
      'the chart renderer must not exit just because the horizon is shorter than one year');
  });
});

/**
 * export.test.js — does UI.downloadCSV() actually work? (F-36)
 *
 * `UI.downloadCSV()` was defined twice in the source. JavaScript silently ran the
 * second and discarded the first; both threw when called, and nothing in the suite
 * called either one, so the defect shipped with a fully green build. See
 * docs/ANALYSIS.md#f-36 and docs/adr/0026-restore-the-detailed-csv-export.md.
 *
 * This test drives the real function against a real calculation result and a DOM
 * stub that actually implements `setAttribute` on the elements it creates (the smoke
 * suite's stub does not need to, because nothing it exercises calls it — this is
 * exactly the kind of gap AGENTS.md warns about: "a stub that quietly differs from a
 * browser produces green tests for code the browser never runs").
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function makeApp() {
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  const ids = new Set([...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(m => m[1]));
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
  const createdLinks = [];
  const el = (id, isCreated) => store[id] || (store[id] = {
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
    attrs: {},
    setAttribute(k, v) {
      const firstAttr = Object.keys(this.attrs).length === 0;
      this.attrs[k] = v;
      if (isCreated && firstAttr) createdLinks.push(this);
    },
    addEventListener() {}, dispatchEvent() {},
    appendChild(child) { this.children.push(child); },
    removeChild(child) { this.children = this.children.filter(c => c !== child); },
    insertAdjacentElement() {}, click() {}, remove() {},
    querySelectorAll: () => [],
    getContext: () => ({}),
  });

  const document = {
    body: el('body'),
    addEventListener() {},
    querySelector: (s) => (s === '.top-actions' ? el('__topActions') : null),
    querySelectorAll: () => [],
    getElementById: (id) => (ids.has(id) ? el(id) : null),
    createElement: () => el('__created' + Math.random(), true),
  };

  const alerts = [];
  const sandbox = {
    document,
    window: { addEventListener() {} },
    console: { log() {}, warn() {}, error() {}, info() {} },
    fetch: () => Promise.reject(new Error('no network in tests')),
    setTimeout: () => 0, clearTimeout() {},
    structuredClone, Intl,
    Event: function Event() {},
    alert: (m) => alerts.push(String(m)),
    Chart: function Chart() { return { destroy() {}, update() {} }; },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;globalThis.__x = { UI, ModelModule, runCalculation };', sandbox, { filename: 'app.js' });

  return { ...sandbox.__x, alerts, createdLinks };
}

describe('CSV export (F-36)', () => {
  test('UI.downloadCSV() does not throw, and produces exactly one CSV', () => {
    const app = makeApp();
    app.runCalculation(true); // populates UI.lastResults, same as clicking Recalculate
    assert.deepStrictEqual(app.alerts, [], `runCalculation alerted: ${app.alerts[0]}`);

    assert.doesNotThrow(() => app.UI.downloadCSV());

    assert.strictEqual(app.createdLinks.length, 1,
      `expected exactly one downloadable link created, got ${app.createdLinks.length}`);
    const link = app.createdLinks[0];
    assert.strictEqual(link.attrs.download, 'model_debug_data.csv');
    assert.ok(link.attrs.href.startsWith('data:text/csv'), 'href should be a CSV data URI');
  });

  test('the exported CSV contains real figures from the run, not placeholders', () => {
    const app = makeApp();
    app.runCalculation(true);
    app.UI.downloadCSV();

    const href = app.createdLinks[0].attrs.href;
    const csv = decodeURIComponent(href.replace('data:text/csv;charset=utf-8,', ''));

    assert.ok(!csv.includes('$undefined'), 'CSV should not contain "$undefined" (F-13-class bug)');
    assert.ok(!csv.includes('NaN'), 'CSV should not contain NaN');
    assert.ok(csv.includes('Month,Constraint'), 'CSV should have the monthly data header row');

    // The parameter block should reflect the actual initial grant capital entered,
    // not an undefined `inputs.grantFund` (the field is `investGrant`).
    const inputs = app.UI.getInputs();
    assert.ok(csv.includes(`GrantFund,$${inputs.investGrant}`),
      'CSV parameter block should show the real grant capital, not $undefined');
  });

  test('UI.downloadCSV() is defined exactly once', () => {
    // The regression this test exists to prevent: two definitions of the same key in
    // an object literal, where JavaScript silently keeps the second and no test ever
    // called either one. `no-dupe-keys` (F-19) catches this statically; this asserts
    // it dynamically too, so a static-analysis regression here also fails `npm test`.
    const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const matches = src.match(/^\s{4}downloadCSV\(\)\s*\{/gm) || [];
    assert.strictEqual(matches.length, 1,
      `downloadCSV() is defined ${matches.length} times in app.js — should be exactly 1`);
  });
});

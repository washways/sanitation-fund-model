const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const INPUTS = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'inputs.js'), 'utf8');
const PARAMETERS = fs.readFileSync(path.join(ROOT, 'docs', 'PARAMETERS.md'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const METHODOLOGY = fs.readFileSync(path.join(ROOT, 'methodology.html'), 'utf8');

test('every numeric UI input has a complete canonical parameter row', () => {
  const ids = [...INPUTS.matchAll(/get(?:Raw|Percent)\('([^']+)'/g)]
    .map(match => match[1])
    .filter((id, index, all) => all.indexOf(id) === index);
  const rows = new Map(
    PARAMETERS.split(/\r?\n/)
      .map(line => [line.match(/^\|\s*`([^`]+)`\s*\|/)?.[1], line])
      .filter(([id]) => id)
  );

  const missing = ids.filter(id => !rows.has(id));
  const incomplete = ids.filter(id => rows.has(id) && (rows.get(id).match(/\|/g) || []).length < 7);
  assert.deepStrictEqual(missing, [], `undocumented numeric inputs: ${missing.join(', ')}`);
  assert.deepStrictEqual(incomplete, [], `incomplete parameter rows: ${incomplete.join(', ')}`);
});

test('the published app links to a concise model map and calibration checklist', () => {
  assert.match(INDEX, /href="methodology\.html#model-map"[^>]*>[\s\S]*?How it works/i);
  assert.match(METHODOLOGY, /<section[^>]*id="model-map"/);
  assert.strictEqual((METHODOLOGY.match(/data-model-step=/g) || []).length, 5,
    'the at-a-glance flow must retain five explicit steps');
  assert.match(METHODOLOGY, /id="calibration-checklist"/);
  for (const phrase of ['two ledgers', 'operating reserve', 'loan cohorts',
    'integrity', 'viability', 'not a forecast', 'blue', 'amber']) {
    assert.ok(METHODOLOGY.toLowerCase().includes(phrase), `guide must explain “${phrase}”`);
  }
  assert.doesNotMatch(INDEX, /Double-Entry Audit Engine/,
    'the model is a reconciled two-ledger simulation, not double-entry accounting');
  assert.doesNotMatch(INDEX, /Interest Rates<\/em> affects demand/,
    'the model has no price-elastic demand response');
  assert.doesNotMatch(INDEX, /guarantee the Investor gets their money back/i,
    'the interface must not imply that a chosen scenario guarantees repayment');
});

test('country sanitation need is not presented as forecast borrower demand (F-64)', () => {
  assert.match(INDEX, /Need and Coverage Parameters/);
  assert.match(INDEX, /Rural Population Without Basic Sanitation/);
  assert.match(INDEX, /Share of Unserved Rural Target Reached/);
  assert.doesNotMatch(INDEX, /Pop\. Needing Toilets/);
  assert.doesNotMatch(INDEX, /SDG6 Gap Closed/);
  assert.match(METHODOLOGY, /not a demand forecast/i);
  assert.match(METHODOLOGY, /willing and able to borrow/i);
  assert.match(METHODOLOGY, /does not model[^.]*uptake/i);
});

/**
 * golden.test.js — characterisation tests.
 *
 * These lock in what the model produces *today*, bugs included. They do not
 * assert that any number is correct; they assert that no number changes by
 * accident. That is what makes refactoring safe in a codebase whose git history
 * is eight consecutive "Fix TypeError" commits.
 *
 * WHEN A GOLDEN VALUE CHANGES
 * ---------------------------
 * A failure here is not automatically a bug — it means behaviour moved. Decide
 * which, and never do the second step first:
 *
 *   1. Unintended? You broke something. Fix the code, not the golden file.
 *   2. Intended?   The ADR for your change must already predict the direction
 *                  and rough size of the move. Check the diff against that
 *                  prediction, then re-record:
 *
 *                      node tests/golden.record.js
 *
 *                  and commit the regenerated file *in the same commit* as the
 *                  change, with the ADR referenced in the message.
 *
 * Re-recording a golden file to make a red build green, without an ADR, defeats
 * the entire point of this suite.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');
const { SCENARIOS, summarise } = require('./golden.scenarios');

const GOLDEN_PATH = path.join(__dirname, 'golden.json');

describe('golden scenarios', () => {
  if (!fs.existsSync(GOLDEN_PATH)) {
    test('golden.json is missing', () => {
      assert.fail('Run `node tests/golden.record.js` to create tests/golden.json');
    });
    return;
  }

  const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));

  test('the recorded scenario set matches the one defined in code', () => {
    assert.deepStrictEqual(
      Object.keys(golden.scenarios).sort(),
      Object.keys(SCENARIOS).sort(),
      'scenarios were added or removed without re-recording — run `node tests/golden.record.js`'
    );
  });

  for (const [name, overrides] of Object.entries(SCENARIOS)) {
    test(name, () => {
      const expected = golden.scenarios[name];
      if (!expected) assert.fail(`no golden record for "${name}" — run tests/golden.record.js`);

      const actual = summarise(ModelModule.calculate({ ...BASE, ...overrides }));

      const drift = [];
      for (const key of Object.keys(expected)) {
        const e = expected[key], a = actual[key];
        if (typeof e === 'number' && typeof a === 'number') {
          // Relative tolerance for money, absolute for small counts.
          const tol = Math.max(1, Math.abs(e) * 1e-9);
          if (Math.abs(a - e) > tol) {
            const pct = e !== 0 ? ((a - e) / Math.abs(e) * 100).toFixed(2) + '%' : 'n/a';
            drift.push(`  ${key}: ${fmt(e)} -> ${fmt(a)}  (${pct})`);
          }
        } else if (e !== a) {
          drift.push(`  ${key}: ${JSON.stringify(e)} -> ${JSON.stringify(a)}`);
        }
      }

      assert.deepStrictEqual(drift, [],
        `behaviour changed in "${name}":\n${drift.join('\n')}\n\n` +
        `If this was intended, confirm the move matches your ADR's prediction, ` +
        `then re-record with \`node tests/golden.record.js\`.`);
    });
  }
});

function fmt(v) {
  if (typeof v !== 'number') return String(v);
  return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(4);
}

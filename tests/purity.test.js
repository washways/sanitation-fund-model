/**
 * purity.test.js — src/model/ has no DOM dependency (S5 rule 1, ADR-0033).
 *
 * ARCHITECTURE.md's S5 target shape requires: "src/model/ must not reference
 * `document`, `window` or `Chart`. A test enforces it." This is that test.
 *
 * Two checks, because either alone can miss things a real defect would trip:
 *   - a static scan catches an accidental reference even in a branch nothing
 *     currently exercises;
 *   - actually loading and running the model with NO stub at all (not even the
 *     minimal one `tools/load-model.js` provides) proves the static scan isn't
 *     missing something reachable only through a property access pattern the
 *     regex doesn't catch (e.g. `window['docu' + 'ment']`).
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const MODEL_FILES = ['engine.js', 'kpis.js', 'solvers.js', 'invariants.js'];

describe('src/model/ has no DOM dependency (ADR-0033)', () => {
  test('no source file mentions document, window, Chart, alert or fetch', () => {
    for (const f of MODEL_FILES) {
      const src = fs.readFileSync(path.join(ROOT, 'src', 'model', f), 'utf8');
      // Word-boundary match so this doesn't trip on substrings like "documentation".
      for (const banned of ['document', 'window', 'Chart', 'alert', 'fetch']) {
        const re = new RegExp(`\\b${banned}\\b`);
        assert.ok(!re.test(src), `src/model/${f} references "${banned}" — the model must stay DOM-free`);
      }
    }
  });

  test('the model loads and runs a full calculation with NO stub at all', () => {
    const source = MODEL_FILES
      .map(f => fs.readFileSync(path.join(ROOT, 'src', 'model', f), 'utf8'))
      .join('\n');

    // Deliberately not the DOM-stub sandbox tools/load-model.js uses — no document,
    // no window, no Chart, no fetch, no alert. If the model needs any of those to
    // finish a calculation, this fails and the static scan above missed something.
    const sandbox = { console, structuredClone };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(source + ';globalThis.__x = { ModelModule };', sandbox, { filename: 'model-only.js' });

    const { ModelModule } = sandbox.__x;
    const BASE = require('../tools/baseline-inputs');
    const result = ModelModule.calculate({ ...BASE, verify: true });

    assert.strictEqual(result.integrity.ok, true, 'the model should run cleanly with no DOM present at all');
    assert.ok(result.kpis.reach.toilets > 0, 'expected a real calculation result');
  });
});

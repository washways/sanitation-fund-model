/**
 * app-source.js — the single source of truth for how the app's files load (S5, ADR-0033).
 *
 * The app has no bundler and no module system: every file is a classic (non-module)
 * `<script>` tag, and top-level `const`/`let` bindings are shared across all of them by
 * the browser's Script Environment Record — the same way one big app.js already worked,
 * just spread across files now instead of one. index.html's `<script>` tags MUST appear
 * in this exact order, and if you add, remove or reorder a file here, update index.html
 * to match (there is no test that can see both — index.html is HTML, this is JS).
 *
 * Every test harness that used to do `fs.readFileSync('app.js')` reads this list instead,
 * via `concatenated()` — that reproduces exactly what the browser sees: one script's worth
 * of globals, visible to the next.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const FILES = [
  'src/data/worldbank.js',
  'src/data/countries.js',
  'src/data/stakeholders.js',
  'src/model/engine.js',
  'src/model/kpis.js',
  'src/model/solvers.js',
  'src/model/invariants.js',
  'src/ui/inputs.js',
  'src/ui/kpis.js',
  'src/ui/charts.js',
  'src/ui/tables.js',
  'src/ui/export.js',
  'src/ui/advisor.js',
  'src/app.js',
];

/** Absolute paths, in load order. */
function paths() {
  return FILES.map(f => path.join(ROOT, f));
}

/** All files concatenated in load order — what a browser's classic-script scope sees. */
function concatenated() {
  return paths().map(p => fs.readFileSync(p, 'utf8')).join('\n');
}

module.exports = { ROOT, FILES, paths, concatenated };

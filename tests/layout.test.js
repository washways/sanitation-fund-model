const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');

describe('responsive results layout (F-55, ADR-0048)', () => {
  test('the programme summary is not locked to three inline columns', () => {
    const resultsTag = HTML.match(/<div class="results-grid"[^>]*>/)?.[0] || '';
    assert.ok(resultsTag, 'programme summary must retain a results-grid container');
    assert.ok(!/grid-template-columns\s*:\s*repeat\(3/.test(resultsTag),
      'an inline three-column grid forces the summary off narrower viewports');
    assert.match(CSS,
      /\.results-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*20rem\),\s*1fr\)\)/s,
      'the grid must reflow from three columns to two or one based on available width');
  });

  test('summary cells wrap while only the monthly audit table stays wide', () => {
    assert.match(CSS, /\.summary-table\s*\{[^}]*table-layout:\s*fixed/s,
      'summary cards need fixed table layout so long labels cannot expand their card');
    assert.match(CSS, /\.summary-table\s+th,\s*\.summary-table\s+td\s*\{[^}]*overflow-wrap:\s*anywhere/s,
      'summary-table cells must be allowed to wrap long labels and values');
    assert.match(CSS, /#monthlyDataTable\s+th,\s*#monthlyDataTable\s+td\s*\{[^}]*white-space:\s*nowrap/s,
      'the 22-column monthly table should retain readable no-wrap cells in its scroll container');
    assert.ok(!/\.summary-table th,\s*\.summary-table td\s*\{[^}]*white-space:\s*nowrap/s.test(CSS),
      'no-wrap must not apply globally to the compact programme-summary tables');
  });

  test('the monthly audit table stays inside an auto-height card and scrolls locally', () => {
    const monthlyCard = HTML.match(/<div class="[^"]*monthly-table-card[^"]*"[^>]*>[\s\S]*?<h3>Monthly Implementation Data<\/h3>/)?.[0] || '';
    assert.ok(monthlyCard, 'Monthly Implementation Data needs its own card class');
    assert.match(CSS, /\.monthly-table-card\s*\{[^}]*height:\s*auto/s,
      'the monthly table card must override the generic fixed 400px chart height');
    assert.match(CSS, /\.monthly-table-scroll\s*\{[^}]*overflow:\s*auto/s,
      'the bounded table viewport must contain overflow on both axes');
    assert.match(CSS, /#monthlyDataTable\s+thead\s+th\s*\{[^}]*position:\s*sticky[^}]*top:\s*0/s,
      'column headings should remain visible during local vertical scrolling');
  });
});

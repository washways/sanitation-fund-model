#!/usr/bin/env node
/**
 * Reproducible sensitivity CLI (ADR-0045).
 *
 * Usage:
 *   node tools/sensitivity.js <bounds.json> [inputs.json]
 *
 * Both files must be inside this repository. With no inputs file, the shipped
 * baseline inputs are used. Output is deterministic JSON written to stdout.
 */
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./app-source');
const { ModelModule } = require('./load-model');
const BASE = require('./baseline-inputs');

function resolveInsideProject(file) {
  const resolved = path.resolve(ROOT, file);
  const relative = path.relative(ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to read outside the project: ${file}`);
  }
  return resolved;
}

function readJson(file) {
  const resolved = resolveInsideProject(file);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function main(argv) {
  if (argv.length < 1 || argv.length > 2) {
    throw new Error('Usage: node tools/sensitivity.js <bounds.json> [inputs.json]');
  }
  const specification = readJson(argv[0]);
  const inputs = argv[1] ? readJson(argv[1]) : BASE;
  const result = ModelModule.runSensitivity(inputs, specification);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}

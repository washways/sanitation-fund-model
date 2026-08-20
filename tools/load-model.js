/**
 * load-model.js — headless loader for ModelModule.
 *
 * `app.js` is a browser script: it defines `ModelModule` as a top-level `const`
 * and touches `document` / `window` at load time. This loader evaluates it in a
 * VM context with the smallest DOM stub that lets it finish, then hands back the
 * pure calculation modules.
 *
 * Nothing here may modify app.js's behaviour. If a stub ever has to *do*
 * something (rather than merely exist), that is a signal the model has grown a
 * hidden DOM dependency — fix the model, not this file.
 *
 * Usage:  const { ModelModule } = require('./tools/load-model');
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP_PATH = path.join(__dirname, '..', 'app.js');

function makeElement() {
  return {
    value: '',
    innerText: '',
    innerHTML: '',
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, contains() { return false; } },
    dataset: {},
    addEventListener() {},
    dispatchEvent() {},
    appendChild() {},
    insertAdjacentElement() {},
    click() {},
    querySelectorAll() { return []; },
  };
}

function load() {
  const source = fs.readFileSync(APP_PATH, 'utf8');

  const documentStub = {
    body: null,          // deliberately absent: rendering must degrade, not throw
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement() { return makeElement(); },
  };

  const sandbox = {
    document: documentStub,
    window: { addEventListener() {} },
    console,
    // The model core never fetches; ApiModule does, and tests must not hit the network.
    fetch: () => Promise.reject(new Error('network access is not available in tests')),
    setTimeout, clearTimeout, setInterval, clearInterval,
    structuredClone,
    Intl,
    Event: function Event() {},
    alert() {},
    Chart: function Chart() { return { destroy() {} }; },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(
    source + '\n;globalThis.__exports = { ModelModule, UI, ApiModule, LDC_COUNTRIES };',
    sandbox,
    { filename: 'app.js' }
  );

  return sandbox.__exports;
}

module.exports = load();

# CLAUDE.md

**See [AGENTS.md](AGENTS.md).** It is the working contract for this repository and applies in full.

Quick orientation:

```bash
export PATH="/c/Users/jrobertson/Repositories/node-v25.8.1-win-x64:$PATH"   # Node is not on PATH
cat STATUS.md      # where the work is
npm test           # must be green before you touch anything
```

The five rules you will get wrong if you skip AGENTS.md:

1. **[docs/MODEL_SPEC.md](docs/MODEL_SPEC.md) outranks `app.js`.** Where they disagree, the code is wrong — unless the rule is tagged `[AS-BUILT]`.
2. **Never re-record `tests/golden.json` to turn a red build green.** Behaviour moves only when an ADR predicted it. This is the most damaging thing you can do here.
3. **One roadmap stage at a time.** Found something else broken? Register it in [docs/ANALYSIS.md](docs/ANALYSIS.md) and carry on — do not fix it.
4. **Never invent a number.** Every constant is an input, a World Bank indicator, or a documented assumption in [docs/PARAMETERS.md](docs/PARAMETERS.md). If it is none of those, stop and ask.
5. **The defaults in `index.html` are not what runs.** The app auto-fetches country data 500 ms after load and overwrites most of the form. `tests/startup.test.js` is the only test that covers what a user actually sees — run it whenever you touch a default, a form control, or the fetch.

This model's outputs go into funding decisions. A plausible wrong number is worse than a crash, because nobody catches it.

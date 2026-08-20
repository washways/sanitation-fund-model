# Deployment

The app is published with **GitHub Pages**, served from the `main` branch at the
repository root:

<https://washways.org/sanitation-fund-model/>

There is no build step. Pages copies the repository as-is, which is why
[ADR-0002](adr/0002-keep-the-app-buildless.md) matters operationally as well as
philosophically: what you test locally is byte-for-byte what gets served.

## How to release

```bash
npm test                                   # must be green
npm run golden:diff                         # "No behaviour change", or re-recorded

git checkout main
git merge --no-ff <your-branch>
git push origin main
```

Pages rebuilds automatically, usually within a minute. Watch it with:

```bash
gh api repos/washways/sanitation-fund-model/pages/builds/latest --jq '.status, .error.message'
```

Then confirm the deployed copy is the one you meant to ship — a 200 is not proof
the new code is live, because the old code returns 200 too:

```bash
curl -s https://washways.org/sanitation-fund-model/ | grep -c 'select id="countryInput"'
```

Pick a string that only exists in the new version. Cache-bust with `?v=$(date +%s)`
if a browser is holding an old copy.

## Configuration

| | |
|---|---|
| Source | `main`, path `/` (classic Pages, not Actions) |
| Custom domain | Inherited from the `washways.org` apex site; this repo has no `CNAME` of its own |
| HTTPS certificate | Issued for `washways.org` and `www.washways.org` |

### `.nojekyll`

The repository root contains an empty `.nojekyll` file. Without it, Pages runs the
site through Jekyll, which applies its own exclusion rules and treats `{{ }}` and
`{% %}` in HTML as template syntax. Neither is wanted here — the site is plain
static files and should be served exactly as committed. **Do not delete it.**

## Things that will bite

- **Everything must stay relative.** The site is served from a subpath, so a leading
  `/` in any `src` or `href` resolves to `washways.org/` and 404s. A test in
  `tests/` should be added if this ever recurs.
- **Every external call must be HTTPS**, or the browser blocks it as mixed content.
  Currently: the World Bank API, `countriesnow.space`, jsDelivr and Google Fonts.
- **The World Bank API must allow cross-origin requests.** If it ever stops, country
  auto-fill fails silently and the form keeps its defaults — the app still runs, but
  users would be modelling Malawi's defaults under another country's name. Worth a
  visible warning if that day comes.
- **Chart.js is pinned with an integrity hash.** If the CDN copy ever changes, the
  browser refuses it and the page falls back to `vendor/chart.umd.min.js`. That
  fallback only works because `.nojekyll` stops Jekyll interfering with `vendor/`.

## Rolling back

Pages serves whatever is on `main`, so a rollback is an ordinary revert:

```bash
git revert --no-commit <bad-merge>..HEAD && git commit && git push origin main
```

Prefer `git revert` over force-pushing `main`: the deployed history stays readable,
and anyone who pulled in between is not stranded.

# Averex catalogues — EGGER and CLEAF

The site at https://averex.netlify.app offers separate downloadable PDFs:
- EGGER: `Averex Catalogue 2026.pdf`
- CLEAF: `CLEAF Catalogue.pdf`

Both PDFs are copied into the published `dist` folder by `scripts/build.mjs`.
The existing EGGER embedded PDF viewer and its direct PDF links are unchanged.

## Separate private download-click counters

Netlify Blobs store: **`catalogue-downloads`**
- EGGER: **`total.json`** — existing key is retained, including the existing count.
- CLEAF: **`cleaf.json`** — new separate count beginning with the first recorded CLEAF click.

From your authenticated Netlify dashboard, open the site, then **Blobs**
→ **catalogue-downloads** → the respective JSON file. The `total` field
and metadata show the click count. Neither total is publicly readable.

Only an activation of the respective download button is counted; page views,
embedded viewing, direct PDF URLs, and the EGGER viewer fallback link are not
counted. These are button-click events, not unique visitors or verified saves.
Accidental same-button double-clicks within one second are ignored.

Tracking is best-effort and never blocks a PDF download. JavaScript/network
failures, blockers, rate limits, storage errors, or a different PDF-handling
browser may affect observed downloads. The original EGGER event payload
`download` remains valid; CLEAF sends `download:cleaf`. Both use the same
existing protected Netlify Function. There is no public read/reset endpoint.

Only aggregated counts and timestamps are stored by this application.
No form, cookies, names, emails, or browsing histories are introduced. Netlify
still processes requests and applies its own infrastructure logs/rate limits.

## Development

Use Node.js 22 or newer:

```sh
npm ci
npm test
npm run build
```

Netlify uses `netlify.toml` to run tests, build `dist`, and publish the
function from `netlify/functions/track-download.mjs`. Redeployment of the
existing linked site is sufficient; no separate account or paid plan required.
The code retains the exact production-origin restriction to
`https://averex.netlify.app` and keeps preview traffic uncounted.

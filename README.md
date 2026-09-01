# Averex EGGER catalogue

## Private download-click total

Only activation of **Download Catalogue** is counted. Page views, the embedded
PDF and **View Catalogue** are not counted. The website looks and works as before.

After the first recorded click, sign in to Netlify, open this project, choose
**Blobs**, open **catalogue-downloads**, then **total.json**. The **total** value
is the click count; it is also included in that blob's metadata. Download the
JSON from the Blobs UI if a content preview is unavailable. Before the first
click the store does not exist and the count is zero. Existing Netlify team
members with appropriate access can also see it.

There is no public totals or reset API. Counts are stored in site-wide Netlify
Blobs, not GitHub or the browser, and survive redeploys. No new account or secret
is required; Netlify supplies storage access to its deployed function.

### What the number means

- Counts start when this implementation is deployed; earlier clicks cannot be recovered.
- These are recorded button clicks, not unique visitors or confirmed saved files.
- Downloading through a browser PDF viewer, visiting a direct PDF link, or using
  "Save link as" is not counted. Normal click/tap/keyboard activation is counted.
- Repeated activations within one second are ignored as accidental double-clicks.
- JavaScript/network failures, blockers, rate limits or a storage outage can
  cause missed events. The PDF download continues regardless.
- The endpoint validates production origin, method and payload, and Netlify
  limits it to 20 requests per IP/domain per minute. These controls reduce
  casual abuse, but do not prove a request came from a real person.
- Preview deployments do not count. If the production domain changes, update
  `PRODUCTION_ORIGIN` in `lib/download-counter.mjs`.

### Privacy and usage

The application stores only an aggregate total and its start/update timestamps.
It does not set cookies or store IP addresses, names, emails or browsing histories.
Netlify still processes requests and applies its own infrastructure logging and
rate limiting. Review your site's privacy disclosures as appropriate.

Function executions and Blobs reads/writes use the existing Netlify plan's
allowances and may incur usage charges. This change does not purchase or upgrade
a plan. Monitor usage in Netlify.

## Development and deployment

Use Node.js 22 or newer:

```sh
npm ci
npm test
npm run build
```

Netlify runs the tests/build, publishes the allowlisted assets in `dist`, and
bundles `netlify/functions/track-download.mjs` separately. The root PDF and logo
remain the source assets. Only the tracking script and its script tag are added
to the public page; styles, PDF links and layout are unchanged.

To disable tracking, remove the `download-tracking.js` script tag from
`index.html` and redeploy. Existing totals stay private in Blobs.

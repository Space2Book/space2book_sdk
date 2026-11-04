# Contributing

Work only in this SDK repository; treat the backend as read-only reference.
Use Node.js 22.13+ or 24 and `npm ci`. The runtime has zero dependencies.

```sh
npm run typecheck
npm run lint
npm test
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
npm run release
npm pack --dry-run --ignore-scripts
```

`npm test` builds first. Use the full browser matrix where available and report
unavailable browsers honestly. jsdom is not evidence of browser security or
cookie behavior. Browser fixtures need OpenSSL and two local HTTPS ports.
See [testing](docs/testing.md) and [manual publication](docs/distribution.md).

Keep the existing factory/singleton, Shadow DOM and adapter architecture. Preserve
SSR-safe imports, safe HTTPS URLs, exact origin/source/channel checks, translated
UI in all five locales, conservative form states and central close coordination.
Do not replace active forms or route normal dismissal through `destroy()`.

Read the real EMBED-1 contract before implementing a production adapter. Never
invent endpoints, wire names or credentials; never embed a public `/bf/` page.
Keep fixtures explicitly marked. Backend authorization and booking logic stay in
the backend. No secrets, raw iframe data or personal details belong in hostevents.

Use `destroy()` on programmatic handles when removing framework components.
Declarative observers clean up removed elements. Choose the public API for future
wrappers; no separate framework booking implementation is needed.

Release files are prepared locally, not published automatically. Versioned paths
must remain immutable. GitHub is not the CDN origin; do not configure Bunny or the
image CDN here. See [SECURITY.md](SECURITY.md) for reporting security concerns.

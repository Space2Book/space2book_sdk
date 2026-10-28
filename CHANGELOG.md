# Changelog

## 0.1.0

Initial SDK implementation; this entry does not imply npm publication.

- Dependency-free runtime with ESM and standalone browser builds.
- `createSpace2Book(options)` factory and named `Space2Book` singleton, also
  exposed by the browser build as `window.Space2Book`.
- Modal triggers, programmatic open/close, inline mounts, direct public booking
  links, and cleanup handles.
- Localized UI for Dutch, English, German, French, and Spanish, with configurable
  branding name and hex color.
- Fail-closed embedding: without an authorized adapter, show a localized error
  and direct public booking link, with no iframe.
- Explicit HTTPS public booking URLs and same-origin authorized embed URLs.
- Optional backend-specific messaging adapter with source/origin checks and
  normalized version/channel validation; no finalized backend wire contract.
- SSR-safe ESM import; DOM-facing usage requires a browser.

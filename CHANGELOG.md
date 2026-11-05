# Changelog

## 1.1.0 — SDK-2 (unpublished)

- Automatically select the official Space2Book adapter for a 64-character lowercase
  hexadecimal integration identifier; modal and inline use the secure API embed route.
- Implement the real EMBED-1 v1 child hello / host init / verified ready protocol,
  stable per-frame instance, fresh reload channels, exact origin/source/payload checks
  and initialization and runtime language commands.
- Honor ready/completed canClose, dirty discard confirmation, definitive validation
  and identical-request retry transitions; preserve uncertain submits and recovery UI
  across reported backend security/renewal errors.
- Decode backend error codes into safe localized messages, bound inline resize,
  and retain sandbox/CSP restrictions and explicit public-link fallbacks.
- Add backend schema/fixture validation, protocol regressions and a read-only real
  backend harness with disposable MySQL, actual filters/views/services and real submit.
- Update HTML/PHP examples, declarations and documentation. No production/Bunny publication.
- Backend reference: `Space2Book/s2b_dev@b8b9c2dbe84e0033d1865d44ebda48652eba8e36`,
  `docs/integrations/webforms/embed-contract-v1.md`, protocol `space2book.embed` v1.

## 1.0.0 — SDK-1 preparation

- Preserve factory/singleton and Shadow DOM architecture; add idempotent declarative
  HTML, dynamic initialization and shared document lifecycle across bundle copies.
- Protect external links with new-tab isolation; allow embed-only integration IDs.
- Centralize all normal close routes, add five-language confirmation and conservative
  interactive, dirty, submitting, uncertain and completed state handling.
- Require verified readiness messaging, reject public-page embeds, bound resize
  events, invalidate reload contexts and retain uncertain submits.
- Add browser/ESM/declaration/CSS builds, immutable manual-release staging, lint,
  unit regressions, HTTPS browser fixtures, HTML/PHP examples and deployment docs.
- Production embedding remains disabled: EMBED-1 contract is absent.

### Review corrections

- Invoke TypeScript through the current Node executable and verify Linux/Windows builds.
- Freeze retained frames and block dismissal/fallbacks when verified state tracking is lost.
- Replace the mutable V1 alias from clean staging without leaving obsolete files.
- Keep replacement mounts registered when an obsolete handle is destroyed again.
- Synchronize submission notices with uncertainty and completion.

### Safety-related changes for custom adapters

- Adapter messaging is now required; iframe load no longer marks readiness.
- Use a separate authorized endpoint and exact embedOrigin when needed.
- Repeated open preserves the active form; concurrent modal replacement and
  singleton reconfiguration with active forms are rejected. Normal close is guarded.
- New normalized events are internal adapter events, not a production wire protocol.


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

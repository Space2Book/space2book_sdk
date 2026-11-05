# Security

Report vulnerabilities through GitHub private vulnerability reporting when enabled.
Otherwise request a private contact in a minimal issue without exploit details,
credentials or customer data. No response-time commitment is implied.

## Trust boundaries

- The SDK does not authorize users, make bookings, calculate prices, process
  payments or unlock subscriptions. The backend checks current rights and domains.
- A valid public integration token selects the official API embed route. It is
  a public identifier, never proof of authorization. Public `/bf/` pages are rejected
  as iframe endpoints. External links are explicit HTTPS new-tab user actions.
- The host checks exact HTTPS origin and its own iframe window before decoding
  protocol v1 messages. The adapter checks the pinned schema's envelope/payloads,
  child-generated channel and host-generated instance. No wildcard messaging.
- The listener exists before iframe insertion. Readiness requires actual `ready`
  after child hello and host init; load alone is insufficient. Reloads retire old
  channels. An uncertain reload never silently starts a new booking.
- Ready/completed may close; dirty requires a discard decision; submitting and
  uncertain block dismissal and public fallback. Cancel keeps the original frame.
  Normal close always uses the central coordinator; destroy is technical teardown.
- Reported backend security/renewal errors retain the last close state, live listener
  and recovery UI. A genuine loss of tracking retains the frame inert and uncertain.
  No automatic booking retries, iframe recreation, redirects or public-link navigation.
- No raw iframe messages, customer details, receipts, HMAC capabilities or CSRF
  values enter SDK callbacks. Only fixed sanitized error codes leave the core.
- The SDK uses no credentials, cookies or storage. Contexts, same-origin fetches,
  submission bodies and idempotency remain in the backend iframe. Custom adapters
  remain trusted executable code, never declarative authorization switches.

## Browser containment

Frames use `sandbox="allow-scripts allow-forms allow-same-origin allow-popups"`
and `referrerpolicy="no-referrer"`. Scripts and same-origin are required for
EMBED-1 transport. Real JavaScript form submission and a disposable external terms
popup are tested. No top navigation, download permission or popup sandbox escape
is added. Sandbox does not replace backend authorization or frame-ancestors.

Host UI uses textContent, isolated Shadow DOM and validated hex colors. There is
no eval, HTML injection or remote script injection in SDK runtime code. Strict host
CSP supplies a response-specific style nonce; no unsafe-inline is required.
The host allows its SDK script and https://api.space2book.com in frame-src.

An initially refused cross-origin HTML document cannot safely report a specific
code; CSP and missing CORS prevent the SDK reading its HTTP body. Timeout is the
honest result. The SDK never probes with an unprotected alternate API.

See [backend contract](docs/backend-contract.md) and [test boundaries](docs/testing.md)
for exact provenance, real-backend evidence and browser/provider limitations.

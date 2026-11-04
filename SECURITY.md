# Security

## Reporting a vulnerability

Do not post exploit details, credentials, customer information, or sensitive
booking data in a public issue or pull request.

If GitHub private vulnerability reporting is enabled for this repository, use
the repository's **Security → Report a vulnerability** option. Its availability
is not assumed. Otherwise, open a minimal public issue requesting a private
security contact **without vulnerability details**, then wait for a maintainer
to provide a private channel. No security email address or private repository is
designated here.

In the private report, include the affected version, prerequisites, impact, and
a minimal reproduction with synthetic data. Remove all real secrets and
personal data. Version 0.1.0 is the initial implementation; no broader supported
release range or response-time commitment is implied.

## Trust boundaries

- The SDK does not authorize users, make bookings, calculate prices, process
  payments or unlock subscriptions. The backend enforces all rights and domains.
- Public links require absolute HTTPS URLs without credentials and open with
  `target="_blank" rel="noopener noreferrer"`. A direct link needs no integration.
- Production embedding is disabled pending the verified EMBED-1 contract. An
  integration identifier alone never creates a frame. No public `/bf/` fallback.
- Custom adapters are trusted executable code, not an authorization switch.
  Embeds must use their exact configured HTTPS origin and be cross-origin from
  the host. Public booking pages and the public URL itself are rejected.
- Origin and source are checked before decoding messages. The core validates
  normalized version, channel, exact fields, event type and state transitions.
  Ready requires a verified event after initial load; load alone is insufficient.
- A new navigation invalidates the context; a new mount gets a fresh UUID.
  A UUID is correlation data, not a security token or backend credential.
- No raw iframe messages, customer details, booking records, secrets or private
  tokens are sent to host callbacks. Only fixed error codes are exposed.
- Errors and reloads retain interactive/uncertain submit context. No automatic
  retries, reopening or public-link navigation occurs. Normal closing always
  uses confirmation/state guards; technical `destroy()` is an explicit teardown.
- The SDK stores no credentials and does not read or write cookies or storage.
  The future backend contract must separately prove cookie-independent operation.

## Browser containment

Frames use `sandbox="allow-scripts allow-forms allow-same-origin allow-popups"`
and `referrerpolicy="no-referrer"`. Top navigation and popup sandbox escape are
not allowed. Existing sandbox permissions are retained for compatibility; EMBED-1
must verify whether popups are necessary before any change. Do not relax sandbox
or CSP to bypass a broken integration. Sandbox is defense in depth and does not
replace backend authorization or `frame-ancestors` domain restrictions.

UI uses textContent, safe attributes, isolated Shadow DOM and validated hex colors.
There is no eval, innerHTML injection, remote script injection or wildcard messaging.
The optional host CSS only targets explicit SDK data attributes. Strict host CSP
uses a response-specific style nonce; no `unsafe-inline` is required. The host must
allow its SDK script and the verified iframe origin under its own CSP.

Unit and synthetic HTTPS browser tests are separated from real backend integration
proof. See [backend dependencies](docs/backend-contract.md) and
[test limitations](docs/testing.md). Do not enable production embedding until the
actual contract, authorization, expiration and booking flows have been verified.

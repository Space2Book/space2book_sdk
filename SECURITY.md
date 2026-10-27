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

- The SDK renders integration UI; it does not authorize users, make bookings,
  process payments, or implement the booking backend.
- Supply an explicit, verified public absolute HTTPS `bookingUrl` without
  credentials. The example's `https://booking.example.invalid/public` is a
  nonfunctional placeholder, not a service endpoint.
- Without an adapter, embedding fails closed: modal and inline UI show a
  localized error and direct public booking link, with **no iframe**. A modal
  trigger may still open that fallback.
- An adapter's `resolveEmbedUrl(context)` must return an authorized HTTPS URL
  on the same origin as `bookingUrl`. URL validation alone does not establish
  backend authorization. The backend owner must implement that authorization.
- Optional messaging is a backend-specific integration. `IntegrationEvent`
  (`version: 1`, context UUID `channelId`, and `ready`/`close`/`error`) is an
  internal normalized shape, **not a finalized backend wire contract**.
- The SDK checks source window and origin before invoking `parseMessage`, then
  checks the returned normalized version and channel. The adapter must validate
  the real payload schema and map the actual backend contract; unknown or
  invalid messages should return `null`.
- Iframe `load` is not proof of authorization. A `ready` event is only as
  trustworthy as the actual adapter/backend. Neither proves a completed
  booking or payment.
- Keep credentials and backend secrets out of browser bundles and adapters.
  A channel UUID correlates messages; it is not an authentication credential.

## Browser containment

Embeds use:

```html
sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
referrerpolicy="no-referrer"
```

Top navigation is not granted. `allow-popups-to-escape-sandbox` is not granted,
so popups retain sandbox restrictions. Do not silently relax these protections
to make a backend flow work; agree on a safe integration with its owner instead.
Sandboxing is defense in depth, not a replacement for a trustworthy booking
origin or correct backend authorization. In particular, serving untrusted embed
content from the host application's own origin weakens isolation when scripts
and same-origin access are both permitted.

Direct public links are a fallback navigation path, not evidence that embedding
is authorized. Review the real destination and your site's deployment policies
before enabling any integration.

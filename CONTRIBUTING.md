# Contributing

Use Node.js 22 or later and npm. Clone the repository and install its development
dependencies:

```sh
npm install
```

## Development checks

Run the existing commands for code changes:

```sh
npm run typecheck
npm run build
npm test
```

`npm test` also builds. There is no separate lint command. Documentation-only
changes do not require these commands unless they change executable behavior.
Keep changes focused, include relevant regression coverage for behavior changes,
and update public documentation when the API changes.

To inspect the local example after building:

```sh
python3 -m http.server 8000
# Visit http://localhost:8000/examples/
```

Serve from the repository root so the example can import `../dist/index.js`.
Replace `https://booking.example.invalid/public` only with a real, verified
public booking URL. The example deliberately supplies no adapter: modal and
inline views show the localized disabled-integration fallback, not a working
booking iframe. Do not present a mock adapter or fabricated success as a
production integration.

## Integration changes

- Keep runtime dependencies at zero unless a change is explicitly justified.
- Preserve SSR-safe imports; perform DOM work only in a browser.
- Keep authorization and booking logic in the owning backend.
- Do not invent production endpoints, credentials, or wire contracts. Adapter
  changes need validation against the backend owner's actual contract.
- Preserve fail-closed behavior, HTTPS/no-credentials URL validation, same-origin
  embed restrictions, source/origin validation before decoding, and normalized
  channel/version checks.
- Do not weaken the iframe sandbox or referrer policy without a documented
  security review. Iframe load is not authorization.
- Keep all five supported locales (`nl`, `en`, `de`, `fr`, `es`) consistent.
- Never commit secrets, customer data, or sensitive booking payloads.

## Release preparation

The proposed package name is `@space2book/sdk`; do not assume it is published.
Before publishing, verify package ownership/name availability, version and
changelog, public documentation, and actual backend integration assumptions.
Run the checks above, then inspect the package:

```sh
npm pack --dry-run
```

The `prepack` hook runs type checking and tests. Verify the ESM artifact
`dist/index.js`, declarations, and standalone `dist/space2book.min.js` are in
the package. CDN metadata is preparation only: publication and deployment
require an explicit maintainer release process. Pin versions in distribution
examples once a release has been verified.

For vulnerabilities, follow [SECURITY.md](SECURITY.md), not a public issue
containing exploit details.

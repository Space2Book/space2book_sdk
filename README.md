# Space2Book SDK

Version **0.1.0**. A dependency-free runtime for modal buttons, inline booking
embeds, and direct public booking links. It does not implement availability,
booking logic, authentication, payment, or backend authorization.

## Status and safe defaults

`@space2book/sdk` is the proposed npm name; publication is not claimed.
**Embedding is disabled without a backend-verified integration adapter.** Modal
buttons still open a modal, showing a localized error and direct public booking
link, **not an iframe**. Inline mounting has the same fail-closed fallback.
Direct links do not require an adapter.

Supply an explicit, verified public `bookingUrl`: an absolute HTTPS URL without
credentials. `https://booking.example.invalid/public` below is deliberately
nonfunctional. Replace it with the real public URL supplied by Space2Book.

## Local setup

Use Node.js 22 or later. From a checkout:

```sh
npm install
npm run typecheck
npm run build
npm test
```

The ESM build is `dist/index.js`, declarations are `dist/index.d.ts`, and the
standalone browser build is `dist/space2book.min.js`. `npm test` also builds.
There are no runtime dependencies.

To try the [example](examples/index.html), build first, then serve the repository
root instead of opening a `file://` URL:

```sh
python3 -m http.server 8000
# Open http://localhost:8000/examples/
```

The example intentionally has no adapter and cannot book anything at its
placeholder address.

## ESM quick start

```js
import { createSpace2Book } from './dist/index.js';

const booking = createSpace2Book({
  bookingUrl: 'https://booking.example.invalid/public', // Replace before use.
  locale: 'en',
  branding: { name: 'Your venue', color: '#2457A7' },
});

const button = booking.createButton(document.querySelector('#book-button'));
const secondButton = booking.createButton(document.querySelector('#other-button'));
const inline = booking.mount(document.querySelector('#inline-booking'));
const link = booking.createLink(document.querySelector('#booking-link'));

// In a user-action handler: opens the disabled-embed fallback without an adapter.
booking.open(document.querySelector('#custom-trigger'));
booking.close();

// On component teardown:
button.destroy();
secondButton.destroy();
inline.destroy();
link.destroy();
booking.destroy();
```

`open(trigger)` accepts an optional focus-return element. Pass actual
`HTMLElement` containers to the mounting and control methods.

### Singleton and browser script

The named ESM export `Space2Book` is a singleton with `init(options)` plus the
same methods as a factory instance:

```js
import { Space2Book } from './dist/index.js';

Space2Book.init({
  bookingUrl: 'https://booking.example.invalid/public',
  locale: 'nl',
});
Space2Book.createButton(document.querySelector('#book-button'));
// Later: Space2Book.close(); Space2Book.destroy();
```

Alternatively, the standalone browser build exposes that singleton API as
`window.Space2Book`:

```html
<div id="book-button"></div>
<script src="./dist/space2book.min.js"></script>
<script>
  window.Space2Book.init({
    bookingUrl: 'https://booking.example.invalid/public',
    locale: 'en'
  });
  window.Space2Book.createButton(document.getElementById('book-button'));
</script>
```

Choose ESM or the standalone script for a page. ESM import is SSR-safe;
DOM-facing methods are browser-only and require the relevant
containers to exist. Use the factory for independently configured instances.
Clean up handles and instances on component teardown.

The modal traps host-page focus, makes background content inert, restores focus
on close, and becomes fullscreen on small screens. Booking content inside a
cross-origin iframe must implement its own accessible keyboard navigation.
Keyboard events inside that iframe do not reach the host: the backend adapter
must map its dismiss action (including Escape) to a normalized `close` event.
Brand colors use contrasting black or white button text. Modern browsers with
Shadow DOM, `inert`, and `crypto.randomUUID()` support are required; serve the host
page over HTTPS (localhost is suitable for development).

## API

`createSpace2Book(options): BookingSDK`

| Option | Type | Purpose |
| --- | --- | --- |
| `bookingUrl` | `string`, required | Explicit public absolute HTTPS URL, no credentials. |
| `locale` | `'nl' \| 'en' \| 'de' \| 'fr' \| 'es'` | Dutch, English, German, French, or Spanish UI. |
| `branding` | `{ name?: string; color?: string }` | Display name and hex brand color, for example `#2457A7`. |
| `adapter` | `IntegrationAdapter` | Backend-specific authorized embedding and optional messaging. Omit to keep embedding disabled. |
| `timeoutMs` | `number` | Embed timeout in milliseconds. |
| `onError` | `(code: ErrorCode) => void` | Reports `integration-disabled`, `integration-error`, `load-error`, or `timeout`. |

| Method | Result |
| --- | --- |
| `open(trigger?: HTMLElement)` | Opens the modal, including fallback when embedding is disabled. |
| `close()` | Closes the modal. |
| `mount(container: HTMLElement)` | Mounts inline UI; returns `{ destroy(): void }`. |
| `createButton(container: HTMLElement)` | Adds a modal trigger; returns `{ destroy(): void }`. |
| `createLink(container: HTMLElement)` | Adds a direct public link; returns `{ destroy(): void }`. |
| `destroy()` | Cleans up the instance's UI and resources. |

`Space2Book.init(options)` configures the singleton before using those methods.
Full public TypeScript definitions live in [`src/types.ts`](src/types.ts).

## Authorized adapter boundary

An adapter is not a switch that makes an arbitrary URL authorized. The backend
owner must provide the real authorization flow and map its actual wire messages
to the SDK's internal events. No production endpoint, token scheme, or finalized
backend messaging contract is supplied by this package.

```ts
interface IntegrationContext {
  readonly bookingUrl: string;
  readonly locale: 'nl' | 'en' | 'de' | 'fr' | 'es';
  readonly mode: 'modal' | 'inline';
  readonly channelId: string; // UUID generated for this integration context.
  readonly protocolVersion: 1;
}

type IntegrationEvent = {
  version: 1;
  channelId: string;
  type: 'ready' | 'close' | 'error';
};

interface IntegrationAdapter {
  resolveEmbedUrl(context: IntegrationContext): string;
  messaging?: {
    version: 1;
    createInitMessage?(context: IntegrationContext): unknown;
    parseMessage(data: unknown, context: IntegrationContext): IntegrationEvent | null;
  };
}
```

`resolveEmbedUrl` must return an **authorized absolute HTTPS URL on exactly the
same origin as `bookingUrl`**. Do not return an unverified public page merely to
bypass the disabled state. Keep backend secrets out of browser code.
The embed origin must differ from the host page's origin to retain sandbox
isolation. Cross-origin redirects are not granted messaging trust.

Messaging is optional. `createInitMessage` creates a backend-specific payload;
`parseMessage` validates and maps that backend's payload or returns `null`.
`IntegrationEvent` is an **internal normalized event, not the finalized backend
wire format**. The SDK checks source window and origin before calling the
decoder, then checks the normalized `version` and `channelId`. The adapter must
still validate the actual message schema and authorization semantics.
The backend must enforce the host domain allowlist and iframe authorization,
including an appropriate CSP `frame-ancestors` policy. Host CSP must permit the
verified booking origin in `frame-src`. SDK-generated styles require a compatible
`style-src` policy; strict deployments must review this before integration.

Iframe `load` is **not proof of authorization**. A normalized `ready` event is
only as trustworthy as the real adapter/backend implementation; neither it nor
the SDK establishes a booking, payment, or authenticated session.

Iframes use `sandbox="allow-scripts allow-forms allow-same-origin allow-popups"`
and `referrerpolicy="no-referrer"`. Top navigation and
`allow-popups-to-escape-sandbox` are not granted; popups remain sandboxed. Direct
links are a separate navigation fallback, not an authorization mechanism.
See [SECURITY.md](SECURITY.md).

## npm and CDN preparation

Before any release, verify ownership and availability of the proposed
`@space2book/sdk` name, review package contents with `npm pack --dry-run`, and
complete the checks in [CONTRIBUTING.md](CONTRIBUTING.md). The package's
`prepack` hook runs type checking and tests.

Only **after a verified publication**, consumers could run
`npm install @space2book/sdk@0.1.0` and import from `@space2book/sdk`.
Likewise, an npm-backed CDN could serve the pinned
`@space2book/sdk@0.1.0/dist/space2book.min.js` artifact once it actually exists.
The `unpkg` and `jsdelivr` package fields prepare artifact selection; they do not
publish or automatically deploy anything. Until then, build locally and host
reviewed `dist` artifacts yourself. No live npm or CDN availability is promised.

## License

[MIT](LICENSE).

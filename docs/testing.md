# SDK-2 testen en verificatiegrenzen

## Reproduceerbare SDK-controles

Node.js 22.13+ of 24:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

Bij een aanwezige systeem-Chromium:

```sh
S2B_CHROMIUM_PATH=/usr/bin/chromium npm run test:browser -- --project=chromium
```

`npm test` bouwt browserbundles, ESM en declarations en draait alle unitbestanden.
De Node 24-runner toont hier bestandsresultaten; `node tests/embed-v1.test.mjs`
toont de afzonderlijke cases. De protocoltests valideren de echte backendfixtures
met het ongewijzigde Draft 2020-12-schema via Ajv, naast adversariële berichten.

`tests/sdk.test.mjs`, `tests/v1.test.mjs`, `tests/release.test.mjs` en
`tests/browser/*` blijven synthetische SDK-/lifecycle-/distributietests. De oude
`tests/fixtures/adapter.mjs` is expliciet geen productieprotocol. Het browserharnas
gebruikt twee lokale HTTPS-origins onder CSP met third-party-cookiecontroles,
Shadow DOM, focus/sluitbevestiging, teardown, reloads en meerdere instanties.

`tests/embed-v1.test.mjs` test de officiële adapter met het echte wireprotocol,
maar een synthetisch MessageEvent/DOM. Dit is geen echte HTTP-backendtest.
Dekking: childchannel/hostinstance, alle hello/load/ready-volgordes, duplicaten,
foute origins/windows/versies/instances/payloads, retired channels/reload,
timeout, taal, resize, completed/close, validatie/retry-overgangen, verlopen
context, fouten tijdens submit, onafhankelijke modal/inlineframes, declaratieve
initialisatie en alle backendfoutcodes in vijf talen.

## Echte SDK + EMBED-1-integratietest

`tests/backend/real.test.mjs` gebruikt de **officiële adapter zonder endpointoverride**,
met `https://api.space2book.com/webforms/embed/{token}` in Chromium. De browser
resolveert uitsluitend testnamen naar een lokale HTTPS-server met een tijdelijk
self-signed certificaat. Er worden geen productiehosts of productiegegevens geraakt.
De hostorigin is `https://voorbeeld.nl`; `https://denied.nl` is de verboden variant.

Het SDK-eigen `tests/backend/router.php` is afgeleid van de gelezen backendfixture.
Het laadt de echte CodeIgniter-routes, filters, controllers, gedeelde bookingformview,
search/compose/bridge en services uit de read-only backendcheckout. Alleen de
omgevingsorigin, runtime-schrijfmap en expliciete fixture-scenario's zijn lokaal.
Backendbestanden zijn niet gewijzigd. PHP runtime/cache/security-state schrijft
onder `space2book_sdk/work/`. Tests gebruiken geïsoleerde SQLite-fixtures voor
reads en de bestaande bewaakte **`s2b_public_tests`** MySQL-fixture voor echte submits.
Deze fixture wist tabellen; gebruik een aparte wegwerpserver en draai serial.

Vereisten: OpenSSL, Playwright/Chromium, vrije loopbackpoorten 443 en 8097, PHP 8.3
met de Composer-locked backendafhankelijkheden en benodigde extensies, en een
expliciet geactiveerde wegwerp-MySQL-database. De backend staat standaard op
`../s2b_dev/app.space2book.com`; override met `S2B_BACKEND_APP`.

```sh
S2B_PUBLIC_TEST_MYSQL=1 \
S2B_PUBLIC_TEST_HOST=127.0.0.1 S2B_PUBLIC_TEST_PORT=33316 \
S2B_PUBLIC_TEST_USER=root S2B_PUBLIC_TEST_PASSWORD='' \
S2B_CHROMIUM_PATH=/usr/bin/chromium S2B_TEST_PHP=/path/to/php \
npm run test:backend
```

Een al gestarte lokale PHP-testserver kan gebruikt worden met `S2B_TEST_PHP_EXTERNAL=1`.
Die server moet de SDK-router draaien met `S2B_BACKEND_APP`,
`S2B_SDK_TEST_WRITEPATH` en de wegwerpdatabasevariabelen ingesteld.
Het harnas start of stopt die externe server niet.

Een PHP-containerwrapper moet de vier databasevariabelen en `S2B_PUBLIC_TEST_MYSQL`,
`S2B_BACKEND_APP`, `S2B_SDK_TEST_WRITEPATH` doorgeven. Mount de backend read-only,
de SDK read/write, publiceer alleen `127.0.0.1:8097:8097` en verbind alleen met de
wegwerp-MySQL-server. PHP draait zijn lokale router op 0.0.0.0:8097 binnen die
container. Zorg dat de wrapper bij SIGTERM ook zijn container stopt.

Het harnas blokkeert externe assets/providers en cookie/web-storagegebruik.
Succesvolle API-antwoorden worden **niet gemockt**. Alleen de eerste submit wordt
bewust afgebroken en één renewal krijgt een geïnjecteerde 503. Vervolgens moet
een byte-identieke retry de echte transactieservices bereiken en `completed`
opleveren. De backendstorage-double geeft geen echte terms-PDF-URL; de popuptest
gebruikt de echte voorwaardenlink met een expliciet lokale externe testdocument-URL.
Dit is een sandboxtest, geen productie-PDF-providercontrole.

## Resultaten van 5 november 2026

De definitieve aantallen en commandoresultaten staan in [SDK-2-rapport](sdk-2-report.md).
De aanvankelijke complete Playwright-matrix kon browsers niet starten omdat hun
binaries ontbraken. De download van `cdn.playwright.dev` is door het omgevingsbeleid
geweigerd (403 Domain forbidden). Chromium is daarna met de aanwezige systeembrowser
uitgevoerd. Firefox en WebKit zijn hier **niet geverifieerd**; geen geslaagde matrixclaim.

## Grenzen voor acceptatie

- Dit bewijst SDK-integratie met de echte backendcode op wegwerpfixtures, geen
  staging-/productieaccount of volledige productie-AppBoot.
- Initiële HTTP-denials worden apart gecontroleerd; de host kan hun specifieke
  foutcode niet lezen en toont conform contract timeout. Runtimecodes worden wel verwerkt.
- Geen productie-CSP/XFO/CDN-edgeheaders, echte klantaccounts, mail/storage/paymentproviders,
  checkout, mobiele WebViews of Safari/Firefox getest.
- Een afgebroken submit vóór verwerking plus byte-identieke echte retry is getest.
  Een committed response die verloren gaat is hier niet afzonderlijk gesimuleerd;
  de backend-idempotencytests behandelen dat scenario, maar zijn niet opnieuw als
  onderdeel van deze SDK-run geclaimd.
- Geen eigen boekings-API, capabilities in hostevents, productieboekingen of
  Bunny-/productiepublicatie. Gezamenlijke acceptatie controleert de resterende
  browsermatrix, echte accountconfiguratie en infrastructuur.

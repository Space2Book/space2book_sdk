# SDK-2 oplevering — 5 november 2026

De officiële productieadapter is geïmplementeerd voor modal en inline zonder
klantadaptercode. Versie **1.1.0** is lokaal voorbereid; geen productiepublicatie,
Bunny-wijziging of V1-aliaspublicatie is uitgevoerd. De SDK is klaar voor
**gezamenlijke volledige integratieacceptatie**; de nog niet uitgevoerde
browser-/infrastructuur-/providercontroles staan hieronder expliciet open.

## Adapter en contract

`src/space2book-adapter.ts` levert één officiële adapter, automatisch geselecteerd
bij een identifier van exact 64 kleine hextekens. Het endpoint is uitsluitend
`https://api.space2book.com/webforms/embed/{integration_identifier}`.
Externe links blijven gewone MyBooking-links in een beschermd nieuw tabblad,
zonder SDK of webformulierkoppeling.

Bron: `Space2Book/s2b_dev@b8b9c2dbe84e0033d1865d44ebda48652eba8e36`,
`docs/integrations/webforms/embed-contract-v1.md`; protocol `space2book.embed`
**versie 1**. SDK-basis: `4c7a24fe56150d5ea91778821077a3a260518812`.
De backendcheckout is uitsluitend gelezen en in de PHP-testcontainer read-only
gemount. Geen backendbestanden aangepast.

De decoder verwerkt de echte hello/init/ready-berichten, childchannels,
hostinstances, foutcodes, state, completed, close-request, resize en taal.
Origin en iframewindow worden vóór parsing gecontroleerd. Backendcontext,
capabilities, CSRF, contactgegevens, boekings-API, prijzen en idempotency blijven
in het iframe. De SDK ontvangt alleen minimaal genormaliseerde status en vaste codes.

## State-machine en sluitgedrag

- Ready is bruikbaar en mag direct sluiten. Dirty vraagt bevestiging; annuleren
  behoudt dezelfde iframe, invoer en scroll. Completed betekent verwerkt, niet
  automatisch betaald of definitief bevestigd.
- Submitting en uncertain blokkeren alle normale sluitroutes en de publieke
  fallback. `submitting → dirty` verwerkt definitieve validatiefouten;
  `uncertain → submitting` ondersteunt de bestaande identieke backendretry.
- Een gemelde security-/renewalfout behoudt de laatst bekende sluitstatus,
  frame, listener en herstelknoppen; een late completion wordt nog verwerkt.
  Echte trackingfouten blijven conservatief inert/uncertain.
- Hello en ready mogen vóór load aankomen. Duplicaten resetten geen voortgang.
  Reloads gebruiken nieuwe channels, behouden de instance en negeren oude events.
  Tijdens een onzekere submit wordt geen nieuwe sessie/boeking gestart.
- Sandbox blijft `allow-scripts allow-forms allow-same-origin allow-popups`.
  Geen topnavigatie, popupescape, wildcardcommunicatie of onbeveiligde fallback.

## Definitieve HTML

Na publicatie van de SDK, met een actieve koppeling op het geregistreerde HTTPS-domein:

```html
<script defer src="https://cdn.space2book.com/sdk/v1/space2book.min.js"></script>

<button type="button" data-s2b-mode="modal"
        data-s2b-integration="INTEGRATION_ID"
        data-s2b-locale="nl">Boek direct</button>

<div data-s2b-mode="inline"
     data-s2b-integration="INTEGRATION_ID"
     data-s2b-locale="nl"></div>
```

Vervang `INTEGRATION_ID` door het publieke token van 64 kleine hextekens.
Bij strikte host-CSP: geef de eigen response-nonce door met
`data-s2b-style-nonce`; laat de API-origin toe in `frame-src`.

## Uitgevoerde controles

| Controle | Resultaat |
| --- | --- |
| `npm ci` | Geslaagd met de definitieve lockfile; runtime blijft dependency-free |
| `npm run typecheck` | Geslaagd |
| `npm run lint` | Geslaagd |
| `npm test` | Alle 4 unitbestanden geslaagd; **74 afzonderlijke cases** (23 EMBED-1, 14 SDK, 35 V1/lifecycle, 2 release) |
| Echte backendfixtures + Draft 2020-12-schema | Alle 9 originele fixtures met Ajv gevalideerd; kopieën byte-identiek aan backend |
| `npm run test:browser`, systeem-Chromium | **10 Chromium-cases geslaagd**; Firefox/WebKit ontbreken in deze omgeving |
| Echte SDK + backend in Chromium | **9 inhoudelijke controles geslaagd**, plus overkoepelend scenario: Node rapporteert **10/10** |
| Browser-/ESM-bundles, declarations en npm pack dry-run | Gebouwd en gecontroleerd; lokale 1.1.0-release voorbereid |
| `git diff --check`, backendstatus | Schoon; backend ongewijzigd |

De oorspronkelijke volledige matrix kon geen Playwright-binaries starten. De
browserinstallatie op `cdn.playwright.dev` werd door het netwerkbeleid geweigerd
met 403 `Domain forbidden`. Met `S2B_CHROMIUM_PATH=/usr/bin/chromium` slaagt Chromium.
De volledige definitieve matrix rapporteert de ontbrekende Firefox/WebKit-starts
als infrastructuurfouten; deze gelden niet als geslaagde browsertests.

De echte run gebruikt de SDK-adapter zonder origin-/endpointoverride, lokale
HTTPS-origins, echte filters/controllers/shared views/services en expliciete
wegwerp-SQLite/MySQL-fixtures. Geslaagde API-responses zijn niet gemockt.
Alleen de eerste submit wordt afgebroken en één renewal geeft een geïnjecteerde
503. De identieke retry bereikt de echte transactieservices.

Geslaagde echte controles:

1. Initialisatie, eigen instance, taalwisseling en cookie-vrije same-origin contexttransport.
2. Invoer en iframe behouden na close-request/annuleren; externe voorwaardenpopup onder de bestaande sandbox.
3. Onderbroken submit, geblokkeerd sluiten/fallback, renewal-fout en byte-identieke echte retry tot completed.
4. Herhaald openen/sluiten en veilige reload met een nieuw childchannel.
5. Declaratieve modal en inline met uitsluitend identifier, taal en geverifieerde resize.
6. Lokale contextexpiratie na ready, met behoud van de echte dirty-sluitstatus.
7. Echte revocation tijdens een actieve dirty-sessie zonder iframeverlies.
8. Echte HTTP-autorisatie voor inactive, revoked, subscription-required, missing en afwijkende domein-CSP.
9. Verboden browserorigin en ontbrekende integratie falen gesloten met timeout.

De voorwaardenlink wordt voor de sandboxcontrole zichtbaar gemaakt en voorzien
van een lokale synthetische externe URL: de backendstorage-double levert geen
productie-PDF. Dit bewijst popuprechten, niet productie-providerbeschikbaarheid.
Testinfrastructuurproblemen en onjuiste fixture-aannames tijdens ontwikkeling zijn
hersteld; bovenstaande resultaten betreffen de geslaagde controles na herstel.

## Resterende acceptatiepunten

- Firefox, WebKit/Safari en mobiele WebViews moeten nog worden uitgevoerd in een
  omgeving waar de browserbinaries beschikbaar zijn.
- Gezamenlijk testen met echte stagingintegraties, actuele accountrechten,
  productieachtige CSP/XFO/CDN-headers en externe voorwaarden-/mail-/storage-/paymentproviders.
- De initiële geweigerde HTML-response kan geen veilig postMessage sturen en
  heeft geen CORS. De SDK kan die status/body niet uitlezen; bezoekers zien timeout.
  Specifieke codes zijn wel beschikbaar zodra de backend veilig kan communiceren.
  Dit is een expliciete EMBED-1-contractgrens, geen client-side autorisatieomweg.
- Exact herstel van het interne focusveld en Escape vanuit het cross-origin
  formulier zijn niet door host-DOM-toegang af te dwingen. V1 heeft een eigen sluitknop.
- Geen claim op volledige productieacceptatie, externe checkout of verloren
  committed-responsrecovery in deze SDK-browsertest. De backend heeft eigen
  idempotencytests; die zijn niet als nieuwe SDK-testresultaten meegeteld.

Er zijn geen vereiste backendcodewijzigingen vastgesteld voor de adapter.
Publicatie blijft een afzonderlijke stap na gezamenlijke integratieacceptatie.
Zie [testing](testing.md) voor herhaalbare commando's en veiligheidsgrenzen.

## Gewijzigde bestanden

- Runtime: `src/space2book-adapter.ts`, `src/embed.ts`, `src/types.ts`,
  `src/index.ts`, `src/modal.ts`, `src/security.ts`, `src/i18n.ts`.
- Versie/devtest-tooling: `package.json`, `package-lock.json` (1.1.0; Ajv alleen als devDependency).
- Unit/protocol: `tests/embed-v1.test.mjs`, `tests/sdk.test.mjs`, `tests/v1.test.mjs`,
  `tests/fixtures/embed-v1/embed-messages-v1.schema.json`,
  `tests/fixtures/embed-v1/embed-messages-v1.fixtures.json`.
- Browsertests: `tests/browser/host.mjs`, `tests/browser/sdk.spec.mjs`;
  echte integratie: `tests/backend/host.mjs`, `tests/backend/router.php`, `tests/backend/real.test.mjs`.
- Documentatie: `README.md`, `SECURITY.md`, `CHANGELOG.md`, `docs/backend-contract.md`,
  `docs/testing.md`, `docs/distribution.md`, `docs/sdk-1-report.md` (historische verwijzing),
  `docs/sdk-2-report.md`.
- Voorbeelden: `examples/index.html`, `examples/modal.html`, `examples/inline.html`,
  `examples/template.php`. De gewone externe HTML-link blijft geldig zonder wijzigingen.
- `dist/` en `release/sdk/1.1.0/` zijn gegenereerde, genegeerde lokale buildoutput;
  geen gegenereerde bestanden of testcredentials in de broncommit.

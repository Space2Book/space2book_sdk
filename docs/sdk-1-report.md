# SDK-1 eindrapport

Datum: 4 november 2026. Scope: uitsluitend `space2book_sdk`.

**De backendonafhankelijke V1-functionaliteit is geïmplementeerd. Volledige
productieacceptatie van modal en inline wacht op EMBED-1. Productie-embedding
blijft aantoonbaar uitgeschakeld.** Er is niets naar CDN, npm of productie uitgerold.

## 1. Gewijzigde bestanden

Bestaande bestanden verbeterd:

- `src/index.ts`, `src/types.ts`, `src/embed.ts`, `src/modal.ts`, `src/browser.ts`,
  `src/i18n.ts`, `src/styles.ts`.
- `tests/sdk.test.mjs`, `examples/index.html`.
- `package.json`, `package-lock.json`, `.gitignore`, `.github/workflows/ci.yml`.
- `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`.

Toegevoegd:

- `src/declarative.ts`, `src/host.css`.
- `scripts/build.mjs`, `scripts/release.mjs`, `eslint.config.mjs`, `playwright.config.mjs`.
- `tests/v1.test.mjs`, `tests/release.test.mjs`, `tests/fixtures/adapter.mjs`.
- `tests/browser/server.mjs`, `host.html`, `host.mjs`, `host.css`, `frame.html`,
  `frame.mjs`, `sdk.spec.mjs`.
- `examples/external.html`, `examples/modal.html`, `examples/inline.html`,
  `examples/template.php`.
- `docs/backend-contract.md`, `docs/distribution.md`, `docs/testing.md`, dit rapport.

De bestaande frameworkvrije factory/singleton, Shadow DOM-componenten,
vertaalstructuur, kleurvalidatie en adaptergrens zijn hergebruikt. Geen
runtime-dependencies, frameworkpackages, WordPress-plugin of boekingslogica toegevoegd.
`src/security.ts` en de repository-instructies zijn ongewijzigd gebleven.

## 2. Integratievormen

| Vorm | Gerealiseerd gedrag | Productiestatus |
| --- | --- | --- |
| Extern | Gewone HTML-link zonder JS, plus helper en declaratieve externe knop; nieuw tabblad met rel-beveiliging. Geen koppeling vereist. | Beschikbaar met echte publieke formulierlink. |
| Modal | Lazy iframe, responsive/mobile fullscreen, focusbegrenzing, scroll lock, vijf talen, fout/timeout, centrale sluitbeveiliging. | Volledig SDK-gedrag getest met expliciete fixtures; officiële embed uitgeschakeld. |
| Inline | Zelfde adapter/koppeling, idempotente mount, responsive breedte, begrensde resize, meerdere kanalen, cleanup en herinitialisatie. | Zelfde productieblokkade als modal; geen afzonderlijke backendinstelling. |

De backend controleert domein, venue, rechten, beschikbaarheid, prijzen en
boekingen. Een publieke link wordt nooit automatisch ingesloten of geopend.

## 3. Publieke SDK-methoden

Factory: `createSpace2Book(options)` met `open(trigger?)`, `close()`,
`mount(container)`, `createButton(container)`, `createLink(container)`, `destroy()`.
Handles houden `destroy()`. De singleton `Space2Book` behoudt `init(options)` en
alle bestaande methoden; de browserbundle exposeert deze als `window.Space2Book`.

Nieuwe functies: `initDeclarative(root?)`, `observeDeclarative(document?)`,
`destroyDeclarative(document?)`; ook beschikbaar op de singleton.
`VERSION` en `Space2Book.version` zijn `1.0.0`. Volledige opties/types staan in de
README en `src/types.ts`; TypeScript declarations worden gebouwd.

## 4. Definitieve HTML-attributen

`data-s2b-mode="external|modal|inline"`, `data-s2b-integration`, `data-s2b-url`,
`data-s2b-locale`, `data-s2b-text`, `data-s2b-name`, `data-s2b-color`,
`data-s2b-style-nonce`.

Modal gebruikt een echte button met eigen HTML-label. `integration` is vereist
voor modal/inline; `url` is vereist voor de externe helper en optioneel als
expliciete publieke embedlink. Geen endpoint-, adapter-, token- of rechtenattributen.
Automatische initialisatie, dubbele scriptlading, dynamische toevoeging en
verwijdering zijn afgedekt. Wijzigingen vervangen geen actief formulier.

## 5. Productieadapter en backendcontract

Backendreferentie: `/workspace/s2b_dev`, commit `2d4b8de1`, alleen gelezen.
`docs/integrations/webforms/embed-contract-v1.md` ontbreekt. De aangetroffen API-
iframecontroller retourneert alleen een welkomsttekst; publieke MyBooking-routes
vormen geen embedcontract. Er zijn geen routes, credentials of wirepayloads verzonnen.

Daarom is geen productieadapter ingeschakeld. `integrationId`, locale,
channelcontext en status-/resize-normalisatie zijn voorbereid in de bestaande
adapterinterface. Alle nieuwe transportfixtures zijn expliciet gemarkeerd.
Zie [de concrete resterende backendstappen](backend-contract.md).

## 6. Bevestigings- en sluitgedrag

Alle vijf normale routes gebruiken dezelfde coördinator: sluitknop, backdrop,
Escape, `close()` en iframeverzoek. Een verborgen, niet-interactief laadscherm en
fout vóór readiness kunnen direct sluiten. Na readiness is bevestiging vereist,
ook zonder betrouwbaar dirty-signaal. Dirty kan de bescherming niet terugzetten.

Annuleren behoudt dezelfde iframe-instantie, invoer en scrollpositie. Focus gaat
terug naar de vorige hostcontrol of de iframe-browsingcontext. Exact herstel van
het laatst actieve veld binnen een cross-origin formulier is een expliciete
backendafhankelijkheid; de host kan dat veld niet uitlezen of gericht focussen.
De browserproef verifieert focus op het iframe, zonder onjuiste claim over het veld.

Submitting en uncertain blokkeren normaal sluiten en verbergen de publieke link.
Een submit die tijdens de bevestiging begint wordt opnieuw gecontroleerd vóór
verwerpen. Completed mag direct sluiten. Reload/fouten wissen geen onzekere
submitstatus; de SDK herhaalt geen boeking. `destroy()` blijft uitsluitend
technische teardown. Actieve formulieren worden niet stilzwijgend vervangen.

## 7. Beveiliging

HTTPS/no-credentials URL-validatie; exacte cross-origin embedallowlist; weigeren
van `/bf/` en publieke-linkembeds; verplichte readiness-messaging; origin en source
vóór decoding; versie, channel, actuele instantie, exacte payloadvelden en geldige
statusovergangen. Oude sources/channels en onbekende payloads worden genegeerd.
Nieuwe navigatie invalideert de oude handshake. Geen wildcard `postMessage`.

Bestaande minimale sandbox en referrerpolicy behouden, geen topnavigatie of popup-
escape. Geen secrets, klantgegevens, ruwe berichten of boekingsresultaten in
hostevents. Alleen vaste foutcodes. Tekst via textContent, veilige hexkleuren,
Shadow DOM en optionele nonce voor strikte CSP; geen `unsafe-inline` nodig.
Timers/listeners en observers hebben cleanup. Geen cookies, storage, polling,
backendcalls, automatische retry of bookingimplementatie in de SDK.

## 8. Testresultaten

- 38 unit-/DOM-/releasetests: geslaagd op Node 24.22.1 en Node 22.23.4.
- `npm run typecheck`, `npm run lint`, `npm test`: geslaagd op beide Node-versies.
- Acht lokale Playwright-tests: geslaagd op Chromium 155.0.8059.79.
- Volledige GitHub Actions-matrix: 22 geslaagd op Chromium 156.0.8078.4, Firefox
  157.0 en WebKit 27.2; twee expliciete skips voor de Chromium-specifieke cookieproef.
- Echte lokale HTTPS-sites: `localhost:9443` tegenover `127.0.0.1:9444`.
- CSP zonder `unsafe-inline`, origin/source-handshake, geblokkeerde third-party
  cookies, formulierbehoud, iframefocus, submit-/onzekerheidsbeveiliging,
  mobiele fullscreen, meerdere instanties, redirect, reload, dubbele scriptlading
  en eigen host-JavaScript/CSS gecontroleerd.
- `git diff --check` en pakketinspectie geslaagd; release-overwritebescherming getest.

Dit zijn geen echte backendboekingen. Rechten, expiratie, koppelingintrekking,
boekingsmodi, beschikbaarheids-/prijswijzigingen en dubbele submit moeten tegen
EMBED-1 worden getest. jsdom is uitsluitend als DOM-bewijs gebruikt.
PHP is hier niet geïnstalleerd; het PHP-voorbeeld is inhoudelijk gecontroleerd,
maar niet met een PHP-interpreter uitgevoerd.

## 9. Browsercompatibiliteit

Doel: moderne Chromium, Firefox, Safari/WebKit met Shadow DOM, inert,
crypto.randomUUID en dynamische viewportunits. Alle drie engines zijn daadwerkelijk
in GitHub Actions getest. De lokale downloadblokkade voor Firefox/WebKit (HTTP 403
`Domain forbidden`) is als omgevingsbeperking behouden in de verslaglegging.
Geen IE-ondersteuning of polyfills toegevoegd.

[CI-run 41836904139](https://github.com/Space2Book/space2book_sdk/actions/runs/41836904139)
is volledig groen op broncommit `075b5134259b08b26ee7c2f84ef841acaee65b9a`: beide
Node-jobs en de volledige browsermatrix. De laatste verslagwijziging wijzigt
alleen Markdown, geen broncode, build of tests.

## 10. Buildresultaten

Browserbundle, geminificeerde productievariant, ESM, declarations en optionele
host-CSS bouwen succesvol. Runtime-dependencies: nul. Geminificeerde browser-JS:
18.177 bytes (circa 7,0 kB gzip); geminificeerde CSS: 313 bytes. ESM heeft een
publieke source map; minified browser-JS heeft geen source map.

## 11. Distributiebestanden

`dist/space2book.js`, `dist/space2book.min.js`, `dist/index.js`,
`dist/index.js.map`, `dist/*.d.ts`, `dist/space2book.css`,
`dist/space2book.min.css`.

De lokale releasevoorbereiding bevat dezelfde bestanden onder
`release/sdk/1.0.0/` en de expliciet voorbereide alias `release/sdk/v1/`, plus
`integrity.json` met SHA-384-hashes. Gegenereerde build-/releasebestanden zijn
bewust genegeerd in Git; de scripts leveren ze reproduceerbaar uit de bron.
Geen automatische remote publicatie.

## 12. Publiceren onder /sdk/

`npm run release -- --update-v1` voert de checks uit en bereidt een nieuwe vaste
versie en alias voor. Een reeds bestaande versiemap wordt geweigerd. Controleer
browsermatrix en pakket, upload eerst de vaste map naar
`https://www.space2book.com/sdk/1.0.0/`, verifieer de CDN-response en publiceer
dan pas `/sdk/v1/`.

Vaste versies: een jaar immutable cache. V1-alias: korte cache van vijf minuten.
Correcte JS/CSS/JSON-MIME-types, nosniff, leesbare bestandsrechten en optionele
SRI zijn beschreven in [publicatie-instructies](distribution.md). GitHub is geen
CDN-origin. Bunny en het afbeeldings-CDN zijn niet geconfigureerd.

## 13. Openstaande backendafhankelijkheden

Het definitieve EMBED-1-contract, officiële API-embedroute, verificatie van de
handshake/berichten, locale-/hoogtegedrag, verlopen/ingetrokken context,
exact focusherstel binnen het iframe, domein-/abonnementsautorisatie en alle
werkelijke boekingsscenario's ontbreken nog als productievalidatie.

Zodra het contract beschikbaar is, moet één geverifieerde productieadapter
worden aangesloten op de gedeelde modal/inline-flow en declaratieve configuratie.
De onafhankelijke SDK-onderdelen zijn afgerond; volledige productieacceptatie
wordt pas daarna geclaimd. De backendrepository is niet gewijzigd.

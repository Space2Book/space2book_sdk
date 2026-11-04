# Testdekking en browsercompatibiliteit

## Soorten bewijs

- Node/jsdom-tests controleren DOM-logica, statusovergangen, genormaliseerde
  messagevalidatie, teardown, declaratieve initialisatie en releasestructuur.
  Zij bewijzen geen echte iframecommunicatie, CSP of cookiegedrag.
- Playwright gebruikt echte lokale HTTPS-servers: host `https://localhost:9443`
  en iframe `https://127.0.0.1:9444`. Dit zijn verschillende origins én verschillende
  sites. Een tijdelijk self-signed certificaat wordt in `work/tls/` gemaakt;
  alleen de tests accepteren dit certificaat. Productie schakelt TLS-validatie niet uit.
- De browseradapter, endpoints en payloads zijn expliciete fixtures. Deze tests
  bewijzen geen echte backendautorisatie, boekingen of EMBED-1-conformiteit.

## Uitvoeren

```sh
npm ci
npm run typecheck
npm run lint
npm test
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

Op een omgeving met een systeem-Chromium:

```sh
S2B_CHROMIUM_PATH=/usr/bin/chromium npm run test:browser -- --project=chromium
```

Die optie verandert alleen het testexecutable. Er worden geen downloads via
alternatieve mirrors of omzeilingen van netwerkbeleid gebruikt. De certificaat-
fixture vereist `openssl`. Tests luisteren uitsluitend lokaal op poorten 9443/9444;
maak die vrij voordat de suite start. De CI voert unitchecks uit op Node 22 en 24
op Linux en Windows en biedt een aparte browserjob op Node 24.

## Afgedekte gedragingen

Externe link: exacte publieke URL, nieuw tabblad, rel-beveiliging, aangepaste tekst,
geen integration-ID en een HTML-voorbeeld zonder script. Bestaande URL-validatietests
controleren onveilige schema's, credentials en relatieve URL's.

Modal: alle vijf sluitroutes, interactieve/dirty-status, annuleren met behoud van
iframe/scroll/focus, submit tijdens de bevestiging, submitting/uncertain, completed,
herhaald openen, conflicterende instanties, focusinperking en focusherstel,
vooraf bestaande inert-/scrollstatus, dynamisch toegevoegde achtergrondcontent,
lokalisatie en mobiele fullscreenweergave.

Inline: idempotente mount, meerdere kanalen/instanties, begrensde hoogte-events,
verwijderen, opnieuw initialiseren, fouten en teardown. De browserfixture verifieert
modal plus inline tegelijk op echte HTTPS-origins.

Messaging: exacte origin en source vóór de decoder, versie/channelcontrole,
onbekende events/statussen, onverwachte payloadvelden, oude sources/channels,
ready vóór load, load zonder ready, navigatie/reload, timeout en adapterfouten.
Readiness volgt pas na de eerste load en het geverifieerde adapterevent. Een
nieuwe load invalideert de bestaande context, zonder onzekere submitstatus te wissen.

De Chromium-cookieproef stelt via CDP expliciet third-party-cookierestricties in.
De iframe-response probeert een synthetische `Secure; SameSite=None`-cookie te
zetten; de test controleert dat het frame die niet kan lezen en dat de fixtureflow
blijft werken. Dat bewijst cookie-onafhankelijkheid van de SDK-fixture, niet van
het nog ontbrekende productieformulier. Dezelfde specifieke CDP-proef wordt
expliciet overgeslagen in Firefox/WebKit.

Releases: vaste versiemappen worden nooit overschreven; `v1` wijzigt alleen na
expliciete opt-in en elke nieuwe vaste versie krijgt een integriteitsmanifest.

## Uitvoering in deze opdracht

Op 4 november 2026 zijn de Chromium-tests uitgevoerd op systeem-Chromium
155.0.8059.79. De acht browsertests slagen, inclusief CSP zonder `unsafe-inline`,
echte cross-site messaging en expliciet geblokkeerde third-party cookies.

Firefox en WebKit konden niet lokaal worden geïnstalleerd: de browserdownload
vanaf `cdn.playwright.dev` wordt door het omgevingsnetwerkbeleid geweigerd met
HTTP 403 `Domain forbidden`. De volledige matrix is vervolgens daadwerkelijk
in GitHub Actions uitgevoerd: Chromium 156.0.8078.4, Firefox 157.0 en WebKit 27.2.
**22 tests slagen; twee Chromium-specifieke cookieproeven zijn bewust overgeslagen
in Firefox en WebKit.** De gecorrigeerde test wacht op de zichtbare SDK-status,
omdat `postMessage` asynchroon wordt afgeleverd. De bestaande unitproef dekt
een submit die begint terwijl de sluitbevestiging al openstaat.

Bewijs: [CI-run 41836904139](https://github.com/Space2Book/space2book_sdk/actions/runs/41836904139),
gevalideerde broncommit `075b5134259b08b26ee7c2f84ef841acaee65b9a`.

De unit-/DOM-suite omvat na de Copilot-review 51 testgevallen (14 bestaande,
35 V1-regressies en twee releasetests). Raadpleeg het eindrapport voor de laatste uitvoerresultaten.

## Nog te verifiëren met EMBED-1

Geen actieve of ingetrokken productie-integratie, domein-/abonnementsweigering,
expiratie, directe boeking, offerte, optie, verloren beschikbaarheid, prijswijziging,
voorwaardenwijziging of dubbele boeking is tegen een echte backend getest.
Deze flows vereisen het definitieve contract en testaccounts/venues. De SDK maakt
geen boekingen en simuleert daarvoor geen productiesucces.

Doelbrowsers zijn actuele Chromium, Firefox en Safari/WebKit met Shadow DOM,
`inert`, `crypto.randomUUID()` en `dvh`. Geen IE, oude WebViews of automatische
polyfills. Exact herstel van het laatst actieve cross-origin formulierveld kan de host
niet controleren of afdwingen; dit is een expliciete EMBED-1-validatie.
Cross-origin iframe-toegankelijkheid, schermlezers en keyboardgedrag
van het echte formulier moeten ook door de backend worden gevalideerd.


## Copilot-review verwerkt

De regressies controleren verlies van statuscontrole na readiness (reload,
iframe-/backendfout en decoderfout), blokkeren van sluiten/fallback en behoud van
een inert iframe, verouderde mount-handles, automatisch bijgewerkte verzendmeldingen
en een schone aliasvervanging zonder oude bestanden. De lokale Node 22/24-checks
en tien Chromium-tests slagen. De CI-matrix omvat nu ook Windows voor beide
Node-versies om build, tests en pakketinspectie op echte Windows-runners te toetsen.
De laatste CI-status staat op PR #3; de eerder gekoppelde run is de oorspronkelijke
validatie vóór deze reviewcorrecties.

# Space2Book SDK V1

Lichtgewicht TypeScript SDK zonder runtime-dependencies. Bestaande factory,
singleton, Shadow DOM, modal en inline architectuur zijn behouden.

**Status 1.0.0: de externe boekingslink is beschikbaar. Productie-embedding blijft
uitgeschakeld totdat EMBED-1 is geleverd en tegen de echte backend is getest.**
Een integration-ID alleen schakelt niets vrij. Modal en inline tonen momenteel
een vertaalde foutmelding, zonder iframe. Er is geen automatische `/bf/`-fallback.
Zie [backendafhankelijkheden](docs/backend-contract.md).

## Binnen enkele minuten: externe knop

Kopieer in Space2Book de publieke boekingslink van de locatie. Gebruik de volledige
link, inclusief public ID en slug. Een beschikbaar publiek formulier is voldoende;
een betaalde webformulierkoppeling is hiervoor niet vereist. Plaats deze HTML in
het CMS of de template van de website:

```html
<a href="https://mybooking.space2book.com/bf/PUBLIC_ID/venue"
   target="_blank" rel="noopener noreferrer">Boek direct</a>
```

Vervang `PUBLIC_ID/venue` door de gekopieerde waarden. Deze variant werkt volledig
zonder JavaScript. Styling kan met de eigen website-CSS.

## Modal en inline voorbereiden

Maak in Space2Book een webformulierkoppeling aan, registreer het exacte domein van
de website en kopieer het integration identifier. Backendautorisatie bepaalt
venue, abonnement, domeinen en beschikbare boekingsmogelijkheden. Beide
presentaties gebruiken **dezelfde koppeling en dezelfde adapter**; er is geen
aparte modal- of inline-instelling.

Onderstaande productie-URL's zijn de beoogde publicatiepaden. De bestanden moeten
eerst handmatig gepubliceerd worden; deze repository claimt geen live CDN-release.
Zolang EMBED-1 ontbreekt, tonen beide voorbeelden de veilige foutmelding.

```html
<link rel="stylesheet" href="https://cdn.space2book.com/sdk/1.0.0/space2book.min.css">
<script defer src="https://cdn.space2book.com/sdk/1.0.0/space2book.min.js"></script>

<button type="button" data-s2b-mode="modal"
        data-s2b-integration="INTEGRATION_ID" data-s2b-locale="nl">Boek direct</button>

<div data-s2b-mode="inline"
     data-s2b-integration="INTEGRATION_ID" data-s2b-locale="nl"></div>
```

Het script initialiseert bestaande en dynamisch toegevoegde elementen automatisch.
Herhaald laden of scannen maakt geen tweede formulier. Verwijderde declaratieve
elementen worden opgeruimd; terugplaatsen initialiseert ze opnieuw. Attribuutwijzigingen
vervangen een actief formulier niet. Ruim eerst bewust op voordat je configuratie wijzigt.

Inline vult de breedte van de container. De standaard iframehoogte is 600px en kan
na geverifieerde readiness door de adapter aangepast worden tussen 240 en 20.000px.
De SDK zet geen `scrolling="no"`: zonder betrouwbare hoogte-informatie blijft de
inhoud bereikbaar. De backend moet betrouwbare hoogte-events leveren om dubbele
scrollbars bij lange formulieren te voorkomen.

Volledige voorbeelden: [externe link](examples/external.html),
[modal](examples/modal.html), [inline](examples/inline.html),
[PHP-template](examples/template.php). PHP rendert dezelfde HTML met escaping;
er is geen afzonderlijke PHP SDK.

## Declaratieve attributen

| Attribuut | Betekenis |
| --- | --- |
| `data-s2b-mode` | `external`, `modal` of `inline`. Modal vereist een echt `<button>`-element; gebruik voor de andere modi een container. |
| `data-s2b-integration` | Vereist voor declaratieve modal en inline. Publieke identifier, geen secret. |
| `data-s2b-url` | Expliciete publieke HTTPS-boekingslink. Vereist voor `external`; optionele afzonderlijke link bij embedfouten. |
| `data-s2b-locale` | `nl`, `en` (standaard), `de`, `fr`, `es`. |
| `data-s2b-text` | Tekst voor een gegenereerde externe knop. Schrijf modal-knoptekst rechtstreeks in HTML. |
| `data-s2b-name` | Locatienaam in de modal- en iframetitel; veilig als tekst weergegeven. |
| `data-s2b-color` | Zescijferige hexkleur voor gegenereerde Shadow DOM-controls. Ongeldige kleur gebruikt de standaard. |
| `data-s2b-style-nonce` | Host-CSP-nonce voor style-elementen in Shadow DOM. |

Voor een SDK-gegenereerde externe knop kan een container gebruikt worden:

```html
<div data-s2b-mode="external"
     data-s2b-url="https://mybooking.space2book.com/bf/PUBLIC_ID/venue"
     data-s2b-text="Boek direct" data-s2b-locale="nl"></div>
```

Een gewone `<a>` heeft de voorkeur als JavaScript niet nodig is. Er bestaan geen
HTML-attributen om adapters, endpoints, rechten, tokens of sandboxrechten te veranderen.

## Programmeerbare API

```js
import { createSpace2Book } from './dist/index.js';

const booking = createSpace2Book({
  bookingUrl: 'https://mybooking.space2book.com/bf/PUBLIC_ID/venue',
  integrationId: 'INTEGRATION_ID',
  locale: 'nl',
  branding: { name: 'Onze locatie', color: '#2457A7' },
  buttonText: 'Boek direct',
  onError: code => console.info('Space2Book:', code),
});
const link = booking.createLink(document.querySelector('#link'));
const button = booking.createButton(document.querySelector('#button'));
const inline = booking.mount(document.querySelector('#inline'));

// In een gebruikersactie:
booking.open(document.querySelector('#eigen-knop'));
booking.close(); // Gebruikt dezelfde sluitbeveiliging als alle andere sluitacties.

// Technische teardown, bijvoorbeeld bij het verwijderen van een frameworkcomponent:
inline.destroy(); button.destroy(); link.destroy();
booking.destroy();
```

Zonder geverifieerde adapter tonen modal en inline een foutmelding. Bovenstaande
code claimt geen werkende productie-embedding. Voor alleen externe links is
`integrationId` niet nodig. Voor embed-only configuratie is `bookingUrl` optioneel;
er verschijnt dan geen publieke fallbacklink. Er moet minstens één van beide zijn.

| Methode | Gedrag |
| --- | --- |
| `createSpace2Book(options)` | Maakt een onafhankelijke instantie. ESM-import en factory zijn SSR-veilig. |
| `open(trigger?)` | Lazy mount van de modal. Herhaald openen behoudt iframe en invoer en focust de bestaande modal. |
| `close()` | Centrale sluitcoördinator; kan bevestiging tonen of sluiten blokkeren. |
| `mount(container)` | Inline mount; herhaald aanroepen op dezelfde container retourneert hetzelfde handle. |
| `createButton(container)` | Maakt een gestylede modal-trigger; retourneert een destroy-handle. |
| `createLink(container)` | Maakt een externe boekingsknop met `_blank` en `noopener noreferrer`. Vereist `bookingUrl`. |
| `destroy()` | Technische teardown van alle UI, listeners en timers van de instantie. Geen normale sluitroute. |
| `initDeclarative(root?)` | Idempotente scan; handle ruimt alleen door deze scan aangemaakte elementen op. |
| `observeDeclarative(document?)` | Eén gedeelde observer per document; initialiseert dynamische elementen en ruimt verwijderde op. |
| `destroyDeclarative(document?)` | Stopt de automatische observer en ruimt diens componenten technisch op. |

De singleton `Space2Book` heeft `version`, `init(options)` en dezelfde methoden als
een factory-instantie, plus de declaratieve functies. De browserbundle exposeert
de singleton als `window.Space2Book`. Het door `init` geretourneerde object heeft
ook de gewone instantie-API. `init` vervangt nooit een instantie met een actieve
modal of inline mount; gebruik een factory of voer eerst expliciete teardown uit.

| Optie | Betekenis |
| --- | --- |
| `bookingUrl?: string` | Expliciete absolute HTTPS-link zonder credentials. |
| `integrationId?: string` | Publieke identifier; 1–200 letters/cijfers, `_` of `-`. Definitieve backendvalidatie wacht op EMBED-1. |
| `locale?: Locale` | Vijf bestaande talen; standaard Engels. Wordt meegegeven in adaptercontext. |
| `branding?: {name?, color?}` | Host-UI; beïnvloedt de interne iframevormgeving niet. Tekstkleur wordt op contrast gekozen. |
| `buttonText?: string` | Tekst voor gegenereerde buttons en links. |
| `timeoutMs?: number` | Readiness-timeout, standaard 15.000ms; groter dan nul, maximaal 2.147.483.647. |
| `styleNonce?: string` | Host-CSP-nonce voor SDK-style-elementen. |
| `onError?: (code) => void` | Alleen `integration-disabled`, `integration-error`, `load-error` of `timeout`. |
| `adapter?: IntegrationAdapter` | Vertrouwde code-extensie; voorlopig alleen expliciete fixtures of later een aantoonbaar geverifieerde contractadapter. |

## Sluiten en formulierstatus

Alle normale sluitroutes (knop, backdrop, Escape, `close()` en iframeverzoek)
gebruiken dezelfde coördinator. Het iframe is verborgen en niet interactief vóór
geverifieerde readiness. Laden, een fout vóór interactie en succesvolle afronding
mogen direct sluiten. Een interactief of gewijzigd formulier vraagt bevestiging.
Annuleren behoudt dezelfde iframe-instantie, invoer en scrollpositie en geeft
focus terug aan de hostcontrol of het iframe. Exact herstel van het laatst
actieve veld binnen het cross-origin formulier vereist ondersteuning van het
formulier zelf en moet met EMBED-1 worden gevalideerd.
Escape in de bevestiging annuleert het sluiten.

`submitting` en `uncertain` blokkeren sluiten en tonen uitleg. De publieke link
wordt daarbij verborgen om een tweede aanvraag te voorkomen. Een submit die
begint terwijl de bevestiging openstaat wordt vóór definitief sluiten opnieuw
gecontroleerd. Bij fouten of herladen tijdens submit blijft de noodzakelijke
context behouden. De SDK probeert nooit zelf opnieuw te boeken.

Er kan per document één modal actief zijn; inline kan daarnaast bestaan. Een
andere instantie mag de actieve modal niet stilzwijgend vervangen: `open()` focust
de bestaande modal en werpt een fout. De eigenaar sluit eerst via de coördinator.
De singleton en declaratieve code respecteren dezelfde bescherming.

Toetsen binnen een cross-origin iframe bereiken de host niet. De backendadapter
moet Escape en eigen sluitacties naar het interne sluitverzoek vertalen. De
fixture demonstreert dit; productiegedrag wacht op EMBED-1.

## Fouten, CSP en problemen oplossen

- `integration-disabled`: officiële adapter ontbreekt. Alleen een ID invullen is onvoldoende.
- `integration-error`: ongeldige configuratie, endpoint of adapter. Controleer HTTPS, origin, schema en adapterversie.
- `timeout`: geen geverifieerd `ready` binnen de termijn; controleer netwerk, CSP en het backendcontract.
- `load-error`: iframe-/backendfout of onverwachte navigatie. De SDK voert geen automatische retries uit.

Declaratieve elementen sturen `s2b:error` op het element met uitsluitend
`detail: {code}`. Er worden geen berichten, persoonsgegevens of boekingsresultaten
naar de website doorgestuurd. Configuratiefouten krijgen een toegankelijke melding.
Embedfouten tonen een melding in de SDK-UI. Een expliciet geconfigureerde publieke
link opent alleen na een afzonderlijke gebruikersactie.

Host-CSP moet het gepubliceerde SDK-script toestaan in `script-src`, de optionele
CSS in `style-src`, en straks uitsluitend de officiële API-origin in `frame-src`.
Shadow DOM-style-elementen vereisen een toegestane nonce bij strikte `style-src`;
geef de **per response door de host gegenereerde nonce** door via `styleNonce` of
`data-s2b-style-nonce`. Voeg geen `unsafe-inline`, wildcard of versoepelde iframepolicy toe.
Het backenddocument moet zijn eigen `frame-ancestors` en requestautorisatie leveren.

Controleer bij ontbrekende UI de browserconsole, CDN-MIME-types, CSP en de DOM.
Laad één SDK-versie per pagina. Controleer bij een onbereikbaar embed de actieve
koppeling, rechten en geregistreerde domeinen in Space2Book; de SDK kan die niet
corrigeren. Als de submituitkomst onbekend is: houd het formulier open en dien
niet opnieuw in. Los de uitkomst op via het backendproces zodra dat beschikbaar is.

## Bouwen, testen en publiceren

Node.js 22.13+ of 24, npm, geen runtime-dependencies:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
npm run release
```

`npm test` bouwt eerst. `dist/` bevat leesbare en geminificeerde browserbundles,
ESM met source map, TypeScript declarations en optionele host-CSS. `release/sdk/1.0.0/`
is een lokale publicatiemap met integriteitshashes. Een bestaande versiemap wordt
nooit overschreven. [Publicatie-instructies](docs/distribution.md) beschrijven de
website-origin `www.space2book.com/sdk/` en CDN-host `cdn.space2book.com/sdk/`.
GitHub wordt niet als CDN-origin gebruikt. Geen Bunny- of afbeeldings-CDN-configuratie.

Voor lokaal bekijken: bouw en serveer de repository, bijvoorbeeld met
`python3 -m http.server 8000`, open `/examples/`. PHP-voorbeeld: `php -S localhost:8000`.
De browserfixtures gebruiken twee echte lokale HTTPS-sites en geen productiebackend.
Zie [testdekking en compatibiliteit](docs/testing.md).

Moderne Chromium, Firefox en Safari/WebKit met Shadow DOM, `inert`,
`crypto.randomUUID()` en dynamische viewportunits zijn de doelen. Hostpagina's
moeten via HTTPS worden aangeboden (localhost voor ontwikkeling). Geen IE of
polyfills. Ondersteuning is geen claim dat elke browser in deze omgeving getest is.

Toekomstige WordPress-, React-, Angular-, Vue- en PHP-wrappers gebruiken deze API
met expliciete technische teardown. Er zijn nu geen frameworkpackages of WordPress-plugin toegevoegd.

[Volledig SDK-1 eindrapport](docs/sdk-1-report.md).

[MIT](LICENSE).

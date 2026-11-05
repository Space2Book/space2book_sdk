# Space2Book JavaScript SDK

Lichtgewicht TypeScript SDK zonder runtime-dependencies, met externe boekingslink,
modal en inlineformulier. Een geldige `integrationId` selecteert automatisch de
officiële Space2Book-productieadapter. Klanten hoeven geen adapter of JavaScript
te schrijven. De koppeling gebruikt het geïmplementeerde EMBED-1 v1-contract;
zie [exacte contractreferentie en beveiligingsgrens](docs/backend-contract.md).

De bestanden zijn lokaal gebouwd en getest. Er is in deze opdracht niets naar
productie of Bunny gepubliceerd. Onderstaande CDN-paden werken na publicatie.

## Externe knop

Kopieer de publieke boekingslink van de locatie. Een webformulierkoppeling is niet
nodig; deze HTML werkt ook zonder SDK of JavaScript:

```html
<a href="https://mybooking.space2book.com/bf/PUBLIC_ID/venue"
   target="_blank" rel="noopener noreferrer">Boek direct</a>
```

## Modal en inline

Maak een actieve webformulierkoppeling in Space2Book, registreer het domein van de
website en kopieer de integration identifier: **64 kleine hextekens**. De website
moet op het toegestane HTTPS-domein staan. De backend controleert abonnement,
domein, scope en de beschikbaarheid van het publieke formulier.

Vervang `INTEGRATION_ID` door die identifier. Beide vormen gebruiken exact dezelfde
koppeling en backendinstellingen:

```html
<script defer src="https://cdn.space2book.com/sdk/v1/space2book.min.js"></script>

<button type="button"
        data-s2b-mode="modal"
        data-s2b-integration="INTEGRATION_ID"
        data-s2b-locale="nl">Boek direct</button>

<div data-s2b-mode="inline"
     data-s2b-integration="INTEGRATION_ID"
     data-s2b-locale="nl"></div>
```

Het script initialiseert bestaande en dynamisch toegevoegde elementen automatisch.
Shadow DOM-UI heeft eigen styles; de optionele `space2book.min.css` verzorgt
hostknoppen. Laden is zichtbaar tot een geverifieerd `ready`-bericht. Inline vult
de containerbreedte, begint met 600px en volgt geverifieerde resize-events tussen
240 en 20.000px. Scrollen blijft mogelijk. Er is geen aparte inline-koppeling.

Herhaald laden/scannen maakt geen dubbele componenten. Verwijderde declaratieve
elementen worden opgeruimd; terugplaatsen initialiseert opnieuw. Attribuutwijzigingen
vervangen geen actief formulier. Ruim eerst bewust op bij configuratiewijzigingen.

Voorbeelden: [externe link](examples/external.html), [modal](examples/modal.html),
[inline](examples/inline.html), [PHP-template](examples/template.php).
PHP rendert dezelfde HTML met escaping; er is geen afzonderlijke PHP SDK.

## Declaratieve attributen

| Attribuut | Betekenis |
| --- | --- |
| `data-s2b-mode` | `external`, `modal` of `inline`; modal vereist een `<button>` |
| `data-s2b-integration` | Vereist voor modal/inline; 64 kleine hextekens, publiek identifier |
| `data-s2b-url` | Expliciete publieke HTTPS-link; vereist voor external, optionele afzonderlijke fallback bij embedfouten |
| `data-s2b-locale` | `nl`, `en` (standaard), `de`, `fr`, `es` |
| `data-s2b-text` | Tekst van gegenereerde externe knop; schrijf modal-knoptekst in HTML |
| `data-s2b-name` | Locatienaam in hosttitels, veilig als tekst |
| `data-s2b-color` | Zescijferige hexkleur voor hostcontrols |
| `data-s2b-style-nonce` | De door de host per response gegenereerde CSP-nonce |

Een gegenereerde externe knop gebruikt een container:

```html
<div data-s2b-mode="external"
     data-s2b-url="https://mybooking.space2book.com/bf/PUBLIC_ID/venue"
     data-s2b-text="Boek direct" data-s2b-locale="nl"></div>
```

Een gewone `<a>` heeft de voorkeur als JavaScript niet nodig is. HTML kan geen
embedendpoint, adapter, autorisatie, credentials of sandboxrechten instellen.

## Programmeerbare API

```js
import { createSpace2Book } from './dist/index.js';

const booking = createSpace2Book({
  integrationId: 'INTEGRATION_ID', // vervangen door 64 kleine hextekens
  locale: 'nl',
  // Optioneel: afzonderlijke publieke link, nooit als iframe gebruikt.
  bookingUrl: 'https://mybooking.space2book.com/bf/PUBLIC_ID/venue',
  branding: { name: 'Onze locatie', color: '#2457A7' },
  onError: code => console.info('Space2Book:', code),
});
const inline = booking.mount(document.querySelector('#inline'));
const button = booking.createButton(document.querySelector('#button'));
const link = booking.createLink(document.querySelector('#link'));
booking.open(document.querySelector('#eigen-knop')); // in een gebruikersactie
booking.setLanguage('fr'); // hetzelfde iframe, actuele channel/instance
booking.close(); // centrale sluitbeveiliging

// Expliciete technische teardown, bijvoorbeeld bij verwijderen van een component:
inline.destroy(); button.destroy(); link.destroy(); booking.destroy();
```

Voor alleen externe links is `integrationId` niet nodig. `bookingUrl` is optioneel
voor embed-only gebruik; zonder deze optie verschijnt geen fallbacklink. Minstens
één van beide is verplicht.

| Methode | Gedrag |
| --- | --- |
| `createSpace2Book(options)` | Onafhankelijke instantie; SSR-veilige factory en ESM-import |
| `open(trigger?)` | Lazy modal; herhaald openen focust en behoudt de bestaande frame |
| `close()` | Centrale coördinator voor veilig sluiten |
| `mount(container)` | Inline; dezelfde container geeft hetzelfde handle |
| `createButton(container)` | Gestylede modaltrigger en destroy-handle |
| `createLink(container)` | Publieke link in nieuw tabblad; vereist `bookingUrl` |
| `setLanguage(locale)` | Initialiseert volgende frames en stuurt taal naar actieve frames; backend negeert taalwissels als het formulier die blokkeert |
| `destroy()` | Technische teardown van UI, listeners en timers; geen normale gebruikerssluitroute |
| `initDeclarative(root?)` | Idempotente scan met destroy-handle |
| `observeDeclarative(document?)` | Gedeelde observer voor toevoegen/verwijderen |
| `destroyDeclarative(document?)` | Observer en bijbehorende componenten opruimen |

`Space2Book` heeft `version`, `init(options)` en dezelfde methoden, plus de
declaratieve functies. De browserbundle exposeert `window.Space2Book`.
Een actieve singleton kan niet stilzwijgend vervangen worden. Er kan één modal
per document actief zijn, naast meerdere onafhankelijke inlineframes.

| Optie | Betekenis |
| --- | --- |
| `integrationId?: string` | Officieel publiek token van 64 kleine hextekens |
| `bookingUrl?: string` | Expliciete absolute HTTPS-link zonder credentials |
| `locale?: Locale` | Vijf talen; standaard Engels; host-UI kiest taal bij creatie |
| `branding?: {name?, color?}` | Host-UI; verandert geen interne iframevormgeving |
| `buttonText?: string` | Tekst van gegenereerde knoppen/links |
| `timeoutMs?: number` | Handshaketimeout, standaard 15.000ms; >0 en ≤2.147.483.647 |
| `styleNonce?: string` | Host-CSP-nonce voor SDK-style-elementen |
| `onError?: (code) => void` | Alleen vaste SDK-/backendfoutcode; geen ruwe payload |
| `adapter?: IntegrationAdapter` | Bestaand vertrouwd extensiepunt voor ontwikkelaars/tests; klant hoeft dit nooit te configureren |

## Formulierstatus en sluiten

`ready` is geladen en bruikbaar, met `canClose=true`. `dirty` vraagt bevestiging;
annuleren behoudt de oorspronkelijke frame, invoer en scroll. `submitting` en
`uncertain` blokkeren alle sluitroutes en verbergen de publieke link. De SDK
behoudt de frame voor een identieke retry binnen het backendformulier en boekt
nooit zelf opnieuw. `completed` mag direct sluiten: de aanvraag is **verwerkt**,
wat niet automatisch betaald of definitief bevestigd betekent.

Knop, Escape/backdrop, API-close en backend-`close-request` gebruiken dezelfde
coördinator. Een submit die tijdens de bevestiging begint wordt opnieuw gecontroleerd.
Een gemelde backend-security-/renewalfout behoudt de laatst bekende sluitstatus
en herstelbediening; een latere completion blijft mogelijk. Een echte trackingfout
maakt de behouden frame inert en onzeker. Reload tijdens een onzekere aanvraag
kan verloren gegevens niet reconstrueren en start geen nieuwe boeking.

De backend vertaalt zijn eigen sluitknop naar `close-request`. V1 stuurt geen
algemeen Escape-event vanuit het cross-origin iframe; Escape op de host werkt
via de coördinator. Focus kan naar de iframecontext terug, maar de host kan het
laatst actieve veld binnen de cross-origin pagina niet uitlezen.

## Fouten en CSP

Foutmeldingen zijn vertaald in vijf talen. `onError` en het declaratieve
`s2b:error` (`detail: {code}`) bevatten alleen een vaste code. Integratie ontbreekt,
inactief/ingetrokken, abonnementsrechten, domein, verlopen context, handshake,
timeout en tijdelijke backenduitval worden onderscheiden als de backend een
veilig bericht kan sturen. Een geweigerde initiële HTML-response is door CSP en
browserisolatie niet uitleesbaar: die resulteert in timeout. Zie de
[exacte foutcodes en grenzen](docs/backend-contract.md#foutcodes-en-de-waarneembaarheidsgrens).

Een expliciete publieke link opent alleen na een afzonderlijke gebruikersactie.
Er zijn geen automatische retries, redirects of publieke iframefallbacks.

Host-CSP moet het SDK-script toestaan in `script-src` en **uitsluitend
`https://api.space2book.com`** voor dit embed in `frame-src`. Bij strikte
`style-src` geeft de host zijn response-nonce door via `styleNonce` of
`data-s2b-style-nonce`. Voeg geen wildcard of `unsafe-inline` toe. De iframe gebruikt
`sandbox="allow-scripts allow-forms allow-same-origin allow-popups"` en
`referrerpolicy="no-referrer"`. De backend bepaalt eigen CSP/domeinrechten.

## Bouwen en testen

Node.js 22.13+ of 24, npm, geen runtime-dependencies:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

`dist/` bevat leesbare/geminificeerde browserbundles, ESM met source map,
TypeScript declarations en optionele host-CSS. [Distributie](docs/distribution.md)
beschrijft lokale releasevoorbereiding; er wordt niets automatisch geüpload.

[Testing](docs/testing.md) scheidt synthetische SDK-tests van tests met de echte
EMBED-1-implementatie en wegwerpdata. Moderne Chromium, Firefox en WebKit met
Shadow DOM, inert en crypto zijn de doelen; de uitgevoerde matrix wordt daar
expliciet gerapporteerd. Geen IE of polyfills. Geen frameworkpackages toegevoegd.

Voor lokale voorbeelden: bouw en serveer de repository met bijvoorbeeld
`python3 -m http.server 8000` of `php -S localhost:8000`. Een echte embed vereist
het in Space2Book geregistreerde HTTPS-domein en actieve backendconfiguratie;
een willekeurige localhost-origin krijgt geen autorisatie.

[MIT](LICENSE).

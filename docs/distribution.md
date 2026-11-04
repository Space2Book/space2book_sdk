# Handmatige publicatie onder /sdk/

## Release voorbereiden

```sh
npm ci
npm run release
```

Dit voert typecheck, lint, build en unittests uit en maakt `release/sdk/1.0.0/`.
Voer de browsermatrix apart uit vóór publicatie. De directory mag nog niet
bestaan: een bestaande vaste versie wordt geweigerd. Verhoog voor een volgende
release de versie in `package.json`, `package-lock.json` en `src/index.ts`, en werk
het changelog bij. Controleer `npm pack --dry-run --ignore-scripts`.

Voor het gelijktijdig voorbereiden van de veranderlijke V1-alias:

```sh
npm run release -- --update-v1
```

Gebruik deze vlag tijdens het eerste voorbereiden van een nieuwe versie. De
npm-argumenten worden doorgegeven aan `scripts/release.mjs`. Voor een al gemaakte
release kopieert de publiceerder de geverifieerde vaste map handmatig naar `v1`;
een tweede run overschrijft de vaste map nooit.

## Bestanden en directories

Zorg dat statische bestanden leesbaar zijn voor de webserver (doorgaans bestanden
0644 en directories 0755; pas dit aan het eigen hostingmodel aan).

Upload de volledige inhoud van `release/sdk/1.0.0/` naar de website-origin:

```text
https://www.space2book.com/sdk/1.0.0/
  space2book.js
  space2book.min.js
  space2book.css
  space2book.min.css
  index.js
  index.js.map
  *.d.ts
  integrity.json
```

De publieke CDN-URL heeft dezelfde structuur:
`https://cdn.space2book.com/sdk/1.0.0/space2book.min.js`.
`index.js` is een gebundelde ESM-build; de andere JS-bestanden zijn zelfstandige
browserbundles. De source map hoort uitsluitend bij ESM en bevat publieke
SDK-broncode, geen credentials. De geminificeerde browserbundle heeft geen source map.
Declarations bevatten ook de door `index.d.ts` geïmporteerde moduledeclaraties;
publiceer daarom alle `.d.ts`-bestanden samen.

Kopieer pas na controle van de vaste versie dezelfde release-inhoud naar `/sdk/v1/`.
`1.0.0` blijft onveranderlijk; `v1` is bewust veranderlijk en kan na verificatie
ook teruggezet worden op een eerdere vaste V1-release. Geen bestanden van
historische versies verwijderen of overschrijven. Controleer op de origin
vóór upload dat het vaste versienummer nog niet gepubliceerd is; het lokale
releasescript kan de remote origin niet inspecteren.

`integrity.json` bevat per bestand een SHA-384 SRI-hash. Controleer na upload
bytes en MIME-types. Een publiceerder kan een vaste hash toevoegen aan de HTML
met `integrity="sha384-..." crossorigin="anonymous"` zodra de CDN-response
passende CORS-headers levert. Pas een vaste SRI-hash niet toe op een automatisch
veranderend alias zonder de HTML tegelijk bij te werken.

## HTTP-headers

| Bestanden | Content-Type | Cache-Control |
| --- | --- | --- |
| `.js` | `text/javascript; charset=utf-8` | Vast pad: `public, max-age=31536000, immutable` |
| `.css` | `text/css; charset=utf-8` | Vast pad: idem |
| `.map`, `.json` | `application/json; charset=utf-8` | Vast pad: idem |
| `.d.ts` | `text/plain; charset=utf-8` | Vast pad: idem |
| Alles onder `/v1/` | Volgens extensie | `public, max-age=300, must-revalidate` |

Advies: `X-Content-Type-Options: nosniff`, gzip/Brotli, en voor publieke
ESM-/SRI-bestanden `Access-Control-Allow-Origin: *` zonder credentials. Dit is
alleen een advies voor publieke statische distributiebestanden en geldt niet
voor iframeberichten of backendautorisatie.

Upload vaste versies eerst, controleer ze, publiceer dan de alias en vernieuw zo
nodig alleen de alias-cache via het bestaande hostingproces. Het SDK-releasescript
uploadt niets, configureert Bunny niet en raakt het afbeeldings-CDN niet aan.
GitHub is uitsluitend de bronrepository, nooit CDN-origin.

## HTML bij een locatie

```html
<link rel="stylesheet" href="https://cdn.space2book.com/sdk/1.0.0/space2book.min.css">
<script defer src="https://cdn.space2book.com/sdk/1.0.0/space2book.min.js"></script>
```

De CSS is optioneel voor bestaande hostknoppen; Shadow DOM-UI heeft eigen geïsoleerde
styles. Strikte CSP gebruikt de nonce-optie uit de README. Gebruik vaste
versiepaden voor reproduceerbare integraties; kies `/v1/` alleen als automatische
V1-updates gewenst zijn. Een CDN-publicatie activeert embedding niet zolang de
geverifieerde productieadapter ontbreekt.

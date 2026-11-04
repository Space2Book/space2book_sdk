# EMBED-1 afhankelijkheden en adaptergrens

## Gecontroleerde backendreferentie

Op 4 november 2026 is de lokale backendrepository `/workspace/s2b_dev` alleen gelezen.
`docs/integrations/webforms/embed-contract-v1.md` ontbreekt. Ook de directory
`docs/integrations` ontbreekt in deze checkout.

De bestaande `app.space2book.com/app/Config/MYBOOKING/Routes.php` bevat publieke
`GET bf/{public_id}/{slug}`-routing en publieke `bf-api/v1`-routes. Deze zijn geen
bewijs van een geautoriseerde embedroute en worden niet als iframe gebruikt.
`app/Controllers/API/BookingForm.php::showIframe()` geeft uitsluitend een tekstuele
welkomstmelding terug. Er is geen aantoonbaar definitief embed-/messagecontract
gevonden in de API-routes. Bestaande publieke boekingslogica is niet gekopieerd.

## Productiestatus

Er is bewust **geen productieadapter** geïmplementeerd met verzonnen routes of
payloads. `integrationId` is voorbereid in SDK- en adaptercontext. Declaratieve
HTML kan geen adapter of URL voor embedding injecteren. Zonder adapter bestaat
er geen iframe. Dit geldt identiek voor modal en inline.

`IntegrationAdapter` blijft de bestaande vertrouwde extensiegrens. Een custom
adapter is uitvoerbare integratiecode van de ontwikkelaar, geen frontendautorisatie.
De backend blijft verplicht alle rechten en requestcontext te controleren.
De SDK vereist nu messaging voor geverifieerde readiness; adapters die alleen
iframe-`load` gebruikten falen voortaan bewust gesloten.

## Interne interface, geen wireprotocol

`IntegrationContext` bevat `bookingUrl` (of lege string), optioneel `integrationId`,
`locale`, presentatiemodus, unieke `channelId` en `protocolVersion: 1`.
`embedOrigin` geeft de exacte vertrouwde HTTPS-origin op; bij legacy-adapters
zonder die waarde geldt de publieke-linkorigin. Productie moet expliciet de
geverifieerde API-origin gebruiken. Het endpoint mag geen `/bf/`-pagina of de
publieke boekingslink zelf zijn en moet cross-origin van de host zijn.

De interne normalisatie kent `ready`, `error`, `close`, `state` en `resize`.
Deze namen worden **niet** als definitieve backendberichten gepubliceerd.
Een adapter decodeert uitsluitend de echte wireberichten en retourneert de
minimale interne vorm uit `src/types.ts`. Voor genormaliseerde events accepteert
de core alleen exact de noodzakelijke velden; extra velden, zoals klantgegevens,
worden verworpen. Er worden geen ruwe iframepayloads naar hostevents doorgestuurd.

Toegestane statusovergangen:

```text
loading --verified ready after load--> interactive
interactive --> dirty --> submitting --> uncertain --> completed
interactive ------------> submitting ---------------> completed
loading --> error
```

Herhaalde readiness reset geen voortgang. Dirty kan niet zomaar pristine worden;
completed is terminaal. Onbekende of onmogelijke overgangen worden genegeerd.
Een error vóór readiness verwijdert het iframe. Een fout na interactie behoudt
context en sluitbevestiging; een submitfout wordt uncertain. Nieuwe navigatie
na de eerste load faalt gesloten en mag dezelfde handshake niet hergebruiken.
Een volledig nieuwe mount krijgt een nieuwe channel-ID; oude source/channelberichten
kunnen geen nieuwe instantie beïnvloeden.

## Nodig vóór productie-inschakeling

1. Lees het definitieve contract rechtstreeks uit de backend, inclusief versie en commit.
2. Verifieer HTTP-methode en exacte embedroute, identifierformaat en toegestane URL-parameters.
3. Verifieer bootstrap/handshake, channelbinding, berichtschema's, versievalidatie,
   taalinitialisatie, statusovergangen, sluitverzoek en eventuele hoogte-events.
   Verifieer ook herstel van het laatst actieve veld na een hostbevestiging; de
   host kan alleen focus teruggeven aan het cross-origin iframe als geheel.
4. Verifieer expiratie, intrekking, foutcodes en gedrag tijdens een onzekere submituitkomst.
5. Verifieer sandboxrechten, CSP/frame-ancestors, referrervereisten en cross-site
   werking zonder third-party cookies. Voeg geen client secrets of partnertokens toe.
6. Implementeer één productieadapter; koppel die aan de gedeelde modal/inline-flow
   en de declaratieve integration-ID. Laat de backend alle autorisatie uitvoeren.
7. Test werkelijk actieve, ontbrekende, inactieve en ingetrokken koppelingen,
   verkeerde domeinen en ontbrekende abonnementsrechten.
8. Test directe boeking, offerte en optie; verloren beschikbaarheid, dubbele submit,
   gewijzigde prijzen/voorwaarden en verlopen requestcontext op echte HTTPS-sites.
9. Test Chromium, Firefox en WebKit. Schakel productie pas daarna in.

`tests/fixtures/adapter.mjs` en `tests/browser/*` zijn expliciet synthetische fixtures.
Hun URL's, handshake en events zijn geen voorbeelden voor productieconfiguratie.
Er zijn geen backendbestanden aangepast.

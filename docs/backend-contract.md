# EMBED-1 v1 en de officiële SDK-adapter

De SDK is gebaseerd op het definitieve backendcontract
[`embed-contract-v1.md`](https://github.com/Space2Book/s2b_dev/blob/b8b9c2dbe84e0033d1865d44ebda48652eba8e36/docs/integrations/webforms/embed-contract-v1.md)
in `Space2Book/s2b_dev`, commit **`b8b9c2dbe84e0033d1865d44ebda48652eba8e36`**.
Protocol: **`space2book.embed`, uitsluitend versie 1**. Contract, schema, fixtures,
API-routes/filter, childbridge, gedeelde views/scripts en backendbrowsertests zijn
gelezen. De schema's en negen fixtures zijn ongewijzigd gekopieerd naar
`tests/fixtures/embed-v1/`; Ajv valideert ze in de SDK-tests. Dit vervangt de oude
SDK-1-aanname dat EMBED-1 ontbrak. De synthetische legacy-adapter blijft alleen een testfixture.

## Toegang en verantwoordelijkheden

De officiële `space2bookAdapter` wordt automatisch gebruikt bij een geldige
`integrationId`: exact 64 kleine hextekens. Het enige endpoint is:

```text
https://api.space2book.com/webforms/embed/{integration_identifier}
```

De identifier is het bestaande publieke token van een webformulierkoppeling.
Modal en inline gebruiken dezelfde koppeling, adapter en rechten. De backend
controleert actuele integratie, abonnement, venue, domein en scope op elke aanvraag.
De SDK doet geen boekings-API-aanroepen. Bootstrap/context, HMAC-capabilities,
CSRF, configuratie, catalogus, prijzen, beschikbaarheid, preview, submit, idempotency,
contactgegevens en ontvangstbewijs blijven binnen het iframe/de backend.

Een externe knop gebruikt de expliciete publieke MyBooking-link in een nieuw
tabblad, zonder integratie. Publieke `/bf/`-pagina's worden nooit ingesloten.
Een fallback is een afzonderlijke gebruikersactie; de SDK opent die nooit zelf.
Tijdens `submitting`/`uncertain` is deze link verborgen.

## Handshake en documentlevensduur

1. De host registreert de listener vóór het invoegen van het iframe.
2. Het child maakt een willekeurig channel van 32 kleine hextekens en stuurt
   `hello` met `{}` zonder instance naar elke exact toegestane parent-origin.
3. De SDK controleert eerst `event.origin === 'https://api.space2book.com'` en
   `event.source === iframe.contentWindow`, dan envelope, versie en payload.
4. De SDK antwoordt één keer met `init`, hetzelfde channel, een eigen UUID als
   instance (16–64 ASCII letters/cijfers/`_`/`-`) en `{language: locale}`.
5. Het child maakt intern de beveiligde context en initialiseert het formulier.
6. Alleen `ready: {state:'ready', canClose:true}` toont het iframe.

De SDK accepteert een geldig hello vóór én na `load`; ook ready vóór load blijft
behouden. Load alleen is nooit readiness. Een duplicaathello verstuurt init niet
opnieuw en een duplicaatready wist geen formulierstatus. Elke mount krijgt een
unieke instance. Bij reload blijft die instance stabiel, maar is een nieuw
childchannel verplicht. Oude channels worden ingetrokken en oude events genegeerd,
ook bij een hello vóór het nieuwe load-event. Veilige reloads herinitialiseren
dezelfde frame; reload tijdens submitting/uncertain geeft een geblokkeerde,
onzekere toestand en start geen nieuwe boeking. Verloren iframegegevens kunnen
niet door de SDK worden gereconstrueerd.

De timeout is standaard 15 seconden. Ongeldige berichten worden genegeerd;
zonder geldige handshake/ready volgt timeout. Er is geen wildcard, versieonderhandeling,
initretry met andere claims of automatisch opnieuw boeken.

## Berichten, status en sluiten

De wiredecoder volgt de exacte velden van het vastgelegde JSON-schema en
normaliseert alleen minimale interne events. Ruwe payloads worden nooit aan
hostcallbacks doorgegeven. Onbekende events/versies worden genegeerd. `canClose`
moet bij de beschreven status passen; een vervalste boolean kan geen sluiting toestaan.

| Backend | SDK en gevolg |
| --- | --- |
| `ready` | `interactive`, direct sluiten toegestaan |
| `state: dirty` | Bevestiging voor weggooien vereist |
| `state: submitting` | Sluiten blokkeren; geen publieke fallback |
| `state: uncertain` | Dezelfde frame en retry-UI behouden; sluiten blokkeren |
| `state: completed`, `completed: {processed:true}` | `completed`, sluiten zonder bevestiging |
| `close-request` | Snapshot verwerken en dezelfde centrale sluitcoördinator gebruiken |
| `resize: {height: integer >= 0}` | Alleen geverifieerde inlineframes; hoogte 240–20.000px |
| `error: {code}` | Alleen gedocumenteerde foutcodes; onbekende code wordt `temporarily_unavailable` |
| Host `language` | `setLanguage('nl'|'en'|'de'|'fr'|'es')` met actuele channel/instance |

Naast de bestaande states ondersteunt de core `submitting → dirty` voor een
definitieve validatiefout en `uncertain → submitting` voor exact dezelfde retry.
`completed` is terminaal binnen een document. Voortijdige completion vanuit ready
of dirty wordt genegeerd. Na annuleren van de sluitbevestiging blijven dezelfde
frame, invoer en scroll bestaan. Focus keert terug naar de iframecontext of hostcontrol;
het exacte interne veld kan de cross-origin host niet selecteren.

Een backend-security-/renewalfout ná ready behoudt de laatst bekende sluitstatus,
de zichtbare frame en de listener. Een latere retry/completion blijft mogelijk.
Een echte trackingfout (frame-error/decoder-exceptie) behoudt de frame conservatief
inert en uncertain. Er is geen heartbeat in v1; stilgevallen communicatie tijdens
submitting blijft geblokkeerd tot een definitief bericht of expliciete technische teardown.

`completed` betekent **verwerkt**; een offerte, optie of betaling kan nog opvolging
vereisen. Het betekent niet automatisch betaald of definitief bevestigd.

Hostmeldingen, titels en hun `lang`-metadata behouden de taal van aanmaak.
`setLanguage` verandert alleen de iframecontext en de taal voor volgende mounts.
Zowel de SDK-methode als de publieke mount-handle valideren taal vóór mutatie;
een ongeldige waarde geeft een `TypeError` en verandert init/timeout niet.

## Foutcodes en de waarneembaarheidsgrens

De SDK onderscheidt `integration_not_found`, `integration_inactive`,
`subscription_required`, `booking_form_unavailable`, `invalid_domain_configuration`,
`domain_not_allowed`, `integration_scope_denied`, `embed_context_expired`,
`invalid_handshake`, `invalid_request_protection`, `temporarily_unavailable` en
`rate_limit_exceeded`, plus SDK-codes `timeout`, `load-error`, `integration-error`
en `integration-disabled` (geen integratie/adapter). Meldingen zijn vertaald in
NL/EN/DE/FR/ES. Alleen een vaste code bereikt `onError` of `s2b:error`.

**Een geweigerde initiële HTML-response kan geen vertrouwd bericht sturen.** Die
responses hebben `frame-ancestors 'none'`; de SDK kan hun HTTP-status/body wegens
browserisolatie en ontbrekende CORS niet uitlezen. Zij verschijnen daarom als
handshaketimeout, niet als een verzonnen specifieke diagnose. Zodra de bridge
veilig berichten kan sturen worden echte codes wel onderscheiden. De echte test
controleert de verschillende HTTP-denials apart. Deze contractgrens vereist geen
client-side autorisatieomweg of onbeveiligde preflight-API.

## Sandbox en CSP

Sandbox blijft `allow-scripts allow-forms allow-same-origin allow-popups`.
JavaScript en een bruikbare same-origin-origin zijn vereist voor cookie-vrije
interne requests. Formulieren en externe voorwaardenlinks mogen werken; topnavigatie,
downloadrechten en popup-sandboxescape worden niet toegevoegd. Referrerpolicy:
`no-referrer`. De host moet de API-origin in `frame-src` toestaan en SDK-styles via
een eigen response-nonce toelaten bij strikte CSP. De backend bepaalt
`frame-ancestors` met exact HTTPS root/www-domein, zonder poorten/subdomeinsuffixmatching.

De echte test mount de backend read-only, gebruikt echte filters/controllers/
views/services en een wegwerpdatabase. De voorwaarden-URL uit de storage-double is
leeg; de sandboxtest geeft de echte link een lokale synthetische externe URL.
Dit bewijst popuprechten, niet productie-PDF-/providerbeschikbaarheid.
Zie [testing](testing.md) voor resultaten en grenzen. Productieproxy/CDN-headers,
accountconfiguratie en externe providers vallen onder gezamenlijke integratieacceptatie.

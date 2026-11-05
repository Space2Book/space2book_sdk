import type { Locale } from './types';

const translations = {
  en: { confirm: "Close this booking form? Your progress may be lost.", keep: "Keep booking", discard: "Close and discard", submitting: "Your request is being submitted. Please wait for the result.", uncertain: "The result of your request is unknown. Keep this form open and do not submit again.", disabled: "Embedding is unavailable. Check the webform integration.", book: 'Book now', close: 'Close', loading: 'Loading booking page…', fallback: 'Open booking page', error: 'The embedded booking page is unavailable.', title: 'Book with' },
  nl: { confirm: "Weet je zeker dat je wilt sluiten? Je invoer kan verloren gaan.", keep: "Verder boeken", discard: "Sluiten en invoer wissen", submitting: "Je aanvraag wordt verzonden. Wacht op het resultaat.", uncertain: "Het resultaat van je aanvraag is nog onbekend. Houd dit formulier open en verstuur niet opnieuw.", disabled: "Insluiten is nog niet beschikbaar. Controleer de webformulierkoppeling.", book: 'Nu boeken', close: 'Sluiten', loading: 'Boekingspagina laden…', fallback: 'Boekingspagina openen', error: 'De ingesloten boekingspagina is niet beschikbaar.', title: 'Boek bij' },
  de: { confirm: "Buchungsformular schließen? Deine Eingaben können verloren gehen.", keep: "Weiter buchen", discard: "Schließen und verwerfen", submitting: "Deine Anfrage wird gesendet. Bitte warte auf das Ergebnis.", uncertain: "Das Ergebnis deiner Anfrage ist unbekannt. Lass dieses Formular offen und sende nicht erneut.", disabled: "Einbettung ist nicht verfügbar. Prüfe die Webformular-Integration.", book: 'Jetzt buchen', close: 'Schließen', loading: 'Buchungsseite wird geladen…', fallback: 'Buchungsseite öffnen', error: 'Die eingebettete Buchungsseite ist nicht verfügbar.', title: 'Buchen bei' },
  fr: { confirm: "Fermer ce formulaire ? Vos informations pourraient être perdues.", keep: "Continuer la réservation", discard: "Fermer et abandonner", submitting: "Votre demande est en cours d’envoi. Veuillez attendre le résultat.", uncertain: "Le résultat de votre demande est inconnu. Gardez ce formulaire ouvert et ne renvoyez pas la demande.", disabled: "L’intégration est indisponible. Vérifiez la connexion du formulaire.", book: 'Réserver', close: 'Fermer', loading: 'Chargement de la page de réservation…', fallback: 'Ouvrir la page de réservation', error: 'La page de réservation intégrée est indisponible.', title: 'Réserver avec' },
  es: { confirm: "¿Cerrar este formulario? Podrías perder los datos introducidos.", keep: "Seguir reservando", discard: "Cerrar y descartar", submitting: "Tu solicitud se está enviando. Espera el resultado.", uncertain: "El resultado de tu solicitud es desconocido. Mantén abierto el formulario y no lo envíes de nuevo.", disabled: "La integración no está disponible. Comprueba la conexión del formulario.", book: 'Reservar', close: 'Cerrar', loading: 'Cargando la página de reservas…', fallback: 'Abrir página de reservas', error: 'La página de reservas integrada no está disponible.', title: 'Reservar con' },
} as const;

export function translate(locale: Locale = 'en') {
  return translations[locale] ?? translations.en;
}

const errors = {
  nl: {
    missing: 'Deze boekingskoppeling is niet gevonden. Neem contact op met de locatie.',
    inactive: 'Deze boekingskoppeling is niet actief. Neem contact op met de locatie.',
    subscription: 'Online boeken via deze website is niet beschikbaar. Neem contact op met de locatie.',
    domain: 'Dit boekingsformulier is niet beschikbaar op deze website.',
    context: 'Deze boekingssessie is verlopen of ongeldig. Start opnieuw als je nog geen aanvraag hebt verzonden.',
    handshake: 'Het boekingsformulier kon niet veilig worden geladen. Probeer het later opnieuw.',
    timeout: 'Het laden duurt te lang. Controleer je verbinding en probeer het later opnieuw.',
    temporary: 'Het boekingsformulier is tijdelijk niet beschikbaar. Probeer het later opnieuw.',
  },
  en: {
    missing: 'This booking integration was not found. Please contact the venue.',
    inactive: 'This booking integration is inactive. Please contact the venue.',
    subscription: 'Booking through this website is unavailable. Please contact the venue.',
    domain: 'This booking form is not available on this website.',
    context: 'This booking session has expired or is invalid. Start again if you have not submitted a request.',
    handshake: 'The booking form could not be loaded securely. Please try again later.',
    timeout: 'Loading took too long. Check your connection and try again later.',
    temporary: 'The booking form is temporarily unavailable. Please try again later.',
  },
  de: {
    missing: 'Diese Buchungsintegration wurde nicht gefunden. Bitte kontaktiere den Veranstaltungsort.',
    inactive: 'Diese Buchungsintegration ist inaktiv. Bitte kontaktiere den Veranstaltungsort.',
    subscription: 'Buchen über diese Website ist nicht verfügbar. Bitte kontaktiere den Veranstaltungsort.',
    domain: 'Dieses Buchungsformular ist auf dieser Website nicht verfügbar.',
    context: 'Diese Buchungssitzung ist abgelaufen oder ungültig. Starte erneut, falls du noch keine Anfrage gesendet hast.',
    handshake: 'Das Buchungsformular konnte nicht sicher geladen werden. Bitte versuche es später erneut.',
    timeout: 'Das Laden dauert zu lange. Prüfe deine Verbindung und versuche es später erneut.',
    temporary: 'Das Buchungsformular ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
  },
  fr: {
    missing: 'Cette intégration de réservation est introuvable. Contactez le lieu.',
    inactive: 'Cette intégration de réservation est inactive. Contactez le lieu.',
    subscription: 'La réservation via ce site est indisponible. Contactez le lieu.',
    domain: 'Ce formulaire de réservation est indisponible sur ce site.',
    context: 'Cette session a expiré ou est invalide. Recommencez si vous n’avez pas envoyé de demande.',
    handshake: 'Le formulaire n’a pas pu être chargé de manière sécurisée. Réessayez plus tard.',
    timeout: 'Le chargement prend trop de temps. Vérifiez votre connexion et réessayez plus tard.',
    temporary: 'Le formulaire est temporairement indisponible. Réessayez plus tard.',
  },
  es: {
    missing: 'No se ha encontrado esta integración de reservas. Contacta con el establecimiento.',
    inactive: 'Esta integración de reservas está inactiva. Contacta con el establecimiento.',
    subscription: 'Las reservas desde este sitio no están disponibles. Contacta con el establecimiento.',
    domain: 'Este formulario de reservas no está disponible en este sitio.',
    context: 'Esta sesión ha caducado o no es válida. Empieza de nuevo si no has enviado una solicitud.',
    handshake: 'No se pudo cargar el formulario de forma segura. Inténtalo más tarde.',
    timeout: 'La carga tarda demasiado. Comprueba tu conexión e inténtalo más tarde.',
    temporary: 'El formulario no está disponible temporalmente. Inténtalo más tarde.',
  },
} as const;

export function errorText(locale: Locale, code: import('./types').ErrorCode): string {
  const messages = errors[locale];
  switch (code) {
    case 'integration_not_found': case 'booking_form_unavailable': return messages.missing;
    case 'integration_inactive': return messages.inactive;
    case 'subscription_required': return messages.subscription;
    case 'domain_not_allowed': case 'invalid_domain_configuration': case 'integration_scope_denied': return messages.domain;
    case 'embed_context_expired': case 'invalid_request_protection': return messages.context;
    case 'invalid_handshake': return messages.handshake;
    case 'timeout': return messages.timeout;
    case 'temporarily_unavailable': case 'rate_limit_exceeded': return messages.temporary;
    case 'integration-disabled': return translate(locale).disabled;
    default: return translate(locale).error;
  }
}

import type { Locale } from './types';

const translations = {
  en: { book: 'Book now', close: 'Close', loading: 'Loading booking page…', fallback: 'Open booking page', error: 'The embedded booking page is unavailable.', title: 'Book with' },
  nl: { book: 'Nu boeken', close: 'Sluiten', loading: 'Boekingspagina laden…', fallback: 'Boekingspagina openen', error: 'De ingesloten boekingspagina is niet beschikbaar.', title: 'Boek bij' },
  de: { book: 'Jetzt buchen', close: 'Schließen', loading: 'Buchungsseite wird geladen…', fallback: 'Buchungsseite öffnen', error: 'Die eingebettete Buchungsseite ist nicht verfügbar.', title: 'Buchen bei' },
  fr: { book: 'Réserver', close: 'Fermer', loading: 'Chargement de la page de réservation…', fallback: 'Ouvrir la page de réservation', error: 'La page de réservation intégrée est indisponible.', title: 'Réserver avec' },
  es: { book: 'Reservar', close: 'Cerrar', loading: 'Cargando la página de reservas…', fallback: 'Abrir página de reservas', error: 'La página de reservas integrada no está disponible.', title: 'Reservar con' },
} as const;

export function translate(locale: Locale = 'en') {
  return translations[locale] ?? translations.en;
}

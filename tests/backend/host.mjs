import { createSpace2Book } from '/dist/index.js';
const identifier = 'a'.repeat(64);
window.errors = [];
window.events = [];
window.violations = [];
window.addEventListener('message', event => {
  if (event.origin === 'https://api.space2book.com') window.events.push(event.data);
});
document.addEventListener('securitypolicyviolation', event => window.violations.push(event.violatedDirective));
const params = new URLSearchParams(location.search);
window.sdk = createSpace2Book({
  integrationId: params.has('missing') ? 'f'.repeat(64) : identifier,
  locale: 'en', styleNonce: 'sdk-test', timeoutMs: params.has('denied') || params.has('missing') ? 1500 : 15000,
  bookingUrl: 'https://mybooking.space2book.com/bf/venue_1/house',
  onError: code => window.errors.push(code),
});
document.querySelector('#open').addEventListener('click', event => window.sdk.open(event.currentTarget));
if (params.has('inline')) window.inline = window.sdk.mount(document.querySelector('main'));

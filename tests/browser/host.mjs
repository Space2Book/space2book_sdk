/** Browser test fixture only. All data is synthetic. */
import { createSpace2Book } from '/dist/index.js';
const params = new URLSearchParams(location.search);
window.violations = [];
document.addEventListener('securitypolicyviolation', event => window.violations.push(event.violatedDirective));
const adapter = {
  embedOrigin: 'https://127.0.0.1:9444',
  resolveEmbedUrl: context => 'https://127.0.0.1:9444/' + (params.has('redirect') ? 'redirect' : 'tests/browser/frame.html') + '?channel=' + context.channelId,
  messaging: {
    version: 1,
    createInitMessage: context => ({ fixture: context.channelId }),
    parseMessage: data => data,
  },
};
window.sdk = createSpace2Book({
  integrationId: 'FIXTURE_ONLY',
  bookingUrl: 'https://mybooking.space2book.com/bf/PUBLIC_ID/venue',
  styleNonce: 'fixture-style',
  timeoutMs: params.has('redirect') ? 300 : 5000,
  ...(params.has('disabled') ? {} : { adapter }),
});
document.querySelector('#trigger').addEventListener('click', event => window.sdk.open(event.currentTarget));

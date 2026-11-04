/** TEST FIXTURE: no booking API, credentials, cookies or real customer data. */
const channelId = new URLSearchParams(location.search).get('channel');
const send = (type, payload = {}) => parent.postMessage({ version: 1, channelId, type, ...payload }, 'https://localhost:9443');
window.addEventListener('message', event => {
  if (event.source === parent && event.origin === 'https://localhost:9443' && event.data?.fixture === channelId) send('ready');
});
document.querySelector('#input').addEventListener('input', () => send('state', { state: 'dirty' }));
for (const [id, state] of [['submit', 'submitting'], ['uncertain', 'uncertain'], ['complete', 'completed']]) {
  document.getElementById(id).addEventListener('click', () => send('state', { state }));
}
document.querySelector('#close').addEventListener('click', () => send('close'));
window.addEventListener('keydown', event => { if (event.key === 'Escape') send('close'); });

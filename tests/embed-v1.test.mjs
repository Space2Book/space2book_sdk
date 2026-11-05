import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import Ajv2020 from 'ajv/dist/2020.js';
import { createSpace2Book, initDeclarative, space2bookAdapter as adapter, SPACE2BOOK_EMBED_ORIGIN as origin } from '../dist/index.js';

const integrationId = 'a'.repeat(64);
const channel = 'b'.repeat(32);
const nextChannel = 'c'.repeat(32);
let dom;
const handles = [];
function setup(options = {}, mode = 'modal') {
  dom = new JSDOM('<!doctype html><body><button>Book</button><main></main><aside></aside>', {
    url: 'https://voorbeeld.nl', pretendToBeVisual: true,
  });
  globalThis.document = dom.window.document;
  const errors = [];
  const sdk = createSpace2Book({ integrationId, locale: 'nl', onError: code => errors.push(code), ...options });
  handles.push(sdk);
  if (mode === 'modal') sdk.open();
  else sdk.mount(document.querySelector('main'));
  const root = mode === 'modal' ? [...document.body.children].find(e => e.shadowRoot)?.shadowRoot : document.querySelector('main').firstChild.shadowRoot;
  const frame = root.querySelector('iframe');
  const sent = [];
  Object.defineProperty(frame, 'contentWindow', { value: { postMessage: (...args) => sent.push(args) } });
  const send = (type, payload = {}, extra = {}, event = {}) => dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
    origin, source: frame.contentWindow,
    data: { protocol: 'space2book.embed', version: 1, channel,
      ...(type !== 'hello' ? { instance: sent.at(-1)?.[0].instance } : {}), type, payload, ...extra }, ...event,
  }));
  const load = () => frame.dispatchEvent(new dom.window.Event('load'));
  const hello = () => send('hello');
  const ready = () => send('ready', { state: 'ready', canClose: true });
  const state = value => send('state', { state: value, canClose: value === 'completed' });
  return { sdk, root, frame, sent, send, load, hello, ready, state, errors };
}
afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  dom?.window.close();
  delete globalThis.document;
});

test('official URL and 64 lowercase hex identifier are selected without customer adapter code', () => {
  const { frame, sent, load } = setup();
  assert.equal(frame.src, origin + '/webforms/embed/' + integrationId);
  load(); assert.equal(sent.length, 0);
  for (const integrationId of ['ID', 'A'.repeat(64), 'a'.repeat(63), '../bf/venue', 'a'.repeat(65), 'a'.repeat(64) + '\n']) {
    assert.throws(() => createSpace2Book({ integrationId }));
  }
  assert.throws(() => adapter.resolveEmbedUrl({ integrationId: 'a'.repeat(64) + '?override=1' }));
});

for (const order of ['hello-ready-load', 'hello-load-ready', 'load-hello-ready']) {
  test(`race-safe handshake: ${order}`, () => {
    const { frame, root, sent, hello, ready, load, sdk } = setup();
    for (const step of order.split('-')) ({ hello, ready, load })[step]();
    assert.equal(frame.hidden, false);
    assert.equal(root.querySelector('[role="status"]').hidden, true);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0][0], { protocol: 'space2book.embed', version: 1, channel,
      instance: sent[0][0].instance, type: 'init', payload: { language: 'nl' } });
    assert.match(sent[0][0].instance, /^[A-Za-z0-9_-]{16,64}$/);
    assert.equal(sent[0][1], origin);
    sdk.close(); assert.equal(frame.isConnected, false); // ready canClose=true
  });
}

test('actual backend fixtures decode; only child messages become normalized events', () => {
  const fixtures = JSON.parse(readFileSync('tests/fixtures/embed-v1/embed-messages-v1.fixtures.json', 'utf8'));
  const schema = JSON.parse(readFileSync('tests/fixtures/embed-v1/embed-messages-v1.schema.json', 'utf8'));
  const validate = new Ajv2020({ strict: false }).compile(schema);
  for (const fixture of fixtures) assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...fixtures[0], version: 2 }), false);
  const context = { channelId: fixtures[0].channel, instanceId: 'sdk_instance_123456' };
  for (const fixture of fixtures) {
    const parsed = adapter.messaging.parseMessage(fixture, context);
    assert.equal(!!parsed, !['init', 'language'].includes(fixture.type), fixture.type);
    if (parsed) assert.ok(!JSON.stringify(parsed).includes('payload'));
  }
});

test('source, exact origin, protocol, version, instance, envelope and payload are all checked', () => {
  const { send, hello, ready, sent, frame } = setup();
  for (const origin of ['null', 'http://api.space2book.com', 'https://api.space2book.com:444', 'https://api.space2book.com.evil.nl']) send('hello', {}, {}, { origin });
  send('hello', {}, {}, { source: dom.window });
  for (const extra of [{ version: 2 }, { protocol: 'old' }, { channel: 'invalid' }, { instance: 'not-on-hello' }, { secret: 'ignored' }]) send('hello', {}, extra);
  send('hello', { capability: 'ignored' }); assert.equal(sent.length, 0);
  hello();
  const valid = { state: 'ready', canClose: true };
  for (const extra of [{ instance: 'wrong_instance_123' }, { channel: nextChannel }, { version: '1' }, { booking_code: 'PRIVATE' }]) send('ready', valid, extra);
  for (const payload of [null, [], {}, { state: 'ready', canClose: false }, { ...valid, customer: 'PRIVATE' }]) send('ready', payload);
  send('unknown', {});
  assert.equal(frame.hidden, true);
  ready(); assert.equal(frame.hidden, false);
});

test('duplicate hello/ready/completed never resend init or reset progress', () => {
  const { hello, ready, state, sent, sdk, root } = setup();
  hello(); ready(); state('dirty'); hello(); ready();
  assert.equal(sent.length, 1);
  sdk.close(); assert.ok(root.querySelector('.confirmation'));
  root.querySelector('.confirmation button').click();
  state('submitting'); state('completed'); state('completed'); state('dirty');
  sdk.close(); assert.equal(root.host.isConnected, false);
});

for (const early of [true, false]) {
  test(`reload requires a new channel, fresh hello ${early ? 'before' : 'after'} load`, () => {
    const { hello, ready, load, send, sent, frame, sdk } = setup();
    hello(); ready(); load();
    const firstInstance = sent[0][0].instance;
    if (!early) load();
    send('hello', {}, { channel: nextChannel });
    send('ready', { state: 'ready', canClose: true }, { channel: nextChannel });
    if (early) load();
    assert.equal(sent.length, 2);
    assert.equal(sent[1][0].instance, firstInstance);
    assert.equal(sent[1][0].channel, nextChannel);
    hello(); send('state', { state: 'submitting', canClose: false });
    assert.equal(sent.length, 2);
    sdk.close(); assert.equal(frame.isConnected, false);
  });
}

test('readiness waits for real ready, and malformed messages eventually time out', async () => {
  const { hello, send, frame, root, errors } = setup({ timeoutMs: 10 });
  hello(); send('ready', { state: 'ready', canClose: false });
  assert.equal(frame.hidden, true);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(errors, ['timeout']); assert.equal(frame.isConnected, false);
  assert.match(root.querySelector('.content [role="alert"]').textContent, /lang/);
});

test('dirty close cancellation retains frame and data; definitive validation allows submitting -> dirty', () => {
  const { hello, ready, load, state, send, sdk, root, frame } = setup();
  hello(); ready(); load(); state('dirty');
  frame.scrollTop = 87;
  send('close-request', { state: 'dirty', canClose: false });
  root.querySelector('.confirmation button').click();
  assert.equal(root.querySelector('iframe'), frame); assert.equal(frame.scrollTop, 87);
  state('submitting'); state('dirty'); sdk.close();
  assert.ok(root.querySelector('.confirmation'));
});

for (const stateBeforeError of ['interactive', 'dirty', 'submitting', 'uncertain', 'completed']) {
  test(`backend security errors retain ${stateBeforeError} close semantics and recovery`, () => {
    const { hello, ready, load, state, send, sdk, root, frame, errors } = setup({ bookingUrl: 'https://mybooking.space2book.com/bf/venue/test' });
    hello(); ready(); load();
    if (stateBeforeError !== 'interactive') state('dirty');
    if (['submitting', 'uncertain', 'completed'].includes(stateBeforeError)) state('submitting');
    if (['uncertain', 'completed'].includes(stateBeforeError)) state(stateBeforeError);
    send('error', { code: 'embed_context_expired' });
    assert.deepEqual(errors, ['embed_context_expired']);
    assert.equal(root.querySelector('iframe'), frame); assert.notEqual(frame.inert, true);
    sdk.close();
    if (['submitting', 'uncertain'].includes(stateBeforeError)) {
      assert.equal(root.querySelector('.confirmation'), null); assert.equal(root.querySelector('footer').hidden, true);
      state('submitting'); state('completed'); send('completed', { processed: true }); sdk.close();
      assert.equal(frame.isConnected, false);
    } else if (stateBeforeError === 'dirty') assert.ok(root.querySelector('.confirmation'));
    else assert.equal(frame.isConnected, false);
  });
}

test('lost document during submit cannot be reinitialized as a new booking', () => {
  const { hello, ready, load, state, send, sdk, root, frame, sent } = setup();
  hello(); ready(); load(); state('submitting'); load();
  send('hello', {}, { channel: nextChannel }); ready(); state('completed'); sdk.close();
  assert.equal(sent.length, 1); assert.equal(root.querySelector('iframe'), frame);
  assert.equal(frame.inert, true); assert.equal(root.querySelector('.confirmation'), null);
});

test('language changes use bound instance/channel, resize is verified and clamped', () => {
  const { sdk, hello, ready, load, send, frame, sent } = setup({}, 'inline');
  sdk.setLanguage('de'); hello(); assert.equal(sent[0][0].payload.language, 'de');
  ready(); load(); sdk.setLanguage('fr');
  assert.equal(sent.at(-1)[0].type, 'language'); assert.equal(sent.at(-1)[0].payload.language, 'fr');
  send('resize', { height: 1100 }); assert.equal(frame.style.height, '1100px');
  for (const height of [-1, '800', 500.5, 20001]) send('resize', { height });
  assert.equal(frame.style.height, '1100px');
  send('resize', { height: 0 }); assert.equal(frame.style.height, '240px');
  assert.throws(() => sdk.setLanguage('xx'));
});

test('declarative modal and inline need only the official identifier', () => {
  setup(); handles[0].destroy();
  document.body.innerHTML = `<button data-s2b-mode="modal" data-s2b-integration="${integrationId}" data-s2b-locale="nl">Boek direct</button><div data-s2b-mode="inline" data-s2b-integration="${integrationId}"></div>`;
  handles.push(initDeclarative(document));
  const inline = document.querySelector('div').firstChild.shadowRoot.querySelector('iframe');
  document.querySelector('button').click();
  const modal = [...document.body.children].at(-1).shadowRoot.querySelector('iframe');
  assert.equal(inline.src, modal.src); assert.match(inline.src, /api.space2book.com\/webforms\/embed\//);
});

test('documented error codes are sanitized and translated, unknown errors normalize', () => {
  const { hello, ready, send, errors, root } = setup();
  hello(); ready(); send('error', { code: 'internal_error' });
  assert.deepEqual(errors, ['temporarily_unavailable']);
  assert.match(root.querySelector('.content [role="alert"]').textContent, /tijdelijk/);
  assert.ok(!root.textContent.includes('internal_error'));
});


test('official inline and modal instances isolate channels, instances and stale sources', () => {
  const { sdk, root, frame, hello, ready, load, sent, send } = setup({}, 'inline');
  hello(); ready(); load();
  const firstInstance = sent[0][0].instance;
  sdk.open();
  const modalRoot = [...document.body.children].map(e => e.shadowRoot).find(r => r?.querySelector('.panel'));
  const second = modalRoot.querySelector('iframe');
  const commands = [];
  Object.defineProperty(second, 'contentWindow', { value: { postMessage: (...args) => commands.push(args) } });
  const secondSend = (type, payload, extra = {}) => dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
    origin, source: second.contentWindow, data: { protocol: 'space2book.embed', version: 1, channel: nextChannel,
      ...(type !== 'hello' ? { instance: commands[0]?.[0].instance } : {}), type, payload, ...extra },
  }));
  secondSend('hello', {}); secondSend('ready', { state: 'ready', canClose: true });
  second.dispatchEvent(new dom.window.Event('load'));
  assert.notEqual(commands[0][0].instance, firstInstance);
  send('state', { state: 'submitting', canClose: false }, { channel: nextChannel, instance: commands[0][0].instance });
  sdk.close(); assert.equal(second.isConnected, false); assert.equal(root.querySelector('iframe'), frame);
  sdk.setLanguage('es'); assert.equal(sent.at(-1)[0].instance, firstInstance);
});

test('initialization errors expose only fixed codes, in all five visitor languages', () => {
  const codes = ['integration_not_found', 'integration_inactive', 'subscription_required', 'domain_not_allowed',
    'embed_context_expired', 'invalid_handshake', 'temporarily_unavailable', 'invalid_domain_configuration',
    'integration_scope_denied', 'invalid_request_protection', 'rate_limit_exceeded', 'booking_form_unavailable'];
  setup(); handles[0].destroy();
  for (const locale of ['nl', 'en', 'de', 'fr', 'es']) {
    for (const code of codes) {
      const reported = [];
      const sdk = createSpace2Book({ integrationId, locale, onError: value => reported.push(value) });
      sdk.mount(document.querySelector('main'));
      const root = document.querySelector('main').lastChild.shadowRoot;
      const frame = root.querySelector('iframe'); const sent = [];
      Object.defineProperty(frame, 'contentWindow', { value: { postMessage: data => sent.push(data) } });
      const send = (type, payload) => dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        origin, source: frame.contentWindow, data: { protocol: 'space2book.embed', version: 1, channel,
          ...(type !== 'hello' ? { instance: sent[0]?.instance } : {}), type, payload },
      }));
      send('hello', {}); send('error', { code });
      assert.deepEqual(reported, [code]); assert.equal(frame.isConnected, false);
      const alert = root.querySelector('[role="alert"]'); assert.ok(alert.textContent); assert.equal(alert.hidden, false);
      assert.ok(!alert.textContent.includes(code)); sdk.destroy();
    }
  }
});

test('language changed after init is delivered after real readiness without restarting the handshake', () => {
  const { sdk, hello, ready, sent } = setup();
  hello(); sdk.setLanguage('es');
  assert.equal(sent.length, 1);
  ready();
  assert.equal(sent.length, 2); assert.equal(sent[1][0].type, 'language');
  assert.equal(sent[1][0].payload.language, 'es');
  assert.equal(sent[0][0].instance, sent[1][0].instance);
  assert.equal(sent[0][0].channel, sent[1][0].channel);
});

for (const phase of ['before-hello', 'after-init', 'ready']) {
  test(`mount handle rejects unsupported JavaScript locales without changing the ${phase} session`, async () => {
    const { sdk, hello, ready, sent, frame, errors, root } = setup({ timeoutMs: phase === 'ready' ? 15000 : 10 }, 'inline');
    const mount = sdk.mount(document.querySelector('main'));
    if (phase !== 'before-hello') hello();
    if (phase === 'ready') ready();
    const count = sent.length;
    const windowErrors = [];
    dom.window.addEventListener('error', event => { windowErrors.push(event.message); event.preventDefault(); });
    for (const value of ['xx', '', null, undefined, {}, 7]) {
      assert.throws(() => mount.setLanguage(value), { name: 'TypeError', message: 'Unsupported locale.' });
    }
    assert.equal(sent.length, count);
    if (phase === 'before-hello') hello();
    assert.equal(sent[0][0].payload.language, 'nl');
    if (phase === 'ready') {
      mount.setLanguage('fr');
      assert.equal(sent.at(-1)[0].type, 'language');
      assert.equal(sent.at(-1)[0].payload.language, 'fr');
      assert.equal(frame.hidden, false);
    } else {
      await new Promise(resolve => setTimeout(resolve, 30));
      assert.deepEqual(errors, ['timeout']);
      assert.equal(frame.isConnected, false);
      assert.match(root.querySelector('[role="alert"]').textContent, /Het laden duurt te lang/);
    }
    assert.deepEqual(windowErrors, []);
  });
}

for (const mode of ['modal', 'inline']) {
  test(`${mode} host text keeps its creation language after iframe language changes, errors and reload`, () => {
    const { sdk, hello, ready, load, send, root, sent } = setup({ bookingUrl: 'https://mybooking.space2book.com/bf/venue/test' }, mode);
    hello(); ready(); load(); sdk.setLanguage('fr');
    assert.equal(sent.at(-1)[0].payload.language, 'fr');
    const content = root.querySelector('.content');
    assert.equal(content.lang, 'nl');
    assert.equal(root.querySelector('footer a').textContent, 'Boekingspagina openen');
    send('error', { code: 'temporarily_unavailable' });
    assert.match(content.querySelector('[role="alert"]').textContent, /^Het boekingsformulier is tijdelijk/);
    load();
    assert.equal(content.lang, 'nl');
    assert.equal(content.querySelector('[role="status"]').textContent, 'Boekingspagina laden…');
    send('hello', {}, { channel: nextChannel });
    assert.equal(sent.at(-1)[0].payload.language, 'fr');
  });
}

test('SDK option and method reject unsupported locales before any language mutation', () => {
  const { sdk, hello, ready, sent } = setup();
  hello(); ready();
  for (const value of ['xx', '', null, {}, 7]) {
    assert.throws(() => createSpace2Book({ integrationId, locale: value }), /Unsupported locale/);
    assert.throws(() => sdk.setLanguage(value), /Unsupported locale/);
  }
  assert.equal(sent.length, 1);
  sdk.setLanguage('de');
  assert.equal(sent.at(-1)[0].payload.language, 'de');
});

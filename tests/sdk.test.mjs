import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createSpace2Book, Space2Book, VERSION } from '../dist/index.js';

const bookingUrl = 'https://booking.example.invalid/public';
let dom;
let sdk;

function setup(options = {}) {
  dom = new JSDOM('<!doctype html><body><button id="trigger">Book</button><main></main></body>', {
    url: 'https://host.example.invalid/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  globalThis.document = dom.window.document;
  sdk = createSpace2Book({ bookingUrl, ...options });
  return { doc: document, win: dom.window, container: document.querySelector('main') };
}

function modal(doc = document) {
  return [...doc.body.children].map((node) => node.shadowRoot)
    .find((root) => root?.querySelector('[role="dialog"]'));
}

function adapterFixture() {
  let context;
  let calls = 0;
  return {
    get context() { return context; },
    get calls() { return calls; },
    adapter: {
      resolveEmbedUrl(value) { context = value; return bookingUrl; },
      messaging: {
        version: 1,
        createInitMessage(value) { return { fixture: value.channelId }; },
        parseMessage(data) { calls++; return data; },
      },
    },
  };
}

function message(win, frame, data, overrides = {}) {
  win.dispatchEvent(new win.MessageEvent('message', {
    origin: new URL(bookingUrl).origin,
    source: frameWindow(frame),
    data,
    ...overrides,
  }));
}

function frameWindow(frame) {
  // jsdom does not create browsing contexts for shadow-root iframes.
  if (!frame.contentWindow) {
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage() {} } });
  }
  return frame.contentWindow;
}

afterEach(() => {
  sdk?.destroy();
  Space2Book.destroy();
  dom?.window.close();
  delete globalThis.document;
});

test('SSR-safe factory, version and strict public URL validation', () => {
  assert.equal(VERSION, '0.1.0');
  for (const url of ['javascript:alert(1)', 'http://example.invalid', '/relative', '******example.invalid']) {
    assert.throws(() => createSpace2Book({ bookingUrl: url }));
  }
  for (const timeoutMs of [0, -1, NaN, Infinity, 2147483648]) {
    assert.throws(() => createSpace2Book({ bookingUrl, timeoutMs }));
  }
  const instance = createSpace2Book({ bookingUrl });
  assert.throws(() => instance.open(), /browser document/);
  instance.destroy();
  assert.throws(() => Space2Book.open(), /init/);
});

test('disabled integration gives an accessible localized modal and safe fallback', () => {
  const errors = [];
  const { doc } = setup({ locale: 'nl', onError: (code) => errors.push(code) });
  const trigger = doc.querySelector('#trigger');
  trigger.focus();
  sdk.open();
  const root = modal();
  assert.equal(root.querySelector('section').getAttribute('aria-modal'), 'true');
  assert.equal(root.querySelector('section').lang, 'nl');
  assert.equal(root.querySelector('iframe'), null);
  assert.equal(root.querySelector('button').textContent, 'Sluiten');
  assert.equal(root.querySelector('a').href, bookingUrl);
  assert.equal(root.querySelector('a').rel, 'noopener noreferrer');
  assert.deepEqual(errors, ['integration-disabled']);
  assert.equal(doc.body.style.overflow, 'hidden');
  assert.equal(trigger.inert, true);
  root.querySelector('button').click();
  assert.equal(modal(), undefined);
  assert.equal(doc.activeElement, trigger);
  assert.equal(doc.body.style.overflow, '');
});

test('focus cycles, Escape closes and pre-existing inert/scroll state is restored', async () => {
  const { doc, win, container } = setup();
  container.inert = true;
  doc.body.style.overflow = 'clip';
  sdk.open();
  const root = modal();
  const first = root.querySelector('button');
  const last = root.querySelector('a');
  first.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, composed: true }));
  assert.equal(root.activeElement, last);
  last.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true }));
  assert.equal(root.activeElement, first);
  const late = doc.createElement('aside');
  doc.body.append(late);
  await Promise.resolve();
  assert.equal(late.inert, true);
  first.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
  assert.equal(modal(), undefined);
  assert.equal(container.inert, true);
  assert.equal(doc.body.style.overflow, 'clip');
});

test('multiple buttons, repeated opens, direct links and handle cleanup', () => {
  const { container } = setup();
  const one = sdk.createButton(container);
  sdk.createButton(container);
  sdk.createLink(container);
  const buttons = [...container.children].map((host) => host.shadowRoot.querySelector('button')).filter(Boolean);
  assert.equal(buttons.length, 2);
  buttons[0].click();
  buttons[1].click();
  assert.equal([...document.body.children].filter((host) => host.shadowRoot?.querySelector('[role="dialog"]')).length, 1);
  sdk.close();
  assert.equal(container.children[1].shadowRoot.activeElement, buttons[1]);
  assert.equal(container.children[2].shadowRoot.querySelector('a').href, bookingUrl);
  one.destroy();
  one.destroy();
  sdk.destroy();
  assert.equal(container.children.length, 0);
  assert.throws(() => sdk.open(), /destroyed/);
});

test('all supported locales and safe branding text/color', () => {
  const { container } = setup();
  for (const [locale, label] of [['nl', 'Nu boeken'], ['en', 'Book now'], ['de', 'Jetzt buchen'], ['fr', 'Réserver'], ['es', 'Reservar']]) {
    const instance = createSpace2Book({ bookingUrl, locale });
    instance.createButton(container);
    assert.equal(container.lastChild.shadowRoot.querySelector('button').textContent, label);
    instance.destroy();
  }
  const instance = createSpace2Book({
    bookingUrl,
    branding: { name: '<img src=x onerror=alert(1)>', color: 'red; background:url(evil)' },
  });
  instance.open();
  assert.equal(modal().querySelector('img'), null);
  assert.match(modal().querySelector('h2').textContent, /<img/);
  assert.equal(modal().host.style.getPropertyValue('--s2b-color'), '#2457d6');
  instance.destroy();
});

test('inline frame sandbox, explicit adapter, loading state and destruction', () => {
  const { container, win } = setup({ adapter: { resolveEmbedUrl: () => bookingUrl } });
  const handle = sdk.mount(container);
  const root = container.firstChild.shadowRoot;
  const frame = root.querySelector('iframe');
  assert.equal(frame.src, bookingUrl);
  assert.equal(frame.referrerPolicy, 'no-referrer');
  assert.equal(frame.getAttribute('sandbox'), 'allow-scripts allow-forms allow-same-origin allow-popups');
  assert.equal(root.querySelector('[role="status"]').hidden, false);
  frame.dispatchEvent(new win.Event('load'));
  assert.equal(root.querySelector('[role="status"]').hidden, true);
  handle.destroy();
  assert.equal(container.children.length, 0);
});

test('branding selects contrasting button text for light and dark colors', () => {
  const { container } = setup();
  for (const [color, contrast] of [['#ffffff', '#000'], ['#000000', '#fff'], ['#ffff00', '#000']]) {
    const instance = createSpace2Book({ bookingUrl, branding: { color } });
    instance.createButton(container);
    assert.equal(container.lastChild.style.getPropertyValue('--s2b-contrast'), contrast);
    instance.open();
    assert.equal(modal().host.style.getPropertyValue('--s2b-contrast'), contrast);
    instance.destroy();
  }
});

test('invalid, off-origin, host-origin and unsupported adapters fail closed', () => {
  const { container } = setup();
  for (const url of ['http://booking.example.invalid', 'https://evil.example.invalid', 'https://host.example.invalid/']) {
    const errors = [];
    const instance = createSpace2Book({
      bookingUrl: url.includes('host.') ? url : bookingUrl,
      adapter: { resolveEmbedUrl: () => url },
      onError: (code) => errors.push(code),
    });
    instance.mount(container);
    assert.equal(container.lastChild.shadowRoot.querySelector('iframe'), null);
    assert.deepEqual(errors, ['integration-error']);
    instance.destroy();
  }
  const fixture = adapterFixture();
  fixture.adapter.messaging.version = 2;
  const instance = createSpace2Book({ bookingUrl, adapter: fixture.adapter });
  instance.mount(container);
  assert.equal(container.lastChild.shadowRoot.querySelector('iframe'), null);
  instance.destroy();
});

test('messaging checks origin/source before parsing and validates version/channel', () => {
  const fixture = adapterFixture();
  const { win } = setup({ adapter: fixture.adapter });
  sdk.open();
  const root = modal();
  const frame = root.querySelector('iframe');
  let sent;
  frameWindow(frame).postMessage = (...args) => { sent = args; };
  frame.dispatchEvent(new win.Event('load'));
  assert.equal(sent[1], new URL(bookingUrl).origin);
  const valid = { type: 'ready', version: 1, channelId: fixture.context.channelId };
  message(win, frame, valid, { origin: 'https://evil.example.invalid' });
  message(win, frame, valid, { source: win });
  message(win, frame, valid, { origin: 'null' });
  assert.equal(fixture.calls, 0);
  for (const value of [null, {}, { ...valid, version: 2 }, { ...valid, channelId: 'stale' }, { ...valid, type: 'unknown' }]) {
    message(win, frame, value);
    assert.equal(root.querySelector('[role="status"]').hidden, false);
  }
  message(win, frame, valid);
  assert.equal(root.querySelector('[role="status"]').hidden, true);
  frame.dispatchEvent(new win.Event('load'));
  assert.equal(root.querySelector('[role="status"]').hidden, false);
  message(win, frame, { ...valid, type: 'close' });
  assert.equal(modal(), undefined);
  const calls = fixture.calls;
  message(win, frame, valid);
  assert.equal(fixture.calls, calls);
});

test('timeout, frame error and adapter exceptions retain fallback without retries', async () => {
  const errors = [];
  const fixture = adapterFixture();
  const { container } = setup({ adapter: fixture.adapter, timeoutMs: 10, onError: (code) => errors.push(code) });
  sdk.mount(container);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const root = container.firstChild.shadowRoot;
  assert.equal(root.querySelector('iframe'), null);
  assert.equal(root.querySelector('a').href, bookingUrl);
  assert.deepEqual(errors, ['timeout']);
});

test('readiness before initial load is preserved', async () => {
  const fixture = adapterFixture();
  delete fixture.adapter.messaging.createInitMessage;
  const errors = [];
  const { win, container } = setup({ adapter: fixture.adapter, timeoutMs: 10, onError: (code) => errors.push(code) });
  sdk.mount(container);
  const root = container.firstChild.shadowRoot;
  const frame = root.querySelector('iframe');
  message(win, frame, { version: 1, channelId: fixture.context.channelId, type: 'ready' });
  frame.dispatchEvent(new win.Event('load'));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(root.querySelector('[role="status"]').hidden, true);
  assert.deepEqual(errors, []);
});

test('synchronous error callbacks can destroy or close UI during creation', () => {
  const { container } = setup();
  for (const mode of ['modal', 'inline']) {
    const instance = createSpace2Book({ bookingUrl, onError: () => instance.destroy() });
    if (mode === 'modal') instance.open();
    else instance.mount(container);
    assert.equal(modal(), undefined);
    assert.equal(container.children.length, 0);
    assert.equal(document.body.style.overflow, '');
    assert.throws(() => instance.open(), /destroyed/);
  }
  const instance = createSpace2Book({ bookingUrl, onError: () => instance.close() });
  instance.open();
  assert.equal(modal(), undefined);
  instance.destroy();
});

test('frame error, normalized backend error and decoder failure clean up', () => {
  const { container, win } = setup();
  for (const failure of ['frame', 'backend', 'decoder']) {
    const fixture = adapterFixture();
    const errors = [];
    if (failure === 'decoder') fixture.adapter.messaging.parseMessage = () => { throw new Error('invalid'); };
    const instance = createSpace2Book({ bookingUrl, adapter: fixture.adapter, onError: (code) => errors.push(code) });
    instance.mount(container);
    const root = container.lastChild.shadowRoot;
    const frame = root.querySelector('iframe');
    if (failure === 'frame') frame.dispatchEvent(new win.Event('error'));
    else message(win, frame, { version: 1, channelId: fixture.context.channelId, type: 'error' });
    assert.equal(root.querySelector('iframe'), null);
    assert.deepEqual(errors, [failure === 'decoder' ? 'integration-error' : 'load-error']);
    instance.destroy();
  }
});

test('singleton initialization is atomic and browser bundle exposes the same API', () => {
  const { win } = setup();
  Space2Book.init({ bookingUrl });
  assert.throws(() => Space2Book.init({ bookingUrl: 'http://invalid' }));
  Space2Book.open();
  assert.ok(modal());
  Space2Book.close();
  win.eval(readFileSync(new URL('../dist/space2book.min.js', import.meta.url), 'utf8'));
  assert.equal(win.Space2Book.version, '0.1.0');
  win.Space2Book.init({ bookingUrl });
  win.Space2Book.open();
  assert.ok(modal());
  win.Space2Book.destroy();
});

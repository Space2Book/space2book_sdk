import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createSpace2Book, destroyDeclarative, initDeclarative, observeDeclarative, Space2Book } from '../dist/index.js';
import { adapterFixture, fixtureOrigin } from './fixtures/adapter.mjs';

const bookingUrl = 'https://mybooking.space2book.com/bf/PUBLIC_ID/venue';
let dom;
const instances = [];
const observers = [];
function setup(options = {}) {
  dom = new JSDOM('<!doctype html><body><button id="trigger">Book</button><main></main>', {
    url: 'https://host.example.invalid/', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  globalThis.document = dom.window.document;
  const fixture = adapterFixture();
  const sdk = createSpace2Book({ bookingUrl, adapter: fixture.adapter, ...options });
  instances.push(sdk);
  const root = () => [...document.body.children].map(e => e.shadowRoot).find(r => r?.querySelector('.panel'));
  const send = (type, payload = {}, overrides = {}) => {
    const frame = root()?.querySelector('iframe') ?? document.querySelector('main').firstChild.shadowRoot.querySelector('iframe');
    if (!frame.contentWindow) Object.defineProperty(frame, 'contentWindow', { value: { postMessage() {} } });
    dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
      origin: fixtureOrigin, source: frame.contentWindow,
      data: { version: 1, channelId: fixture.context.channelId, type, ...payload }, ...overrides,
    }));
  };
  const ready = () => { root().querySelector('iframe').dispatchEvent(new dom.window.Event('load')); send('ready'); };
  return { sdk, fixture, root, send, ready, win: dom.window, container: document.querySelector('main') };
}
afterEach(() => {
  for (const observer of observers.splice(0)) observer.destroy();
  for (const sdk of instances.splice(0)) sdk.destroy();
  Space2Book.destroy();
  dom?.window.Space2Book?.destroyDeclarative();
  dom?.window.Space2Book?.destroy();
  dom?.window.close();
  delete globalThis.document;
});

test('external helper needs no integration and opens a protected new tab', () => {
  const { sdk, container } = setup({ adapter: undefined, buttonText: 'Boek direct' });
  sdk.createLink(container);
  const link = container.firstChild.shadowRoot.querySelector('a');
  assert.equal(link.href, bookingUrl);
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(link.textContent, 'Boek direct');
  assert.equal(container.querySelector('iframe'), null);
});

test('plain HTML link works with scripting disabled', () => {
  const html = readFileSync('examples/external.html', 'utf8');
  const page = new JSDOM(html);
  const link = page.window.document.querySelector('a');
  assert.equal(link.href, bookingUrl);
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(page.window.document.querySelector('script'), null);
  page.window.close();
});

for (const action of ['button', 'backdrop', 'escape', 'api', 'iframe']) {
  test(`${action} uses confirmation; cancellation preserves frame, focus and scroll`, () => {
    const { sdk, root, ready, send, win } = setup();
    sdk.open(document.querySelector('#trigger'));
    ready();
    const frame = root().querySelector('iframe');
    frame.scrollTop = 73;
    root().querySelector('button').focus();
    if (action === 'button') root().querySelector('button').click();
    if (action === 'backdrop') root().querySelector('.backdrop').click();
    if (action === 'escape') document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (action === 'api') sdk.close();
    if (action === 'iframe') send('close');
    assert.ok(root().querySelector('[role="alertdialog"]'));
    root().querySelector('.confirmation button').click();
    assert.equal(root().querySelector('.confirmation'), null);
    assert.equal(root().querySelector('iframe'), frame);
    assert.equal(frame.scrollTop, 73);
    assert.equal(root().activeElement, root().querySelector('button'));
    assert.equal(document.body.style.overflow, 'hidden');
    sdk.close();
    root().querySelector('.confirmation button:last-child').click();
    assert.equal(root(), undefined);
    assert.equal(document.activeElement, document.querySelector('#trigger'));
    assert.equal(document.body.style.overflow, '');
  });
}

test('dirty cannot become pristine; premature completion cannot bypass confirmation', () => {
  const { sdk, root, ready, send } = setup();
  sdk.open(); ready();
  send('state', { state: 'dirty' });
  send('state', { state: 'interactive' });
  send('state', { state: 'completed' });
  sdk.close();
  assert.ok(root().querySelector('.confirmation'));
});

test('submitting and uncertain block all close routes, hide fallback, then complete safely', () => {
  const { sdk, root, ready, send, win } = setup();
  sdk.open(); ready();
  for (const state of ['submitting', 'uncertain']) {
    send('state', { state });
    sdk.close(); root().querySelector('button').click(); root().querySelector('.backdrop').click();
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' })); send('close');
    assert.ok(root().querySelector('iframe'));
    assert.equal(root().querySelector('.confirmation'), null);
    assert.equal(root().querySelector('footer').hidden, true);
    assert.equal(root().querySelector('[role="alert"]').hidden, false);
  }
  send('state', { state: 'completed' });
  sdk.close();
  assert.equal(root(), undefined);
});

test('submit starting during confirmation cannot be discarded', () => {
  const { sdk, root, ready, send } = setup();
  sdk.open(); ready(); sdk.close();
  send('state', { state: 'submitting' });
  root().querySelector('.confirmation button:last-child').click();
  assert.ok(root().querySelector('iframe'));
  assert.equal(root().querySelector('.confirmation'), null);
});

test('repeat open and another instance never replace an active form or unlock scroll', () => {
  const { sdk, root, ready } = setup();
  sdk.open(); ready();
  const frame = root().querySelector('iframe');
  sdk.open();
  const other = createSpace2Book({ bookingUrl }); instances.push(other);
  assert.throws(() => other.open(), /Another/);
  other.close(); other.destroy();
  assert.equal(root().querySelector('iframe'), frame);
  assert.equal(document.body.style.overflow, 'hidden');
});

test('reload and submit errors retain uncertain context and reject subsequent messages', () => {
  const { sdk, root, ready, send, win } = setup();
  sdk.open(); ready(); send('state', { state: 'submitting' });
  const frame = root().querySelector('iframe');
  frame.dispatchEvent(new win.Event('load'));
  send('state', { state: 'completed' });
  sdk.close();
  assert.equal(root().querySelector('iframe'), frame);
  assert.equal(root().querySelector('.confirmation'), null);
  assert.match(root().querySelector('[role="alert"]').textContent, /unknown/);
});

test('unready iframe is hidden and load alone never establishes readiness', () => {
  const { sdk, root, send, win } = setup();
  sdk.open();
  const frame = root().querySelector('iframe');
  send('ready'); assert.equal(frame.hidden, true);
  frame.dispatchEvent(new win.Event('load')); assert.equal(frame.hidden, true);
  send('ready'); assert.equal(frame.hidden, false);
});

test('unexpected payload fields, unknown state, wrong origin/source/channel/version are ignored', () => {
  const { sdk, root, ready, send, win } = setup();
  sdk.open(); ready();
  for (const payload of [{ version: 2 }, { channelId: 'old' }, { customer: 'PRIVATE' }]) send('state', { state: 'submitting', ...payload });
  send('state', { state: 'submitting' }, { source: win });
  send('state', { state: 'submitting' }, { origin: 'https://evil.invalid' });
  send('state', { state: 'unknown' });
  send('invented');
  sdk.close(); assert.ok(root().querySelector('.confirmation'));
});

test('inline mounts are idempotent, resize is bounded, independent and remountable', () => {
  const { sdk, container, win, fixture } = setup();
  const one = sdk.mount(container);
  assert.equal(sdk.mount(container), one);
  const root = container.firstChild.shadowRoot;
  const frame = root.querySelector('iframe');
  Object.defineProperty(frame, 'contentWindow', { value: { postMessage() {} } });
  frame.dispatchEvent(new win.Event('load'));
  const send = (type, extra = {}) => win.dispatchEvent(new win.MessageEvent('message', {
    source: frame.contentWindow, origin: fixtureOrigin,
    data: { type, version: 1, channelId: fixture.context.channelId, ...extra },
  }));
  send('ready'); send('resize', { height: 900 }); assert.equal(frame.style.height, '900px');
  for (const height of [-1, 239, 20001, Infinity, '800', 500.5]) send('resize', { height });
  assert.equal(frame.style.height, '900px');
  send('close'); assert.ok(container.firstChild);
  one.destroy(); one.destroy();
  sdk.mount(container);
  assert.notEqual(container.firstChild.shadowRoot.querySelector('iframe'), frame);
});

test('public /bf pages, absent messaging and untrusted origin cannot be embedded', () => {
  const { container } = setup();
  for (const adapter of [
    { resolveEmbedUrl: () => bookingUrl },
    { embedOrigin: 'https://mybooking.space2book.com', resolveEmbedUrl: () => bookingUrl, messaging: adapterFixture().adapter.messaging },
    { ...adapterFixture().adapter, resolveEmbedUrl: () => 'https://evil.invalid/official' },
  ]) {
    const errors = [];
    const sdk = createSpace2Book({ bookingUrl, adapter, onError: c => errors.push(c) }); instances.push(sdk);
    sdk.mount(container);
    assert.equal(container.lastChild.shadowRoot.querySelector('iframe'), null);
    assert.deepEqual(errors, ['integration-error']);
  }
});

test('integration-only options do not fabricate public fallback links or iframe endpoints', () => {
  const { container } = setup();
  const sdk = createSpace2Book({ integrationId: 'INTEGRATION_ID', locale: 'nl' }); instances.push(sdk);
  sdk.mount(container);
  assert.equal(container.lastChild.shadowRoot.querySelector('iframe'), null);
  assert.equal(container.lastChild.shadowRoot.querySelector('a'), null);
  assert.throws(() => sdk.createLink(container), /bookingUrl/);
});

test('declarative scans, double script load, dynamic removal and reinitialization are safe', async () => {
  const { container, win } = setup();
  container.innerHTML = '<button data-s2b-mode="modal" data-s2b-integration="ID">Book</button><div data-s2b-mode="inline" data-s2b-integration="ID"></div>';
  const observer = observeDeclarative(document); observers.push(observer);
  assert.equal(observeDeclarative(document), observer);
  observers.push(initDeclarative(document));
  const inline = container.lastChild;
  assert.equal(inline.children.length, 1);
  const button = container.firstChild;
  assert.equal(button.type, 'button');
  const script = readFileSync('dist/space2book.min.js', 'utf8');
  win.eval(script); const global = win.Space2Book; win.eval(script);
  assert.equal(win.Space2Book, global);
  assert.equal(inline.children.length, 1);
  inline.remove(); await Promise.resolve();
  assert.equal(inline.children.length, 0);
  container.append(inline); await Promise.resolve();
  assert.equal(inline.children.length, 1);
  observer.destroy();
  assert.equal(inline.children.length, 0);
});

test('invalid declarative configuration reports only sanitized error codes', () => {
  const { container } = setup();
  container.innerHTML = '<div data-s2b-mode="inline" data-s2b-integration="bad value"></div>';
  let detail;
  container.firstChild.addEventListener('s2b:error', event => { detail = event.detail; });
  observers.push(initDeclarative(container));
  assert.deepEqual(detail, { code: 'integration-error' });
  assert.equal(container.querySelector('iframe'), null);
  assert.ok(container.querySelector('[role="alert"]'));
});

test('singleton reconfiguration cannot destroy active forms returned by init', () => {
  const { container } = setup();
  const sdk = Space2Book.init({ bookingUrl });
  sdk.mount(container);
  assert.throws(() => Space2Book.init({ bookingUrl }), /Destroy/);
  assert.ok(container.firstChild);
});

test('a stale channel or source cannot ready a new inline frame', () => {
  const { sdk, container, win, fixture } = setup();
  const old = sdk.mount(container);
  const previous = container.firstChild.shadowRoot.querySelector('iframe');
  Object.defineProperty(previous, 'contentWindow', { value: { postMessage() {} } });
  const oldChannel = fixture.context.channelId;
  old.destroy(); sdk.mount(container);
  const current = container.firstChild.shadowRoot.querySelector('iframe');
  Object.defineProperty(current, 'contentWindow', { value: { postMessage() {} } });
  current.dispatchEvent(new win.Event('load'));
  assert.notEqual(oldChannel, fixture.context.channelId);
  for (const [source, channelId] of [
    [previous.contentWindow, oldChannel], [previous.contentWindow, fixture.context.channelId], [current.contentWindow, oldChannel],
  ]) {
    win.dispatchEvent(new win.MessageEvent('message', { source, origin: fixtureOrigin, data: { type: 'ready', version: 1, channelId } }));
    assert.equal(current.hidden, true);
  }
});

test('multiple inline contexts have distinct channels and isolated destruction', () => {
  const { sdk, container, fixture } = setup();
  const first = sdk.mount(container);
  const channel = fixture.context.channelId;
  const secondContainer = document.createElement('aside'); container.after(secondContainer);
  sdk.mount(secondContainer);
  assert.notEqual(channel, fixture.context.channelId);
  first.destroy();
  assert.equal(container.children.length, 0);
  assert.ok(secondContainer.firstChild.shadowRoot.querySelector('iframe'));
});


test('synchronous declarative error handlers can stop observation without leaving UI or observers', () => {
  const { container } = setup();
  container.innerHTML = '<div data-s2b-mode="inline" data-s2b-integration="ID"></div>';
  const element = container.firstChild;
  element.addEventListener('s2b:error', () => destroyDeclarative(document), { once: true });
  const observer = observeDeclarative(document); observers.push(observer);
  assert.equal(element.children.length, 0);
  // Disposed handles are idempotent and must not disconnect the next observer.
  const next = observeDeclarative(document); observers.push(next);
  observer.destroy();
  assert.notEqual(next, observer);
  assert.equal(element.children.length, 1);
});

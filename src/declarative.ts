import { createSpace2Book } from './index';
import { translate } from './i18n';
import type { EmbedHandle, Locale, SDKOptions } from './types';

const stateKey = Symbol.for('space2book.declarative.v1');
interface DeclarativeState { registry: Map<HTMLElement, EmbedHandle>; observer?: EmbedHandle }
function stateFor(doc: Document): DeclarativeState {
  const shared = doc as Document & { [stateKey]?: DeclarativeState };
  if (!shared[stateKey]) Object.defineProperty(shared, stateKey, { value: { registry: new Map() } });
  return shared[stateKey]!;
}
const selector = '[data-s2b-mode]';

/** Idempotent scan. Destroy the returned handle before intentionally changing configuration. */
export function initDeclarative(root: ParentNode = document): EmbedHandle {
  const doc = root.nodeType === 9 ? root as Document : root.ownerDocument ?? document;
  const registry = stateFor(doc).registry;
  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
  if (root instanceof (root.ownerDocument ?? document).defaultView!.HTMLElement && root.matches(selector)) {
    elements.unshift(root as HTMLElement);
  }
  const owned: EmbedHandle[] = [];
  for (const element of elements) {
    if (registry.has(element)) continue;
    const doc = element.ownerDocument;
    const win = doc.defaultView!;
    let cleanup: (() => void) | undefined;
    let error: HTMLElement | undefined;
    const notify = (code: string) => element.dispatchEvent(new win.CustomEvent('s2b:error', { detail: { code } }));
    const report = (code: string) => {
      if (!error) {
        error = doc.createElement('p');
        error.setAttribute('role', 'alert');
        error.textContent = translate(element.dataset.s2bLocale as Locale).disabled;
        element.after(error);
      }
      notify(code);
    };
    let disposed = false;
    const handle: EmbedHandle = {
      destroy() {
        if (disposed) return;
        disposed = true;
        cleanup?.();
        error?.remove();
        registry.delete(element);
      },
    };
    registry.set(element, handle);
    owned.push(handle);
    try {
      const mode = element.dataset.s2bMode;
      if (!['external', 'modal', 'inline'].includes(mode ?? '')) throw new TypeError('Invalid mode.');
      const options: SDKOptions = {
        ...(element.dataset.s2bUrl ? { bookingUrl: element.dataset.s2bUrl } : {}),
        ...(element.dataset.s2bIntegration ? { integrationId: element.dataset.s2bIntegration } : {}),
        ...(element.dataset.s2bLocale ? { locale: element.dataset.s2bLocale as Locale } : {}),
        ...(element.dataset.s2bText !== undefined ? { buttonText: element.dataset.s2bText } : {}),
        ...(element.dataset.s2bStyleNonce ? { styleNonce: element.dataset.s2bStyleNonce } : {}),
        branding: {
          ...(element.dataset.s2bColor ? { color: element.dataset.s2bColor } : {}),
          ...(element.dataset.s2bName ? { name: element.dataset.s2bName } : {}),
        },
        onError: notify,
      };
      if (mode !== 'external' && !options.integrationId) throw new TypeError('An integration identifier is required.');
      if (mode === 'modal' && !(element instanceof win.HTMLButtonElement)) throw new TypeError('Use a button for modal triggers.');
      const sdk = createSpace2Book(options);
      cleanup = () => sdk.destroy();
      if (mode === 'inline') sdk.mount(element);
      else if (mode === 'external') sdk.createLink(element);
      else {
        const button = element as HTMLButtonElement;
        const oldType = button.getAttribute('type');
        const oldPopup = button.getAttribute('aria-haspopup');
        button.type = 'button';
        button.setAttribute('aria-haspopup', 'dialog');
        const click = () => { try { sdk.open(button); } catch { report('integration-error'); } };
        button.addEventListener('click', click);
        cleanup = () => {
          button.removeEventListener('click', click);
          for (const [name, value] of [['type', oldType], ['aria-haspopup', oldPopup]]) {
            if (value === null) button.removeAttribute(name!);
            else button.setAttribute(name!, value!);
          }
          sdk.destroy();
        };
      }
    } catch { report('integration-error'); }
    if (disposed) cleanup?.();
  }
  return { destroy() { for (const handle of owned) handle.destroy(); } };
}


/** Disconnect the automatic observer and technically tear down its forms. */
export function destroyDeclarative(doc: Document = document): void {
  stateFor(doc).observer?.destroy();
}

/** Event-driven dynamic initialization and cleanup. No polling or automatic form replacement. */
export function observeDeclarative(doc: Document = document): EmbedHandle {
  const shared = stateFor(doc);
  const registry = shared.registry;
  const existing = shared.observer;
  if (existing) return existing;
  const owned = new Set<HTMLElement>();
  let disposed = false;
  const scan = (root: ParentNode) => {
    const before = new Set(registry.keys());
    initDeclarative(root);
    for (const element of registry.keys()) {
      if (!before.has(element)) {
        if (disposed) registry.get(element)?.destroy();
        else owned.add(element);
      }
    }
  };
  const observer = new doc.defaultView!.MutationObserver((records) => {
    for (const [element, handle] of registry) {
      if (element.ownerDocument === doc && !element.isConnected) {
        handle.destroy();
        owned.delete(element);
      }
    }
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof doc.defaultView!.HTMLElement && node.isConnected &&
            (node.matches(selector) || node.querySelector(selector))) scan(node);
      }
    }
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  const handle: EmbedHandle = {
    destroy() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      for (const element of owned) registry.get(element)?.destroy();
      owned.clear();
      delete shared.observer;
    },
  };
  shared.observer = handle;
  scan(doc);
  return handle;
}

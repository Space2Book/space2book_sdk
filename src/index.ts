import { destroyDeclarative, initDeclarative, observeDeclarative } from './declarative';
import { createEmbed } from './embed';
import { translate } from './i18n';
import { createModal } from './modal';
import { brandColor, brandTextColor, publicUrl } from './security';
import { styles } from './styles';
import type { BookingSDK, EmbedHandle, ModalHandle, SDKOptions } from './types';

export type * from './types';
export { destroyDeclarative, initDeclarative, observeDeclarative } from './declarative';
export const VERSION = '1.0.0';
const activeForms = new WeakMap<BookingSDK, () => boolean>();

export function createSpace2Book(input: SDKOptions): BookingSDK {
  const options: SDKOptions = {
    ...input,
    ...(input.bookingUrl ? { bookingUrl: publicUrl(input.bookingUrl).href } : {}),
    ...(input.branding ? { branding: { ...input.branding } } : {}),
  };
  if (input.bookingUrl !== undefined && !input.bookingUrl) throw new TypeError('bookingUrl must be a nonempty HTTPS URL.');
  if (!options.bookingUrl && !options.integrationId) throw new TypeError('Supply bookingUrl or integrationId.');
  if (options.integrationId !== undefined && !/^[A-Za-z0-9_-]{1,200}$/.test(options.integrationId)) {
    throw new TypeError('Invalid integration identifier.');
  }
  if (options.locale && !['nl', 'en', 'de', 'fr', 'es'].includes(options.locale)) throw new TypeError('Unsupported locale.');
  if (options.timeoutMs !== undefined &&
      (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0 || options.timeoutMs > 2147483647)) {
    throw new TypeError('timeoutMs must be between 0 and 2147483647.');
  }
  const handles = new Set<EmbedHandle>();
  const mounts = new WeakMap<HTMLElement, EmbedHandle>();
  const inlineHandles = new Set<EmbedHandle>();
  let modal: ModalHandle | undefined;
  let modalGeneration = 0;
  let destroyed = false;
  const assertActive = () => {
    if (destroyed) throw new Error('This Space2Book instance has been destroyed.');
    if (typeof document === 'undefined' || !document.body) {
      throw new Error('Space2Book DOM methods require a browser document with a body.');
    }
  };
  const attach = (container: HTMLElement, render: (root: ShadowRoot) => EmbedHandle): EmbedHandle => {
    assertActive();
    const host = container.ownerDocument.createElement('div');
    host.style.setProperty('--s2b-color', brandColor(options.branding?.color));
    host.style.setProperty('--s2b-contrast', brandTextColor(brandColor(options.branding?.color)));
    const root = host.attachShadow({ mode: 'open' });
    const style = container.ownerDocument.createElement('style');
    style.textContent = styles;
    if (options.styleNonce) style.nonce = options.styleNonce;
    root.append(style);
    container.append(host);
    let child: EmbedHandle;
    try {
      child = render(root);
    } catch (error) {
      host.remove();
      throw error;
    }
    let disposed = false;
    const handle = {
      destroy() {
        if (disposed) return;
        disposed = true;
        child.destroy();
        host.remove();
        handles.delete(handle);
      },
    };
    if (destroyed) handle.destroy();
    else handles.add(handle);
    return handle;
  };
  const sdk: BookingSDK = {
    open(trigger) {
      assertActive();
      if (modal?.active) { modal.focus(); return; }
      const generation = ++modalGeneration;
      const next = createModal(options, trigger);
      if (destroyed || generation !== modalGeneration) next.destroy();
      else modal = next;
    },
    close() {
      modalGeneration++;
      modal?.requestClose();
      if (!modal?.active) modal = undefined;
    },
    mount(container) {
      assertActive();
      const existing = mounts.get(container);
      if (existing) return existing;
      const mounted = attach(container, (root) => {
        const wrapper = container.ownerDocument.createElement('div');
        root.append(wrapper);
        return createEmbed(wrapper, options, 'inline', () => {});
      });
      const handle = {
        destroy() {
          mounted.destroy();
          if (mounts.get(container) === handle) mounts.delete(container);
          inlineHandles.delete(handle);
        },
      };
      if (!destroyed) { mounts.set(container, handle); inlineHandles.add(handle); }
      return handle;
    },
    createButton(container) {
      return attach(container, (root) => {
        const button = container.ownerDocument.createElement('button');
        button.type = 'button';
        button.lang = options.locale ?? 'en';
        button.textContent = options.buttonText ?? translate(options.locale).book;
        button.setAttribute('aria-haspopup', 'dialog');
        const click = () => sdk.open(button);
        button.addEventListener('click', click);
        root.append(button);
        return { destroy() { button.removeEventListener('click', click); button.remove(); } };
      });
    },
    createLink(container) {
      if (!options.bookingUrl) throw new TypeError('createLink requires a public bookingUrl.');
      return attach(container, (root) => {
        const link = container.ownerDocument.createElement('a');
        link.href = options.bookingUrl!;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'booking-link';
        link.lang = options.locale ?? 'en';
        link.textContent = options.buttonText ?? translate(options.locale).book;
        root.append(link);
        return { destroy: () => link.remove() };
      });
    },
    destroy() {
      modalGeneration++;
      modal?.destroy();
      modal = undefined;
      for (const handle of inlineHandles) handle.destroy();
      for (const handle of handles) handle.destroy();
      destroyed = true;
    },
  };
  activeForms.set(sdk, () => !!modal?.active || inlineHandles.size > 0);
  return sdk;
}

let defaultInstance: BookingSDK | undefined;
function instance(): BookingSDK {
  if (!defaultInstance) throw new Error('Call Space2Book.init(options) first.');
  return defaultInstance;
}

export const Space2Book = {
  version: VERSION,
  destroyDeclarative,
  initDeclarative,
  observeDeclarative,
  init(options: SDKOptions): BookingSDK {
    if (defaultInstance && activeForms.get(defaultInstance)?.()) throw new Error('Destroy the existing singleton before reinitializing it.');
    const next = createSpace2Book(options);
    defaultInstance?.destroy();
    defaultInstance = next;
    return next;
  },
  open: (trigger?: HTMLElement): void => instance().open(trigger),
  close: (): void => defaultInstance?.close(),
  mount: (container: HTMLElement): EmbedHandle => instance().mount(container),
  createButton: (container: HTMLElement): EmbedHandle => instance().createButton(container),
  createLink: (container: HTMLElement): EmbedHandle => instance().createLink(container),
  destroy(): void {
    defaultInstance?.destroy();
    defaultInstance = undefined;
  },
};

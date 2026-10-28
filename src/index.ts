import { createEmbed } from './embed';
import { translate } from './i18n';
import { createModal } from './modal';
import { brandColor, brandTextColor, publicUrl } from './security';
import { styles } from './styles';
import type { BookingSDK, EmbedHandle, SDKOptions } from './types';

export type * from './types';
export const VERSION = '0.1.0';

export function createSpace2Book(input: SDKOptions): BookingSDK {
  const options: SDKOptions = {
    ...input,
    bookingUrl: publicUrl(input.bookingUrl).href,
    ...(input.branding ? { branding: { ...input.branding } } : {}),
  };
  if (options.timeoutMs !== undefined &&
      (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0 || options.timeoutMs > 2147483647)) {
    throw new TypeError('timeoutMs must be between 0 and 2147483647.');
  }
  const handles = new Set<EmbedHandle>();
  let modal: EmbedHandle | undefined;
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
    root.append(style);
    container.append(host);
    let child: EmbedHandle;
    try {
      child = render(root);
    } catch (error) {
      host.remove();
      throw error;
    }
    const handle = {
      destroy() {
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
      modal?.destroy();
      const generation = ++modalGeneration;
      const next = createModal(options, trigger);
      if (destroyed || generation !== modalGeneration) next.destroy();
      else modal = next;
    },
    close() {
      modalGeneration++;
      modal?.destroy();
      modal = undefined;
    },
    mount(container) {
      return attach(container, (root) => {
        const wrapper = container.ownerDocument.createElement('div');
        root.append(wrapper);
        return createEmbed(wrapper, options, 'inline', () => {});
      });
    },
    createButton(container) {
      return attach(container, (root) => {
        const button = container.ownerDocument.createElement('button');
        button.type = 'button';
        button.lang = options.locale ?? 'en';
        button.textContent = translate(options.locale).book;
        button.setAttribute('aria-haspopup', 'dialog');
        button.addEventListener('click', () => sdk.open(button));
        root.append(button);
        return { destroy: () => button.remove() };
      });
    },
    createLink(container) {
      return attach(container, (root) => {
        const link = container.ownerDocument.createElement('a');
        link.href = options.bookingUrl;
        link.lang = options.locale ?? 'en';
        link.textContent = translate(options.locale).book;
        root.append(link);
        return { destroy: () => link.remove() };
      });
    },
    destroy() {
      sdk.close();
      for (const handle of handles) handle.destroy();
      destroyed = true;
    },
  };
  return sdk;
}

let defaultInstance: BookingSDK | undefined;
function instance(): BookingSDK {
  if (!defaultInstance) throw new Error('Call Space2Book.init(options) first.');
  return defaultInstance;
}

export const Space2Book = {
  version: VERSION,
  init(options: SDKOptions): BookingSDK {
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

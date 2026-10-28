import { createEmbed } from './embed';
import { translate } from './i18n';
import { brandColor, brandTextColor } from './security';
import { styles } from './styles';
import type { EmbedHandle, SDKOptions } from './types';

let activeModal: EmbedHandle | undefined;

export function activeElement(doc: Document): Element | null {
  let active = doc.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

export function createModal(options: SDKOptions, trigger?: HTMLElement): EmbedHandle {
  activeModal?.destroy();
  const doc = document;
  const win = doc.defaultView!;
  const previous = trigger ?? activeElement(doc);
  const text = translate(options.locale);
  const host = doc.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = styles;
  host.style.setProperty('--s2b-color', brandColor(options.branding?.color));
  host.style.setProperty('--s2b-contrast', brandTextColor(brandColor(options.branding?.color)));
  const backdrop = doc.createElement('div');
  backdrop.className = 'backdrop';
  const panel = doc.createElement('section');
  panel.className = 'panel';
  panel.lang = options.locale ?? 'en';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 's2b-title');
  const header = doc.createElement('header');
  const title = doc.createElement('h2');
  title.id = 's2b-title';
  title.textContent = `${text.title} ${options.branding?.name || 'Space2Book'}`;
  const closeButton = doc.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = text.close;
  header.append(title, closeButton);
  panel.append(header);
  backdrop.append(panel);
  root.append(style, backdrop);

  const inertStates = new Map<HTMLElement, boolean>();
  const makeInert = () => {
    for (const child of doc.body.children) {
      if (child !== host && child instanceof win.HTMLElement && !inertStates.has(child)) {
        inertStates.set(child, child.inert);
        child.inert = true;
      }
    }
  };
  const overflow = doc.body.style.overflow;
  let disposed = false;
  let embed: EmbedHandle | undefined;
  const observer = new win.MutationObserver(makeInert);
  const handle: EmbedHandle = {
    destroy() {
      if (disposed) return;
      disposed = true;
      embed?.destroy();
      observer.disconnect();
      doc.removeEventListener('keydown', onKey, true);
      doc.removeEventListener('focusin', onFocus, true);
      host.remove();
      for (const [element, inert] of inertStates) element.inert = inert;
      doc.body.style.overflow = overflow;
      if (activeModal === handle) activeModal = undefined;
      if (previous instanceof win.HTMLElement && previous.isConnected) previous.focus();
    },
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      handle.destroy();
    } else if (event.key === 'Tab') {
      const items = Array.from(panel.querySelectorAll<HTMLElement>('button, a[href], iframe'))
        .filter((element) => !element.hidden && !element.hasAttribute('disabled'));
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = activeElement(doc);
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  const onFocus = (event: FocusEvent) => {
    if (!event.composedPath().includes(host)) closeButton.focus();
  };
  closeButton.addEventListener('click', () => handle.destroy());
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) handle.destroy();
  });
  doc.body.append(host);
  makeInert();
  observer.observe(doc.body, { childList: true });
  doc.body.style.overflow = 'hidden';
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('focusin', onFocus, true);
  activeModal = handle;
  closeButton.focus();
  try {
    embed = createEmbed(panel, options, 'modal', () => handle.destroy());
  } catch (error) {
    handle.destroy();
    throw error;
  }
  return handle;
}

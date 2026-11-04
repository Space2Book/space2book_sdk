import { createEmbed } from './embed';
import { translate } from './i18n';
import { brandColor, brandTextColor } from './security';
import { styles } from './styles';
import type { FormHandle, FormState, ModalHandle, SDKOptions } from './types';

const modalKey = Symbol.for('space2book.modal.v1');
interface ModalState { active?: ModalHandle }
function stateFor(doc: Document): ModalState {
  const shared = doc as Document & { [modalKey]?: ModalState };
  if (!shared[modalKey]) Object.defineProperty(shared, modalKey, { value: {} });
  return shared[modalKey]!;
}

export function activeElement(doc: Document): Element | null {
  let active = doc.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

export function createModal(options: SDKOptions, trigger?: HTMLElement): ModalHandle {
  const modalState = stateFor(document);
  if (modalState.active?.active) {
    modalState.active.focus();
    throw new Error('Another Space2Book modal is active. Close it before opening a different form.');
  }
  const doc = document;
  const win = doc.defaultView!;
  const previous = trigger ?? activeElement(doc);
  const text = translate(options.locale);
  const host = doc.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = styles;
  if (options.styleNonce) style.nonce = options.styleNonce;
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
  const notice = doc.createElement('p');
  notice.setAttribute('role', 'alert');
  notice.tabIndex = -1;
  notice.hidden = true;
  panel.append(header, notice);
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
  const overflowPriority = doc.body.style.getPropertyPriority('overflow');
  let disposed = false;
  let embed: FormHandle | undefined;
  let confirmation: HTMLElement | undefined;
  let confirmationFocus: Element | null = null;
  const observer = new win.MutationObserver(makeInert);
  const handle: ModalHandle = {
    get active() { return !disposed; },
    focus() { (confirmation?.querySelector('button') ?? closeButton).focus(); },
    requestClose() {
      if (disposed || confirmation) return;
      if (embed?.state === 'submitting' || embed?.state === 'uncertain') {
        notice.textContent = embed.state === 'submitting' ? text.submitting : text.uncertain;
        notice.hidden = false;
        notice.focus();
        return;
      }
      if (!embed || ['loading', 'error', 'completed'].includes(embed.state)) {
        handle.destroy();
        return;
      }
      confirmationFocus = activeElement(doc);
      confirmation = doc.createElement('section');
      confirmation.className = 'confirmation';
      confirmation.setAttribute('role', 'alertdialog');
      confirmation.setAttribute('aria-modal', 'true');
      confirmation.setAttribute('aria-labelledby', 's2b-confirm-title');
      const label = doc.createElement('h2');
      label.id = 's2b-confirm-title';
      label.textContent = text.confirm;
      const cancel = doc.createElement('button');
      cancel.type = 'button';
      cancel.textContent = text.keep;
      const discard = doc.createElement('button');
      discard.type = 'button';
      discard.textContent = text.discard;
      cancel.addEventListener('click', cancelClose);
      discard.addEventListener('click', () => {
        // A submit can start after confirmation opened; recheck before destroying.
        if (embed?.state === 'submitting' || embed?.state === 'uncertain') {
          cancelClose();
          handle.requestClose();
        } else handle.destroy();
      });
      confirmation.append(label, cancel, discard);
      panel.append(confirmation);
      cancel.focus();
      for (const child of Array.from(panel.children)) {
        if (child !== confirmation) (child as HTMLElement).inert = true;
      }
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      embed?.destroy();
      observer.disconnect();
      doc.removeEventListener('keydown', onKey, true);
      doc.removeEventListener('focusin', onFocus, true);
      host.remove();
      for (const [element, inert] of inertStates) element.inert = inert;
      doc.body.style.setProperty('overflow', overflow, overflowPriority);
      if (modalState.active === handle) delete modalState.active;
      if (previous instanceof win.HTMLElement && previous.isConnected) previous.focus();
    },
  };
  const cancelClose = () => {
    confirmation?.remove();
    confirmation = undefined;
    for (const child of Array.from(panel.children)) (child as HTMLElement).inert = false;
    if (confirmationFocus instanceof win.HTMLIFrameElement && confirmationFocus.isConnected &&
        typeof confirmationFocus.contentWindow?.focus === 'function') {
      // Restore focus to the cross-origin browsing context; inner-field restoration belongs to the form.
      confirmationFocus.contentWindow.focus();
    } else if (confirmationFocus instanceof win.HTMLElement && confirmationFocus.isConnected) confirmationFocus.focus();
    else closeButton.focus();
  };
  const syncNotice = (state: FormState) => {
    if (disposed) return;
    if (state !== 'submitting' && state !== 'uncertain') {
      notice.hidden = true;
      notice.textContent = '';
    } else if (!notice.hidden) {
      notice.textContent = state === 'submitting' ? text.submitting : text.uncertain;
    }
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (confirmation) cancelClose();
      else handle.requestClose();
    } else if (event.key === 'Tab') {
      const items = Array.from((confirmation ?? panel).querySelectorAll<HTMLElement>('button, a[href], iframe, [tabindex="0"]'))
        .filter((element) => !element.hidden && !element.closest('[hidden]') && !element.hasAttribute('disabled'));
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
    if (!event.composedPath().includes(host) ||
        (confirmation && !event.composedPath().includes(confirmation))) handle.focus();
  };
  closeButton.addEventListener('click', () => handle.requestClose());
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) handle.requestClose();
  });
  doc.body.append(host);
  makeInert();
  observer.observe(doc.body, { childList: true });
  doc.body.style.overflow = 'hidden';
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('focusin', onFocus, true);
  modalState.active = handle;
  closeButton.focus();
  try {
    embed = createEmbed(panel, options, 'modal', () => handle.requestClose(), syncNotice);
  } catch (error) {
    handle.destroy();
    throw error;
  }
  return handle;
}

import { translate } from './i18n';
import { publicUrl } from './security';
import type { FormHandle, FormState, EmbedMode, ErrorCode, IntegrationContext, SDKOptions } from './types';

export function createEmbed(
  container: HTMLElement, options: SDKOptions, mode: EmbedMode, close: () => void,
): FormHandle {
  const doc = container.ownerDocument;
  const win = doc.defaultView!;
  const text = translate(options.locale);
  const content = doc.createElement('section');
  content.className = mode === 'inline' ? 'content inline' : 'content';
  content.lang = options.locale ?? 'en';
  const status = doc.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = text.loading;
  const footer = doc.createElement('footer');
  if (options.bookingUrl) {
    const link = doc.createElement('a');
    link.href = options.bookingUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = text.fallback;
    footer.append(link);
  } else footer.hidden = true;
  content.append(status, footer);
  container.append(content);

  let state: FormState = 'loading';
  let frame: HTMLIFrameElement | undefined;
  let timer: number | undefined;
  let disposed = false;
  let failed = false;
  let ready = false;
  let hasLoaded = false;
  let listener: ((event: MessageEvent<unknown>) => void) | undefined;
  const clearTimer = () => win.clearTimeout(timer);
  const fail = (code: ErrorCode) => {
    if (disposed || failed) return;
    failed = true;
    clearTimer();
    // Preserve interactive state and browsing context, especially during an unknown submit outcome.
    if (state === 'submitting' || state === 'uncertain') state = 'uncertain';
    else if (!ready) { state = 'error'; frame?.remove(); }
    if (listener) win.removeEventListener('message', listener);
    status.hidden = false;
    status.setAttribute('role', 'alert');
    status.textContent = state === 'uncertain' ? text.uncertain :
      code === 'integration-disabled' ? text.disabled : text.error;
    // A second booking link while a submit may have succeeded invites duplicate bookings.
    footer.hidden = state === 'uncertain' || !options.bookingUrl;
    options.onError?.(code);
  };
  const markReady = () => {
    if (!hasLoaded || ready || state !== 'loading') return;
    ready = true;
    state = 'interactive';
    clearTimer();
    status.hidden = true;
    if (frame) frame.hidden = false;
  };
  const transition = (next: FormState) => {
    if (!ready || state === 'completed') return;
    const allowed: Record<string, readonly FormState[]> = {
      interactive: ['dirty', 'submitting'], dirty: ['submitting'],
      submitting: ['uncertain', 'completed'], uncertain: ['completed'],
    };
    if (!allowed[state]?.includes(next)) return;
    state = next;
    footer.hidden = next === 'submitting' || next === 'uncertain' || !options.bookingUrl;
    if (next === 'uncertain') {
      status.textContent = text.uncertain;
      status.hidden = false;
    } else if (next === 'completed') status.hidden = true;
  };

  if (!options.adapter) fail('integration-disabled');
  else {
    try {
      const context: IntegrationContext = Object.freeze({
        bookingUrl: options.bookingUrl ?? '',
        ...(options.integrationId ? { integrationId: options.integrationId } : {}),
        locale: options.locale ?? 'en', mode,
        channelId: win.crypto.randomUUID(), protocolVersion: 1,
      });
      const adapter = options.adapter;
      const url = publicUrl(adapter.resolveEmbedUrl(context));
      const allowedOrigin = publicUrl(adapter.embedOrigin ?? options.bookingUrl ?? '').origin;
      if (url.origin !== allowedOrigin || url.origin === win.location.origin) {
        throw new TypeError('Embed URL must use the exact trusted cross-origin endpoint.');
      }
      // Public MyBooking pages must never be used as an iframe fallback.
      if (/\/bf(?:\/|$)/i.test(decodeURIComponent(url.pathname)) || url.href === options.bookingUrl) {
        throw new TypeError('A separate official embed endpoint is required.');
      }
      const messaging = adapter.messaging;
      if (!messaging || messaging.version !== 1) throw new TypeError('Verified readiness messaging is required.');
      frame = doc.createElement('iframe');
      frame.hidden = true; // No visitor interaction before verified readiness.
      frame.title = `${text.title} ${options.branding?.name || 'Space2Book'}`;
      frame.referrerPolicy = 'no-referrer';
      frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups');
      listener = (event) => {
        if (disposed || failed || event.origin !== url.origin || event.source !== frame?.contentWindow) return;
        try {
          const message = messaging.parseMessage(event.data, context);
          if (!message || message.version !== 1 || message.channelId !== context.channelId) return;
          // Validate normalized adapter output as well as its wire decoder.
          const keys = Object.keys(message).sort().join(',');
          if (message.type === 'state') {
            if (keys === 'channelId,state,type,version') transition(message.state);
          } else if (message.type === 'resize') {
            if (keys === 'channelId,height,type,version' && ready && mode === 'inline' &&
                Number.isInteger(message.height) && message.height >= 240 && message.height <= 20000) {
              frame!.style.height = `${message.height}px`;
            }
          } else if (keys === 'channelId,type,version') {
            if (message.type === 'ready') markReady();
            else if (message.type === 'close' && mode === 'modal') close();
            else if (message.type === 'error') fail('load-error');
          }
        } catch { fail('integration-error'); }
      };
      win.addEventListener('message', listener);
      frame.addEventListener('load', () => {
        if (disposed || failed) return;
        // A second navigation cannot reuse a previous handshake/channel or reset submit state.
        if (hasLoaded) { fail('load-error'); return; }
        hasLoaded = true;
        try {
          if (messaging.createInitMessage) {
            frame?.contentWindow?.postMessage(messaging.createInitMessage(context), url.origin);
          }
        } catch { fail('integration-error'); }
      });
      frame.addEventListener('error', () => fail('load-error'));
      frame.src = url.href;
      content.insertBefore(frame, footer);
      timer = win.setTimeout(() => fail('timeout'), options.timeoutMs ?? 15000);
    } catch { fail('integration-error'); }
  }
  return {
    get state() { return state; },
    destroy() {
      if (disposed) return;
      disposed = true;
      clearTimer();
      if (listener) win.removeEventListener('message', listener);
      content.remove();
    },
  };
}

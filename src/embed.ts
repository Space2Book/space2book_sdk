import { errorText, translate } from './i18n';
import { space2bookAdapter } from './space2book-adapter';
import { publicUrl } from './security';
import type { FormHandle, FormState, EmbedMode, ErrorCode, IntegrationContext, Locale, SDKOptions } from './types';

export function createEmbed(
  container: HTMLElement, options: SDKOptions, mode: EmbedMode, close: () => void,
  onStateChange: (state: FormState) => void = () => {},
): FormHandle {
  const doc = container.ownerDocument;
  const win = doc.defaultView!;
  let locale = options.locale ?? 'en';
  let text = translate(locale);
  const adapter = options.adapter ?? (options.integrationId ? space2bookAdapter : undefined);
  const childChannel = adapter?.messaging?.channelSource === 'iframe';
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
  let closeAllowed = true;
  let pendingLanguage = false;
  let context: IntegrationContext;
  let loadedChannel: string | undefined;
  let waitingHelloForLoad = false;
  const retiredChannels = new Set<string>();
  let listener: ((event: MessageEvent<unknown>) => void) | undefined;
  const clearTimer = () => win.clearTimeout(timer);
  const fail = (code: ErrorCode, backend = false) => {
    // A reported backend security/renewal failure does not lose message tracking.
    // Keep retry controls usable and accept a later definitive receipt on this session.
    if (backend && ready && !disposed && !failed) {
      status.hidden = false;
      status.setAttribute('role', 'alert');
      status.textContent = state === 'uncertain' ? text.uncertain : errorText(locale, code);
      footer.hidden = state === 'submitting' || state === 'uncertain' || !options.bookingUrl;
      options.onError?.(code);
      return;
    }
    if (disposed || failed) return;
    failed = true;
    clearTimer();
    // Once tracking is lost, a visible frame may submit without notifying us.
    // Preserve its context, prevent new interaction and block dismissal/fallbacks.
    if (ready) {
      state = 'uncertain';
      closeAllowed = false;
      if (frame) frame.inert = true;
    } else { state = 'error'; frame?.remove(); }
    if (listener) win.removeEventListener('message', listener);
    status.hidden = false;
    status.setAttribute('role', 'alert');
    status.textContent = state === 'uncertain' ? text.uncertain :
      errorText(locale, code);
    // A second booking link while a submit may have succeeded invites duplicate bookings.
    footer.hidden = state === 'uncertain' || !options.bookingUrl;
    onStateChange(state);
    options.onError?.(code);
  };
  const markReady = () => {
    if ((!childChannel && !hasLoaded) || ready || state !== 'loading') return;
    ready = true;
    state = 'interactive';
    closeAllowed = childChannel;
    clearTimer();
    status.hidden = true;
    status.setAttribute('role', 'status');
    if (frame) frame.hidden = false;
    onStateChange(state);
    if (pendingLanguage) { pendingLanguage = false; language?.(locale); }
  };
  const transition = (next: FormState) => {
    if (!ready || state === 'completed') return;
    const allowed: Record<string, readonly FormState[]> = {
      interactive: ['dirty', 'submitting'], dirty: ['submitting'],
      submitting: ['dirty', 'uncertain', 'completed'], uncertain: ['submitting', 'completed'],
    };
    if (!allowed[state]?.includes(next)) return;
    state = next;
    closeAllowed = next === 'completed';
    footer.hidden = next === 'submitting' || next === 'uncertain' || !options.bookingUrl;
    if (next === 'uncertain') {
      status.textContent = text.uncertain;
      status.hidden = false;
    } else status.hidden = true;
    onStateChange(state);
  };

  let language: ((value: Locale) => void) | undefined;
  if (!adapter) fail('integration-disabled');
  else {
    try {
      context = Object.freeze({
        bookingUrl: options.bookingUrl ?? '',
        ...(options.integrationId ? { integrationId: options.integrationId } : {}),
        locale: options.locale ?? 'en', mode,
        channelId: childChannel ? '' : win.crypto.randomUUID(), instanceId: win.crypto.randomUUID(), protocolVersion: 1,
      });
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
      const post = (data: unknown) => frame?.contentWindow?.postMessage(data, url.origin);
      const startTimer = () => {
        clearTimer();
        timer = win.setTimeout(() => fail('timeout'), options.timeoutMs ?? 15000);
      };
      const resetSession = () => {
        if (context.channelId) retiredChannels.add(context.channelId);
        if (state === 'submitting' || state === 'uncertain') {
          fail('load-error');
          return false;
        }
        ready = false;
        state = 'loading';
        closeAllowed = true;
        context = Object.freeze({ ...context, channelId: '' });
        frame!.hidden = true;
        status.textContent = text.loading;
        status.hidden = false;
        status.setAttribute('role', 'status');
        onStateChange(state);
        startTimer();
        return true;
      };
      listener = (event) => {
        if (disposed || failed || event.origin !== url.origin || event.source !== frame?.contentWindow) return;
        try {
          const message = messaging.parseMessage(event.data, context);
          if (!message || message.version !== 1) return;
          const keys = Object.keys(message).sort().join(',');
          if (childChannel && message.type === 'hello' && keys === 'channelId,type,version') {
            if (!/^[a-f0-9]{32}$/.test(message.channelId) || retiredChannels.has(message.channelId) ||
                message.channelId === context.channelId) return;
            if (context.channelId && !resetSession()) return;
            context = Object.freeze({ ...context, channelId: message.channelId, locale });
            if (waitingHelloForLoad) { loadedChannel = context.channelId; waitingHelloForLoad = false; }
            if (messaging.createInitMessage) post(messaging.createInitMessage(context));
            return;
          }
          if (message.channelId !== context.channelId || (childChannel && !context.channelId)) return;
          // Validate normalized adapter output too; only minimal fields cross the core boundary.
          if (message.type === 'state') {
            if (keys === 'channelId,state,type,version' ||
                (childChannel && keys === 'canClose,channelId,state,type,version' &&
                  message.canClose === (message.state === 'completed'))) transition(message.state);
          } else if (message.type === 'resize') {
            if (keys === 'channelId,height,type,version' && ready && mode === 'inline' &&
                Number.isSafeInteger(message.height) && message.height >= 0 && message.height <= 20000 &&
                (childChannel || message.height >= 240)) {
              frame!.style.height = `${Math.max(240, message.height)}px`;
            }
          } else if (message.type === 'ready') {
            if (keys === 'channelId,type,version' || (childChannel &&
                keys === 'canClose,channelId,type,version' && message.canClose === true)) markReady();
          } else if (message.type === 'close' && mode === 'modal') {
            if (keys === 'channelId,type,version') close();
            else if (childChannel && keys === 'canClose,channelId,state,type,version') {
              // A close snapshot may be newer than the last state event, but never reset dirty/completed.
              if (message.state && !['loading', 'error', 'interactive'].includes(message.state)) transition(message.state);
              close();
            }
          } else if (message.type === 'error') {
            if (keys === 'channelId,type,version') fail('load-error');
            else if (childChannel && keys === 'channelId,code,type,version' && message.code) fail(message.code, true);
          }
        } catch { fail('integration-error'); }
      };
      win.addEventListener('message', listener);
      frame.addEventListener('load', () => {
        if (disposed || failed) return;
        if (childChannel) {
          // A fresh hello can precede OR follow load. Bind each load to its current
          // fresh channel and retire the previous document's queued messages.
          if (hasLoaded && context.channelId === loadedChannel && !resetSession()) return;
          loadedChannel = context.channelId || undefined;
          waitingHelloForLoad = !context.channelId;
          hasLoaded = true;
          return;
        }
        if (hasLoaded) { fail('load-error'); return; }
        hasLoaded = true;
        try {
          if (messaging.createInitMessage) post(messaging.createInitMessage(context));
        } catch { fail('integration-error'); }
      });
      language = (value) => {
        if (context.channelId && !ready) pendingLanguage = true;
        locale = value;
        text = translate(value);
        context = Object.freeze({ ...context, locale: value });
        if (ready && !failed && messaging.createLanguageMessage) post(messaging.createLanguageMessage(context, value));
      };
      frame.addEventListener('error', () => fail('load-error'));
      startTimer();
      frame.src = url.href;
      content.insertBefore(frame, footer);
    } catch { fail('integration-error'); }
  }
  return {
    get state() { return state; },
    get canClose() { return closeAllowed; },
    setLanguage(value) { if (!disposed) language?.(value); },
    destroy() {
      if (disposed) return;
      disposed = true;
      clearTimer();
      if (listener) win.removeEventListener('message', listener);
      content.remove();
    },
  };
}

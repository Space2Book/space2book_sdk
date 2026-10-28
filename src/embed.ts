import { translate } from './i18n';
import { publicUrl } from './security';
import type { EmbedHandle, EmbedMode, ErrorCode, IntegrationContext, SDKOptions } from './types';

export function createEmbed(
  container: HTMLElement,
  options: SDKOptions,
  mode: EmbedMode,
  close: () => void,
): EmbedHandle {
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
  const link = doc.createElement('a');
  link.href = options.bookingUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = text.fallback;
  footer.append(link);
  content.append(status, footer);
  container.append(content);

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
    frame?.remove();
    if (listener) win.removeEventListener('message', listener);
    status.hidden = false;
    status.textContent = text.error;
    options.onError?.(code);
  };
  const markReady = () => {
    ready = true;
    clearTimer();
    status.hidden = true;
  };

  if (!options.adapter) {
    fail('integration-disabled');
  } else {
    try {
      const context: IntegrationContext = Object.freeze({
        bookingUrl: options.bookingUrl,
        locale: options.locale ?? 'en',
        mode,
        channelId: win.crypto.randomUUID(),
        protocolVersion: 1,
      });
      const adapter = options.adapter;
      const url = publicUrl(adapter.resolveEmbedUrl(context));
      if (url.origin !== publicUrl(options.bookingUrl).origin) {
        throw new TypeError('Embed URL must share the public booking origin.');
      }
      // Same-origin scripts with allow-same-origin could remove their sandbox.
      if (url.origin === win.location.origin) {
        throw new TypeError('Booking frames must be cross-origin from the host.');
      }
      const messaging = adapter.messaging;
      if (messaging && messaging.version !== 1) {
        throw new TypeError('Unsupported adapter messaging version.');
      }
      frame = doc.createElement('iframe');
      frame.title = `${text.title} ${options.branding?.name || 'Space2Book'}`;
      frame.referrerPolicy = 'no-referrer';
      frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups');
      if (messaging) {
        listener = (event) => {
          if (disposed || failed || event.origin !== url.origin || event.source !== frame?.contentWindow) return;
          try {
            const message = messaging.parseMessage(event.data, context);
            if (!message || message.version !== 1 || message.channelId !== context.channelId) return;
            if (message.type === 'ready') markReady();
            else if (message.type === 'close' && mode === 'modal') close();
            else if (message.type === 'error') fail('load-error');
          } catch {
            fail('integration-error');
          }
        };
        win.addEventListener('message', listener);
      }
      frame.addEventListener('load', () => {
        if (disposed || failed) return;
        try {
          if (messaging) {
            // Preserve an acknowledgement sent before the initial load event.
            if (hasLoaded || !ready) {
              ready = false;
              status.hidden = false;
              clearTimer();
              timer = win.setTimeout(() => fail('timeout'), options.timeoutMs ?? 15000);
            }
            hasLoaded = true;
            if (messaging.createInitMessage) {
              frame?.contentWindow?.postMessage(messaging.createInitMessage(context), url.origin);
            }
          } else {
            markReady();
          }
        } catch {
          fail('integration-error');
        }
      });
      frame.addEventListener('error', () => fail('load-error'));
      frame.src = url.href;
      content.insertBefore(frame, footer);
      if (!ready) timer = win.setTimeout(() => fail('timeout'), options.timeoutMs ?? 15000);
    } catch {
      fail('integration-error');
    }
  }
  return {
    destroy() {
      disposed = true;
      clearTimer();
      if (listener) win.removeEventListener('message', listener);
      content.remove();
    },
  };
}

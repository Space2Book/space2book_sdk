import { isIntegrationId } from './security';
import type { ErrorCode, IntegrationAdapter, IntegrationContext, IntegrationEvent, Locale } from './types';

export const SPACE2BOOK_EMBED_ORIGIN = 'https://api.space2book.com';
export const EMBED_ERROR_CODES = [
  'integration_not_found', 'integration_inactive', 'subscription_required', 'booking_form_unavailable',
  'invalid_domain_configuration', 'domain_not_allowed', 'integration_scope_denied', 'embed_context_expired',
  'invalid_handshake', 'invalid_request_protection', 'temporarily_unavailable', 'rate_limit_exceeded',
] as const;
const states = ['dirty', 'submitting', 'uncertain', 'completed'] as const;
const languages: readonly string[] = ['nl', 'en', 'de', 'fr', 'es'];
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).sort().join(',') === keys.sort().join(',');
const canClose = (state: unknown) => state === 'ready' || state === 'completed';

function command(context: IntegrationContext, type: 'init' | 'language', language: Locale = context.locale) {
  return { protocol: 'space2book.embed', version: 1, channel: context.channelId,
    instance: context.instanceId, type, payload: { language } };
}

/** Decode only the pinned EMBED-1 v1 schema. Never pass wire payloads to SDK consumers. */
export function parseEmbedMessage(data: unknown, context: IntegrationContext): IntegrationEvent | null {
  if (!record(data) || data.protocol !== 'space2book.embed' || data.version !== 1 ||
      typeof data.channel !== 'string' || data.channel.length !== 32 || !/^[a-f0-9]{32}$/.test(data.channel) || !record(data.payload)) return null;
  const base = { version: 1 as const, channelId: data.channel };
  if (data.type === 'hello') {
    return exact(data, ['protocol', 'version', 'channel', 'type', 'payload']) && exact(data.payload, [])
      ? { ...base, type: 'hello' } : null;
  }
  if (!exact(data, ['protocol', 'version', 'channel', 'instance', 'type', 'payload']) ||
      data.instance !== context.instanceId || data.channel !== context.channelId) return null;
  const payload = data.payload;
  switch (data.type) {
    case 'ready':
      return exact(payload, ['state', 'canClose']) && payload.state === 'ready' && payload.canClose === true
        ? { ...base, type: 'ready', canClose: true } : null;
    case 'state':
    case 'close-request': {
      const validStates: readonly unknown[] = data.type === 'state' ? states :
        ['initializing', 'ready', ...states, 'failed'];
      if (!exact(payload, ['state', 'canClose']) || !validStates.includes(payload.state) ||
          payload.canClose !== canClose(payload.state)) return null;
      const state = payload.state === 'ready' ? 'interactive' : payload.state === 'initializing' ? 'loading' :
        payload.state === 'failed' ? 'error' : payload.state as typeof states[number];
      return data.type === 'state' ? { ...base, type: 'state', state: state as typeof states[number], canClose: payload.canClose } :
        { ...base, type: 'close', state, canClose: payload.canClose };
    }
    case 'completed':
      return exact(payload, ['processed']) && payload.processed === true
        ? { ...base, type: 'state', state: 'completed', canClose: true } : null;
    case 'resize':
      return exact(payload, ['height']) && typeof payload.height === 'number' &&
        Number.isSafeInteger(payload.height) && payload.height >= 0 ? { ...base, type: 'resize', height: payload.height } : null;
    case 'error':
      return exact(payload, ['code']) && typeof payload.code === 'string' && /^[a-z_]+$/.test(payload.code)
        ? { ...base, type: 'error', code: EMBED_ERROR_CODES.includes(payload.code as typeof EMBED_ERROR_CODES[number])
          ? payload.code as ErrorCode : 'temporarily_unavailable' } : null;
    default: return null;
  }
}

/** The one official production adapter; no configurable origins, capabilities or booking API. */
export const space2bookAdapter: IntegrationAdapter = Object.freeze({
  embedOrigin: SPACE2BOOK_EMBED_ORIGIN,
  resolveEmbedUrl(context: IntegrationContext) {
    if (!context.integrationId || !isIntegrationId(context.integrationId)) throw new TypeError('Invalid integration identifier.');
    return new URL(`/webforms/embed/${context.integrationId}`, SPACE2BOOK_EMBED_ORIGIN).href;
  },
  messaging: Object.freeze({
    version: 1 as const,
    channelSource: 'iframe' as const,
    createInitMessage: (context: IntegrationContext) => command(context, 'init'),
    createLanguageMessage(context: IntegrationContext, language: Locale) {
      if (!languages.includes(language)) throw new TypeError('Unsupported locale.');
      return command(context, 'language', language);
    },
    parseMessage: parseEmbedMessage,
  }),
});

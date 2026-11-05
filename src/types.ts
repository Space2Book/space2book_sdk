export type Locale = 'nl' | 'en' | 'de' | 'fr' | 'es';
export type EmbedMode = 'modal' | 'inline';
export type FormState = 'loading' | 'interactive' | 'dirty' | 'submitting' | 'uncertain' | 'completed' | 'error';

export interface IntegrationContext {
  /** Empty when no separate public link was supplied. Never used as an embed fallback. */
  readonly bookingUrl: string;
  readonly integrationId?: string;
  readonly locale: Locale;
  readonly mode: EmbedMode;
  /** Host channel for legacy adapters; child-generated channel after hello for EMBED-1. */
  readonly channelId: string;
  readonly instanceId?: string;
  readonly protocolVersion: 1;
}

/** Internal normalized events only. These are NOT the EMBED-1 wire protocol. */
export type IntegrationEvent = { version: 1; channelId: string } & (
  | { type: 'hello' }
  | { type: 'ready'; canClose?: boolean }
  | { type: 'close'; state?: FormState; canClose?: boolean }
  | { type: 'error'; code?: ErrorCode }
  | { type: 'state'; state: Exclude<FormState, 'loading' | 'error'>; canClose?: boolean }
  | { type: 'resize'; height: number }
);

export interface IntegrationAdapter {
  /** Trusted adapter code, never declarative HTML. Must implement the verified backend contract. */
  resolveEmbedUrl(context: IntegrationContext): string;
  /** Exact HTTPS origin, required when different from bookingUrl (production: API origin). */
  embedOrigin?: string;
  messaging?: {
    version: 1;
    /** Opt into child hello/init/ready; legacy adapters retain host-channel behavior. */
    channelSource?: 'iframe';
    createLanguageMessage?(context: IntegrationContext, language: Locale): unknown;
    createInitMessage?(context: IntegrationContext): unknown;
    parseMessage(data: unknown, context: IntegrationContext): IntegrationEvent | null;
  };
}

export type ErrorCode = 'integration-disabled' | 'integration-error' | 'load-error' | 'timeout' |
  'integration_not_found' | 'integration_inactive' | 'subscription_required' | 'booking_form_unavailable' |
  'invalid_domain_configuration' | 'domain_not_allowed' | 'integration_scope_denied' | 'embed_context_expired' |
  'invalid_handshake' | 'invalid_request_protection' | 'temporarily_unavailable' | 'rate_limit_exceeded';

export interface SDKOptions {
  /** Separate public HTTPS booking link. Optional for an embed-only integration. */
  bookingUrl?: string;
  integrationId?: string;
  locale?: Locale;
  branding?: { name?: string; color?: string };
  buttonText?: string;
  /** Trusted extension point. A valid integrationId automatically selects the official adapter. */
  adapter?: IntegrationAdapter;
  timeoutMs?: number;
  /** CSP nonce for SDK style elements; obtain from the host's response policy. */
  styleNonce?: string;
  onError?: (code: ErrorCode) => void;
}

export interface EmbedHandle { destroy(): void; setLanguage?(locale: Locale): void }
export interface FormHandle extends EmbedHandle { readonly state: FormState; readonly canClose: boolean }
export interface ModalHandle extends EmbedHandle {
  readonly active: boolean;
  requestClose(): void;
  focus(): void;
}
export interface BookingSDK {
  open(trigger?: HTMLElement): void;
  close(): void;
  setLanguage(locale: Locale): void;
  mount(container: HTMLElement): EmbedHandle;
  createButton(container: HTMLElement): EmbedHandle;
  createLink(container: HTMLElement): EmbedHandle;
  /** Technical teardown only; normal user dismissal must call close(). */
  destroy(): void;
}

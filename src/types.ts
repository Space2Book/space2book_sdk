export type Locale = 'nl' | 'en' | 'de' | 'fr' | 'es';
export type EmbedMode = 'modal' | 'inline';
export type FormState = 'loading' | 'interactive' | 'dirty' | 'submitting' | 'uncertain' | 'completed' | 'error';

export interface IntegrationContext {
  /** Empty when no separate public link was supplied. Never used as an embed fallback. */
  readonly bookingUrl: string;
  readonly integrationId?: string;
  readonly locale: Locale;
  readonly mode: EmbedMode;
  readonly channelId: string;
  readonly protocolVersion: 1;
}

/** Internal normalized events only. These are NOT the EMBED-1 wire protocol. */
export type IntegrationEvent = { version: 1; channelId: string } & (
  | { type: 'ready' | 'close' | 'error' }
  | { type: 'state'; state: Exclude<FormState, 'loading' | 'error'> }
  | { type: 'resize'; height: number }
);

export interface IntegrationAdapter {
  /** Trusted adapter code, never declarative HTML. Must implement the verified backend contract. */
  resolveEmbedUrl(context: IntegrationContext): string;
  /** Exact HTTPS origin, required when different from bookingUrl (production: API origin). */
  embedOrigin?: string;
  messaging?: {
    version: 1;
    createInitMessage?(context: IntegrationContext): unknown;
    parseMessage(data: unknown, context: IntegrationContext): IntegrationEvent | null;
  };
}

export type ErrorCode = 'integration-disabled' | 'integration-error' | 'load-error' | 'timeout';

export interface SDKOptions {
  /** Separate public HTTPS booking link. Optional for an embed-only integration. */
  bookingUrl?: string;
  integrationId?: string;
  locale?: Locale;
  branding?: { name?: string; color?: string };
  buttonText?: string;
  /** Trusted extension point; no production adapter ships until EMBED-1 is verified. */
  adapter?: IntegrationAdapter;
  timeoutMs?: number;
  /** CSP nonce for SDK style elements; obtain from the host's response policy. */
  styleNonce?: string;
  onError?: (code: ErrorCode) => void;
}

export interface EmbedHandle { destroy(): void }
export interface FormHandle extends EmbedHandle { readonly state: FormState }
export interface ModalHandle extends EmbedHandle {
  readonly active: boolean;
  requestClose(): void;
  focus(): void;
}
export interface BookingSDK {
  open(trigger?: HTMLElement): void;
  close(): void;
  mount(container: HTMLElement): EmbedHandle;
  createButton(container: HTMLElement): EmbedHandle;
  createLink(container: HTMLElement): EmbedHandle;
  /** Technical teardown only; normal user dismissal must call close(). */
  destroy(): void;
}

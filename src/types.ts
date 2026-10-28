export type Locale = 'nl' | 'en' | 'de' | 'fr' | 'es';
export type EmbedMode = 'modal' | 'inline';

export interface IntegrationContext {
  readonly bookingUrl: string;
  readonly locale: Locale;
  readonly mode: EmbedMode;
  readonly channelId: string;
  readonly protocolVersion: 1;
}

/** Internal adapter events, NOT a finalized backend wire protocol. */
export type IntegrationEvent = {
  version: 1;
  channelId: string;
  type: 'ready' | 'close' | 'error';
};

export interface IntegrationAdapter {
  /** Return an authorized HTTPS URL on the public booking URL's origin. */
  resolveEmbedUrl(context: IntegrationContext): string;
  messaging?: {
    version: 1;
    createInitMessage?(context: IntegrationContext): unknown;
    parseMessage(data: unknown, context: IntegrationContext): IntegrationEvent | null;
  };
}

export type ErrorCode = 'integration-disabled' | 'integration-error' | 'load-error' | 'timeout';

export interface SDKOptions {
  /** Explicit public URL supplied by Space2Book; never a private API endpoint. */
  bookingUrl: string;
  locale?: Locale;
  branding?: { name?: string; color?: string };
  adapter?: IntegrationAdapter;
  timeoutMs?: number;
  onError?: (code: ErrorCode) => void;
}

export interface EmbedHandle {
  destroy(): void;
}

export interface BookingSDK {
  open(trigger?: HTMLElement): void;
  close(): void;
  mount(container: HTMLElement): EmbedHandle;
  createButton(container: HTMLElement): EmbedHandle;
  createLink(container: HTMLElement): EmbedHandle;
  destroy(): void;
}

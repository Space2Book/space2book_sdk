export function publicUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new TypeError('A public HTTPS booking URL without credentials is required.');
  }
  return url;
}

export function brandColor(value: string | undefined): string {
  return value && /^#[\da-f]{6}$/i.test(value) ? value : '#2457d6';
}

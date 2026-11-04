/** TEST FIXTURE ONLY. Invented transport, never the EMBED-1 contract or a production endpoint. */
export const fixtureOrigin = 'https://embed.example.invalid';
export const fixtureUrl = fixtureOrigin + '/sdk-test-fixture';
export function adapterFixture() {
  let context;
  let calls = 0;
  return {
    get context() { return context; },
    get calls() { return calls; },
    adapter: {
      embedOrigin: fixtureOrigin,
      resolveEmbedUrl(value) { context = value; return fixtureUrl; },
      messaging: {
        version: 1,
        createInitMessage(value) { return { fixture: value.channelId }; },
        parseMessage(data) { calls++; return data; },
      },
    },
  };
}

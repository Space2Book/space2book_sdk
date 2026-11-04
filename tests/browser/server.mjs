/** Local HTTPS fixture servers. This transport is NOT the EMBED-1 backend contract. */
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';

mkdirSync('work/tls', { recursive: true });
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
  '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
  '-keyout', 'work/tls/key.pem', '-out', 'work/tls/cert.pem'], { stdio: 'ignore' });
const tls = { key: readFileSync('work/tls/key.pem'), cert: readFileSync('work/tls/cert.pem') };
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' };
for (const port of [9443, 9444]) {
  https.createServer(tls, (req, res) => {
    const pathname = new URL(req.url, 'https://localhost').pathname;
    if (pathname === '/redirect') { res.writeHead(302, { Location: 'https://localhost:9443/redirected.html' }); res.end(); return; }
    const path = resolve('.' + (pathname === '/' ? '/tests/browser/host.html' : pathname));
    if (!path.startsWith(resolve('tests/browser') + '/') && !path.startsWith(resolve('dist') + '/')) {
      res.writeHead(404); res.end(); return;
    }
    try {
      if (port === 9444) res.setHeader('Set-Cookie', 'fixtureThirdParty=synthetic; Secure; SameSite=None; Path=/');
      res.setHeader('Content-Type', types[extname(path)] ?? 'text/plain');
      res.setHeader('Content-Security-Policy', port === 9443
        ? "default-src 'self'; script-src 'self'; style-src 'self' 'nonce-fixture-style'; frame-src https://127.0.0.1:9444; object-src 'none'"
        : "default-src 'self'; script-src 'self'; frame-ancestors https://localhost:9443; object-src 'none'");
      res.end(readFileSync(path));
    } catch { res.writeHead(404); res.end(); }
  }).listen(port, port === 9443 ? 'localhost' : '127.0.0.1');
}

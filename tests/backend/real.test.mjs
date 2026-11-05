/** SDK + real EMBED-1 filters/controllers/shared views/services; disposable fixtures only. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import { chromium, expect } from '@playwright/test';

const sdkRoot = resolve('.');
const app = resolve(process.env.S2B_BACKEND_APP || '../s2b_dev/app.space2book.com');
const identifier = 'a'.repeat(64);
const origin = 'https://api.space2book.com';
const optedIn = process.env.S2B_PUBLIC_TEST_MYSQL === '1';

test('SDK with real EMBED-1: modal, inline, safe retry, sandbox, CSP, authorization and privacy',
  { skip: !optedIn && 'Explicit disposable MySQL opt-in required', timeout: 180000 }, async t => {
    assert.ok(existsSync(app + '/tests/_support/Embed/EmbedFixture.php'));
    const writepath = resolve('work/backend-runtime');
    for (const dir of ['', '/logs', '/cache', '/session', '/security-state']) mkdirSync(writepath + dir, { recursive: true });
    mkdirSync('work/backend-tls', { recursive: true });
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=api.space2book.com',
      '-keyout', 'work/backend-tls/key.pem', '-out', 'work/backend-tls/cert.pem'], { stdio: 'ignore' });
    const php = process.env.S2B_TEST_PHP_EXTERNAL === '1' ? undefined : spawn(process.env.S2B_TEST_PHP || 'php', ['-S', '0.0.0.0:8097', resolve('tests/backend/router.php')], {
      cwd: sdkRoot, env: { ...process.env, S2B_BACKEND_APP: app, S2B_SDK_TEST_WRITEPATH: writepath }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let diagnostics = '';
    php?.stderr.on('data', data => { diagnostics += data; });
    php?.stdout.on('data', data => { diagnostics += data; });
    const tls = { key: readFileSync('work/backend-tls/key.pem'), cert: readFileSync('work/backend-tls/cert.pem') };
    const server = https.createServer(tls, (req, res) => {
      const host = req.headers.host;
      const pathname = new URL(req.url, 'https://' + host).pathname;
      if (host === 'api.space2book.com') {
        if (pathname.startsWith('/assets/')) {
          const asset = resolve(app + '/private_html', '.' + pathname);
          if (!asset.startsWith(app + '/private_html/assets/') || !existsSync(asset)) { res.writeHead(404); res.end(); return; }
          res.setHeader('Content-Type', extname(asset) === '.js' ? 'text/javascript' : 'text/css');
          res.end(readFileSync(asset)); return;
        }
        const upstream = http.request({ hostname: '127.0.0.1', port: 8097, path: req.url, method: req.method, headers: req.headers }, response => {
          res.writeHead(response.statusCode, response.headers); response.pipe(res);
        });
        upstream.on('error', () => { res.writeHead(503); res.end('Fixture unavailable'); }); req.pipe(upstream); return;
      }
      if (pathname === '/dist/index.js' || pathname === '/dist/space2book.min.js' || pathname === '/tests/backend/host.mjs') {
        res.setHeader('Content-Type', 'text/javascript'); res.end(readFileSync(sdkRoot + pathname)); return;
      }
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'nonce-sdk-test'; frame-src https://api.space2book.com; object-src 'none'");
      if (host === 'terms.space2book.test') { res.end('<h1>Disposable external terms</h1>'); return; }
      if (req.url === '/declarative') {
        res.end(`<script defer src="/dist/space2book.min.js"></script><button data-s2b-mode="modal" data-s2b-integration="${identifier}" data-s2b-locale="nl" data-s2b-style-nonce="sdk-test">Boek direct</button><div data-s2b-mode="inline" data-s2b-integration="${identifier}" data-s2b-locale="nl" data-s2b-style-nonce="sdk-test"></div>`); return;
      }
      res.end('<script type="module" src="/tests/backend/host.mjs"></script><button id="open">Open</button><main></main>');
    });
    let browser;
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(443, '127.0.0.1', resolve); });
      for (let attempt = 0; attempt < 600; attempt++) {
        try { await new Promise((resolve, reject) => { const socket = net.connect(8097, '127.0.0.1', () => { socket.end(); resolve(); }); socket.on('error', reject); }); break; }
        catch { if (php?.exitCode !== null && php?.exitCode !== undefined) throw new Error('PHP exited: ' + diagnostics); if (attempt === 599) throw new Error('PHP unavailable: ' + diagnostics); await new Promise(resolve => setTimeout(resolve, 100)); }
      }
      browser = await chromium.launch({ headless: true, executablePath: process.env.S2B_CHROMIUM_PATH || '/usr/bin/chromium',
        args: ['--no-proxy-server', '--host-resolver-rules=MAP voorbeeld.nl 127.0.0.1, MAP denied.nl 127.0.0.1, MAP api.space2book.com 127.0.0.1, MAP terms.space2book.test 127.0.0.1', '--test-third-party-cookie-phaseout'] });
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      await context.addInitScript(() => {
        const now = Date.now; window.embedClockOffset = 0; Date.now = () => now() + window.embedClockOffset;
        Object.defineProperty(window.Document.prototype, 'cookie', { get: () => '', set: () => {}, configurable: true });
        for (const method of ['getItem', 'setItem', 'removeItem']) window.Storage.prototype[method] = () => { throw new Error('Storage blocked by test'); };
      });
      await context.route('**/*', route => ['voorbeeld.nl', 'denied.nl', 'api.space2book.com', 'terms.space2book.test'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors = [], requests = [], bodies = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (/\/context|\/renew|\/bf-api\//.test(request.url())) requests.push({ url: request.url(), headers: request.headers() });
        if (request.url().endsWith('/submit')) bodies.push(request.postData());
      });
      let interruptSubmit = true, interruptRenew = true;
      await page.route('**/submit', route => { if (interruptSubmit) { interruptSubmit = false; return route.abort(); } return route.continue(); });
      await page.route('**/renew', route => { if (interruptRenew) { interruptRenew = false; return route.fulfill({ status: 503, json: { success: false, error: { code: 'temporarily_unavailable' } } }); } return route.continue(); });
      await page.goto('https://voorbeeld.nl'); await page.locator('#open').click();
      const iframe = page.locator('iframe'); const frame = page.frameLocator('iframe');
      await iframe.waitFor({ state: 'visible' });
      const check = async (name, action) => {
        let failure;
        await t.test(name, async () => { try { await action(); } catch (error) { failure = error; throw error; } });
        if (failure) {
          console.error('Accepted host events:', JSON.stringify(await page.evaluate(() => ({ events: window.events, errors: window.errors })).catch(() => null)));
          throw failure;
        }
      };
      await check('real initialization, stable instance, language, same-origin capability transport', async () => {
        assert.equal(await frame.locator('#pb-language').inputValue(), 'en');
        assert.equal(await iframe.getAttribute('src'), origin + '/webforms/embed/' + identifier);
        await page.evaluate(() => window.sdk.setLanguage('fr'));
        await expect(frame.locator('#pb-language')).toHaveValue('fr');
        await page.evaluate(() => window.sdk.setLanguage('en'));
        await expect(frame.locator('#pb-language')).toHaveValue('en');
        assert(requests.length > 0); assert(requests.every(request => !request.headers.cookie && request.headers['x-s2b-embed-context']));
      });
      await check('dirty close-request cancellation preserves original shared form and data', async () => {
        await frame.locator('#pb-date').fill('2030-06-03'); await frame.locator('#pb-pax').fill('10');
        await frame.locator('#pb-start').selectOption('09:00'); await frame.locator('#pb-end').selectOption('10:00');
        await frame.getByRole('button', { name: 'Select this space' }).first().click();
        await frame.locator('.pb-subtotal').waitFor();
        await frame.locator('#pc-contact').fill('SDK Fixture'); await frame.locator('#pc-email').fill('sdk@example.test');
        await frame.locator('#pc-phone').fill('0612345678');
        if (await frame.locator('#pc-terms').isVisible()) await frame.locator('#pc-terms').check();
        // The storage double deliberately has no signed terms URL. Exercise the real
        // link/target with a disposable external document, without contacting a provider.
        await frame.locator('#pc-terms-link').evaluate(link => {
          link.href = 'https://terms.space2book.test/terms';
          link.closest('#pc-terms-wrap').hidden = false;
        });
        const [popup] = await Promise.all([context.waitForEvent('page'), frame.locator('#pc-terms-link').click()]);
        await popup.waitForLoadState();
        assert.equal(await popup.locator('h1').innerText(), 'Disposable external terms'); await popup.close();
        await frame.locator('#pb-embed-close').click(); await page.getByRole('alertdialog').waitFor();
        await page.getByRole('button', { name: 'Keep booking' }).click();
        assert.equal(await frame.locator('#pc-email').inputValue(), 'sdk@example.test');
        assert.equal(await iframe.count(), 1);
      });
      await check('interrupted submit, renewal failure and identical real retry retain usable iframe', async () => {
        await frame.locator('#pc-quote').click();
        await page.waitForFunction(() => window.events.some(event => event.type === 'state' && event.payload.state === 'uncertain'));
        await page.evaluate(() => window.sdk.close());
        assert.equal(await page.getByRole('alertdialog').count(), 0);
        assert.equal(await page.locator('.content footer').isVisible(), false);
        await frame.locator('#public-booking').evaluate(() => { window.embedClockOffset = 850000; });
        await frame.locator('#pc-retry').click();
        await page.waitForFunction(() => window.errors.includes('temporarily_unavailable'));
        assert.equal(await frame.locator('#pc-retry').isEnabled(), true);
        assert.equal(await iframe.getAttribute('inert'), null);
        await frame.locator('#pc-retry').click(); await frame.locator('#pc-success').waitFor({ state: 'visible' });
        await page.waitForFunction(() => window.events.some(event => event.type === 'completed'));
        assert.equal(bodies.length, 2); assert.equal(bodies[0], bodies[1]);
        const messages = await page.evaluate(() => window.events);
        assert(!/SDK Fixture|sdk@example|0612345678|context|booking_code|customer/.test(JSON.stringify(messages)));
        await page.evaluate(() => window.sdk.close()); assert.equal(await iframe.count(), 0);
      });
      await check('repeated opening and safe reload establish fresh channels', async () => {
        await page.locator('#open').click(); await iframe.waitFor({ state: 'visible' });
        const before = await page.evaluate(() => window.events.filter(event => event.type === 'hello').at(-1).channel);
        await page.frames().find(frame => frame.url().startsWith(origin)).evaluate(() => location.reload());
        await iframe.waitFor({ state: 'visible' });
        await page.waitForFunction(old => window.events.filter(event => event.type === 'hello').at(-1).channel !== old, before);
        await page.evaluate(() => window.sdk.close()); assert.equal(await iframe.count(), 0);
      });
      await check('declarative modal + inline work with only identifier and real resize', async () => {
        await page.goto('https://voorbeeld.nl/declarative');
        await page.locator('div iframe').waitFor({ state: 'visible' });
        await page.getByRole('button', { name: 'Boek direct' }).click();
        await page.locator('iframe').nth(1).waitFor({ state: 'visible' });
        assert.equal(await page.locator('iframe').count(), 2);
        const inline = page.frameLocator('div[data-s2b-mode="inline"] iframe');
        assert.equal(await inline.locator('#pb-language').inputValue(), 'nl');
        await page.waitForFunction(() => document.querySelector('[data-s2b-mode="inline"]').firstChild.shadowRoot.querySelector('iframe').style.height !== '');
        assert.equal(await page.locator('iframe').first().getAttribute('sandbox'), 'allow-scripts allow-forms allow-same-origin allow-popups');
        await page.getByRole('button', { name: 'Sluiten', exact: true }).click();
        assert.equal(await page.locator('iframe').count(), 1);
      });
      await check('local context expiry after readiness keeps the last dirty close decision', async () => {
        await page.goto('https://voorbeeld.nl'); await page.locator('#open').click(); await iframe.waitFor({ state: 'visible' });
        await frame.locator('#pb-pax').fill('10');
        await page.waitForFunction(() => window.events.some(event => event.payload?.state === 'dirty'));
        await frame.locator('#public-booking').evaluate(() => { window.embedClockOffset = 950000; });
        await frame.locator('#pb-date').fill('2030-06-03');
        await page.waitForFunction(() => window.errors.includes('embed_context_expired'));
        assert.equal(await iframe.count(), 1); assert.equal(await iframe.getAttribute('inert'), null);
        await page.evaluate(() => window.sdk.close()); await page.getByRole('alertdialog').waitFor();
        await page.getByRole('button', { name: 'Keep booking' }).click();
      });
      await check('real revocation during an active dirty session is reported without discarding the frame', async () => {
        await page.goto('https://voorbeeld.nl'); await page.locator('#open').click(); await iframe.waitFor({ state: 'visible' });
        await frame.locator('#pb-pax').fill('10');
        await page.waitForFunction(() => window.events.some(event => event.payload?.state === 'dirty'));
        await page.route('**/bf-api/**', route => route.continue({ headers: { ...route.request().headers(), 'x-sdk-test-scenario': 'revoked' } }));
        await frame.locator('#pb-date').fill('2030-06-03');
        await page.waitForFunction(() => window.errors.includes('integration_inactive'));
        assert.equal(await iframe.count(), 1); await page.evaluate(() => window.sdk.close());
        await page.getByRole('alertdialog').waitFor();
        await page.unroute('**/bf-api/**');
      });
      await check('actual HTTP authorization distinguishes inactive, revoked, subscription, missing and domain denial', async () => {
        const request = (path, scenario) => new Promise((resolve, reject) => {
          const call = https.request({ hostname: '127.0.0.1', port: 443, path, rejectUnauthorized: false,
            headers: { Host: 'api.space2book.com', 'X-SDK-Test-Scenario': scenario } }, response => {
            let body = ''; response.on('data', data => { body += data; });
            response.on('end', () => resolve({ status: response.statusCode, body, headers: response.headers }));
          }); call.on('error', reject); call.end();
        });
        for (const [scenario, code] of [['inactive', 'integration_inactive'], ['revoked', 'integration_inactive'], ['subscription', 'subscription_required']]) {
          const response = await request('/webforms/embed/' + identifier, scenario);
          assert.equal(response.status, 403); assert.equal(JSON.parse(response.body).error.code, code);
        }
        const missing = await request('/webforms/embed/' + 'f'.repeat(64), '');
        assert.equal(missing.status, 404); assert.equal(JSON.parse(missing.body).error.code, 'integration_not_found');
        const domain = await request('/webforms/embed/' + identifier, 'domain');
        assert.equal(domain.status, 200); assert.match(domain.headers['content-security-policy'], /https:\/\/other.nl/);
        assert(!domain.headers['content-security-policy'].includes('https://voorbeeld.nl'));
      });
      await check('denied origin and missing integration fail closed with timeout, without public iframe fallback', async () => {
        await page.goto('https://denied.nl/?denied'); await page.locator('#open').click();
        await page.waitForFunction(() => window.errors.includes('timeout'));
        assert.equal(await page.locator('iframe').count(), 0);
        await page.goto('https://voorbeeld.nl/?missing'); await page.locator('#open').click();
        await page.waitForFunction(() => window.errors.includes('timeout'));
        assert.equal(await page.locator('iframe').count(), 0);
      });
      assert.deepEqual(errors, []);
    } catch (error) {
      error.message += '\nPHP diagnostics: ' + diagnostics.slice(-5000); throw error;
    } finally {
      await browser?.close();
      await new Promise(resolve => server.close(resolve));
      if (php) {
        php.kill('SIGTERM'); php.stdout.destroy(); php.stderr.destroy();
        await new Promise(resolve => { if (php.exitCode !== null) return resolve(); php.once('exit', resolve); setTimeout(resolve, 3000).unref(); }); php.unref();
      }
    }
  });

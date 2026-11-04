import { test, expect } from '@playwright/test';

test('real HTTPS cross-site handshake, state preservation, submit guard and completion under CSP', async ({ page }) => {
  await page.goto('/');
  await page.locator('#trigger').click();
  const frame = page.frameLocator('iframe');
  await expect(page.locator('iframe')).toBeVisible();
  await frame.locator('#input').fill('synthetic progress');
  await frame.locator('#close').click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep booking' }).click();
  await expect(frame.locator('#input')).toHaveValue('synthetic progress');
  await expect(page.locator('iframe')).toBeFocused();
  await frame.locator('#submit').click();
  await page.evaluate(() => window.sdk.close());
  await expect(page.getByRole('alert')).toContainText('being submitted');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await frame.locator('#uncertain').click();
  await page.evaluate(() => window.sdk.close());
  await expect(page.getByRole('alert').filter({ hasText: 'unknown' }).first()).toBeVisible();
  await frame.locator('#complete').click();
  await page.evaluate(() => window.sdk.close());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#trigger')).toBeFocused();
  expect(await page.evaluate(() => window.violations)).toEqual([]);
});

test('mobile fullscreen modal and focus isolation from host controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await page.locator('#trigger').click();
  await expect(page.locator('iframe')).toBeVisible();
  const box = await page.getByRole('dialog').boundingBox();
  expect(Math.round(box.width)).toBe(390); expect(Math.round(box.height)).toBe(844);
  expect(await page.locator('#other').evaluate(e => e.inert)).toBe(true);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.locator('iframe')).toBeVisible();
});

test('inline real iframe, multiple instances and technical teardown', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { window.inline = window.sdk.mount(document.querySelector('main')); });
  await expect(page.locator('main iframe')).toBeVisible();
  await page.locator('#trigger').click();
  await expect(page.locator('iframe')).toHaveCount(2);
  await page.evaluate(() => window.sdk.destroy());
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('redirect to another HTTPS origin cannot establish readiness', async ({ page }) => {
  await page.goto('/?redirect'); await page.locator('#trigger').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('unverified production embedding is disabled and never uses public page fallback', async ({ page }) => {
  const frameRequests = [];
  page.on('request', req => { if (req.isNavigationRequest() && req.frame() !== page.mainFrame()) frameRequests.push(req.url()); });
  await page.goto('/?disabled'); await page.locator('#trigger').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(frameRequests).toEqual([]);
});

test('Chromium fixture remains usable with third-party cookies explicitly blocked', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Explicit cookie controls are verified through Chromium CDP.');
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCookieControls', {
    enableThirdPartyCookieRestriction: true,
    disableThirdPartyCookieMetadata: true,
    disableThirdPartyCookieHeuristics: true,
  });
  await page.goto('/'); await page.locator('#trigger').click();
  await expect(page.locator('iframe')).toBeVisible();
  const frame = page.frames().find(f => f.url().startsWith('https://127.0.0.1:9444'));
  expect(await frame.evaluate(() => document.cookie)).toBe('');
  await page.frameLocator('iframe').locator('#input').fill('works without cookies');
  await page.frameLocator('iframe').locator('#close').click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
});

test('iframe reload invalidates the previous handshake without resetting an uncertain submit', async ({ page }) => {
  await page.goto('/'); await page.locator('#trigger').click();
  await expect(page.locator('iframe')).toBeVisible();
  await page.frameLocator('iframe').locator('#submit').click();
  const frame = page.frames().find(f => f.url().startsWith('https://127.0.0.1:9444'));
  await frame.evaluate(() => location.reload());
  await expect(page.getByRole('alert').filter({ hasText: 'unknown' })).toBeVisible();
  await page.evaluate(() => window.sdk.close());
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});


test('declarative script autostart and duplicate loads preserve components with host CSS and JavaScript', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const inline = document.createElement('div');
    inline.id = 'declarative';
    inline.dataset.s2bMode = 'inline'; inline.dataset.s2bIntegration = 'ID';
    inline.dataset.s2bStyleNonce = 'fixture-style';
    document.querySelector('main').append(inline);
  });
  await page.addScriptTag({ url: '/dist/space2book.min.js' });
  await expect(page.locator('#declarative').getByRole('alert')).toBeVisible();
  await page.evaluate(() => { window.originalSDK = window.Space2Book; });
  await page.addScriptTag({ url: '/dist/space2book.min.js' });
  expect(await page.evaluate(() => window.originalSDK === window.Space2Book)).toBe(true);
  expect(await page.locator('#declarative').evaluate(e => e.children.length)).toBe(1);
  expect(await page.locator('#other').evaluate(e => getComputedStyle(e).borderTopWidth)).toBe('8px');
  await page.locator('#trigger').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('iframe')).toBeVisible();
  expect(await page.evaluate(() => window.violations)).toEqual([]);
});

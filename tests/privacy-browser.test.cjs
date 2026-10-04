// Serve the workspace root, then run with Playwright available on NODE_PATH.
// MCSA_TEST_BASE_URL and MCSA_BROWSER_EXECUTABLE can override local defaults.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../MCSA-website-backend/seed.json'), 'utf8'));
const base = process.env.MCSA_TEST_BASE_URL || 'http://127.0.0.1:8765';
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.MCSA_BROWSER_EXECUTABLE || undefined });
});
after(async () => { await browser?.close(); });

async function visit(folder, options = {}) {
  const context = await browser.newContext({ viewport: options.mobile ? { width: 375, height: 812 } : { width: 1440, height: 900 },
    reducedMotion: options.reduced ? 'reduce' : 'no-preference' });
  const data = structuredClone(seed);
  data.settings.openingDuration = 160;
  data.layout.carouselSeconds = 0.2;
  if (options.initial) await context.addInitScript(value => {
    if (!sessionStorage.getItem('test-initialized')) {
      Object.entries(value).forEach(([key, item]) => localStorage.setItem(key, item));
      sessionStorage.setItem('test-initialized', '1');
    }
  }, options.initial);
  if (options.blocked) await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw Error('blocked'); } });
    Object.defineProperty(window, 'sessionStorage', { get() { throw Error('blocked'); } });
  });
  if (options.timeout) await context.addInitScript(() => {
    const timer = window.setTimeout;
    window.setTimeout = (callback, delay, ...args) => timer(callback, delay === 30000 ? 120 : delay, ...args);
  });
  if (folder === 'MCSA-offical-website') {
    await context.route('**/assets/config.js', route => route.fulfill({ contentType: 'text/javascript',
      body: `window.MCSA_CONFIG={apiBase:${JSON.stringify(base + '/api')}};` }));
    await context.route('**/api/site', route => options.failed
      ? route.fulfill({ status: 503, body: 'Unavailable' })
      : route.fulfill({ json: { data, revision: 1 } }));
  } else {
    await context.route('**/data/site.js', route => route.fulfill({ contentType: 'text/javascript',
      body: 'window.MCSA_DATA=' + JSON.stringify(data) + ';' }));
  }
  if (options.imageError) await context.route('**/opening.gif', route => route.abort());
  if (options.timeout) await context.route('**/opening.gif', async route => {
    await new Promise(resolve => setTimeout(resolve, 800));
    try { await route.abort(); } catch {}
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/${folder}/${options.settings ? 'privacy-settings' : 'index'}.html${options.preview ? '?preview=1' : ''}`);
  return { context, page, errors, url: `${base}/${folder}/` };
}

for (const folder of ['MCSA-offical-website', 'MCSA-website-provisional-']) {
  test(`${folder}: animation finishes before one non-modal prompt appears`, async () => {
    const { context, page, errors } = await visit(folder);
    try {
      await page.locator('.opening').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#privacy-prompt').count(), 0);
      await page.locator('#privacy-prompt').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.opening').count(), 0);
      assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
      assert.equal(await page.evaluate(() => localStorage.length), 0);
      assert.equal(await page.locator('#privacy-prompt').getAttribute('aria-modal'), null);
      if (process.env.MCSA_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.MCSA_SCREENSHOT_DIR, folder + '-desktop.png') });
      await page.locator('#language').selectOption('en');
      assert.equal(await page.locator('#privacy-prompt').count(), 1);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('#privacy-prompt').count(), 1);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  for (const action of ['skip', 'escape', 'imageError', 'timeout', 'reduced']) {
    test(`${folder}: ${action} also reaches the prompt`, async () => {
      const { context, page, errors } = await visit(folder, { [action]: true });
      try {
        if (action === 'skip') await page.locator('.opening button').click();
        if (action === 'escape') {
          await page.locator('.opening').waitFor({ state: 'visible' });
          await page.keyboard.press('Escape');
        }
        await page.locator('#privacy-prompt').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.opening').count(), 0);
        assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
  }

  test(`${folder}: allow, customize, deny, navigation, motion and clear`, async () => {
    const { context, page, errors, url } = await visit(folder, { reduced: true });
    try {
      await page.locator('#privacy-prompt').waitFor({ state: 'visible' });
      await page.locator('#language').selectOption('en');
      await page.locator('[data-privacy-choice="allowed"]').click();
      assert.equal(await page.evaluate(() => localStorage.getItem('mcsa-language')), 'en');
      assert.equal(await page.evaluate(() => localStorage.getItem('mcsa-privacy-choice')), 'allowed');
      await page.reload();
      await page.locator('#language').waitFor();
      assert.equal(await page.locator('#language').inputValue(), 'en');
      assert.equal(await page.locator('#privacy-prompt').count(), 0);
      await page.locator('.footer-links a[href="privacy-settings.html"]').click();
      await page.locator('#remember-preferences').uncheck();
      await page.locator('#show-intro').uncheck();
      await page.locator('#allow-motion').uncheck();
      await page.locator('#language').selectOption('hant');
      assert.equal(await page.locator('#remember-preferences').isChecked(), false);
      assert.equal(await page.locator('#show-intro').isChecked(), false);
      assert.equal(await page.locator('#allow-motion').isChecked(), false);
      await page.locator('#preferences-form button[type="submit"]').click();
      assert.match(await page.locator('#preferences-status').textContent(), /工作階段/);
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['mcsa-privacy-choice']);
      await page.goto(url + 'index.html');
      await page.locator('#language').waitFor();
      assert.equal(await page.locator('#language').inputValue(), 'hant');
      assert.equal(await page.locator('#privacy-prompt').count(), 0);
      assert.equal(await page.evaluate(() => MCSA.preferences.motion), false);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      assert.equal(await page.evaluate(() => MCSA.preferences.reducedMotion), true);
      if (folder.includes('provisional')) await page.locator('.mcsa-mascot[data-still="true"]').waitFor();
      await page.locator('.carousel').scrollIntoViewIfNeeded();
      const transform = await page.locator('.carousel-track').evaluate(el => el.style.transform);
      await page.locator('.carousel-track').evaluate(el => {
        window.testSlideChanges = 0;
        new MutationObserver(() => window.testSlideChanges++).observe(el, { attributes: true, attributeFilter: ['style'] });
      });
      await page.waitForTimeout(650);
      assert.equal(await page.evaluate(() => window.testSlideChanges), 0);
      assert.equal(await page.locator('.carousel-track').evaluate(el => el.style.transform), transform);
      await page.locator('.carousel .next').click();
      assert.notEqual(await page.locator('.carousel-track').evaluate(el => el.style.transform), transform);
      await page.goto(url + 'privacy-settings.html');
      await page.locator('#clear-preferences').click();
      assert.equal(await page.locator('#remember-preferences').isChecked(), false);
      assert.equal(await page.locator('#show-intro').isChecked(), true);
      assert.equal(await page.locator('#allow-motion').isChecked(), true);
      assert.equal(await page.evaluate(() => localStorage.length), 0);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('mcsa-session-preferences')), null);
      assert.equal(await page.locator('.opening').count(), 0);
      await page.goto(url + 'index.html');
      await page.locator('#privacy-prompt').waitFor({ state: 'visible' });
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  test(`${folder}: mobile card fits and avoids back-to-top; customize opens settings`, async () => {
    const { context, page, errors } = await visit(folder, { mobile: true, reduced: true });
    try {
      await page.locator('#privacy-prompt').waitFor({ state: 'visible' });
      const card = await page.locator('#privacy-prompt').boundingBox();
      assert.ok(card.x >= 0 && card.x + card.width <= 375);
      assert.ok(card.y >= 0 && card.y + card.height <= 812);
      const back = await page.locator('#back-top').boundingBox();
      assert.ok(back.y + back.height < card.y);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (process.env.MCSA_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.MCSA_SCREENSHOT_DIR, folder + '-mobile.png') });
      await page.locator('#privacy-prompt a').click();
      await page.locator('#preferences-form').waitFor();
      await page.locator('#preferences-form').scrollIntoViewIfNeeded();
      if (process.env.MCSA_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.MCSA_SCREENSHOT_DIR, folder + '-settings-mobile.png') });
      assert.equal(await page.locator('#privacy-prompt').count(), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  test(`${folder}: denied decision alone suppresses prompts after a fresh session`, async () => {
    const { context, page, errors } = await visit(folder, { reduced: true, initial: { 'mcsa-privacy-choice': 'denied' } });
    try {
      await page.locator('#language').waitFor();
      assert.equal(await page.locator('#privacy-prompt').count(), 0);
      assert.equal(await page.evaluate(() => MCSA.preferences.motion), true);
      assert.equal(await page.locator('#language').inputValue(), 'zh');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  test(`${folder}: blocked storage reports current-page fallback`, async () => {
    const { context, page, errors } = await visit(folder, { reduced: true, blocked: true, settings: true });
    try {
      await page.locator('#preferences-form').waitFor();
      await page.locator('#remember-preferences').check();
      await page.locator('#preferences-form button[type="submit"]').click();
      assert.match(await page.locator('#preferences-status').textContent(), /仅在当前页面/);
      assert.equal(await page.evaluate(() => MCSA.preferences.choice), 'allowed');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  test(`${folder}: preview never shows an intro or privacy prompt`, async () => {
    const { context, page, errors } = await visit(folder, { preview: true });
    try {
      await page.locator('#language').waitFor();
      assert.equal(await page.locator('.opening').count(), 0);
      assert.equal(await page.locator('#privacy-prompt').count(), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  test(`${folder}: blocked storage shows a visible, dismissible notice on the homepage`, async () => {
    const { context, page, errors } = await visit(folder, { reduced: true, blocked: true, mobile: true });
    try {
      await page.locator('[data-privacy-choice="denied"]').click();
      const notice = page.locator('#local-preferences-status');
      assert.match(await notice.textContent(), /仅在当前页面/);
      const box = await notice.boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= 812);
      await notice.locator('button').click();
      assert.equal(await notice.textContent(), '');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  test(`${folder}: system reduced motion changes apply immediately`, async () => {
    const { context, page, errors } = await visit(folder);
    try {
      await page.locator('#privacy-prompt').waitFor();
      assert.equal(await page.evaluate(() => MCSA.preferences.reducedMotion), false);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => MCSA.preferences.reducedMotion);
      if (folder.includes('provisional')) assert.equal(await page.locator('.mcsa-mascot').getAttribute('data-still'), 'true');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction(() => !MCSA.preferences.reducedMotion);
      if (folder.includes('provisional')) await page.locator('.mcsa-mascot[data-still="false"]').waitFor();
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  test(`${folder}: browser back and restored DOM reread choices without duplicate prompts`, async () => {
    const { context, page, errors } = await visit(folder, { reduced: true });
    try {
      await page.locator('#privacy-prompt a').click();
      await page.locator('#preferences-form button[type="submit"]').click();
      await page.goBack();
      await page.locator('#language').waitFor();
      assert.equal(await page.evaluate(() => MCSA.preferences.choice), 'denied');
      assert.equal(await page.locator('#privacy-prompt').count(), 0);
      await page.evaluate(() => {
        localStorage.removeItem('mcsa-privacy-choice');
        sessionStorage.removeItem('mcsa-session-preferences');
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      });
      await page.locator('#privacy-prompt').waitFor();
      assert.equal(await page.locator('#privacy-prompt').count(), 1);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  test(`${folder}: valid legacy preferences skip the intro, corrupt records still prompt`, async () => {
    for (const legacy of [JSON.stringify({ remember: true, intro: false, motion: false }), 'broken']) {
      const { context, page, errors } = await visit(folder, { initial: { 'mcsa-preferences': legacy } });
      try {
        await page.locator('#language').waitFor();
        if (legacy === 'broken') await page.locator('#privacy-prompt').waitFor();
        else {
          assert.equal(await page.locator('.opening').count(), 0);
          assert.equal(await page.locator('#privacy-prompt').count(), 0);
          assert.equal(await page.evaluate(() => MCSA.preferences.choice), 'allowed');
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  });
}

test('formal website: loading failure never shows preferences', async () => {
  const { context, page, errors } = await visit('MCSA-offical-website', { failed: true });
  try {
    await page.locator('#retry-content').waitFor();
    assert.equal(await page.locator('#privacy-prompt').count(), 0);
    assert.equal(await page.locator('.opening').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

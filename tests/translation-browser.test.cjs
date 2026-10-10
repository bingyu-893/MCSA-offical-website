// Start backend/tests/translation_browser_server.py before running this file.
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../MCSA-website-backend/seed.json'), 'utf8'));
const base = process.env.MCSA_TEST_BASE_URL || 'http://127.0.0.1:8765';
const adminBase = process.env.MCSA_ADMIN_TEST_URL || 'http://127.0.0.1:8766';
let browser;
before(async () => { browser = await chromium.launch({headless: true, executablePath: process.env.MCSA_BROWSER_EXECUTABLE || undefined}); });
after(async () => { await browser?.close(); });

async function frontend(options = {}) {
  const context = await browser.newContext({viewport: options.mobile ? {width:375,height:812} : {width:1440,height:1000}, reducedMotion:'reduce'});
  await context.route('**/assets/config.js', route => route.fulfill({contentType:'text/javascript', body:`window.MCSA_CONFIG={apiBase:${JSON.stringify(adminBase + '/api')}};`}));
  if (options.data) await context.route('**/api/site', route => route.fulfill({json:{revision:1,data:options.data}}));
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/MCSA-offical-website/${options.route || 'index.html'}`);
  await page.locator('#language').selectOption('en');
  return {context,page,errors};
}

test('English routes, fallback labels, filtering, persistence and mobile layout', async () => {
  for (const mobile of [false,true]) {
    const data=structuredClone(seed);
    data.posts[0].published=true;
    data.posts[0].title={zh:'等待翻译活动',en:'',hant:'等待翻譯活動',_translationStatus:'pending'};
    data.posts[0].text={zh:'中文说明',en:'',hant:'中文說明'};
    data.interfaceText['全部地区']={zh:'全部地区',en:'',hant:'全部地區'};
    data.regions=[{id:'city',name:{zh:'城市',en:'City',hant:'城市'}},{id:'campus',name:{zh:'校区',en:'Campus',hant:'校區'}}];
    data.categories=[{id:'food',name:{zh:'餐饮',en:'Food',hant:'餐飲'}}];
    data.merchants=[{id:'cafe',name:{zh:'咖啡店',en:'An unusually long official merchant name for layout verification',hant:'咖啡店'},text:{zh:'折扣说明',en:'Discount information',hant:'折扣說明'},region:'city',category:'food',image:'',url:''}];
    const {context,page,errors}=await frontend({data,mobile});
    try {
      assert.equal(await page.locator('html').getAttribute('lang'),'en');
      await page.locator('[data-department="marketing"]').first().click();
      await page.locator('#language').selectOption('zh');
      await page.locator('#language').selectOption('en');
      assert.equal(await page.locator('#department-detail h3').textContent(),data.departments.find(d=>d.id==='marketing').name.en);
      for (const route of ['latest-events.html','recruitment.html','presidents.html','discounts.html','sponsors.html','campus-info.html','past-review.html','contact.html','privacy.html','privacy-settings.html','feedback.html','accessibility.html','disclaimer.html',`article.html?id=${encodeURIComponent(data.posts[0].id)}`]) {
        await page.goto(`${base}/MCSA-offical-website/${route}`);
        await page.locator('#language').waitFor();
        assert.equal(await page.locator('#language').inputValue(),'en',route);
        assert.ok((await page.locator('h1,h2').first().textContent()).trim(),route);
        if(route==='discounts.html') {
          assert.equal(await page.locator('#region-filter option').first().textContent(),'All areas');
          await page.locator('#region-filter').selectOption('campus');
          await page.locator('#category-filter').selectOption('food');
          await page.locator('#language').selectOption('zh');
          await page.locator('#language').selectOption('en');
          assert.equal(await page.locator('#region-filter').inputValue(),'campus');
          assert.equal(await page.locator('#category-filter').inputValue(),'food');
          assert.equal(await page.locator('#filter-empty').isVisible(),true);
        }
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
        assert.equal(overflow,false,`${route} overflow at ${mobile?'mobile':'desktop'}`);
      }
      assert.match(await page.locator('#main').textContent(),/Translation pending/);
      assert.match(await page.title(),/等待翻译活动/);
      await page.reload();
      await page.locator('#language').waitFor();
      assert.equal(await page.locator('#language').inputValue(),'en');
      if(mobile) {
        await page.locator('.menu-button').click();
        assert.equal(await page.locator('.menu-button').getAttribute('aria-expanded'),'true');
      }
      assert.deepEqual(errors,[]);
      if(process.env.MCSA_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.MCSA_SCREENSHOT_DIR,`english-${mobile?'mobile':'desktop'}.png`),fullPage:true});
    } finally {await context.close();}
  }
});

test('CMS Chinese publish → machine English → saved draft → approved English, preview and terms', async () => {
  const source = '浏览器校对活动 ' + Date.now();
  const reviewed = 'Human reviewed event ' + Date.now();
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.route('**/MCSA-offical-website/assets/config.js', route => route.fulfill({contentType:'text/javascript',body:`window.MCSA_CONFIG={apiBase:${JSON.stringify(adminBase+'/api')}};`}));
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(adminBase+'/admin.html');
    await page.locator('[name=password]').fill('browser-translation-test');
    await page.locator('.cms-login button').click();
    await page.locator('#add-entry').click();
    const card=page.locator('.editor-card').last();
    if (await card.getAttribute('open') === null) await card.locator('summary').first().click();
    const title=card.locator('[data-path$=".title.zh"]');
    await title.fill(source);
    await card.locator('[data-path$=".text.zh"]').fill('浏览器活动详情');
    await card.locator('[data-path$=".published"]').check();
    await page.locator('#save-site').click();
    await page.locator('#cms-status').filter({hasText:'中文已保存'}).waitFor();
    await page.locator('[data-section=translations]').click();
    for(let attempt=0;attempt<15;attempt++) {
      await page.locator('#refresh-translations').click();
      const body=await page.locator('.cms-editor').textContent();
      if(body.includes(source+' · 待校对')) break;
      await new Promise(resolve=>setTimeout(resolve,300));
    }
    let review=page.locator('.editor-card').filter({has:page.locator('summary',{hasText:source})});
    if (await review.getAttribute('open') === null) await review.locator('summary').first().click();
    await review.locator('[data-english]').fill(reviewed);
    await review.locator('[data-translation-action=draft]').click();
    await page.locator('#cms-status').filter({hasText:'草稿已保存'}).waitFor();
    let publicData=await (await context.request.get(adminBase+'/api/site')).json();
    assert.equal(publicData.data.posts.at(-1).title.en.trim(),'Machine translation');
    assert.ok(!JSON.stringify(publicData).includes(reviewed));
    await page.locator('#preview-site').click();
    const preview=page.frameLocator('.cms-preview iframe');
    await page.locator('#preview-language').selectOption('en');
    await preview.locator('html[lang=en]').waitFor();
    assert.equal(await preview.getByText(reviewed,{exact:true}).count(),0);
    await page.locator('#preview-language').selectOption('candidate');
    await preview.getByText(reviewed,{exact:true}).waitFor();
    await preview.getByText(reviewed,{exact:true}).click();
    await preview.locator('h1').filter({hasText:reviewed}).waitFor();
    assert.equal(await preview.locator('html').getAttribute('lang'),'en');
    await page.locator('.cms-preview button').click();
    review=page.locator('.editor-card').filter({has:page.locator('summary',{hasText:source})});
    if (await review.getAttribute('open') === null) await review.locator('summary').first().click();
    await review.locator('[data-translation-action=approve]').click();
    await page.locator('#cms-status').filter({hasText:'已批准并发布'}).waitFor();
    publicData=await (await context.request.get(adminBase+'/api/site')).json();
    assert.equal(publicData.data.posts.at(-1).title.en,reviewed);
    await page.locator('[data-section=glossary]').click();
    await page.locator('#add-term').click();
    const term=page.locator('.glossary-row').last();
    await term.locator('[data-key=zh]').fill(source);
    await term.locator('[data-key=en]').fill('Browser Review Event');
    await term.locator('[data-key=enabled]').check();
    await page.locator('#save-terms').click();
    await page.locator('#cms-status').filter({hasText:'术语已保存'}).waitFor();
    assert.deepEqual(errors,[]);
    if(process.env.MCSA_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.MCSA_SCREENSHOT_DIR,'english-cms.png'),fullPage:true});
  } finally {await context.close();}
});

test('English machine/update notices and CMS interface text render as plain text', async () => {
  const data=structuredClone(seed);
  data.departments[0].intro._translationStatus='stale';
  data.pages.home.paragraphs[0]._translationStatus='machine';
  data.interfaceText['菜单']={zh:'菜单',en:'Menu <img src=x onerror="window.injected=true">',hant:'菜單'};
  const {context,page,errors}=await frontend({data,mobile:true});
  try {
    assert.match(await page.locator('#main').textContent(),/machine translated/);
    await page.locator('[data-department]').first().click();
    assert.match(await page.locator('#department-detail').textContent(),/awaiting an update/);
    assert.equal(await page.locator('.menu-button img').count(),0);
    assert.equal(await page.evaluate(()=>Boolean(window.injected)),false);
    for(const route of ['about.html','departments.html','department-marketing.html','apply.html']) {
      await page.goto(`${base}/MCSA-offical-website/${route}`);
      await page.locator('#language').waitFor();
      assert.equal(await page.locator('#language').inputValue(),'en');
    }
    assert.deepEqual(errors,[]);
  } finally {await context.close();}
});

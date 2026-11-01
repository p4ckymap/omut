import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?grid');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
  await expect(page).toHaveTitle('ОМУТ');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  return errors;
}

async function bounds(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector('canvas')!.getBoundingClientRect();
    const p = document.querySelector('#game')!.getBoundingClientRect();
    return { x: c.x, y: c.y, width: c.width, height: c.height,
      parent: { x: p.x, y: p.y, right: p.right, bottom: p.bottom },
      overflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
    };
  });
}

async function checkFit(page: Page) {
  await expect.poll(async () => {
    const c = await bounds(page);
    return !c.overflow && c.x >= c.parent.x - 1 && c.y >= c.parent.y - 1 &&
      c.x + c.width <= c.parent.right + 1 && c.y + c.height <= c.parent.bottom + 1;
  }).toBe(true);
  const c = await bounds(page);
  expect(c.width / c.height).toBeCloseTo(390 / 844, 2);
}

async function tap(page: Page, x: number, y: number) {
  const c = await bounds(page);
  await page.mouse.click(c.x + x * c.width / 390, c.y + y * c.height / 844);
}

for (const [width, height] of [[390, 844], [360, 800], [430, 932], [320, 568], [844, 390], [1440, 1000]]) {
  test(`viewport ${width}x${height}: fits, renders and responds`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await ready(page);
    await checkFit(page);
    await tap(page, 50, 150);
    await expect(page.locator('#debug-status')).toHaveText('Место 1.1: 76×80, x 16, y 123');
    await tap(page, 304, 28);
    await expect(page.locator('#debug-status')).toHaveText('Сетка 4 px: выключена');
    await tap(page, 356, 28);
    await expect(page.locator('#debug-status')).toContainText('Этап 0: коснись зоны');
    await tap(page, 303, 809);
    await expect(page.locator('#debug-status')).toHaveText('Конец хода (макет): 150×48, x 228, y 785');
    await tap(page, 356, 28);
    if (width === 390 || width === 1440) await page.screenshot({ path: `output/stage0/${width}x${height}.png` });
    expect(errors).toEqual([]);
  });
}

test('exact logical geometry and fonts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const data = await page.evaluate(() => (window as any).__OMUT_DEBUG__);
  expect(data.phaser).toBe('3.90.0');
  expect([data.width, data.height]).toEqual([390, 844]);
  expect(data.zones.map((z: any) => [z.y, z.height])).toEqual([[0,56],[60,54],[118,190],[312,30],[346,190],[540,230],[774,70]]);
  expect(data.boxes.filter((b: any) => b.width === 88 && b.height === 190).map((b: any) => [b.x,b.y]))
    .toEqual([[10,118],[104,118],[198,118],[292,118],[10,346],[104,346],[198,346],[292,346]]);
  expect(data.boxes.filter((b: any) => b.width === 76 && b.height === 80)).toHaveLength(16);
  expect(data.boxes.find((b: any) => b.name === 'Поднятая карта')).toEqual({name:'Поднятая карта',x:136,y:578,width:118,height:188});
  for (const b of data.boxes) {
    expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x+b.width).toBeLessThanOrEqual(390); expect(b.y+b.height).toBeLessThanOrEqual(844);
  }
  expect(await page.evaluate(() => document.fonts.check('16px "Ruslan Display"', 'ОМУТ') && document.fonts.check('13px "Golos Text"', 'Сетка'))).toBe(true);
});

test('simulated safe-area and live rotation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await ready(page);
  await page.addStyleTag({ content: ':root { --safe-top:47px; --safe-bottom:34px; --safe-left:20px; --safe-right:20px; }' });
  await checkFit(page);
  const c = await bounds(page);
  expect(c.parent).toEqual({x:20,y:47,right:370,bottom:810});
  await tap(page,303,809);
  await expect(page.locator('#debug-status')).toContainText('Конец хода (макет)');
  await tap(page,356,28);
  await page.screenshot({path:'output/stage0/safe-area.png'});
  await page.setViewportSize({width:844,height:390});
  await checkFit(page);
  await tap(page,304,28);
  await expect(page.locator('#debug-status')).toContainText('выключена');
  expect(errors).toEqual([]);
});

test('font failure is visible and retry starts the scene', async ({ page }) => {
  await page.route(/\.woff2?($|\?)/, route => route.abort());
  await page.goto('/?grid');
  await expect(page.locator('#retry')).toBeVisible({timeout:20000});
  await expect(page.locator('#loading-message')).toContainText('Шрифты не загрузились');
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.unroute(/\.woff2?($|\?)/);
  await page.locator('#retry').click();
  await expect(page.locator('html')).toHaveAttribute('data-ready','true',{timeout:20000});
});

test('mobile touch and DPR 3', async ({ browser }) => {
  const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3});
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5187/?grid');
  await expect(page.locator('html')).toHaveAttribute('data-ready','true',{timeout:20000});
  await checkFit(page);
  const c = await bounds(page);
  await page.touchscreen.tap(c.x+195*c.width/390,c.y+650*c.height/844);
  await expect(page.locator('#debug-status')).toHaveText('Поднятая карта: 118×188, x 136, y 578');
  expect(errors).toEqual([]);
  await context.close();
});

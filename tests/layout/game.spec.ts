import { expect, test, type Page } from '@playwright/test';

type Omut = { scene: { busy: boolean; over: boolean; state: { phase: string; activePlayer: number; turn: number }; act: (a: unknown) => Promise<boolean>; tut?: { step: string } }; suggest: () => unknown };
declare global { interface Window { __omut?: Omut } }

async function open(page: Page, settings: object) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(s => localStorage.setItem('omut.settings.v1', JSON.stringify(s)), settings);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await expect(page).toHaveTitle('ОМУТ');
  await page.waitForTimeout(1200);
  return errors;
}

test('full match: menu → toss → bot turns → result, no console errors', async ({ page }) => {
  test.setTimeout(240000);
  const errors = await open(page, { tutorialDone: true, speed: 2 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.mouse.click(195, 600); // «Нырнуть»
  await page.waitForFunction(() => !!window.__omut, null, { timeout: 10000 });
  await page.waitForTimeout(3500);
  // no hand replacement any more: the toss leads straight into the match
  const t0 = Date.now();
  let over = false;
  while (Date.now() - t0 < 200000) {
    const st = await page.evaluate(() => { const s = window.__omut!.scene; return { busy: s.busy, over: s.over, phase: s.state.phase, active: s.state.activePlayer }; });
    if (st.over || st.phase === 'over') { over = true; break; }
    if (st.busy || st.active !== 0 || st.phase !== 'playing') { await page.waitForTimeout(200); continue; }
    await page.evaluate(() => { const o = window.__omut!; const a = o.suggest(); if (a) void o.scene.act(a); });
    await page.waitForTimeout(100);
  }
  expect(over).toBe(true);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'output/release/match-result.png' });
  expect(errors).toEqual([]);
});

test('tutorial starts with the scripted hand and gates other actions', async ({ page }) => {
  const errors = await open(page, { tutorialDone: false });
  await page.waitForTimeout(1500); // the offer appears shortly after the menu fades in
  await page.mouse.click(195, 454); // «Пройти обучение»
  await page.waitForFunction(() => window.__omut?.scene.tut?.step === 'hand' && !window.__omut.scene.busy, null, { timeout: 20000 });
  const refused = await page.evaluate(async () => window.__omut!.scene.act({ type: 'EndTurn', player: 0 }));
  expect(refused).toBe(false);
  await page.screenshot({ path: 'output/release/tutorial-step1.png' });
  expect(errors).toEqual([]);
});

test('long press opens the inspector and releasing the finger keeps it open; pause freezes the bot', async ({ page }) => {
  test.setTimeout(150000);
  const errors = await open(page, { tutorialDone: true, speed: 2 });
  await page.mouse.click(195, 600);
  await page.waitForFunction(() => !!window.__omut, null, { timeout: 10000 });
  await page.waitForTimeout(3500);
  // the match starts right after the toss
  await page.waitForFunction(() => { const s = window.__omut!.scene; return !s.busy && s.state.phase === 'playing' && s.state.activePlayer === 0; }, null, { timeout: 90000 });
  // lowest hand card: press on its left edge, hold, release on the dark backdrop
  const p = await page.evaluate(() => { const v = (window.__omut!.scene as unknown as { handViews: { x: number; y: number }[] }).handViews[0]; return { x: v.x - 30, y: v.y + 40 }; });
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window.__omut!.scene as unknown as { modalOpen: boolean }).modalOpen)).toBe(true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window.__omut!.scene as unknown as { modalOpen: boolean }).modalOpen)).toBe(false);
  // Esc on the bare board opens the pause, which stops the scene clock
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window.__omut!.scene as unknown as { time: { paused: boolean } }).time.paused)).toBe(true);
  await page.screenshot({ path: 'output/release/pause.png' });
  expect(errors).toEqual([]);
});

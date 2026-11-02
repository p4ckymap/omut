import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { CardDefinition } from '../../src/engine/types';
const CARDS: CardDefinition[] = JSON.parse(readFileSync('src/data/cards.json', 'utf8'));

import type { GameState } from '../../src/engine/types';

const out = 'output/redesign-live-20261101/qa';
const defaults = { tutorialDone: true, reduceMotion: false, speed: 2, volume: 0 };

async function open(page: Page, size = { width: 390, height: 844 }, saved?: GameState) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /animation skipped|texture.*not found/i.test(m.text()))) errors.push(m.text()); });
  await page.setViewportSize(size);
  await page.addInitScript(({ settings, state }) => {
    if (!localStorage.getItem('omut.settings.v1')) localStorage.setItem('omut.settings.v1', JSON.stringify(settings));
    if (state && !localStorage.getItem('omut.match.v1')) localStorage.setItem('omut.match.v1', JSON.stringify({ v: 1, state }));
  }, { settings: defaults, state: saved });
  await page.goto('/');
  await expect(page).toHaveTitle('ОМУТ');
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'Menu', { timeout: 30000 });
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.waitForTimeout(500);
  return errors;
}

async function point(page: Page, x: number, y: number) {
  const b = await page.locator('canvas').boundingBox();
  if (!b) throw new Error('Game canvas is missing');
  return { x: b.x + x * b.width / 390, y: b.y + y * b.height / 844 };
}
async function tap(page: Page, x: number, y: number) {
  const p = await point(page, x, y); await page.mouse.click(p.x, p.y);
}
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const a = await point(page, from.x, from.y), b = await point(page, to.x, to.y);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 15 });
  await page.waitForTimeout(100); await page.mouse.up();
}
async function scene(page: Page, name: string) {
  await expect(page.locator('html')).toHaveAttribute('data-scene', name);
  await page.waitForTimeout(450);
}
async function fit(page: Page) {
  const box = await page.evaluate(() => {
    const c = document.querySelector('canvas')!.getBoundingClientRect();
    const p = document.querySelector('#game')!.getBoundingClientRect();
    return { x: c.x, y: c.y, right: c.right, bottom: c.bottom, ratio: c.width / c.height,
      parent: { x: p.x, y: p.y, right: p.right, bottom: p.bottom }, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(box.overflow).toBe(false);
  expect(box.ratio).toBeCloseTo(390 / 844, 3);
  expect(box.x).toBeGreaterThanOrEqual(box.parent.x - 1);
  expect(box.y).toBeGreaterThanOrEqual(box.parent.y - 1);
  expect(box.right).toBeLessThanOrEqual(box.parent.right + 1);
  expect(box.bottom).toBeLessThanOrEqual(box.parent.bottom + 1);
}
async function modalTexture(page: Page, name: string) {
  return page.evaluate(key => {
    const s = (window as any).__omutGame.scene.getScene(key);
    const modal = s.children.list.find((o: any) => o.depth === 5000);
    return modal?.list[1]?.list[0]?.texture.key ?? null;
  }, name);
}

for (const [width, height] of [[390, 844], [360, 800], [430, 932]]) {
  test(`redesign ${width}x${height}: all four navigation screens fit`, async ({ page }) => {
    const errors = await open(page, { width, height });
    await fit(page);
    expect(await page.evaluate(() => document.fonts.check('32px "Tiny5"', 'ОМУТ'))).toBe(true);
    await page.screenshot({ path: `${out}/menu-${width}.png` });
    await tap(page, 350, 52); await scene(page, 'Settings'); await fit(page);
    await page.screenshot({ path: `${out}/settings-${width}.png` });
    await tap(page, 195, 800); await scene(page, 'Menu');
    await tap(page, 285, 748); await scene(page, 'Bestiary'); await fit(page);
    await page.screenshot({ path: `${out}/bestiary-${width}.png` });
    await tap(page, 38, 50); await scene(page, 'Menu');
    await tap(page, 104, 748); await scene(page, 'Rules'); await fit(page);
    await page.screenshot({ path: `${out}/rules-${width}.png` });
    await tap(page, 40, 48); await scene(page, 'Menu');
    expect(errors).toEqual([]);
  });
}

test('catalogue: every original card, all filters, scrolling, flip and close', async ({ page }) => {
  const errors = await open(page);
  await tap(page, 285, 748); await scene(page, 'Bestiary');
  const filters = ['all', 'human', 'undead', 'wild', 'monster', 'demon', 'spell'];
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i];
    await tap(page, i < 4 ? 54 + i * 94 : 89 + (i - 4) * 106, i < 4 ? 124 : 174);
    const ids = await page.evaluate(() => (window as any).__omutGame.scene.getScene('Bestiary').sc.content.list.map((o: any) => o.texture.key));
    const expected = CARDS.filter(c => f === 'all' || (f === 'spell' ? c.kind === 'spell' : c.class === f)).map(c => `h:${c.id}`);
    expect(ids.sort()).toEqual(expected.sort());
  }
  await tap(page, 54, 124);
  await drag(page, { x: 290, y: 730 }, { x: 290, y: 280 });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__omutGame.scene.getScene('Bestiary').sc.content.y)).toBeLessThan(208);
  expect(await modalTexture(page, 'Bestiary')).toBeNull();
  // Re-filter resets the list; an intentional tap then opens the original image.
  await tap(page, 148, 124); await tap(page, 54, 124); await page.waitForTimeout(700);
  await tap(page, 100, 340);
  await expect.poll(() => modalTexture(page, 'Bestiary')).toBe('f:opol');
  await tap(page, 195, 370);
  await expect.poll(() => modalTexture(page, 'Bestiary')).toBe('b:opol');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/original-card-back.png` });
  await page.keyboard.press('Escape');
  await expect.poll(() => modalTexture(page, 'Bestiary')).toBeNull();
  expect(errors).toEqual([]);
});

test('settings controls persist and tutorial restarts from settings', async ({ page }) => {
  const errors = await open(page);
  await tap(page, 350, 52); await scene(page, 'Settings');
  await tap(page, 340, 217); await tap(page, 233, 287); await tap(page, 234, 397);
  await tap(page, 335, 470); await tap(page, 335, 650);
  await drag(page, { x: 220, y: 581 }, { x: 312, y: 581 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('omut.settings.v1')!));
  expect(saved).toMatchObject({ hp: 30, bot: 'easy', speed: 1, reduceMotion: true, music: false, volume: 70 });
  await tap(page, 195, 800); await scene(page, 'Menu'); await page.reload(); await scene(page, 'Menu');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('omut.settings.v1')!))).toEqual(saved);
  await tap(page, 350, 52); await scene(page, 'Settings'); await tap(page, 195, 728);
  await page.waitForFunction(() => (window as any).__omut?.scene.tut?.step === 'hand' && !(window as any).__omut.scene.busy);
  expect(errors).toEqual([]);
});

test('rules scroll and start tutorial without an accidental pause', async ({ page }) => {
  const errors = await open(page);
  await tap(page, 104, 748); await scene(page, 'Rules');
  await drag(page, { x: 280, y: 700 }, { x: 280, y: 200 });
  await page.waitForTimeout(300);
  await tap(page, 195, 800);
  await page.waitForFunction(() => (window as any).__omut?.scene.tut?.step === 'hand' && !(window as any).__omut.scene.busy);
  expect(await page.evaluate(() => (window as any).__omut.scene.time.paused)).toBe(false);
  expect(errors).toEqual([]);
});

test('safe area and touch: live screens stay fitted and respond', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 3 });
  const page = await context.newPage();
  const errors = await open(page);
  await page.evaluate(() => {
    const s = document.documentElement.style;
    s.setProperty('--tg-safe-area-inset-top', '30px');
    s.setProperty('--tg-content-safe-area-inset-top', '44px');
    s.setProperty('--tg-safe-area-inset-bottom', '24px');
  });
  await page.waitForTimeout(400); await fit(page);
  const p = await point(page, 350, 52); await page.touchscreen.tap(p.x, p.y);
  await scene(page, 'Settings'); await fit(page);
  await page.screenshot({ path: `${out}/telegram-safe-area.png` });
  expect(errors).toEqual([]); await context.close();
});

async function playableSave(page: Page) {
  return page.evaluate(async () => {
  const { apply, createGame, legalActions } = await import('/src/engine/rules.ts');
  const { CARDS } = await import('/src/engine/cards.ts');
  for (let seed = 0; seed < 100; seed++) {
    let s = createGame(`redesign-${seed}`, { startingHp: 25 });
    while (s.phase === 'mulligan') s = apply(s, { type: 'Mulligan', player: s.activePlayer, cards: [] }).state;
    if (s.activePlayer !== 0) continue;
    const a = legalActions(s).find(a => a.type === 'PlayCreature' && CARDS.find(c => c.id === s.players[0].hand.find(h => h.uid === a.card)?.cardId)!.cost <= 2);
    if (a?.type === 'PlayCreature') { localStorage.setItem('omut.match.v1', JSON.stringify({ v: 1, state: s })); return { s, a }; }
  }
  throw new Error('No deterministic playable fixture');
  });
}

test('saved match: real drag, move, upgrade, burn and pause preserve state', async ({ page }) => {
  test.setTimeout(90000);
  const errors = await open(page);
  const { s, a } = await playableSave(page);
  await page.reload(); await scene(page, 'Menu');
  await tap(page, 195, 627); await scene(page, 'Match');
  await page.waitForFunction(() => !(window as any).__omut.scene.busy);
  expect(await page.evaluate(() => (window as any).__omut.scene.state)).toEqual(s);
  const handPoint = async (uid: string) => page.evaluate(id => {
    const v = (window as any).__omut.scene.handViews.find((v: any) => v.uid === id);
    const p = v.getWorldTransformMatrix().transformPoint(-40, 25); return { x: p.x, y: p.y };
  }, uid);
  const slot = (n: number) => ({ x: [10, 104, 198, 292][n >> 1] + 44, y: 346 + 22 + (n & 1) * 82 + 40 });
  const destination = slot(a.slot);
  await drag(page, await handPoint(a.card), { x: destination.x, y: destination.y + 60 });
  await page.waitForFunction(uid => (window as any).__omut.scene.state.players[0].board.some((u: any) => u?.uid === uid) && !(window as any).__omut.scene.busy, a.card);
  await tap(page, destination.x, destination.y); await page.waitForTimeout(200);
  const menu = await page.evaluate(() => { const m = (window as any).__omut.scene.tokenMenu; return { x: m.x, y: m.y }; });
  expect(menu).toEqual({ x: 15, y: 540 });
  await page.screenshot({ path: `${out}/battle-actions.png` });
  const move = await page.evaluate(async uid => { const { legalActions } = await import('/src/engine/rules.ts'); return legalActions((window as any).__omut.scene.state).find((m: any) => m.type === 'Move' && m.unit === uid); }, a.card);
  if (!move || move.type !== 'Move') throw new Error('No legal move for the freshly played creature');
  const moveTo = slot(move.slot);
  await drag(page, destination, { x: moveTo.x, y: moveTo.y + 30 });
  await page.waitForFunction(({ uid, n }) => (window as any).__omut.scene.state.players[0].board[n]?.uid === uid && !(window as any).__omut.scene.busy, { uid: a.card, n: move.slot });
  await tap(page, moveTo.x, moveTo.y); await page.waitForTimeout(200); await tap(page, 102, 566);
  await page.waitForFunction(uid => (window as any).__omut.scene.state.players[0].board.find((u: any) => u?.uid === uid)?.upgrades === 1 && !(window as any).__omut.scene.busy, a.card);
  const beforeBurn: GameState = await page.evaluate(() => (window as any).__omut.scene.state);
  const burn = beforeBurn.players[0].hand[0];
  await drag(page, await handPoint(burn.uid), { x: 195, y: 812 });
  await page.waitForFunction(uid => !(window as any).__omut.scene.state.players[0].hand.some((h: any) => h.uid === uid) && !(window as any).__omut.scene.busy, burn.uid);
  const afterBurn: GameState = await page.evaluate(() => (window as any).__omut.scene.state);
  expect(afterBurn.players[0].coins).toBe(beforeBurn.players[0].coins + 1);
  await page.screenshot({ path: `${out}/battle-390.png` });
  for (const [width, height] of [[360, 800], [430, 932]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(300); await fit(page);
    await page.screenshot({ path: `${out}/battle-${width}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
  await tap(page, 312, 28); expect(await page.evaluate(() => (window as any).__omut.scene.time.paused)).toBe(true);
  await page.waitForTimeout(600); expect(await page.evaluate(() => (window as any).__omut.scene.state)).toEqual(afterBurn);
  await tap(page, 195, 428); expect(await page.evaluate(() => (window as any).__omut.scene.time.paused)).toBe(false);
  await page.reload(); await scene(page, 'Menu'); await tap(page, 195, 627); await scene(page, 'Match');
  await page.waitForFunction(() => !(window as any).__omut.scene.busy);
  // Existing save migration materializes an absent home flag as false.
  for (const player of afterBurn.players) for (const unit of player.board) if (unit) unit.home ??= false;
  expect(await page.evaluate(() => (window as any).__omut.scene.state)).toEqual(afterBurn);
  expect(errors).toEqual([]);
});

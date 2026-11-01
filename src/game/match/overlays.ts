import Phaser from 'phaser';
import { CLASS_NAMES, WORLDS } from '../../engine/cards';
import type { PlayerId } from '../../engine/types';
import { sound } from '../audio';
import { C, H, icon, overlays, panel, saveSettings, settings, text, tween, W, Z } from '../core';
import { Button } from '../ui/Button';
import { ripple, sparks } from '../ui/fx';
import type { MatchScene } from './MatchScene';

function shade(scene: Phaser.Scene, alpha = 0.82) {
  return scene.add.rectangle(0, 0, W, H, 0x05070a, alpha).setOrigin(0).setInteractive();
}

/** Two-sided coin: gold «Ты» and crimson «Бот», each with its avatar. Drawn once per canvas zoom. */
function coinFace(scene: Phaser.Scene, side: 'you' | 'bot') {
  const key = `coin-${side}`;
  if (scene.textures.exists(key)) return key;
  const px = 128 * Z, c = px / 2, cv = document.createElement('canvas');
  cv.width = px; cv.height = px;
  const ctx = cv.getContext('2d')!;
  const [rim, face, dark, label] = side === 'you' ? ['#E2B33C', '#B8861E', '#6B4A0C', 'ТЫ'] : ['#E2483C', '#8E1F18', '#4A0C08', 'БОТ'];
  ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(c, c, c * 0.94, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = face; ctx.beginPath(); ctx.arc(c, c, c * 0.8, 0, Math.PI * 2); ctx.fill();
  // notched edge
  ctx.strokeStyle = dark; ctx.lineWidth = Z * 1.5;
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * c * 0.84, c + Math.sin(a) * c * 0.84); ctx.lineTo(c + Math.cos(a) * c * 0.92, c + Math.sin(a) * c * 0.92); ctx.stroke(); }
  const avatar = scene.textures.get(side === 'you' ? 'avatar-me' : 'avatar-bot').getSourceImage() as HTMLImageElement;
  ctx.save(); ctx.beginPath(); ctx.arc(c, c * 0.86, c * 0.42, 0, Math.PI * 2); ctx.clip();
  ctx.drawImage(avatar, c - c * 0.42, c * 0.86 - c * 0.42, c * 0.84, c * 0.84); ctx.restore();
  ctx.strokeStyle = rim; ctx.lineWidth = Z * 2; ctx.beginPath(); ctx.arc(c, c * 0.86, c * 0.42, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#FFF4D6'; ctx.font = `800 ${Math.round(c * 0.3)}px "Golos Text"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, c, c * 1.5);
  scene.textures.addCanvas(key, cv);
  return key;
}

/** The toss: the coin flies up spinning and lands on the side that moves first. */
export async function tossOverlay(scene: MatchScene, first: PlayerId) {
  const you = coinFace(scene, 'you'), bot = coinFace(scene, 'bot');
  const root = scene.add.container(0, 0).setDepth(4500);
  const bg = shade(scene, 0.8);
  root.add(bg);
  root.add(text(scene, W / 2, 150, 'Жребий', { size: 30, color: C.ink, font: 'display' }).setOrigin(0.5));
  root.add(text(scene, W / 2, 190, 'Чья сторона выпадет — тот ходит первым', { size: 14, font: 'text', color: C.muted }).setOrigin(0.5));
  const legend = (x: number, key: string, label: string, color: number) => {
    root.add(scene.add.image(x, 250, key).setDisplaySize(40, 40));
    root.add(text(scene, x + 30, 250, label, { size: 15, color }).setOrigin(0, 0.5));
  };
  legend(110, you, 'Ты', C.gold); legend(225, bot, 'Бот', C.wound);
  const groundY = 560;
  const shadowE = scene.add.ellipse(W / 2, groundY + 62, 120, 22, 0x000000, 0.5);
  const coin = scene.add.image(W / 2, groundY, you).setDisplaySize(128, 128);
  root.add([shadowE, coin]);
  const base = coin.scaleY;
  const flip = async () => {
    sound.whoosh();
    // Half-turns: an even count ends on the starting side («Ты»).
    const halves = 12 + (first === 0 ? 0 : 1);
    const o = { p: 0 };
    const spin = tween(scene, { targets: o, p: halves * Math.PI, duration: 1300, ease: 'Cubic.Out', onUpdate: () => {
      coin.setTexture(Math.floor((o.p + Math.PI / 2) / Math.PI) % 2 === 0 ? you : bot);
      coin.scaleY = base * Math.max(0.06, Math.abs(Math.cos(o.p)));
    } });
    const rise = tween(scene, { targets: coin, y: groundY - 230, duration: 600, ease: 'Quad.Out' })
      .then(() => tween(scene, { targets: coin, y: groundY, duration: 620, ease: 'Bounce.Out' }));
    scene.tweens.add({ targets: shadowE, scaleX: 0.45, alpha: 0.2, duration: 600, yoyo: true, ease: 'Quad.Out' });
    await Promise.all([spin, rise]);
  };
  // Reduced motion: no flight, the coin simply shows the side.
  if (settings.reduceMotion) { coin.setTexture(first === 0 ? you : bot); await tween(scene, { targets: coin, alpha: { from: 0, to: 1 }, duration: 200 }); }
  else await flip();
  coin.setTexture(first === 0 ? you : bot); coin.scaleY = base;
  sound.coin();
  const color = first === 0 ? C.gold : C.blood;
  sparks(scene, W / 2, groundY, color, 30, 60);
  ripple(scene, W / 2, groundY + 62, color, 3, 150);
  const msg = text(scene, W / 2, 680, first === 0 ? 'Первым ходишь ты' : 'Первым ходит Бот', { size: 24, color: first === 0 ? C.gold : C.wound }).setOrigin(0.5);
  const sub = text(scene, W / 2, 714, first === 0 ? 'Бот, как второй, получит +1 монету.' : 'Ты второй: +1 монета на старте.', { size: 13, font: 'text', color: C.muted }).setOrigin(0.5);
  root.add([msg, sub]);
  msg.setAlpha(0); sub.setAlpha(0);
  await tween(scene, { targets: [msg, sub], alpha: 1, duration: 200 });
  await new Promise<void>(resolve => {
    const done = () => { timer.remove(); bg.off('pointerup'); resolve(); };
    const timer = scene.time.delayedCall(1300, done);
    bg.once('pointerup', done);
  });
  await tween(scene, { targets: root, alpha: 0, duration: 200, onComplete: () => root.destroy() });
}

export function pauseOverlay(scene: MatchScene) {
  const root = scene.add.container(0, 0).setDepth(4600);
  root.add(shade(scene, 0.88));
  root.add(text(scene, W / 2, 90, 'Пауза', { size: 30, font: 'display' }).setOrigin(0.5));
  root.add(text(scene, W / 2, 132, 'Миры на этом столе', { size: 13, font: 'text', color: C.muted }).setOrigin(0.5));
  scene.state.worlds.forEach((wid, i) => {
    const w = WORLDS[wid], y = 168 + i * 50;
    const g = scene.add.graphics();
    panel(g, 30, y, 330, 42, C.panel, C.line, { cut: 4 });
    root.add(g);
    root.add(icon(scene, 52, y + 21, w.icon, 16));
    root.add(text(scene, 70, y + 21, w.name, { size: 16, color: w.color }).setOrigin(0, 0.5));
    root.add(text(scene, 160, y + 21, w.native ? `родной класс: ${CLASS_NAMES[w.native]}` : 'пара только одного класса', { size: 13, font: 'text', color: C.ink }).setOrigin(0, 0.5));
  });
  let close = () => {};
  const items: [string, () => void, boolean][] = [
    ['Продолжить', () => close(), true],
    ['Как играть', () => { scene.scene.launch('Rules', { from: 'Match' }); scene.scene.pause(); }, false],
    ['Настройки', () => { scene.scene.launch('Settings', { from: 'Match' }); scene.scene.pause(); }, false],
    ['Сдаться', () => { close(); scene.askConcede(); }, false],
  ];
  items.forEach(([label, fn, main], i) => root.add(new Button(scene, 45, 400 + i * 68, label, fn, { kind: main ? 'main' : 'normal' })));
  scene.freeze(true);
  close = overlays.push(() => { root.destroy(); scene.freeze(false); scene.armBack(); });
}

export function confirmConcede(scene: MatchScene, onYes: () => void) {
  const root = scene.add.container(0, 0).setDepth(4700);
  root.add(shade(scene, 0.8));
  const g = scene.add.graphics();
  panel(g, 30, 300, 330, 230, C.panel, C.blood, { cut: 6, shadow: true });
  root.add(g);
  root.add(text(scene, W / 2, 340, 'Сдаться?', { size: 30, color: C.wound, font: 'display' }).setOrigin(0.5));
  root.add(text(scene, W / 2, 384, 'Партия засчитается как поражение.', { size: 14, font: 'text' }).setOrigin(0.5));
  let close = () => {};
  let yes = false;
  root.add(new Button(scene, 50, 416, 'Сдаться', () => { yes = true; close(); }, { w: 140, h: 48, size: 16 }));
  root.add(new Button(scene, 200, 416, 'Отмена', () => close(), { w: 140, h: 48, size: 16, kind: 'main' }));
  scene.freeze(true);
  close = overlays.push(() => { root.destroy(); scene.freeze(false); if (yes) onYes(); });
}

export function resultOverlay(scene: MatchScene) {
  const win = scene.state.winner === 0;
  scene.persist(); // counts the result once and drops the save
  if (scene.tut) { settings.tutorialDone = true; saveSettings(); }
  win ? sound.win() : sound.lose();
  const root = scene.add.container(0, 0).setDepth(4800);
  const bg = shade(scene, 0);
  root.add(bg);
  scene.tweens.add({ targets: bg, fillAlpha: 0.88, duration: 800 });
  const title = text(scene, W / 2, 200, win ? 'Победа' : 'Утащило на дно', { size: win ? 56 : 38, color: win ? C.gold : 0x6fb3e8, font: 'display' }).setOrigin(0.5);
  const sub = text(scene, W / 2, 252, win ? 'Омут отпустил тебя. Пока что.' : 'Черти водятся. Попробуй ещё раз.', { size: 14, font: 'text', color: C.muted }).setOrigin(0.5);
  root.add([title, sub]);
  title.setAlpha(0).setY(win ? 170 : 230);
  scene.tweens.add({ targets: title, alpha: 1, y: 200, duration: 800, ease: win ? 'Back.Out' : 'Cubic.Out' });
  if (win) {
    for (let i = 0; i < 6; i++) scene.time.delayedCall(i * 180, () => sparks(scene, 60 + Math.random() * 270, 200 + Math.random() * 40, C.gold, 20, 60));
  } else {
    const em = scene.add.particles(0, 0, 'px', { x: { min: 20, max: W - 20 }, y: H, speedY: { min: -70, max: -30 }, lifespan: 6000, tint: 0x8fe0cf,
      alpha: { start: 0.5, end: 0 }, scale: { min: 1, max: 2 }, frequency: 90 }).setDepth(4801);
    root.add(em);
  }
  const me = scene.state.players[0];
  const rows: [string, string, string][] = [
    ['hourglass', 'Ходов', String(me.turns)],
    ['grave', 'Убито карт', String(me.stats.kills)],
    ['coin', 'Монет получено', String(me.stats.earned)],
    ['greed', 'Монет потрачено', String(me.stats.spent)],
    ['flame', 'Сожжено карт', String(me.stats.burned)],
  ];
  const g = scene.add.graphics();
  panel(g, 45, 300, 300, rows.length * 40 + 20, C.panel, C.line, { cut: 5 });
  root.add(g);
  rows.forEach(([ic, label, value], i) => {
    const y = 330 + i * 40;
    root.add(icon(scene, 70, y, ic));
    root.add(text(scene, 88, y, label, { size: 14, font: 'text' }).setOrigin(0, 0.5));
    root.add(text(scene, 320, y, value, { size: 24, color: C.gold }).setOrigin(1, 0.5));
  });
  const next = scene.tut ? 'Сыграть по-настоящему' : 'Ещё партия';
  root.add(new Button(scene, 45, 640, next, () => scene.leave('Match', { tutorial: false }), { kind: 'main' }));
  root.add(new Button(scene, 45, 708, 'В меню', () => scene.leave('Menu')));
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 300 });
}

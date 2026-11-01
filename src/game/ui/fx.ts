import Phaser from 'phaser';
import { C, H, icon, ms, settings, text, tween, W } from '../core';

const calm = () => settings.reduceMotion;
type P = { x: number; y: number };

/** Builds the small runtime textures the effects use. Call once in Boot. */
export function makeFxTextures(scene: Phaser.Scene) {
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 2, 2); g.generateTexture('px', 2, 2); g.clear();
  scene.textures.get('px').setFilter(Phaser.Textures.FilterMode.NEAREST);
  // Soft glow, banded in 6 steps (pixel look, no smooth gradient).
  for (let i = 6; i >= 1; i--) { g.fillStyle(0xffffff, 0.09 * (7 - i)); g.fillCircle(32, 32, i * 5); }
  g.generateTexture('glow', 64, 64); g.clear();
  g.destroy();
  // Red edge vignette for hits on the player.
  // Square canvas stretched to the screen: an elliptical red edge, clear in the middle.
  const cv = scene.textures.createCanvas('vignette', 200, 200)!;
  const ctx = cv.getContext();
  const grad = ctx.createRadialGradient(100, 100, 78, 100, 100, 142);
  grad.addColorStop(0, 'rgba(226,72,60,0)'); grad.addColorStop(1, 'rgba(226,72,60,0.75)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 200, 200); cv.refresh();
}

export function floatText(scene: Phaser.Scene, x: number, y: number, value: string, color: number = C.blood, size = 24) {
  const t = text(scene, x, y, value, { size, color, stroke: true }).setOrigin(0.5).setDepth(3000);
  scene.tweens.add({ targets: t, y: y - 26, duration: ms(700), ease: 'Cubic.Out' });
  scene.tweens.add({ targets: t, alpha: 0, delay: ms(450), duration: ms(350), onComplete: () => t.destroy() });
  if (!calm()) { t.setScale(0.6); scene.tweens.add({ targets: t, scale: 1, duration: ms(160), ease: 'Back.Out' }); }
  return t;
}

export function shake(scene: Phaser.Scene, target: { x: number }, amp = 3, dur = 260) {
  if (calm()) return Promise.resolve();
  const x0 = target.x;
  return tween(scene, { targets: target, x: { from: x0 - amp, to: x0 + amp }, duration: 45, yoyo: true, repeat: Math.max(1, Math.round(dur / 90)),
    onComplete: () => { target.x = x0; } });
}

/** Pixel crumble: 2×2 squares in the art's own colours fall and fade. */
export function crumble(scene: Phaser.Scene, x: number, y: number, w: number, h: number, texKey: string) {
  const colors: number[] = [];
  const tex = scene.textures.get(texKey), src = tex.getSourceImage() as HTMLImageElement;
  for (let i = 0; i < 24; i++) {
    const c = scene.textures.getPixel(Math.floor(Math.random() * src.width), Math.floor(Math.random() * src.height), texKey);
    if (c) colors.push(c.color);
  }
  if (!colors.length) colors.push(0x888888);
  const em = scene.add.particles(0, 0, 'px', {
    x: { min: x, max: x + w }, y: { min: y, max: y + h }, lifespan: { min: ms(500), max: ms(900) },
    speedX: { min: -40, max: 40 }, speedY: { min: -60, max: 30 }, gravityY: 260, scale: { start: 1, end: 0.5 },
    alpha: { start: 1, end: 0 }, tint: colors, emitting: false,
  }).setDepth(2500);
  em.explode(calm() ? 30 : 90);
  scene.time.delayedCall(ms(1100), () => em.destroy());
}

export function sparks(scene: Phaser.Scene, x: number, y: number, color: number, count = 18, spread = 30) {
  if (calm()) count = Math.ceil(count / 3);
  const em = scene.add.particles(x, y, 'px', {
    x: { min: -spread, max: spread }, y: { min: -10, max: 20 }, lifespan: { min: ms(400), max: ms(750) },
    speedY: { min: -90, max: -30 }, speedX: { min: -20, max: 20 }, alpha: { start: 1, end: 0 }, scale: { start: 1.5, end: 0.5 },
    tint: [color, 0xffffff], emitting: false, blendMode: 'ADD',
  }).setDepth(2600);
  em.explode(count);
  scene.time.delayedCall(ms(900), () => em.destroy());
}

export function burst(scene: Phaser.Scene, x: number, y: number, colors: number[], count = 30, speed = 160) {
  if (calm()) count = Math.ceil(count / 3);
  const em = scene.add.particles(x, y, 'px', {
    lifespan: { min: ms(250), max: ms(600) }, speed: { min: speed * 0.3, max: speed }, angle: { min: 0, max: 360 },
    alpha: { start: 1, end: 0 }, scale: { start: 2, end: 0.5 }, tint: colors, emitting: false, blendMode: 'ADD',
  }).setDepth(2600);
  em.explode(count);
  scene.time.delayedCall(ms(700), () => em.destroy());
}

export function glowFlash(scene: Phaser.Scene, x: number, y: number, color: number, size = 120, dur = 300) {
  const g = scene.add.image(x, y, 'glow').setTint(color).setBlendMode('ADD').setDepth(2400).setDisplaySize(size * 0.4, size * 0.4).setAlpha(0.95);
  return tween(scene, { targets: g, displayWidth: size, displayHeight: size, alpha: 0, duration: dur, ease: 'Cubic.Out', onComplete: () => g.destroy() });
}

export function ripple(scene: Phaser.Scene, x: number, y: number, color: number = 0x8fe0cf, rings = 3, size = 60) {
  for (let i = 0; i < rings; i++) {
    const e = scene.add.ellipse(x, y, 8, 3, 0, 0).setStrokeStyle(1, color, 0.8).setDepth(2300);
    scene.tweens.add({ targets: e, width: size * (1 + i * 0.4), height: size * 0.35 * (1 + i * 0.4), alpha: 0, delay: ms(i * 120),
      duration: ms(700), ease: 'Cubic.Out', onComplete: () => e.destroy() });
  }
}

export function vignette(scene: Phaser.Scene, color = 0xffffff) {
  const v = scene.add.image(0, 0, 'vignette').setOrigin(0).setDisplaySize(W, H).setDepth(4000).setAlpha(0).setTint(color);
  scene.tweens.add({ targets: v, alpha: 1, duration: ms(90), yoyo: true, hold: ms(140), onComplete: () => v.destroy() });
}

/** Coins fly along an arc from a fallen card to the coin counter. */
export function coinsFly(scene: Phaser.Scene, from: P, to: P, amount: number) {
  const n = Math.max(1, Math.min(5, amount + 2));
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < n; i++) {
    const c = icon(scene, from.x + (Math.random() - 0.5) * 24, from.y + (Math.random() - 0.5) * 16, 'coin').setDepth(3500);
    const mid = { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * 80, y: Math.min(from.y, to.y) - 40 - Math.random() * 40 };
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(c.x, c.y), new Phaser.Math.Vector2(mid.x, mid.y), new Phaser.Math.Vector2(to.x, to.y));
    const o = { t: 0 };
    jobs.push(tween(scene, { targets: o, t: 1, duration: 500, delay: i * 60, ease: 'Cubic.InOut',
      onUpdate: () => { const p = curve.getPoint(o.t); c.setPosition(p.x, p.y); },
      onComplete: () => c.destroy() }));
  }
  return Promise.all(jobs).then(() => undefined);
}

/** Red ghost streak from a dying creature to its killer. */
export function ghostTrail(scene: Phaser.Scene, from: P, to: P) {
  const head = scene.add.image(from.x, from.y, 'glow').setTint(C.blood).setBlendMode('ADD').setDisplaySize(36, 36).setDepth(2700);
  const skull = icon(scene, from.x, from.y, 'deathstrike', 32).setDepth(2701).setAlpha(0.9);
  const trail = calm() ? undefined : scene.add.particles(0, 0, 'px', { follow: head, lifespan: ms(380), speed: 10, scale: { start: 2, end: 0 },
    alpha: { start: 0.8, end: 0 }, tint: [C.blood, 0xff9a90], frequency: 12, blendMode: 'ADD' }).setDepth(2690);
  return tween(scene, { targets: [head, skull], x: to.x, y: to.y, duration: 250, ease: 'Expo.Out', onComplete: () => {
    head.destroy(); skull.destroy(); trail?.stop(); scene.time.delayedCall(400, () => trail?.destroy());
  } });
}

export type Missile = 'fire' | 'arrow' | 'magic' | 'blood' | 'heal' | 'void';
const MISSILE_COLORS: Record<Missile, number[]> = {
  fire: [0xff7a33, 0xffd36b, 0xe2483c], arrow: [0xece6d6], magic: [0x8fe0cf, 0xffffff], blood: [0xe2483c, 0x8a1c14],
  heal: [0x94d36c, 0xd8ffc0], void: [0x8fe0cf, 0x1d5f57, 0x000000],
};
export function missile(scene: Phaser.Scene, from: P, to: P, kind: Missile, dur = 260) {
  const colors = MISSILE_COLORS[kind];
  const angle = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
  const head = kind === 'arrow'
    ? icon(scene, from.x, from.y, 'arrow', 32).setRotation(angle + Math.PI / 4).setDepth(2700)
    : scene.add.image(from.x, from.y, 'glow').setTint(colors[0]).setBlendMode('ADD').setDisplaySize(kind === 'fire' ? 44 : 30, kind === 'fire' ? 44 : 30).setDepth(2700);
  const trail = calm() ? undefined : scene.add.particles(0, 0, 'px', { follow: head, lifespan: ms(kind === 'fire' ? 420 : 260),
    speed: kind === 'fire' ? 30 : 8, scale: { start: kind === 'fire' ? 2.5 : 1.5, end: 0 }, alpha: { start: 1, end: 0 }, tint: colors,
    frequency: kind === 'fire' ? 8 : 16, blendMode: 'ADD' }).setDepth(2690);
  return tween(scene, { targets: head, x: to.x, y: to.y, duration: dur, ease: kind === 'arrow' ? 'Linear' : 'Sine.InOut', onComplete: () => {
    head.destroy(); trail?.stop(); scene.time.delayedCall(500, () => trail?.destroy());
    burst(scene, to.x, to.y, colors, kind === 'fire' ? 40 : 18, kind === 'fire' ? 180 : 110);
    if (kind === 'fire') void glowFlash(scene, to.x, to.y, 0xff7a33, 140, 320);
  } });
}

/** Kraken: dark water swirls, tentacles rise and drag the victim under. */
export async function devour(scene: Phaser.Scene, victim: Phaser.GameObjects.Container, w: number, h: number) {
  const cx = victim.x + w / 2, cy = victim.y + h / 2;
  const pool = scene.add.ellipse(cx, victim.y + h - 4, 10, 4, 0x05080c, 0.9).setDepth(victim.depth - 1);
  const g = scene.add.graphics().setDepth(victim.depth + 1);
  ripple(scene, cx, victim.y + h - 4, 0xa35cff, 4, 90);
  scene.tweens.add({ targets: pool, width: w + 24, height: 26, duration: ms(260), ease: 'Cubic.Out' });
  const arms = [-0.9, -0.35, 0.3, 0.85];
  const o = { t: 0 };
  await tween(scene, { targets: o, t: 1, duration: 420, ease: 'Cubic.Out', onUpdate: () => {
    g.clear();
    for (const a of arms) {
      const baseX = cx + a * (w / 2), baseY = victim.y + h + 6;
      const tipX = cx + a * (w / 4), tipY = baseY - (h + 10) * o.t;
      g.lineStyle(7, 0x3b1a63, 1);
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(baseX, baseY), new Phaser.Math.Vector2(baseX + a * 30, (baseY + tipY) / 2), new Phaser.Math.Vector2(tipX, tipY));
      curve.draw(g, 12);
      g.lineStyle(3, 0xa35cff, 1); curve.draw(g, 12);
    }
  } });
  await Promise.all([
    tween(scene, { targets: victim, y: victim.y + h * 0.6, scaleX: 0.3, scaleY: 0.15, angle: calm() ? 0 : 25, alpha: 0, duration: 380, ease: 'Quad.In' }),
    tween(scene, { targets: g, y: h * 0.5, alpha: 0, duration: 380, ease: 'Quad.In' }),
  ]);
  burst(scene, cx, victim.y + h, [0x6fb3e8, 0xa35cff, 0xffffff], 34, 140);
  await tween(scene, { targets: pool, width: 4, height: 2, alpha: 0, duration: 260, onComplete: () => { pool.destroy(); g.destroy(); } });
}

/** Coloured smoke puff (transformation, burn). */
export function smoke(scene: Phaser.Scene, x: number, y: number, color: number, count = 22) {
  if (calm()) count = 8;
  const em = scene.add.particles(x, y, 'glow', {
    x: { min: -24, max: 24 }, y: { min: -20, max: 20 }, lifespan: ms(700), speed: { min: 10, max: 40 }, scale: { start: 0.35, end: 0.9 },
    alpha: { start: 0.55, end: 0 }, tint: [color, 0x222222], emitting: false,
  }).setDepth(2600);
  em.explode(count);
  scene.time.delayedCall(ms(800), () => em.destroy());
}

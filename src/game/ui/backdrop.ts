import Phaser from 'phaser';
import { H, settings, W } from '../core';

/**
 * Scene background. `art` puts the moonlit Nav landscape full screen (menu); otherwise a calm dark field.
 * Both get drifting fog and a few fireflies; nothing splits the screen.
 */
export function backdrop(scene: Phaser.Scene, opts: { art?: boolean; dim?: number } = {}) {
  const root = scene.add.container(0, 0).setDepth(-100);
  if (opts.art) {
    const img = scene.add.image(W / 2, H / 2, 'menu-bg').setDisplaySize(W, H);
    root.add(img);
    if (!settings.reduceMotion) scene.tweens.add({ targets: img, scale: img.scale * 1.05, duration: 24000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    // Darken towards the bottom in even steps so the buttons sit on calm ground.
    const shade = scene.add.graphics();
    const steps = 10;
    for (let i = 0; i < steps; i++) { shade.fillStyle(0x07090b, 0.08 + i * 0.075); shade.fillRect(0, H * 0.42 + i * (H * 0.58 / steps), W, H * 0.58 / steps + 1); }
    shade.fillStyle(0x07090b, 0.25); shade.fillRect(0, 0, W, H);
    root.add(shade);
  } else {
    const g = scene.add.graphics();
    g.fillStyle(0x0d0f12, 1); g.fillRect(0, 0, W, H);
    // Soft light pool in the middle, built from a few wide transparent ellipses.
    for (let i = 0; i < 6; i++) { g.fillStyle(0x1c2a2e, 0.06); g.fillEllipse(W / 2, H * 0.45, W * (1.6 - i * 0.2), H * (0.9 - i * 0.1)); }
    root.add(g);
  }
  if (opts.dim) root.add(scene.add.rectangle(0, 0, W, H, 0x000000, opts.dim).setOrigin(0));
  if (settings.reduceMotion) return root;
  const fog = scene.add.particles(0, 0, 'glow', {
    x: { min: -60, max: W + 60 }, y: { min: H * 0.3, max: H }, lifespan: 14000, speedX: { min: 4, max: 10 }, speedY: { min: -2, max: 2 },
    scale: { min: 1.6, max: 3.2 }, alpha: { onEmit: () => 0, onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(t * Math.PI) * 0.06 },
    tint: 0xa9c4c8, frequency: 900, maxAliveParticles: 14,
  });
  const flies = scene.add.particles(0, 0, 'px', {
    x: { min: 10, max: W - 10 }, y: { min: H * 0.25, max: H - 20 }, lifespan: 5000, speedX: { min: -6, max: 6 }, speedY: { min: -8, max: 2 },
    scale: 1, alpha: { onEmit: () => 0, onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(t * Math.PI) * 0.7 },
    tint: [0xb8f07a, 0xe8d58a], frequency: 700, maxAliveParticles: 10, blendMode: 'ADD',
  });
  root.add([fog, flies]);
  return root;
}

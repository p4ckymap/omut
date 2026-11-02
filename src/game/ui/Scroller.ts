import Phaser from 'phaser';
import { C } from '../core';

/** Vertical drag/wheel scrolling area with inertia. */
export class Scroller {
  readonly content: Phaser.GameObjects.Container;
  private y = 0;
  private vel = 0;
  private dragging = false;
  private lastY = 0;
  private moved = 0;
  height = 0;

  constructor(private scene: Phaser.Scene, readonly x: number, readonly top: number, readonly w: number, readonly h: number) {
    this.content = scene.add.container(x, top);
    // No geometry mask (unreliable under camera zoom): an opaque header covers content scrolled above `top`.
    const head = scene.add.graphics().setDepth(9);
    head.fillStyle(C.bg, 1); head.fillRect(0, 0, x + w, top);
    head.fillStyle(C.line, 1); head.fillRect(0, top - 1, x + w, 1);
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.inside(p)) return;
      this.dragging = true; this.lastY = p.worldY; this.vel = 0; this.moved = 0;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const dy = p.worldY - this.lastY; this.lastY = p.worldY;
      this.moved += Math.abs(dy); this.vel = dy;
      this.scrollTo(this.y - dy);
    });
    scene.input.on('pointerup', () => { this.dragging = false; });
    scene.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => { if (this.inside(p)) this.scrollTo(this.y + dy * 0.5); });
    const step = () => {
      if (this.dragging || Math.abs(this.vel) < 0.1) return;
      this.vel *= 0.92; this.scrollTo(this.y - this.vel);
    };
    scene.events.on('update', step);
    scene.events.once('shutdown', () => scene.events.off('update', step));
  }
  inside(p: Phaser.Input.Pointer) { return p.worldX >= this.x && p.worldX <= this.x + this.w && p.worldY >= this.top && p.worldY <= this.top + this.h; }
  /** True when the last gesture was a tap, not a scroll. */
  get wasTap() { return this.moved < 8; }
  scrollTo(v: number) {
    this.y = Phaser.Math.Clamp(v, 0, Math.max(0, this.height - this.h));
    this.content.y = Math.round(this.top - this.y);
  }
}

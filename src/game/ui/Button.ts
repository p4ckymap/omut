import Phaser from 'phaser';
import { C, icon, panel, text } from '../core';
import { sound } from '../audio';

export type ButtonKind = 'main' | 'normal' | 'ghost';
export interface ButtonOpts { w?: number; h?: number; kind?: ButtonKind; icon?: string; size?: number; font?: 'pixel' | 'text' }

/** Pixel 9-slice style button: 2px frame, cut corners, 4px shadow, presses down 2px. */
export class Button extends Phaser.GameObjects.Container {
  readonly w: number; readonly h: number;
  private g: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private ico?: Phaser.GameObjects.Image;
  private face: Phaser.GameObjects.Container;
  private kind: ButtonKind;
  private enabled = true;
  private handler: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, caption: string, onClick: () => void, o: ButtonOpts = {}) {
    super(scene, x, y);
    this.w = o.w ?? 300; this.h = o.h ?? 56; this.kind = o.kind ?? 'normal'; this.handler = onClick;
    this.face = scene.add.container(0, 0);
    this.g = scene.add.graphics();
    this.label = text(scene, 0, 0, caption, { size: o.size ?? (this.h >= 52 ? 21 : 16), font: o.font ?? 'pixel' }).setOrigin(0.5);
    this.face.add([this.g, this.label]);
    if (o.icon) { this.ico = icon(scene, 0, 0, o.icon, this.h >= 52 ? 28 : 20); this.face.add(this.ico); }
    this.add(this.face);
    this.layoutLabel();
    this.draw();
    this.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(0, 0, this.w, this.h), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    this.on('pointerdown', () => { if (!this.enabled) return; this.face.y = 2; this.draw(true); });
    this.on('pointerout', () => { this.face.y = 0; this.draw(); });
    this.on('pointerup', () => {
      const pressed = this.face.y === 2;
      this.face.y = 0; this.draw();
      if (pressed && this.enabled) { sound.click(); this.handler(); }
    });
    scene.add.existing(this);
  }
  private layoutLabel() {
    const gap = 12, iw = this.ico ? this.ico.displayWidth + gap : 0;
    const total = iw + this.label.width;
    const left = (this.w - total) / 2;
    if (this.ico) this.ico.setPosition(Math.round(left + this.ico.displayWidth / 2), Math.round(this.h / 2));
    this.label.setPosition(Math.round(left + iw + this.label.width / 2), Math.round(this.h / 2));
  }
  private draw(pressed = false) {
    const g = this.g; g.clear();
    const main = this.kind === 'main';
    const fill = main ? C.goldBg : this.kind === 'ghost' ? 0x111315 : C.panel2;
    const stroke = main ? C.gold : C.line2;
    const r = Math.min(10, this.h / 4);
    if (!pressed) { g.fillStyle(0x000000, 0.55); g.fillRoundedRect(0, 3, this.w, this.h, r); }
    g.fillStyle(fill, 1); g.fillRoundedRect(0, 0, this.w, this.h, r);
    // A lighter top half gives a gentle raised look without a gradient.
    g.fillStyle(main ? 0x3a2f0e : 0x272b2f, 1); g.fillRoundedRect(1, 1, this.w - 2, this.h / 2, { tl: r, tr: r, bl: 0, br: 0 });
    g.lineStyle(1.5, stroke, 1); g.strokeRoundedRect(0.75, 0.75, this.w - 1.5, this.h - 1.5, r);
    this.label.setColor(main ? '#E2B33C' : '#ECE6D6');
  }
  setText(v: string) { this.label.setText(v); this.layoutLabel(); return this; }
  setKind(k: ButtonKind) { this.kind = k; this.draw(); return this; }
  setEnabled(v: boolean) { this.enabled = v; this.setAlpha(v ? 1 : 0.4); return this; }
  get isEnabled() { return this.enabled; }
  setHandler(fn: () => void) { this.handler = fn; return this; }
}

/** Square 44×44 icon button for panels. */
export function iconButton(scene: Phaser.Scene, x: number, y: number, name: string, onClick: () => void, size = 44) {
  const b = new Button(scene, x, y, '', onClick, { w: size, h: size, kind: 'normal', size: 16 });
  const i = icon(scene, size / 2, size / 2, name, 32);
  (b.list[0] as Phaser.GameObjects.Container).add(i);
  return b;
}

import Phaser from 'phaser';
import { CARDS } from '../../engine/cards';
import { C, H, setupCamera, text, W, Z } from '../core';
import { makeFxTextures } from '../ui/fx';
import { ICONS, iconSvg } from '../icons';

export class BootScene extends Phaser.Scene {
  private draw?: (p: number) => void;
  constructor() { super('Boot'); }

  preload() {
    setupCamera(this);
    const logo = text(this, W / 2, 360, 'ОМУТ', { size: 72, color: C.ink, font: 'display' }).setOrigin(0.5);
    const sub = text(this, W / 2, 410, 'В чёрном омуте черти водятся', { size: 16, color: C.gold }).setOrigin(0.5);
    const bar = this.add.graphics();
    const rings = this.add.graphics();
    let t = 0;
    const draw = (p: number) => {
      bar.clear();
      bar.fillStyle(C.line, 1); bar.fillRect(95, 470, 200, 6);
      bar.fillStyle(C.gold, 1); bar.fillRect(95, 470, Math.round(200 * p), 6);
    };
    draw(0);
    this.draw = draw;
    this.load.on('progress', draw);
    this.events.on('update', (_: number, dt: number) => {
      if (!rings.active) return;
      t += dt / 1000; rings.clear();
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.5 + i / 3) % 1;
        rings.lineStyle(1, 0x8fe0cf, (1 - k) * 0.5);
        rings.strokeEllipse(W / 2, 560, 40 + k * 220, (40 + k * 220) * 0.28);
      }
    });
    void logo; void sub;

    const base = 'art/';
    for (const c of CARDS) {
      this.load.image(`h:${c.id}`, `${base}cards/${c.id}-s.webp`);
      if (c.kind === 'creature') this.load.image(`t:${c.id}`, `${base}tokens/${c.id}.webp`);
    }
    for (const w of ['yav', 'nav', 'chasha', 'puchina', 'peklo', 'omut']) this.load.image(`w:${w}`, `${base}worlds/${w}.webp`);
    this.load.image('menu-bg', `${base}ui/menu-bg.webp`);
    this.load.image('avatar-bot', `${base}ui/avatar-bot.webp`);
    this.load.image('avatar-me', `${base}ui/avatar-me.webp`);
    this.load.image('back', `${base}ui/card-back.webp`);
  }

  async create() {
    // Rasterise the vector icons at 32 logical px × zoom: crisp at every size they are shown.
    const px = 32 * Z;
    await Promise.all(Object.keys(ICONS).map(name => new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas'); cv.width = px; cv.height = px;
        cv.getContext('2d')!.drawImage(img, 0, 0, px, px);
        this.textures.addCanvas(`i:${name}`, cv);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg(name, px))}`;
    })));
    makeFxTextures(this);
    document.documentElement.dataset.ready = 'true';
    this.cameras.main.fadeOut(250, 12, 13, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Boot stays alive, invisible, and streams the large inspector images in the background.
      if (this.draw) this.load.off('progress', this.draw);
      this.children.removeAll(true);
      this.cameras.main.resetFX();
      this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
      this.scene.launch('Menu', { first: true });
      this.scene.sendToBack();
      for (const c of CARDS) {
        this.load.image(`f:${c.id}`, `art/cards/${c.id}.webp`);
        this.load.image(`b:${c.id}`, `art/cards/${c.id}-back.webp`);
      }
      this.load.start();
    });
    void H;
  }
}

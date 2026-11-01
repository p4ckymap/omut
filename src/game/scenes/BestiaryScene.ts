import Phaser from 'phaser';
import { CARDS, CLASS_NAMES } from '../../engine/cards';
import type { ClassId } from '../../engine/types';
import { C, H, icon, overlays, panel, setupCamera, text, W } from '../core';
import { sound } from '../audio';
import { backdrop } from '../ui/backdrop';
import { iconButton } from '../ui/Button';
import { openInspector } from '../ui/Inspector';
import { Scroller } from '../ui/Scroller';

type Filter = 'all' | ClassId | 'spell';
const FILTERS: [Filter, string][] = [['all', ''], ['human', 'sun'], ['undead', 'skull'], ['wild', 'eye'], ['monster', 'tentacle'], ['demon', 'flame'], ['spell', 'rune']];

export class BestiaryScene extends Phaser.Scene {
  private from = 'Menu';
  private filter: Filter = 'all';
  private sc!: Scroller;
  private chips: Phaser.GameObjects.Graphics[] = [];
  private caption!: Phaser.GameObjects.Text;
  constructor() { super('Bestiary'); }

  create(data: { from?: string }) {
    this.from = data?.from ?? 'Menu';
    this.filter = 'all'; this.chips = [];
    setupCamera(this);
    backdrop(this);
    const close = overlays.push(() => this.back());
    iconButton(this, 12, 8, 'exit', () => close()).setDepth(10);
    text(this, W / 2, 32, 'Бестиарий', { size: 30, font: 'display' }).setOrigin(0.5).setDepth(10);
    FILTERS.forEach(([f, ic], i) => {
      const x = 12 + i * 52, y = 66;
      const g = this.add.graphics().setDepth(10);
      this.chips.push(g);
      const hit = this.add.zone(x, y, 48, 44).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(11);
      if (ic) icon(this, x + 24, y + 22, ic, 32).setDepth(11);
      else text(this, x + 24, y + 22, 'Все', { size: 16 }).setOrigin(0.5).setDepth(11);
      hit.on('pointerup', () => { sound.click(); this.filter = f; this.render(); });
    });
    this.caption = text(this, W / 2, 124, '', { size: 13, font: 'text', color: C.muted }).setOrigin(0.5).setDepth(10);
    this.sc = new Scroller(this, 0, 138, W, H - 138);
    this.render();
  }

  private render() {
    FILTERS.forEach(([f], i) => {
      const g = this.chips[i]; g.clear();
      panel(g, 12 + i * 52, 66, 48, 44, f === this.filter ? C.goldBg : C.panel2, f === this.filter ? C.gold : C.line2, { cut: 4 });
    });
    const list = CARDS.filter(c => this.filter === 'all' || (this.filter === 'spell' ? c.kind === 'spell' : c.class === this.filter));
    this.caption.setText(this.filter === 'all' ? `Все карты: ${list.length}` : this.filter === 'spell' ? `Чары: ${list.length}` : `${CLASS_NAMES[this.filter]}: ${list.length}`);
    const content = this.sc.content;
    content.removeAll(true);
    const cw = 112, ch = Math.round(cw * 1133 / 720), gap = 9;
    list.forEach((c, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 15 + col * (cw + gap) + cw / 2, y = 8 + row * (ch + 14) + ch / 2;
      const img = this.add.image(x, y, `h:${c.id}`).setDisplaySize(cw, ch).setInteractive({ useHandCursor: true });
      img.on('pointerup', (p: Phaser.Input.Pointer) => { if (this.sc.wasTap && this.sc.inside(p)) { sound.card(); openInspector(this, c.id); } });
      content.add(img);
      img.setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, duration: 200, delay: Math.min(i, 9) * 25 });
    });
    this.sc.height = Math.ceil(list.length / 3) * (ch + 14) + 30;
    this.sc.scrollTo(0);
  }

  private back() {
    if (this.from === 'Match') { this.scene.stop(); this.scene.resume('Match'); }
    else this.scene.start('Menu');
  }
}

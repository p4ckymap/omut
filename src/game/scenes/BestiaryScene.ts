import Phaser from 'phaser';
import { CARDS, CLASS_NAMES } from '../../engine/cards';
import type { ClassId } from '../../engine/types';
import { C, H, overlays, settings, setupCamera, text, W } from '../core';
import { sound } from '../audio';
import { backdrop } from '../ui/backdrop';
import { Button, iconButton } from '../ui/Button';
import { openInspector } from '../ui/Inspector';
import { Scroller } from '../ui/Scroller';

type Filter = 'all' | ClassId | 'spell';
const FILTERS: [Filter, string, string][] = [
  ['all', 'grid', 'Все'], ['human', 'sun', 'Люди'], ['undead', 'skull', 'Нежить'], ['wild', 'eye', 'Нечисть'],
  ['monster', 'tentacle', 'Чудища'], ['demon', 'flame', 'Бесы'], ['spell', 'rune', 'Чары'],
];
const FEATURED = ['opol', 'kot', 'upyr', 'koshey'];

export class BestiaryScene extends Phaser.Scene {
  private from = 'Menu';
  private filter: Filter = 'all';
  private sc!: Scroller;
  private chips: Button[] = [];
  private caption!: Phaser.GameObjects.Text;
  constructor() { super('Bestiary'); }

  create(data: { from?: string }) {
    this.from = data?.from ?? 'Menu';
    this.filter = 'all'; this.chips = [];
    setupCamera(this);
    backdrop(this);
    const close = overlays.push(() => this.back());
    iconButton(this, 16, 28, 'back', () => close()).setDepth(10).setName('bestiary-back');
    text(this, 218, 45, 'Бестиарий', { size: 44, font: 'display' }).setOrigin(0.5).setDepth(10);
    this.caption = text(this, 218, 79, '', { size: 16, color: C.accent }).setOrigin(0.5).setDepth(10);
    FILTERS.forEach(([f, ic, label], i) => {
      const firstRow = i < 4;
      const x = firstRow ? 10 + i * 94 : 39 + (i - 4) * 106;
      const y = firstRow ? 102 : 152;
      const chip = new Button(this, x, y, label, () => { this.filter = f; this.render(); },
        { w: firstRow ? 88 : 100, h: 44, icon: ic, size: 16 }).setDepth(11).setName(`filter-${f}`);
      this.chips.push(chip);
    });
    this.sc = new Scroller(this, 0, 208, W, H - 208 - 44);
    this.footer();
    this.render();
  }

  private render() {
    FILTERS.forEach(([f], i) => this.chips[i].setKind(f === this.filter ? 'main' : 'normal'));
    const list = CARDS.filter(c => this.filter === 'all' || (this.filter === 'spell' ? c.kind === 'spell' : c.class === this.filter));
    // Lead with the four representative cards from the approved screen; every other card remains accessible.
    if (this.filter === 'all') list.sort((a, b) => {
      const ai = FEATURED.indexOf(a.id), bi = FEATURED.indexOf(b.id);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
    const normalCount = list.filter(c => !c.token).length, tokens = list.length - normalCount;
    this.caption.setText(this.filter === 'all'
      ? `${normalCount} карт${tokens ? ' и жетон' : ''}`
      : `${this.filter === 'spell' ? 'Чары' : CLASS_NAMES[this.filter]}: ${list.length}`);
    const content = this.sc.content;
    this.tweens.killTweensOf(content.list);
    content.removeAll(true);
    const cw = 176, ch = Math.round(cw * 1133 / 720), gap = 12;
    list.forEach((c, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 13 + col * (cw + gap) + cw / 2, y = 3 + row * (ch + gap) + ch / 2;
      const img = this.add.image(x, y, `h:${c.id}`).setDisplaySize(cw, ch).setName(`catalog-card-${c.id}`)
        .setInteractive({ useHandCursor: true });
      img.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (this.sc.wasTap && this.sc.inside(p)) { sound.card(); openInspector(this, c.id); }
      });
      content.add(img);
      if (!settings.reduceMotion) {
        img.setAlpha(0);
        this.tweens.add({ targets: img, alpha: 1, duration: 200, delay: Math.min(i, 5) * 25 });
      }
    });
    this.sc.height = Math.ceil(list.length / 2) * (ch + gap) + 14;
    this.sc.scrollTo(0);
  }

  private footer() {
    // Covers the scrolled cards below the viewport, just as Scroller's header covers them above it.
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(C.bg); g.fillRect(0, H - 44, W, 44);
    g.fillStyle(C.line); g.fillRect(130, H - 38, 50, 2); g.fillRect(210, H - 38, 50, 2);
    g.lineStyle(1, C.line2); g.strokeRect(192, H - 41, 6, 6);
    text(this, W / 2, H - 17, 'Нажми на карту, чтобы рассмотреть.', { size: 13, color: C.muted })
      .setOrigin(0.5).setDepth(11);
  }

  private back() {
    if (this.from === 'Match') { this.scene.stop(); this.scene.resume('Match'); }
    else this.scene.start('Menu');
  }
}

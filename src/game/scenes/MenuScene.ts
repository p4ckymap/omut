import Phaser from 'phaser';
import { C, H, onTap, overlays, panel, saveSettings, settings, setupCamera, text, W } from '../core';
import { sound } from '../audio';
import { backdrop } from '../ui/backdrop';
import { Button, iconButton } from '../ui/Button';
import { openInspector } from '../ui/Inspector';
import { hasSavedMatch } from '../match/save';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create(data: { first?: boolean }) {
    this.leaving = false;
    setupCamera(this);
    overlays.clear();
    backdrop(this, { art: true });
    this.logo();
    this.fan();

    if (hasSavedMatch()) {
      // A match in progress: continuing comes first.
      new Button(this, 45, 548, 'Продолжить партию', () => this.go('Match', { resume: true }), { kind: 'main', icon: 'swirl', h: 52 });
      new Button(this, 45, 610, 'Новая партия', () => this.go('Match', { tutorial: false }), { h: 52, icon: 'deck' });
      new Button(this, 45, 672, 'Как играть', () => this.go('Rules', { from: 'Menu' }), { icon: 'rune', h: 52 });
      new Button(this, 45, 734, 'Бестиарий', () => this.go('Bestiary', { from: 'Menu' }), { icon: 'skull', h: 52 });
    } else {
      new Button(this, 45, 572, 'Нырнуть', () => this.go('Match', { tutorial: false }), { kind: 'main', icon: 'swirl' });
      new Button(this, 45, 640, 'Как играть', () => this.go('Rules', { from: 'Menu' }), { icon: 'rune' });
      new Button(this, 45, 708, 'Бестиарий', () => this.go('Bestiary', { from: 'Menu' }), { icon: 'skull' });
    }
    iconButton(this, W - 56, 12, 'gear', () => this.go('Settings', { from: 'Menu' }));
    if (settings.wins + settings.losses > 0) {
      text(this, W / 2, 812, `Побед: ${settings.wins}    Поражений: ${settings.losses}`, { size: 13, font: 'text', color: C.muted }).setOrigin(0.5);
    }
    this.input.once('pointerdown', () => sound.unlock());
    this.cameras.main.fadeIn(400, 7, 9, 11);
    if (data?.first && !settings.tutorialDone) this.time.delayedCall(600, () => this.offerTutorial());
  }

  private logo() {
    const glow = text(this, W / 2, 132, 'ОМУТ', { size: 80, font: 'display', color: '#8FE0CF' }).setOrigin(0.5).setAlpha(0.35);
    glow.setShadow(0, 0, '#8FE0CF', 24, false, true);
    const logo = text(this, W / 2, 132, 'ОМУТ', { size: 80, font: 'display', color: '#ECE6D6' }).setOrigin(0.5);
    logo.setShadow(0, 4, '#000000', 12, false, true);
    text(this, W / 2, 196, 'В чёрном омуте черти водятся', { size: 15, font: 'text', bold: true, color: C.gold }).setOrigin(0.5)
      .setShadow(0, 2, '#000000', 6, false, true);
    if (!settings.reduceMotion) this.tweens.add({ targets: glow, alpha: 0.12, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  private fan() {
    const cards: [string, number, number, number][] = [['kraken', -64, -9, 0.92], ['kot', 64, 9, 0.92], ['koshey', 0, 0, 1]];
    for (const [id, dx, ang, sc] of cards) {
      const w = Math.round(112 * sc), h = Math.round(w * 1133 / 720);
      const c = this.add.container(W / 2 + dx, 378 + (sc < 1 ? 10 : 0));
      const shadow = this.add.rectangle(4, 10, w - 6, h - 6, 0x000000, 0.5);
      const img = this.add.image(0, 0, `h:${id}`).setDisplaySize(w, h);
      c.add([shadow, img]).setAngle(ang);
      img.setInteractive({ useHandCursor: true });
      onTap(img, () => { sound.card(); openInspector(this, id); });
      if (!settings.reduceMotion) {
        this.tweens.add({ targets: c, angle: ang + (dx === 0 ? 2 : -2 * Math.sign(dx)), y: c.y - 6, duration: 2600 + Math.abs(dx) * 10,
          yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: Math.abs(dx) * 8 });
      }
    }
  }

  private offerTutorial() {
    const root = this.add.container(0, 0).setDepth(4000);
    const shade = this.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    panel(g, 30, 270, 330, 290, C.panel, C.gold, { cut: 6, shadow: true });
    const title = text(this, W / 2, 310, 'Впервые в Омуте?', { size: 24, color: C.gold }).setOrigin(0.5);
    const body = text(this, W / 2, 360, 'Короткое обучение покажет, как ставить карты и как они бьют. Две минуты.',
      { size: 14, font: 'text', wrap: 280, align: 'center', line: 3 }).setOrigin(0.5, 0);
    let close = () => {};
    const hide = () => root.destroy();
    const yes = new Button(this, 50, 430, 'Пройти обучение', () => { close(); this.go('Match', { tutorial: true }); }, { kind: 'main', w: 290, h: 48, size: 16 });
    const no = new Button(this, 50, 490, 'Позже', () => { settings.tutorialDone = true; saveSettings(); close(); }, { w: 290, h: 44, size: 16, kind: 'ghost' });
    root.add([shade, g, title, body, yes, no]);
    close = overlays.push(hide);
  }

  private leaving = false;
  private go(scene: string, data: object) {
    if (this.leaving) return;
    this.leaving = true;
    sound.unlock();
    if (scene === 'Match') sound.splash();
    this.cameras.main.resetFX();
    this.cameras.main.fadeOut(300, 7, 10, 13);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
  }
}

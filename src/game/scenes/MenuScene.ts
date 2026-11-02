import Phaser from 'phaser';
import { C, H, icon, onTap, overlays, panel, saveSettings, settings, setupCamera, text, W } from '../core';
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
    backdrop(this);
    const resume = hasSavedMatch();
    this.logo();
    this.vignette(resume);
    this.fan(resume);

    text(this, W / 2, resume ? 528 : 548, 'Твой ход.', { size: 56, font: 'display' }).setOrigin(0.5);
    text(this, W / 2, resume ? 564 : 586, 'В чёрном омуте черти водятся.',
      { size: 14, font: 'text', color: C.accent }).setOrigin(0.5);

    if (resume) {
      // Continuing a saved match remains the primary action; no save is overwritten on entry.
      new Button(this, 20, 600, 'Продолжить партию', () => this.go('Match', { resume: true }),
        { kind: 'main', w: 350, h: 54, size: 25 }).setName('menu-resume');
      new Button(this, 20, 666, 'Новая партия', () => this.go('Match', { tutorial: false }),
        { w: 350, h: 44, size: 22, icon: 'deck' }).setName('menu-new-game');
      this.tile(20, 722, 70, 'Как играть', 'book', () => this.go('Rules', { from: 'Menu' }));
      this.tile(201, 722, 70, 'Бестиарий', 'skull', () => this.go('Bestiary', { from: 'Menu' }));
    } else {
      const dive = new Button(this, 20, 632, 'Нырнуть', () => this.go('Match', { tutorial: false }),
        { kind: 'main', w: 350, h: 60, size: 32 }).setName('menu-play');
      const arrow = icon(this, 325, 30, 'back', 18).setAngle(180).setTint(C.accentInk);
      (dive.list[0] as Phaser.GameObjects.Container).add(arrow);
      this.tile(20, 706, 84, 'Как играть', 'book', () => this.go('Rules', { from: 'Menu' }));
      this.tile(201, 706, 84, 'Бестиарий', 'skull', () => this.go('Bestiary', { from: 'Menu' }));
    }
    iconButton(this, W - 62, 30, 'gear', () => this.go('Settings', { from: 'Menu' }))
      .setName('menu-settings');
    this.footer();
    this.input.once('pointerdown', () => sound.unlock());
    this.cameras.main.fadeIn(400, 7, 9, 11);
    if (data?.first && !settings.tutorialDone) this.time.delayedCall(600, () => this.offerTutorial());
  }

  private logo() {
    const mark = icon(this, 46, 54, 'swirl', 52).setTint(C.accent);
    text(this, 78, 23, 'ОМУТ', { size: 58, font: 'display' });
    text(this, 80, 79, 'КАРТОЧНАЯ ДУЭЛЬ', { size: 13, color: C.accent });
    if (!settings.reduceMotion) this.tweens.add({ targets: mark, alpha: 0.65, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  private vignette(resume: boolean) {
    const hero = this.add.image(W / 2, resume ? 291 : 311, 'menu-hero');
    // Contain the transparent vignette without stretching its pixel-art silhouette.
    const src = hero.texture.getSourceImage() as HTMLImageElement;
    const scale = Math.min(394 / src.width, 440 / src.height);
    hero.setScale(scale);
  }

  private fan(resume: boolean) {
    // The menu previews are the very same original card textures used in the hand and catalogue.
    const cards: [string, number, number, number][] = [['kraken', -74, -13, 0.94], ['kot', 74, 13, 0.94], ['koshey', 0, 0, 1]];
    for (const [id, dx, ang, sc] of cards) {
      const w = Math.round(78 * sc), h = Math.round(w * 1133 / 720);
      const c = this.add.container(W / 2 + dx, (resume ? 420 : 440) + (sc < 1 ? 7 : 0));
      const shadow = this.add.rectangle(3, 5, w - 6, h - 6, 0x000000, 0.65);
      const img = this.add.image(0, 0, `h:${id}`).setDisplaySize(w, h).setName(`menu-card-${id}`);
      c.add([shadow, img]).setAngle(ang);
      img.setInteractive({ useHandCursor: true });
      onTap(img, () => { sound.card(); openInspector(this, id); });
      if (!settings.reduceMotion) {
        this.tweens.add({ targets: c, angle: ang + (dx === 0 ? 2 : -2 * Math.sign(dx)), y: c.y - 6, duration: 2600 + Math.abs(dx) * 10,
          yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: Math.abs(dx) * 8 });
      }
    }
  }

  private tile(x: number, y: number, h: number, caption: string, symbol: string, action: () => void) {
    const tile = new Button(this, x, y, '', action, { w: 169, h }).setName(`menu-${symbol}`);
    const face = tile.list[0] as Phaser.GameObjects.Container;
    face.add([
      icon(this, 84.5, h === 84 ? 28 : 22, symbol, h === 84 ? 36 : 28),
      text(this, 84.5, h - 22, caption, { size: 21 }).setOrigin(0.5),
    ]);
  }

  private footer() {
    const g = this.add.graphics();
    g.fillStyle(C.line, 1);
    g.fillRect(130, 807, 50, 2); g.fillRect(210, 807, 50, 2);
    for (const [x, y] of [[195, 802], [189, 808], [201, 808], [195, 814]]) {
      g.lineStyle(1, C.line2); g.strokeRect(x - 2, y - 2, 4, 4);
    }
    const caption = settings.wins + settings.losses > 0
      ? `Побед: ${settings.wins}    Поражений: ${settings.losses}`
      : 'Славянские легенды. Твоя тактика.';
    text(this, W / 2, 832, caption, { size: 13, color: C.muted }).setOrigin(0.5);
  }

  private offerTutorial() {
    const root = this.add.container(0, 0).setDepth(4000);
    const shade = this.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    panel(g, 30, 270, 330, 290, C.panel, C.accent, { cut: 6, shadow: true });
    const title = text(this, W / 2, 310, 'Впервые в Омуте?', { size: 29, color: C.accent }).setOrigin(0.5);
    const body = text(this, W / 2, 360, 'Короткое обучение покажет, как ставить карты и как они бьют. Две минуты.',
      { size: 14, font: 'text', wrap: 280, align: 'center', line: 3 }).setOrigin(0.5, 0);
    let close = () => {};
    const hide = () => root.destroy();
    const yes = new Button(this, 50, 430, 'Пройти обучение', () => { close(); this.go('Match', { tutorial: true }); }, { kind: 'main', w: 290, h: 48, size: 21 });
    const no = new Button(this, 50, 490, 'Позже', () => { settings.tutorialDone = true; saveSettings(); close(); }, { w: 290, h: 44, size: 20, kind: 'ghost' });
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

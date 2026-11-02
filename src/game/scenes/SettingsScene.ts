import Phaser from 'phaser';
import { C, onTap, overlays, panel, saveSettings, settings, setupCamera, text } from '../core';
import { sound } from '../audio';
import { backdrop } from '../ui/backdrop';
import { Button, iconButton } from '../ui/Button';

export class SettingsScene extends Phaser.Scene {
  private from = 'Menu';
  private leaving = false;
  constructor() { super('Settings'); }

  create(data: { from?: string }) {
    this.from = data?.from ?? 'Menu';
    this.leaving = false;
    setupCamera(this);
    backdrop(this);
    const close = overlays.push(() => this.back());

    if (this.textures.exists('settings-lantern')) {
      const lantern = this.add.image(342, 92, 'settings-lantern');
      const scale = Math.min(140 / lantern.width, 140 / lantern.height);
      lantern.setScale(scale).setAlpha(0.9);
    }
    iconButton(this, 18, 60, 'back', () => close()).setName('settings-back');
    const title = text(this, 76, 60, 'Настройки', { size: 36, font: 'display' });
    if (title.width > 196) title.setScale(196 / title.width);
    text(this, 76, 103, 'Играй в своём ритме.', { size: 15, color: C.accent });

    const g = this.add.graphics();
    const section = (label: string, y: number) => {
      const heading = text(this, 22, y, label, { size: 19, color: C.accent });
      const start = Math.round(heading.x + heading.width + 12);
      g.fillStyle(C.line2, 0.85).fillRect(start, y + 12, 368 - start, 2);
    };
    const row = (y: number, h = 58) => panel(g, 16, y, 358, h, C.panel, C.line, { cut: 5 });
    const changed = () => { saveSettings(); sound.apply(); };

    section('ПАРТИЯ', 162);
    row(188);
    text(this, 28, this.from === 'Match' ? 208 : 217, 'Жизни на старте', { size: 18 }).setOrigin(0, 0.5);
    if (this.from === 'Match') text(this, 28, 230, 'Со следующей партии', { size: 11, font: 'text', color: C.muted }).setOrigin(0, 0.5);
    const hp = text(this, 291, 217, String(settings.hp), { size: 27 }).setOrigin(0.5);
    const updateHp = (dir: -1 | 1) => {
      settings.hp = Math.max(10, Math.min(40, settings.hp + dir * 5));
      hp.setText(String(settings.hp));
      minus.setEnabled(settings.hp > 10);
      plus.setEnabled(settings.hp < 40);
      changed();
    };
    const minus = new Button(this, 220, 195, '−', () => updateHp(-1), { w: 44, h: 44, size: 30 }).setName('settings-hp-minus');
    const plus = new Button(this, 318, 195, '+', () => updateHp(1), { w: 44, h: 44, size: 30 }).setName('settings-hp-plus');
    minus.setEnabled(settings.hp > 10);
    plus.setEnabled(settings.hp < 40);

    row(258);
    text(this, 28, 287, 'Сложность бота', { size: 18 }).setOrigin(0, 0.5);
    this.segments(190, 265, 172, ['Лёгкий', 'Средний'], settings.bot === 'easy' ? 0 : 1, i => {
      settings.bot = i === 0 ? 'easy' : 'medium'; changed();
    }, 'settings-bot');

    section('ДВИЖЕНИЕ', 342);
    row(368);
    text(this, 28, 397, 'Скорость анимаций', { size: 17 }).setOrigin(0, 0.5);
    const speeds = [1, 1.5, 2] as const;
    this.segments(208, 375, 154, ['×1', '×1,5', '×2'], speeds.indexOf(settings.speed), i => {
      settings.speed = speeds[i]; changed();
    }, 'settings-speed');

    row(438, 66);
    text(this, 28, 458, 'Меньше движения', { size: 19 }).setOrigin(0, 0.5);
    text(this, 28, 484, 'Без тряски и лишних эффектов.', { size: 12, font: 'text', color: C.muted }).setOrigin(0, 0.5);
    this.toggle(308, 453, settings.reduceMotion, v => { settings.reduceMotion = v; changed(); }, 'settings-reduce-motion');

    section('ЗВУК', 526);
    row(552);
    text(this, 28, 581, 'Громкость', { size: 20 }).setOrigin(0, 0.5);
    const volumeText = text(this, 182, 581, `${settings.volume}%`, { size: 18, color: C.accent }).setOrigin(0.5);
    const volume = this.add.graphics();
    const sliderX = 220, sliderW = 132, sliderY = 581;
    const drawVolume = () => {
      volume.clear();
      panel(volume, sliderX, sliderY - 4, sliderW, 8, C.deep, C.line2, { cut: 1, border: 1 });
      if (settings.volume > 0) volume.fillStyle(C.accent).fillRect(sliderX + 1, sliderY - 3, (sliderW - 2) * settings.volume / 100, 6);
      panel(volume, sliderX + sliderW * settings.volume / 100 - 6, sliderY - 13, 12, 26, C.accent, C.ink, { cut: 2, border: 1 });
      volumeText.setText(`${settings.volume}%`);
    };
    drawVolume();
    const slider = this.add.zone(sliderX + sliderW / 2, sliderY, sliderW + 20, 44)
      .setName('settings-volume').setInteractive({ useHandCursor: true });
    this.input.setDraggable(slider);
    const setVolume = (p: Phaser.Input.Pointer) => {
      const next = Math.max(0, Math.min(100, Math.round((p.worldX - sliderX) / sliderW * 10) * 10));
      if (next !== settings.volume) { settings.volume = next; drawVolume(); changed(); }
    };
    slider.on('pointerdown', setVolume);
    slider.on('drag', setVolume);

    row(622);
    text(this, 28, 651, 'Музыка', { size: 20 }).setOrigin(0, 0.5);
    this.toggle(308, 633, settings.music, v => { settings.music = v; changed(); }, 'settings-music');

    if (this.from !== 'Match') {
      new Button(this, 16, 700, 'Пройти обучение снова', async () => {
        if (this.leaving) return;
        this.leaving = true;
        await close();
        this.scene.start('Match', { tutorial: true });
      }, { w: 358, h: 56, size: 20, icon: 'book' }).setName('settings-tutorial');
    }
    new Button(this, 16, this.from === 'Match' ? 700 : 772, 'Готово', () => close(), { w: 358, h: 56, size: 30, kind: 'main' }).setName('settings-done');
    this.input.once('pointerdown', () => sound.unlock());
  }

  /** A single selected segment replaces cycling arrows without changing the saved values. */
  private segments(x: number, y: number, w: number, labels: string[], selected: number, change: (i: number) => void, name: string) {
    const width = w / labels.length;
    const buttons: Button[] = [];
    labels.forEach((label, index) => {
      const b = new Button(this, Math.round(x + index * width), y, label, () => {
        buttons.forEach((button, i) => button.setKind(i === index ? 'main' : 'normal'));
        change(index);
      }, { w: Math.round(width), h: 44, size: 17, kind: index === selected ? 'main' : 'normal' }).setName(`${name}-${index}`);
      buttons.push(b);
    });
  }

  private toggle(x: number, y: number, initial: boolean, change: (v: boolean) => void, name: string) {
    let enabled = initial;
    const g = this.add.graphics();
    const draw = () => {
      g.clear();
      panel(g, x, y, 54, 34, enabled ? C.accent : C.deep, enabled ? C.accent : C.line2, { cut: 7, border: 2 });
      panel(g, x + (enabled ? 25 : 3), y + 3, 26, 28, enabled ? C.ink : C.muted, C.deep, { cut: 5, border: 2 });
    };
    const hit = this.add.zone(x + 27, y + 17, 66, 48).setName(name).setInteractive({ useHandCursor: true });
    onTap(hit, () => { enabled = !enabled; draw(); sound.click(); change(enabled); });
    draw();
  }

  private back() {
    if (this.leaving) return;
    if (this.from === 'Match') { this.scene.stop(); this.scene.resume('Match'); }
    else this.scene.start('Menu');
  }
}

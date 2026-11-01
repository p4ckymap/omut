import Phaser from 'phaser';
import { C, overlays, panel, saveSettings, settings, setupCamera, text, W } from '../core';
import { sound } from '../audio';
import { backdrop } from '../ui/backdrop';
import { Button, iconButton } from '../ui/Button';

interface Row { label: string; hint?: string; get: () => string; step: (dir: 1 | -1) => void }

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
    iconButton(this, 12, 8, 'exit', () => close()).setDepth(10);
    text(this, W / 2, 32, 'Настройки', { size: 30, font: 'display' }).setOrigin(0.5);
    const cycle = <T,>(list: T[], v: T, dir: number) => list[(list.indexOf(v) + dir + list.length) % list.length];
    const rows: Row[] = [
      { label: 'Жизни на старте', hint: this.from === 'Match' ? 'со следующей партии' : undefined, get: () => String(settings.hp),
        step: d => { settings.hp = Math.max(10, Math.min(40, settings.hp + d * 5)); } },
      { label: 'Сложность бота', get: () => (settings.bot === 'easy' ? 'Лёгкий' : 'Средний'), step: () => { settings.bot = settings.bot === 'easy' ? 'medium' : 'easy'; } },
      { label: 'Скорость анимаций', get: () => `×${settings.speed}`, step: d => { settings.speed = cycle([1, 1.5, 2] as const, settings.speed, d) as 1 | 1.5 | 2; } },
      { label: 'Меньше движения', hint: 'без тряски, частиц и наклонов', get: () => (settings.reduceMotion ? 'Вкл' : 'Выкл'), step: () => { settings.reduceMotion = !settings.reduceMotion; } },
      { label: 'Громкость', get: () => `${settings.volume}`, step: d => { settings.volume = Math.max(0, Math.min(100, settings.volume + d * 10)); } },
      { label: 'Музыка', hint: 'тёмный эмбиент и колокола', get: () => (settings.music ? 'Вкл' : 'Выкл'), step: () => { settings.music = !settings.music; } },
    ];
    rows.forEach((r, i) => {
      const y = 76 + i * 66;
      const g = this.add.graphics();
      panel(g, 16, y, 358, 58, C.panel, C.line, { cut: 5 });
      text(this, 30, y + (r.hint ? 19 : 29), r.label, { size: 14, font: 'text' }).setOrigin(0, 0.5);
      if (r.hint) text(this, 30, y + 39, r.hint, { size: 11, font: 'text', color: C.muted }).setOrigin(0, 0.5);
      const value = text(this, 279, y + 29, r.get(), { size: 16, color: C.gold }).setOrigin(0.5);
      const change = (d: 1 | -1) => { r.step(d); value.setText(r.get()); saveSettings(); sound.apply(); };
      new Button(this, 190, y + 7, '‹', () => change(-1), { w: 44, h: 44, size: 20 });
      new Button(this, 324, y + 7, '›', () => change(1), { w: 44, h: 44, size: 20 });
    });
    const by = 76 + rows.length * 66 + 14;
    if (this.from !== 'Match') {
      new Button(this, 45, by, 'Пройти обучение снова', () => {
        this.leaving = true; close();
        this.scene.start('Match', { tutorial: true });
      }, { size: 16 });
    }
    new Button(this, 45, this.from !== 'Match' ? by + 68 : by, 'Готово', () => close(), { kind: 'main' });
    this.input.once('pointerdown', () => sound.unlock());
  }

  private back() {
    if (this.leaving) return;
    if (this.from === 'Match') { this.scene.stop(); this.scene.resume('Match'); }
    else this.scene.start('Menu');
  }
}

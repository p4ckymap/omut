import Phaser from 'phaser';
import { HEIGHT, WIDTH, WORLD_X, ZONES } from '../layout';

// Stage 0 only: geometry and hit testing, no game state or game actions.
export class LayoutScene extends Phaser.Scene {
  private banner!: Phaser.GameObjects.Text;
  private grid!: Phaser.GameObjects.Graphics;
  private selection!: Phaser.GameObjects.Graphics;
  private diagnostics: { name: string; x: number; y: number; width: number; height: number }[] = [];

  constructor() { super('Layout'); }

  private label(x: number, y: number, text: string, size = 13, color = '#9D988C', tiny = false) {
    return this.add.text(x, y, text, {
      fontFamily: tiny ? '"Ruslan Display"' : '"Golos Text"', fontSize: size, color,
      resolution: Math.max(2, window.devicePixelRatio || 1),
      align: 'center',
    }).setOrigin(0.5).setDepth(3);
  }

  private box(name: string, x: number, y: number, width: number, height: number, color = 0x5a5f64) {
    this.add.rectangle(x, y, width, height, 0x16181a).setOrigin(0).setStrokeStyle(1, color);
    const zone = this.add.zone(x, y, width, height).setOrigin(0).setInteractive();
    zone.on('pointerdown', () => {
      this.selection.clear().lineStyle(2, 0xe2b33c).strokeRect(x + 1, y + 1, width - 2, height - 2);
      this.announce(`${name}: ${width}×${height}, x ${x}, y ${y}`);
    });
    this.diagnostics.push({ name, x, y, width, height });
  }

  private announce(text: string) {
    this.banner.setText(text);
    document.querySelector('#debug-status')!.textContent = text;
  }

  create() {
    this.diagnostics = [];
    for (const z of ZONES) {
      this.box(z.name, 0, z.y, WIDTH, z.height, 0x3b3f43);
    }
    this.label(82, 20, 'ОМУТ', 32, '#E2B33C', true);
    this.label(87, 43, 'Этап 0 / каркас', 11);
    this.label(224, 19, '390×844', 16, '#ECE6D6', true);
    this.label(224, 39, 'Сетка 4 px', 11);
    this.box('Сетка', 282, 6, 44, 44, 0xe2b33c);
    this.label(304, 28, 'Сетка', 11, '#E2B33C');
    this.box('Сброс', 334, 6, 44, 44);
    this.label(356, 28, 'Сброс', 11);

    this.label(195, 76, 'РУКА БОТА', 16, '#ECE6D6', true);
    this.label(195, 98, 'y 60–114 / 54 px', 11);
    for (const y of [118, 346]) {
      for (const [i, x] of WORLD_X.entries()) {
        this.box(`${y === 118 ? 'Бот' : 'Ты'} / мир ${i + 1}`, x, y, 88, 190);
        for (const offset of [5, 89]) {
          this.box(`Место ${i + 1}.${offset === 5 ? 1 : 2}`, x + 6, y + offset, 76, 80, 0x45494d);
          this.label(x + 44, y + offset + 32, '76×80', 16, '#ECE6D6', true);
          this.label(x + 44, y + offset + 54, `y ${y + offset}`, 11);
        }
        this.label(x + 44, y + 179, '88×190', 11);
      }
    }
    this.banner = this.label(195, 327, 'Этап 0: коснись зоны — увидишь размеры', 13, '#E2B33C');

    this.box('Действие слева', 10, 546, 110, 44);
    this.label(65, 568, '110×44', 16, '#ECE6D6', true);
    this.box('Действие справа', 270, 546, 110, 44);
    this.label(325, 568, '110×44', 16, '#ECE6D6', true);
    this.box('Карта', 24, 632, 84, 134);
    this.label(66, 690, '84×134', 16, '#ECE6D6', true);
    this.label(66, 715, 'y 632–766', 11);
    this.box('Поднятая карта', 136, 578, 118, 188, 0xe2b33c);
    this.label(195, 644, '118×188', 24, '#E2B33C', true);
    this.label(195, 674, 'Поднятая', 13, '#ECE6D6');
    this.label(195, 696, 'y 578–766', 11);
    this.box('Карта', 282, 632, 84, 134);
    this.label(324, 690, '84×134', 16, '#ECE6D6', true);
    this.label(324, 715, 'y 632–766', 11);
    this.label(115, 796, 'НИЖНЯЯ ПАНЕЛЬ', 16, '#ECE6D6', true);
    this.label(115, 820, 'y 774–844 / 70 px', 11);
    this.box('Конец хода (макет)', 228, 785, 150, 48, 0xe2b33c);
    this.label(303, 800, 'Конец хода', 16, '#E2B33C', true);
    this.label(303, 821, '150×48 / макет', 11);

    this.grid = this.add.graphics().setDepth(1);
    this.grid.lineStyle(1, 0xece6d6, 0.045);
    for (let x = 0; x <= WIDTH; x += 4) this.grid.lineBetween(x, 0, x, HEIGHT);
    for (let y = 0; y <= HEIGHT; y += 4) this.grid.lineBetween(0, y, WIDTH, y);
    this.selection = this.add.graphics().setDepth(4);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y >= 6 && p.y <= 50 && p.x >= 282 && p.x <= 326) {
        this.grid.visible = !this.grid.visible;
        this.announce(`Сетка 4 px: ${this.grid.visible ? 'включена' : 'выключена'}`);
      } else if (p.y >= 6 && p.y <= 50 && p.x >= 334 && p.x <= 378) {
        this.selection.clear(); this.grid.visible = true;
        this.announce('Этап 0: коснись зоны — увидишь размеры');
      }
    });
    // Read-only snapshot for browser geometry checks; it is not an engine API.
    Object.assign(window, { __OMUT_DEBUG__: { width: WIDTH, height: HEIGHT, zones: ZONES, boxes: this.diagnostics, phaser: Phaser.VERSION } });
    this.game.canvas.setAttribute('aria-label', 'ОМУТ. Этап 0: семь зон, восемь миров, шестнадцать мест. Коснись зоны для проверки размеров.');
    document.documentElement.dataset.ready = 'true';
  }
}

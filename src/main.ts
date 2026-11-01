import Phaser from 'phaser';
import { H, W, Z } from './game/core';
import { BestiaryScene } from './game/scenes/BestiaryScene';
import { BootScene } from './game/scenes/BootScene';
import { LayoutScene } from './game/scenes/LayoutScene';
import { MenuScene } from './game/scenes/MenuScene';
import { RulesScene } from './game/scenes/RulesScene';
import { SettingsScene } from './game/scenes/SettingsScene';
import { MatchScene } from './game/match/MatchScene';
// Fonts ship with the app (no Google Fonts): the game also starts offline.
import '@fontsource/golos-text/400.css';
import '@fontsource/golos-text/700.css';
import '@fontsource/ruslan-display/400.css';
import './style.css';
import { initTelegram } from './telegram';

initTelegram();

async function boot() {
  const loading = document.querySelector<HTMLElement>('#loading')!;
  const message = document.querySelector<HTMLElement>('#loading-message')!;
  const retry = document.querySelector<HTMLButtonElement>('#retry')!;
  retry.hidden = true;
  message.textContent = 'Загружаем шрифты…';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const fonts = await Promise.race([
      Promise.all([
        document.fonts.load('32px "Ruslan Display"', 'ОМУТ'),
        document.fonts.load('700 16px "Golos Text"', 'ОМУТ 0123456789 +−'),
        document.fonts.load('13px "Golos Text"', 'Омут водятся 0123456789 ABC abc'),
        document.fonts.load('700 11px "Golos Text"', 'Карта'),
      ]),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('font timeout')), 15000); }),
    ]);
    if (fonts.some(faces => faces.length === 0)) throw new Error('fonts unavailable');
    // ?grid opens the stage-0 layout grid for measurements.
    const grid = new URLSearchParams(location.search).has('grid');
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      backgroundColor: '#0C0D0E',
      antialias: true,
      roundPixels: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: grid ? W : W * Z, height: grid ? H : H * Z },
      input: { activePointers: 1 },
      scene: grid ? [LayoutScene] : [BootScene, MenuScene, MatchScene, RulesScene, BestiaryScene, SettingsScene],
    });
    const observer = new ResizeObserver(() => {
      // refresh() alone uses the cached parent size in Phaser 3.90.
      game.scale.getParentBounds();
      game.scale.refresh();
    });
    observer.observe(document.querySelector('#game')!);
    loading.hidden = true;
    if (import.meta.hot) import.meta.hot.dispose(() => { observer.disconnect(); game.destroy(true); });
  } catch {
    message.textContent = 'Шрифты не загрузились. Нажми «Повторить».';
    retry.hidden = false;
  } finally { clearTimeout(timer); }
}
document.querySelector('#retry')!.addEventListener('click', () => window.location.reload());
void boot();

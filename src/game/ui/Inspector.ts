import Phaser from 'phaser';
import { card } from '../../engine/cards';
import type { Creature } from '../../engine/types';
import { C, H, icon, onTap, overlays, settings, text, W } from '../core';
import { sound } from '../audio';
import { Button } from './Button';

const IW = 300, IH = Math.round(300 * 1133 / 720);

/** Full card viewer: dark backdrop, tap the card or «Перевернуть» to flip (3D turn around Y, 450 ms). */
export function openInspector(scene: Phaser.Scene, cardId: string, live?: Creature, onClose?: () => void, startBack = false) {
  const root = scene.add.container(0, 0).setDepth(5000);
  const shade = scene.add.rectangle(0, 0, W, H, 0x000000, 0.85).setOrigin(0).setInteractive();
  const top = Math.round((H - (IH + 66 + (live ? 30 : 0))) / 2);
  const cy = top + IH / 2;
  const holder = scene.add.container(W / 2, cy);
  // Large art streams in after boot; until then the hand-size image stands in.
  const key = (side: 'f' | 'b') => (scene.textures.exists(`${side}:${cardId}`) ? `${side}:${cardId}` : `h:${cardId}`);
  const img = scene.add.image(0, 0, key(startBack ? 'b' : 'f')).setDisplaySize(IW, IH);
  holder.add(img);
  img.setInteractive();
  root.add([shade, holder]);
  let back = startBack, flipping = false;
  const flip = () => {
    if (flipping) return;
    flipping = true; sound.card();
    const sx = holder.scaleX;
    scene.tweens.add({ targets: holder, scaleX: 0, scaleY: sx * 1.04, duration: 225, ease: 'Sine.In', onComplete: () => {
      back = !back;
      img.setTexture(key(back ? 'b' : 'f')).setDisplaySize(IW, IH);
      scene.tweens.add({ targets: holder, scaleX: 1, scaleY: 1, duration: 225, ease: 'Sine.Out', onComplete: () => { flipping = false; } });
    } });
  };
  onTap(img, flip);
  let y = cy + IH / 2 + 12;
  if (live) {
    const def = card(live.cardId);
    const row = scene.add.container(W / 2, y + 10);
    const parts: Phaser.GameObjects.GameObject[] = [];
    let x = 0;
    const add = (name: string, value: string, color: number = C.ink) => {
      const i = icon(scene, x + 8, 0, name); const t = text(scene, x + 20, 0, value, { size: 16, color }).setOrigin(0, 0.5);
      parts.push(i, t); x += 20 + t.width + 16;
    };
    add('heart', `${live.hp}/${live.maxHp}`, live.hp < live.maxHp ? C.wound : C.ink);
    add('sword', String(live.attack), live.attack > def.attack ? C.gold : C.ink);
    if (live.upgrades) add('hammer', `${live.upgrades}/3`);
    if (live.poison) add('poison', String(live.poison));
    if (def.abilities.steadfast) add('steadfast', live.steadfastUsed ? 'нет' : 'есть');
    row.add(parts); row.x = Math.round(W / 2 - (x - 16) / 2);
    const label = text(scene, W / 2, y - 4, 'Сейчас на поле', { size: 11, font: 'text', color: C.muted }).setOrigin(0.5, 0.5);
    root.add([label, row]);
    y += 30;
  }
  let close = () => {};
  const hide = () => {
    scene.tweens.add({ targets: root, alpha: 0, duration: 140, onComplete: () => root.destroy() });
    onClose?.();
  };
  const by = Math.min(H - 64, y + 6);
  const flipBtn = new Button(scene, 30, by, 'Перевернуть', flip, { w: 160, h: 48, size: 15, icon: 'flip' });
  const closeBtn = new Button(scene, 200, by, 'Закрыть', () => close(), { w: 160, h: 48, size: 15, kind: 'main' });
  root.add([flipBtn, closeBtn]);
  onTap(shade, () => close());
  close = overlays.push(hide);
  root.setAlpha(0);
  holder.setScale(settings.reduceMotion ? 1 : 0.85);
  scene.tweens.add({ targets: root, alpha: 1, duration: 140 });
  scene.tweens.add({ targets: holder, scale: 1, duration: 220, ease: 'Back.Out' });
  return root;
}

/** Long-press helper: calls onLong after 400 ms unless the pointer moved or lifted. */
export function longPress(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, onLong: () => void, onTap?: () => void) {
  let timer: Phaser.Time.TimerEvent | undefined, fired = false, sx = 0, sy = 0;
  target.on('pointerdown', (p: Phaser.Input.Pointer) => {
    fired = false; sx = p.worldX; sy = p.worldY;
    timer = scene.time.delayedCall(400, () => { fired = true; onLong(); });
  });
  target.on('pointermove', (p: Phaser.Input.Pointer) => { if (timer && Math.hypot(p.worldX - sx, p.worldY - sy) > 8) { timer.remove(); timer = undefined; } });
  const end = (tap: boolean) => { if (timer) { timer.remove(); timer = undefined; if (tap && !fired) onTap?.(); } };
  target.on('pointerup', () => end(true));
  target.on('pointerout', () => end(false));
}

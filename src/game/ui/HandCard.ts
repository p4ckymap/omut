import Phaser from 'phaser';
import { card } from '../../engine/cards';
import type { HandCard as HandCardData } from '../../engine/types';
import { C, icon, text } from '../core';

export const CARD_W = 104, CARD_H = 164;
export const CARD_RATIO = 1133 / 720;

/** A card in the hand. Origin is the card centre so it can tilt in the fan. */
export class HandCardView extends Phaser.GameObjects.Container {
  uid: string; cardId: string;
  private img: Phaser.GameObjects.Image;
  private shade: Phaser.GameObjects.Rectangle;
  private badge: Phaser.GameObjects.Container;
  private badgeCoin: Phaser.GameObjects.Image;
  private badgeText: Phaser.GameObjects.Text;
  private stats: Phaser.GameObjects.Container;
  private glow?: Phaser.FX.Glow;
  home = { x: 0, y: 0, angle: 0, depth: 0 };
  affordable: boolean | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, data: HandCardData, faceDown = false) {
    super(scene, x, y);
    this.uid = data.uid; this.cardId = data.cardId;
    this.img = scene.add.image(0, 0, faceDown ? 'back' : `h:${data.cardId}`).setDisplaySize(CARD_W, CARD_H);
    this.shade = scene.add.rectangle(0, 0, CARD_W - 8, CARD_H - 8, 0x000000, 0.5).setVisible(false);
    // Price, always visible in the corner even when cards overlap in the fan.
    this.badge = scene.add.container(-CARD_W / 2 + 7, -CARD_H / 2 + 3);
    this.badgeCoin = scene.add.image(0, 0, 'i:coin').setDisplaySize(26, 26);
    this.badgeText = text(scene, 0, 0, String(card(data.cardId).cost), { size: 15, color: '#2a1c04' }).setOrigin(0.5);
    this.badge.add([this.badgeCoin, this.badgeText]);
    // Big, readable stats over the card's own bottom bar.
    const def = card(data.cardId);
    this.stats = scene.add.container(0, CARD_H / 2 - 18);
    const pg = scene.add.graphics();
    pg.fillStyle(0x0b0c0d, 0.94); pg.fillRoundedRect(-CARD_W / 2 + 7, -11, CARD_W - 14, 22, 9);
    this.stats.add(pg);
    if (def.kind === 'creature') {
      this.stats.add([icon(scene, -CARD_W / 4 - 13, 0, 'sword', 14), text(scene, -CARD_W / 4 - 3, 0, String(def.attack), { size: 15 }).setOrigin(0, 0.5),
        icon(scene, CARD_W / 4 - 13, 0, 'heart', 14), text(scene, CARD_W / 4 - 3, 0, String(def.health), { size: 15 }).setOrigin(0, 0.5)]);
    } else {
      this.stats.add([icon(scene, -18, 0, 'rune', 14), text(scene, -8, 0, 'Чары', { size: 13 }).setOrigin(0, 0.5)]);
    }
    this.stats.setVisible(!faceDown);
    this.add([this.img, this.shade, this.stats, this.badge]);
    this.badge.setVisible(!faceDown);
    this.setInteractive({ hitArea: new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    scene.add.existing(this);
  }

  setFace(up: boolean) {
    this.img.setTexture(up ? `h:${this.cardId}` : 'back').setDisplaySize(CARD_W, CARD_H);
    this.badge.setVisible(up);
    this.stats?.setVisible(up);
  }
  /** Turns face up by squashing the inner image, so it never fights the container's layout tweens. */
  flipUp(delay = 150) {
    const sx = this.img.scaleX;
    this.scene.tweens.add({ targets: this.img, scaleX: 0, delay, duration: 80, onComplete: () => {
      this.setFace(true);
      const full = this.img.scaleX;
      this.img.scaleX = 0;
      this.scene.tweens.add({ targets: this.img, scaleX: full || sx, duration: 80 });
    } });
  }

  setAffordable(ok: boolean) {
    if (ok === this.affordable) return;
    this.affordable = ok;
    this.shade.setVisible(!ok);
    this.badgeCoin.setTint(ok ? 0xffffff : 0x8a7f6a);
    this.badgeText.setColor(ok ? '#2a1c04' : '#8a0f08');
  }
  /** Gold glow along the card outline: this card can be played right now. */
  setPlayable(v: boolean) {
    // Glow hugs the card's own outline (WebGL). Created only while needed so idle cards keep batching.
    const fx = this.img.preFX;
    if (!fx || v === !!this.glow) return;
    if (v) { fx.setPadding(12); this.glow = fx.addGlow(C.gold, 5, 0, false, 0.1, 10); }
    else { fx.disable(true); this.glow = undefined; } // disable() also restores the batched pipeline
  }
}

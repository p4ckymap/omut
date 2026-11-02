import Phaser from 'phaser';
import { card } from '../../engine/cards';
import { hasPriority } from '../../engine/queries';
import type { Creature } from '../../engine/types';
import { C, CLASS_ICON, HEX, icon, RARITY_COLOR, settings, strokeCut, text } from '../core';

export const TOKEN_W = 76, TOKEN_H = 80;
export type TokenState = 'idle' | 'ready' | 'selected' | 'target' | 'friendly' | 'dim';

/** A creature on the board, 76×80. Origin is the top-left corner. */
export class Token extends Phaser.GameObjects.Container {
  uid: string; cardId: string;
  private art: Phaser.GameObjects.Image;
  private frame: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Graphics;
  private flashRect: Phaser.GameObjects.Rectangle;
  private classIcon: Phaser.GameObjects.Image;
  private homeRing: Phaser.GameObjects.Graphics;
  private shield: Phaser.GameObjects.Image;
  private statusBox: Phaser.GameObjects.Container;
  private atkText: Phaser.GameObjects.Text;
  private hpText: Phaser.GameObjects.Text;
  private heartIcon: Phaser.GameObjects.Image;
  private rewardTag: Phaser.GameObjects.Container;
  private pulse?: Phaser.Tweens.Tween;
  mode: TokenState = 'idle';
  private waiting = false;
  unit: Creature;

  constructor(scene: Phaser.Scene, x: number, y: number, unit: Creature) {
    super(scene, x, y);
    this.unit = unit; this.uid = unit.uid; this.cardId = unit.cardId;
    this.glow = scene.add.graphics();
    this.art = scene.add.image(0, 0, `t:${unit.cardId}`).setOrigin(0).setDisplaySize(TOKEN_W, TOKEN_H);
    this.flashRect = scene.add.rectangle(2, 2, TOKEN_W - 4, TOKEN_H - 4, 0xffffff, 1).setOrigin(0).setAlpha(0);
    this.frame = scene.add.graphics();
    this.homeRing = scene.add.graphics();
    this.classIcon = icon(scene, 12, 12, 'sun');
    this.shield = icon(scene, TOKEN_W - 12, 12, 'shield');
    this.statusBox = scene.add.container(3, 40);
    const plate = scene.add.graphics();
    plate.fillStyle(0x0b0c0d, 0.86); plate.fillRoundedRect(4, 58, 33, 18, 9); plate.fillRoundedRect(39, 58, 33, 18, 9);
    const sword = icon(scene, 14, 67, 'sword', 14);
    this.heartIcon = icon(scene, 49, 67, 'heart', 14);
    this.atkText = text(scene, 23, 67, '0', { size: 15 }).setOrigin(0, 0.5);
    this.hpText = text(scene, 58, 67, '0', { size: 15 }).setOrigin(0, 0.5);
    this.rewardTag = scene.add.container(TOKEN_W / 2, -10).setVisible(false);
    this.add([this.glow, this.art, this.flashRect, this.frame, this.homeRing, this.classIcon, this.shield, this.statusBox, plate, sword, this.heartIcon, this.atkText, this.hpText, this.rewardTag]);
    this.setInteractive({ hitArea: new Phaser.Geom.Rectangle(0, 0, TOKEN_W, TOKEN_H), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    this.refresh(unit);
    scene.add.existing(this);
  }

  get cx() { return this.x + TOKEN_W / 2; }
  get cy() { return this.y + TOKEN_H / 2; }

  /** Re-reads displayed stats from a creature snapshot. */
  refresh(unit: Creature) {
    const prevCard = this.cardId;
    this.unit = unit; this.cardId = unit.cardId;
    if (prevCard !== unit.cardId) this.art.setTexture(`t:${unit.cardId}`).setDisplaySize(TOKEN_W, TOKEN_H);
    const def = card(unit.cardId);
    this.classIcon.setTexture(`i:${CLASS_ICON[def.class!]}`).setDisplaySize(16, 16);
    this.shield.setVisible(hasPriority(unit));
    // In its native world: a gold ring around the class icon (the +1 ⚔ bonus).
    this.homeRing.clear();
    if (unit.home) { this.homeRing.fillStyle(0x0b0c0d, 0.85); this.homeRing.fillCircle(12, 12, 10); this.homeRing.lineStyle(2, C.gold, 1); this.homeRing.strokeCircle(12, 12, 10); }
    this.setAtk(unit.attack);
    this.setHp(unit.hp, unit.maxHp);
    this.drawStatuses();
    this.drawFrame();
  }
  setAtk(v: number) {
    this.atkText.setText(String(v));
    const base = card(this.cardId).attack;
    this.atkText.setColor(v > base ? HEX(C.gold) : HEX(C.ink));
  }
  setHp(hp: number, max = this.unit.maxHp) {
    this.hpText.setText(String(Math.max(0, hp)));
    this.hpText.setColor(hp < max ? HEX(C.wound) : HEX(C.ink));
  }
  setWaiting(v: boolean) { if (v !== this.waiting) { this.waiting = v; this.drawStatuses(); } }
  private drawStatuses() {
    const def = card(this.cardId), unit = this.unit;
    this.statusBox.removeAll(true);
    const statuses: string[] = [];
    if (this.waiting) statuses.push('hourglass');
    if (unit.poison) statuses.push('poison');
    if (def.abilities.steadfast && !unit.steadfastUsed) statuses.push('steadfast');
    statuses.forEach((s, i) => this.statusBox.add(icon(this.scene, 9, 6 - i * 17, s, 15)));
    if (unit.upgrades) this.statusBox.add(text(this.scene, 69, 6, `+${unit.upgrades}`, { size: 15, color: C.gold, stroke: true }).setOrigin(1, 0.5));
  }
  private drawFrame() {
    const g = this.frame; g.clear();
    const rarity = RARITY_COLOR[card(this.cardId).rarity];
    strokeCut(g, 0, 0, TOKEN_W, TOKEN_H, rarity, 2, 4);
  }

  private modeReward?: number;
  setMode(s: TokenState, reward?: number) {
    if (s === this.mode && reward === this.modeReward) return;
    this.mode = s; this.modeReward = reward;
    this.pulse?.stop(); this.pulse = undefined;
    this.glow.clear(); this.glow.setAlpha(1);
    this.art.clearTint(); this.art.setAlpha(1);
    this.rewardTag.setVisible(false).removeAll(true);
    const ring = (color: number) => { strokeCut(this.glow, -4, -4, TOKEN_W + 8, TOKEN_H + 8, color, 3, 6); };
    if (s === 'ready') {
      ring(C.accent);
      if (!settings.reduceMotion) this.pulse = this.scene.tweens.add({ targets: this.glow, alpha: 0.35, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    } else if (s === 'selected') {
      ring(C.accent); this.art.setTint(0xffffff);
      this.glow.fillStyle(C.accent, 0.12); this.glow.fillRect(0, 0, TOKEN_W, TOKEN_H);
    } else if (s === 'target') {
      ring(C.blood);
      if (!settings.reduceMotion) this.pulse = this.scene.tweens.add({ targets: this.glow, alpha: 0.4, duration: 420, yoyo: true, repeat: -1 });
      if (reward !== undefined) this.showReward(reward);
    } else if (s === 'friendly') {
      ring(C.heal);
      if (!settings.reduceMotion) this.pulse = this.scene.tweens.add({ targets: this.glow, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
    } else if (s === 'dim') {
      this.art.setTint(0x777777);
    }
    this.y = Math.round(this.y);
  }
  private showReward(n: number) {
    const bg = this.scene.add.graphics();
    const t = text(this.scene, 0, 0, `+${n}`, { size: 16, color: C.gold });
    const ic = icon(this.scene, 0, 0, 'coin');
    const w = t.width + 24;
    bg.fillStyle(0x0b0c0d, 0.92); bg.fillRoundedRect(-w / 2, -10, w, 20, 10); bg.lineStyle(1.5, C.gold, 1); bg.strokeRoundedRect(-w / 2, -10, w, 20, 10);
    t.setPosition(-w / 2 + 4, -9); ic.setPosition(w / 2 - 11, 0);
    this.rewardTag.add([bg, t, ic]).setVisible(true);
  }
  flash(color = 0xffffff) {
    this.flashRect.setFillStyle(color, 1).setAlpha(0.85);
    this.scene.tweens.add({ targets: this.flashRect, alpha: 0, duration: 160 });
  }
  get texKey() { return `t:${this.cardId}`; }
}

import Phaser from 'phaser';
import { chooseAction } from '../../engine/bot';
import { card, CLASS_NAMES, WORLDS } from '../../engine/cards';
import { locate, upgradeCost } from '../../engine/queries';
import { apply, createGame, explainAction, legalActions, previewCombat } from '../../engine/rules';
import type { Action, GameEvent, GameState, PlayerId } from '../../engine/types';
import { sound } from '../audio';
import { haptic } from '../../telegram';
import { C, HEX, icon, ms, overlays, panel, saveSettings, settings, setupCamera, strokeCut, text, tween, W, wait } from '../core';
import { backdrop } from '../ui/backdrop';
import { Button, iconButton } from '../ui/Button';
import { CARD_H, CARD_W, HandCardView } from '../ui/HandCard';
import { openInspector } from '../ui/Inspector';
import { TOKEN_H, TOKEN_W, Token, type TokenState } from '../ui/Token';
import { playEvent } from './anim';
import {
  AVATAR, BANNER_Y, BURN_ZONE, center, COIN_X, contains, DECK, DECK_C, DISCARD, END_BTN, HAND_BOTTOM, HP_X, LEFT_BTN, PANEL_Y, RIGHT_BTN,
  slotAt, slotRect, worldIconRect, worldRect,
} from './geometry';
import { confirmConcede, pauseOverlay, resultOverlay, tossOverlay } from './overlays';
import { Tutorial, tutorialState } from './tutorial';
import { clearMatch, loadMatch, saveMatch } from './save';

type Sel = null | { kind: 'hand'; uid: string } | { kind: 'token'; uid: string } | { kind: 'lik'; uid: string; target: string };
interface Press { kind: 'hand' | 'token' | 'none'; uid?: string; x: number; y: number; moved: boolean; long: boolean; timer?: Phaser.Time.TimerEvent }
interface Hover { slot?: number; token?: string; burn?: boolean; board?: boolean }

const NO_TARGET_SPELLS = new Set(['krov', 'koshel']);
const SELECT_SCALE = 1.32;
const DOUBLE_TAP_MS = 320;

export class MatchScene extends Phaser.Scene {
  state!: GameState;
  prev!: GameState;
  tut?: Tutorial;
  tokens = new Map<string, Token>();
  handViews: HandCardView[] = [];
  botBacks: Phaser.GameObjects.Image[] = [];
  lastPos = new Map<string, { x: number; y: number }>();
  lastDeath = { x: W / 2, y: 330 };
  busy = false;
  botRunning = false;
  over = false;
  leaving = false;
  backArmed = false;
  sel: Sel = null;
  press: Press | null = null;
  drag: null | { kind: 'card' | 'token'; uid: string } = null;
  hover: Hover = {};
  private lastTap = { uid: '', kind: 'none' as 'hand' | 'token' | 'none', x: 0, y: 0, t: 0 };
  private lowTime = false;
  /** Turn timer: only in games between players; never against the bot. */
  private timed = false;
  private turnLength = 60;
  /** Seconds left in the player's turn; null = no timer running. */
  private timeLeft: number | null = null;

  banner!: Phaser.GameObjects.Text;
  private bannerTimer?: Phaser.Time.TimerEvent;
  hpText: Phaser.GameObjects.Text[] = [];
  coinText: Phaser.GameObjects.Text[] = [];
  shown = { hp: [0, 0], coins: [0, 0] };
  avatars: Phaser.GameObjects.Container[] = [];
  deckText!: Phaser.GameObjects.Text;
  discardText!: Phaser.GameObjects.Text;
  /** Translucent preview of the card in the slot under the finger. */
  private ghost!: Phaser.GameObjects.Image;
  private ghostKey = '';
  endBtn!: Button;
  private timerG!: Phaser.GameObjects.Graphics;
  private endHint!: Phaser.GameObjects.Graphics;
  private endHintTween?: Phaser.Tweens.Tween;
  private timerText!: Phaser.GameObjects.Text;
  /** Creature actions live below the board, never covering a world or the turn strip. */
  private tokenMenu?: Phaser.GameObjects.Container;
  private burnBtnR!: Button;
  private burnBtnL!: Button;
  private playBtn!: Button;
  private cancelBtn!: Button;
  private burnZone!: Phaser.GameObjects.Container;
  hl!: Phaser.GameObjects.Graphics;
  hlLabels!: Phaser.GameObjects.Container;
  plan!: Phaser.GameObjects.Graphics;
  planLabels!: Phaser.GameObjects.Container;

  constructor() { super('Match'); }

  init() {
    this.recorded = false;
    this.tokens = new Map(); this.handViews = []; this.botBacks = []; this.lastPos = new Map();
    this.busy = false; this.botRunning = false; this.over = false; this.leaving = false; this.backArmed = false;
    this.endHintTween = undefined; this.lowTime = false;
    this.sel = null; this.press = null; this.drag = null; this.hover = {}; this.timeLeft = null; this.lastTap = { uid: '', kind: 'none', x: 0, y: 0, t: 0 };
    this.tut = undefined;
  }

  private resumed = false;
  create(data: { tutorial?: boolean; resume?: boolean }) {
    setupCamera(this);
    overlays.clear();
    backdrop(this);
    const saved = data?.resume ? loadMatch() : null;
    this.resumed = !!saved;
    if (data?.tutorial) {
      this.state = tutorialState();
      this.tut = new Tutorial(this);
    } else if (saved) {
      this.state = saved;
    } else {
      this.state = createGame(`${Date.now()}:${Math.random()}`, { startingHp: settings.hp });
    }
    this.prev = this.state;
    this.buildBoard();
    this.buildPanels();
    this.buildHandArea();
    this.setupInput();
    this.input.once('pointerdown', () => sound.unlock());
    this.armBack();
    this.cameras.main.fadeIn(350, 7, 10, 13);
    (window as unknown as { __omut: unknown }).__omut = { scene: this, suggest: () => chooseAction(this.state, 'medium') };
    void this.start();
  }

  // ---------------------------------------------------------------- build
  private buildBoard() {
    const g = this.add.graphics().setDepth(1);
    for (const p of [1, 0] as PlayerId[]) {
      this.state.worlds.forEach((wid, w) => {
        const r = worldRect(p, w);
        // Original world art stays as a quiet texture beneath the new slate table.
        this.add.image(r.x, r.y, `w:${wid}`).setOrigin(0).setDisplaySize(r.w, r.h).setTint(0x7d9ba8).setAlpha(0.45).setDepth(0);
        panel(g, r.x, r.y, r.w, r.h, C.panel, C.line2, { cut: 5, alpha: 0.76 });
        const wd = WORLDS[wid];
        for (let s = 0; s < 2; s++) {
          const sr = slotRect(p, w * 2 + s);
          panel(g, sr.x, sr.y, sr.w, sr.h, C.deep, C.line2, { cut: 3, alpha: 0.7, border: 1 });
          icon(this, sr.x + sr.w / 2, sr.y + sr.h / 2, wd.icon, 34).setTint(C.accent).setAlpha(0.16).setDepth(2);
        }
        const ir = worldIconRect(p, w);
        const name = text(this, 0, ir.y + ir.h / 2, wd.name, { size: 13, font: 'pixel', color: C.accent }).setOrigin(0, 0.5).setDepth(2);
        const total = 15 + name.width;
        const ic = icon(this, Math.round(ir.x + ir.w / 2 - total / 2 + 6), ir.y + ir.h / 2, wd.icon, 13).setTint(C.accent).setDepth(2);
        name.setX(Math.round(ic.x + 9));
        this.worldParticles(wid, r);
      });
    }
    this.hl = this.add.graphics().setDepth(6);
    this.ghost = this.add.image(0, 0, 'back').setOrigin(0).setDepth(7).setVisible(false);
    this.plan = this.add.graphics().setDepth(14);
    this.planLabels = this.add.container(0, 0).setDepth(16);
    this.hlLabels = this.add.container(0, 0).setDepth(30);
  }

  private worldParticles(wid: string, r: { x: number; y: number; w: number; h: number }) {
    if (settings.reduceMotion) return;
    const zone = { type: 'random' as const, source: new Phaser.Geom.Rectangle(r.x + 4, r.y + 4, r.w - 8, r.h - 8), quantity: 1 };
    const blink = { onEmit: () => 0, onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(t * Math.PI) * 0.35 };
    const cfg: Record<string, Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> = {
      peklo: { speedY: { min: -26, max: -12 }, speedX: { min: -4, max: 4 }, lifespan: 3200, tint: [0xff7a33, 0xffb347], alpha: blink, scale: 0.8 },
      nav: { speedX: { min: 3, max: 7 }, lifespan: 5000, tint: 0xd8dccf, alpha: { onEmit: () => 0, onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(t * Math.PI) * 0.12 }, scale: { min: 0.4, max: 0.7 } },
      chasha: { speedX: { min: -5, max: 5 }, speedY: { min: -5, max: 5 }, lifespan: 3000, tint: 0xb8f07a, alpha: blink, scale: 0.8 },
      puchina: { speedY: { min: -18, max: -8 }, lifespan: 4000, tint: 0xbfe6ff, alpha: blink, scale: { min: 0.5, max: 0.9 } },
      omut: { speedX: { min: -3, max: 3 }, speedY: { min: 3, max: 8 }, lifespan: 4000, tint: 0x8fe0cf, alpha: blink, scale: 0.8 },
      yav: { speedX: { min: 2, max: 6 }, speedY: { min: -2, max: 3 }, lifespan: 4000, tint: 0xf2d08a, alpha: blink, scale: 0.5 },
    };
    const bounds = new Phaser.Geom.Rectangle(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    this.add.particles(0, 0, wid === 'nav' ? 'glow' : 'px', { ...cfg[wid], emitZone: zone, deathZone: { type: 'onLeave', source: bounds },
      frequency: 320, maxAliveParticles: 10 }).setDepth(1);
  }

  private buildPanels() {
    const bg = this.add.graphics().setDepth(20);
    bg.fillStyle(C.deep, 0.92); bg.fillRect(0, 312, W, 30);
    bg.fillStyle(C.line2, 0.8); bg.fillRect(10, 312, W - 20, 1); bg.fillRect(10, 341, W - 20, 1);
    this.banner = text(this, W / 2, BANNER_Y, '', { size: 13, font: 'text', align: 'center', wrap: 372, line: -3 }).setOrigin(0.5).setDepth(21);
    const pg = this.add.graphics().setDepth(19);
    pg.fillStyle(C.bg, 0.94); pg.fillRect(0, 0, W, 57); pg.fillRect(0, 774, W, 70);
    panel(pg, 54, 6, 230, 44, C.panel, C.line, { cut: 4 });
    panel(pg, 54, 787, 166, 44, C.panel, C.line, { cut: 4 });
    for (const p of [0, 1] as PlayerId[]) {
      const a = AVATAR[p];
      const c = this.add.container(a.x, a.y).setDepth(25);
      const fr = this.add.graphics();
      panel(fr, -2, -2, 48, 48, C.deep, C.line2, { cut: 4 });
      const img = this.add.image(22, 22, p === 1 ? 'avatar-bot' : 'avatar-me').setDisplaySize(44, 44);
      const ring = this.add.graphics(); strokeCut(ring, -2, -2, 48, 48, C.line2, 2, 4);
      c.add([fr, img, ring]);
      this.avatars[p] = c;
      const y = PANEL_Y[p];
      text(this, 65, y, p === 1 ? 'Бот' : 'Ты', { size: 21 }).setOrigin(0, 0.5).setDepth(25);
      icon(this, HP_X + 9, y, 'heart', 18).setDepth(25);
      this.hpText[p] = text(this, HP_X + 22, y, '0', { size: 22 }).setOrigin(0, 0.5).setDepth(25);
      icon(this, COIN_X + 9, y, 'coin', 18).setDepth(25);
      this.coinText[p] = text(this, COIN_X + 22, y, '0', { size: 22, color: C.ink }).setOrigin(0, 0.5).setDepth(25);
    }
    text(this, 252, PANEL_Y[1], settings.bot === 'easy' ? 'Лёгкий' : 'Средний', { size: 11, color: C.muted }).setOrigin(0.5).setDepth(25);
    iconButton(this, 290, 6, 'pause', () => this.openPause()).setDepth(30);
    iconButton(this, 340, 6, 'exit', () => this.askConcede()).setDepth(30);
    this.endBtn = new Button(this, END_BTN.x, END_BTN.y, 'Конец хода', () => this.endTurn(), { w: 150, h: 48, kind: 'main', size: 16 }).setDepth(30);
    this.endHint = this.add.graphics().setDepth(29).setAlpha(0);
    strokeCut(this.endHint, END_BTN.x - 4, END_BTN.y - 4, 158, 56, C.accent, 3, 5);
    this.timerG = this.add.graphics().setDepth(31);
    this.timerText = text(this, END_BTN.x + 150, END_BTN.y, '', { size: 13, color: C.accent }).setOrigin(0.5).setDepth(32);
    // Shared deck and discard: two even plates with an icon, a count and a caption.
    const plate = (r: { x: number; y: number; w: number; h: number }, ic: string, caption: string) => {
      const g = this.add.graphics().setDepth(18);
      panel(g, r.x, r.y, r.w, r.h, C.panel, C.line2, { cut: 4, border: 1 });
      icon(this, r.x + 17, r.y + 17, ic, 18).setTint(C.accent).setDepth(19);
      text(this, r.x + r.w / 2, r.y + 39, caption, { size: 12, color: C.accent }).setOrigin(0.5).setDepth(19);
      return text(this, r.x + 31, r.y + 17, '0', { size: 16 }).setOrigin(0, 0.5).setDepth(19);
    };
    this.deckText = plate(DECK, 'deck', 'Колода');
    this.discardText = plate(DISCARD, 'grave', 'Сброс');
  }

  private buildHandArea() {
    const o = { w: 110, h: 40, size: 14 };
    this.burnBtnR = new Button(this, RIGHT_BTN.x, RIGHT_BTN.y, 'Сжечь +1', () => this.burnSelected(), { ...o, icon: 'flame' }).setDepth(700);
    this.burnBtnL = new Button(this, LEFT_BTN.x, LEFT_BTN.y, 'Сжечь +1', () => this.burnSelected(), { ...o, icon: 'flame' }).setDepth(700);
    this.playBtn = new Button(this, RIGHT_BTN.x, RIGHT_BTN.y, 'Сыграть', () => this.playSelectedSpell(), { ...o, icon: 'rune', kind: 'main' }).setDepth(700);
    this.cancelBtn = new Button(this, RIGHT_BTN.x, RIGHT_BTN.y, 'Отмена', () => this.clearSel(), o).setDepth(700);
    for (const b of [this.burnBtnR, this.burnBtnL, this.playBtn, this.cancelBtn]) b.setVisible(false);
    // Drop zone shown while a card is dragged: throw it down here to burn it for a coin.
    const z = BURN_ZONE;
    this.burnZone = this.add.container(z.x, z.y).setDepth(880).setVisible(false);
    const zg = this.add.graphics();
    this.burnZone.add([zg, icon(this, 34, z.h / 2, 'flame', 26),
      text(this, 56, z.h / 2 - 9, 'Сжечь карту', { size: 16, color: '#FFB27A' }).setOrigin(0, 0.5),
      text(this, 56, z.h / 2 + 11, 'отпусти здесь: +1 монета', { size: 12, font: 'text', color: C.ink }).setOrigin(0, 0.5)]);
    this.burnZone.setData('g', zg);
  }

  // ---------------------------------------------------------------- flow
  private async start() {
    this.syncCounters();
    if (this.resumed) {
      // A saved match: put everything back on the table and carry on from the same moment.
      this.busy = true;
      await this.dealOpening([]);
      for (const p of [0, 1] as PlayerId[]) this.state.players[p].board.forEach((u, slot) => {
        if (!u) return;
        const r = slotRect(p, slot), t = new Token(this, r.x, r.y, u).setDepth(10).setAlpha(0);
        this.tokens.set(u.uid, t);
        this.tweens.add({ targets: t, alpha: 1, duration: ms(260), delay: ms(slot * 40) });
      });
      this.busy = false;
      this.sync();
      this.setBanner('Партия продолжается', 'hint');
      if (this.state.activePlayer === 1) await this.botTurn();
      return;
    }
    if (this.tut) {
      this.busy = true;
      await this.dealOpening([]);
      await this.tut.begin();
      this.busy = false;
      this.sync();
      return;
    }
    this.busy = true;
    this.setBanner('Жребий');
    await tossOverlay(this, this.state.firstPlayer);
    if (this.over || this.leaving) return;
    // No replacing: both keep the dealt hand, the game starts straight away.
    const collected: GameEvent[] = [];
    while (this.state.phase === 'mulligan') {
      const t = apply(this.state, { type: 'Mulligan', player: this.state.activePlayer, cards: [] });
      if (!t.accepted) break;
      this.state = t.state; collected.push(...t.events);
    }
    const first = collected.findIndex(e => e.type === 'TurnStarted');
    const post = first >= 0 ? collected.slice(first) : [];
    await this.dealOpening(post);
    this.prev = this.state;
    await this.playEvents(post);
    if (this.state.activePlayer === 1) await this.botTurn();
  }

  /** Deals the opening hands from the deck, except cards that later events draw themselves. */
  private async dealOpening(post: GameEvent[]) {
    const drawnLater = new Set(post.filter((e): e is Extract<GameEvent, { type: 'CardDrawn' }> => e.type === 'CardDrawn').map(e => e.card.uid));
    const mine = this.state.players[0].hand.filter(h => !drawnLater.has(h.uid));
    const botCount = this.state.players[1].hand.length - post.filter(e => e.type === 'CardDrawn' && e.player === 1 && !e.overflow).length;
    for (let i = 0; i < Math.max(mine.length, botCount); i++) {
      if (i < mine.length) { this.addHandView(mine[i], true); sound.card(); }
      if (i < botCount) this.addBotBack(true);
      this.layoutHand(true); this.layoutBotHand(true);
      await wait(this, 90);
    }
    await wait(this, 200);
    this.syncPiles();
  }

  async playEvents(events: GameEvent[]) {
    this.busy = true;
    this.clearSel(false);
    this.paint();
    try {
      for (const e of events) {
        if (this.over) return;
        try { await playEvent(this, e); } catch (err) { console.warn('animation skipped', e.type, err); }
        this.tut?.onEvent(e);
        if (e.type === 'TurnStarted') { this.turnLength = settings.turnTime; this.timeLeft = e.player === 0 && this.timed && settings.turnTime > 0 ? settings.turnTime : null; }
      }
    } finally {
      // The state is already final; whatever happened to the animations, the view catches up here.
      if (!this.over) { this.sync(); this.busy = false; }
    }
    if (this.over) return;
    this.paint();
    this.refreshButtons();
    this.tut?.afterQueue();
    if (this.state.phase === 'over' && !this.over) {
      this.over = true;
      this.timeLeft = null;
      await wait(this, 500);
      resultOverlay(this);
    }
  }

  /** Every player gesture ends up here: Action → engine → events → animation queue. */
  async act(action: Action): Promise<boolean> {
    const refuse = (reason?: string) => { if (reason) this.deny(reason); this.layoutHand(true); this.sync(); return false; };
    if (this.busy || this.over || this.modalOpen) return refuse();
    const gate = this.tut?.gate(action);
    if (gate) return refuse(gate);
    const t = apply(this.state, action);
    if (!t.accepted) {
      const r = t.events[0];
      return refuse(r.type === 'ActionRejected' ? r.reason : 'Так нельзя.');
    }
    if (action.type === 'EndTurn') this.timeLeft = null;
    this.prev = this.state;
    this.state = t.state;
    this.persist();
    await this.playEvents(t.events);
    if (this.state.phase === 'playing' && this.state.activePlayer === 1) await this.botTurn();
    return true;
  }

  async botTurn() {
    if (this.botRunning) return;
    this.botRunning = true;
    this.busy = true;
    this.refreshButtons();
    try {
      let guard = 0;
      while (this.state.phase === 'playing' && this.state.activePlayer === 1 && !this.over) {
        const chosen = guard++ < 80 ? (this.tut?.botAction(this.state) ?? chooseAction(this.state, settings.bot)) : null;
        // A stuck or exhausted bot always ends its turn, so the match can never hang on its side.
        const a: Action = chosen ?? { type: 'EndTurn', player: 1 };
        try { await this.botTelegraph(a); } catch { /* cosmetic only */ }
        let t = apply(this.state, a);
        if (!t.accepted) t = apply(this.state, { type: 'EndTurn', player: 1 });
        this.prev = this.state;
        this.state = t.state;
        this.persist();
        await this.playEvents(t.events);
        this.busy = true;
        if (a.type !== 'EndTurn') await wait(this, 380);
      }
    } finally {
      this.botRunning = false;
      if (!this.over) { this.busy = false; this.sync(); }
    }
    this.tut?.onBotTurnEnd();
  }

  /** Shows what the bot is about to do: lifts the card or lights the creature. */
  private async botTelegraph(a: Action) {
    if (a.type === 'PlayCreature' || a.type === 'CastSpell' || a.type === 'Burn') {
      const idx = this.state.players[1].hand.findIndex(h => h.uid === a.card);
      const back = this.botBacks[idx] ?? this.botBacks[this.botBacks.length - 1];
      if (back) {
        back.setTint(0xfff2c0);
        await tween(this, { targets: back, y: back.y + 14, duration: 130, ease: 'Quad.Out' });
        await wait(this, 110);
        back.clearTint();
      }
    } else if (a.type === 'Upgrade') {
      const tok = this.tokens.get(a.target);
      if (tok) { tok.setMode('friendly'); await wait(this, 260); tok.setMode('idle'); }
    } else if (a.type === 'EndTurn') {
      this.setBanner('Бот завершает ход');
      await wait(this, 250);
    }
  }

  private endTurn() {
    if (this.busy || this.state.activePlayer !== 0) { this.deny(this.state.activePlayer !== 0 ? 'Сейчас ход Бота.' : 'Подожди, идёт анимация.'); return; }
    this.cancelPress();
    void this.act({ type: 'EndTurn', player: 0 });
  }

  // ---------------------------------------------------------------- views
  addHandView(h: { uid: string; cardId: string }, fromDeck: boolean) {
    const v = new HandCardView(this, DECK_C.x, DECK_C.y, h, fromDeck);
    v.setScale(fromDeck ? 0.3 : 1).setDepth(100);
    this.handViews.push(v);
    if (fromDeck) v.flipUp(ms(120));
    v.setAffordable(card(h.cardId).cost <= this.state.players[0].coins);
    return v;
  }
  addBotBack(fromDeck: boolean) {
    const b = this.add.image(fromDeck ? DECK_C.x : W / 2, fromDeck ? DECK_C.y : 86, 'back').setDisplaySize(32, 48).setDepth(40);
    this.botBacks.push(b);
    return b;
  }

  handHome(i: number, n: number) {
    const span = 370 - CARD_W;
    const step = n > 1 ? Math.min(CARD_W + 4, span / (n - 1)) : 0;
    const total = step * (n - 1);
    const x = W / 2 - total / 2 + i * step;
    const mid = (n - 1) / 2, off = i - mid;
    return { x: Math.round(x), y: Math.round(HAND_BOTTOM - CARD_H / 2 + off * off * 0.8), angle: settings.reduceMotion ? 0 : off * 1.8 };
  }

  layoutHand(animate: boolean) {
    const order = this.state.players[0].hand.map(h => h.uid);
    this.handViews.sort((a, b) => {
      const ia = order.indexOf(a.uid), ib = order.indexOf(b.uid);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    const n = this.handViews.length;
    this.handViews.forEach((v, i) => {
      if (this.drag?.kind === 'card' && this.drag.uid === v.uid) return;
      const selected = (this.sel?.kind === 'hand' || this.sel?.kind === 'lik') && this.sel.uid === v.uid;
      const home = this.handHome(i, n);
      const target = selected
        ? { x: W / 2, y: Math.round(HAND_BOTTOM - CARD_H * SELECT_SCALE / 2), angle: 0, scale: SELECT_SCALE }
        : { ...home, scale: 1 };
      v.setDepth(selected ? 600 : 100 + i);
      this.tweens.killTweensOf(v);
      if (animate) this.tweens.add({ targets: v, x: target.x, y: target.y, angle: target.angle, scale: target.scale, alpha: 1, duration: ms(200), ease: 'Cubic.Out' });
      else v.setPosition(target.x, target.y).setAngle(target.angle).setScale(target.scale).setAlpha(1);
    });
  }

  layoutBotHand(animate: boolean) {
    const n = this.botBacks.length;
    const step = 24, total = step * (n - 1);
    this.botBacks.forEach((b, i) => {
      const off = i - (n - 1) / 2;
      const t = { x: Math.round(W / 2 - total / 2 + i * step), y: 86 + Math.round(Math.abs(off) * 1.5), angle: settings.reduceMotion ? 0 : off * (6 / Math.max(1, (n - 1) / 2)) };
      b.setDepth(40 + i);
      if (animate) this.tweens.add({ targets: b, ...t, duration: ms(240), ease: 'Cubic.Out' });
      else b.setPosition(t.x, t.y).setAngle(t.angle);
    });
  }

  tokenCenter(uid: string) {
    const t = this.tokens.get(uid);
    if (t) return { x: t.cx, y: t.cy };
    return this.lastPos.get(uid) ?? { x: W / 2, y: 330 };
  }
  avatarCenter(p: PlayerId) { return center(AVATAR[p]); }
  coinPos(p: PlayerId) { return { x: COIN_X + 9, y: PANEL_Y[p] }; }

  /** Brings every view in line with the engine state after the animation queue. */
  sync() {
    const s = this.state;
    const alive = new Set<string>();
    for (const p of [0, 1] as PlayerId[]) s.players[p].board.forEach((u, slot) => {
      if (!u) return;
      alive.add(u.uid);
      let t = this.tokens.get(u.uid);
      const r = slotRect(p, slot);
      if (!t) { t = new Token(this, r.x, r.y, u).setDepth(10); this.tokens.set(u.uid, t); }
      else {
        t.refresh(u);
        const dragging = this.drag?.kind === 'token' && this.drag.uid === u.uid;
        if (!dragging && !this.tweens.isTweening(t)) t.setPosition(r.x, r.y).setScale(1).setAlpha(1).setAngle(0).setDepth(10);
      }
      t.setWaiting(u.enteredTurn === s.turn && !card(u.cardId).abilities.rush && s.activePlayer === p);
      this.lastPos.set(u.uid, { x: r.x + TOKEN_W / 2, y: r.y + TOKEN_H / 2 });
    });
    for (const [uid, t] of this.tokens) if (!alive.has(uid)) { t.destroy(); this.tokens.delete(uid); }
    const hand = s.players[0].hand;
    for (const v of [...this.handViews]) if (!hand.some(h => h.uid === v.uid)) { v.destroy(); this.handViews.splice(this.handViews.indexOf(v), 1); }
    for (const h of hand) if (!this.handViews.some(v => v.uid === h.uid)) this.addHandView(h, true);
    this.layoutHand(true);
    const botN = s.players[1].hand.length;
    while (this.botBacks.length < botN) this.addBotBack(true);
    while (this.botBacks.length > botN) this.botBacks.pop()!.destroy();
    this.layoutBotHand(true);
    this.syncCounters();
    this.syncPiles();
    this.paint();
    this.refreshButtons();
    this.setBanner(this.selBanner() ?? this.baseBanner());
  }

  syncCounters() {
    for (const p of [0, 1] as PlayerId[]) { this.setHp(p, this.state.players[p].hp); this.setCoins(p, this.state.players[p].coins); }
  }
  syncPiles() {
    this.deckText.setText(String(this.state.deck.length));
    this.discardText.setText(String(this.state.discard.length));
  }
  setHp(p: PlayerId, v: number) {
    this.shown.hp[p] = v; this.hpText[p].setText(String(v));
    this.hpText[p].setColor(v <= 5 ? HEX(C.wound) : HEX(C.ink));
  }
  setCoins(p: PlayerId, v: number) {
    this.shown.coins[p] = v; this.coinText[p].setText(String(v));
    this.coinText[p].setScale(Math.min(1, 30 / this.coinText[p].width));
    if (p === 0) for (const h of this.handViews) h.setAffordable(card(h.cardId).cost <= v);
  }

  // ---------------------------------------------------------------- banner
  baseBanner() {
    if (this.state.phase === 'over') return this.state.winner === 0 ? 'Победа!' : 'Поражение';
    if (this.state.activePlayer === 1) return 'Ход Бота';
    if (this.tut?.message) return this.tut.message;
    const legal = legalActions(this.state);
    const playable = legal.some(a => a.type === 'PlayCreature' || a.type === 'CastSpell');
    return playable ? 'Твой ход — перетащи карту в мир' : 'Больше нечего сыграть — жми «Конец хода»';
  }
  setBanner(v: string, kind: 'info' | 'deny' | 'hint' = 'info') {
    this.bannerTimer?.remove();
    this.banner.setText(v).setColor(kind === 'deny' ? HEX(C.deny) : kind === 'hint' ? HEX(C.accent) : HEX(C.ink));
    if (kind === 'deny') this.bannerTimer = this.time.delayedCall(2500, () => this.setBanner(this.selBanner() ?? this.baseBanner()));
  }
  deny(reason: string) { sound.deny(); haptic('error'); this.setBanner(reason, 'deny'); }

  private selBanner(): string | null {
    const s = this.sel;
    if (!s) return null;
    if (s.kind === 'token') return this.tokenInfo(s.uid);
    if (s.kind === 'lik') return 'Коснись места в своём мире для копии';
    const h = this.state.players[0].hand.find(c => c.uid === s.uid);
    if (!h) return null;
    const def = card(h.cardId), coins = this.state.players[0].coins;
    if (def.cost > coins) return `${def.name}: нужно ${def.cost} монет, у тебя ${coins}. Можно сжечь за +1`;
    if (def.kind === 'creature') return `${def.name}: перетащи в подсвеченное место или коснись его`;
    if (NO_TARGET_SPELLS.has(def.id)) return `${def.name}: перетащи на поле или нажми «Сыграть»`;
    const enemy = def.id === 'fire' || def.id === 'poglot';
    return `${def.name}: перетащи на ${enemy ? 'врага' : def.id === 'lik' ? 'любое существо' : 'своё существо'} в подсветке`;
  }
  private tokenInfo(uid: string): string {
    const loc = locate(this.state, uid);
    if (!loc) return '';
    const def = card(loc.unit.cardId);
    const plan = loc.player === this.state.activePlayer ? previewCombat(this.state, loc.player).find(a => a.attacker === uid) : undefined;
    const t = plan ? (plan.target === 'hero' ? 'в конце хода ударит по жизням' : `в конце хода ударит «${card(locate(this.state, plan.target)!.unit.cardId).name}»`) : '';
    return `${def.name}: атака ${loc.unit.attack}, ♥ ${loc.unit.hp}${t ? ` — ${t}` : ''}`;
  }

  // ---------------------------------------------------------------- highlights
  paint() {
    const g = this.hl; g.clear();
    this.hlLabels.removeAll(true);
    const me = this.state.players[0];
    for (const v of this.handViews) v.setAffordable(card(v.cardId).cost <= me.coins);
    const modes = new Map<string, [TokenState, number?]>();
    const playable = new Set<string>();
    try { this.paintSelection(modes, playable); } finally {
      for (const v of this.handViews) v.setPlayable(playable.has(v.uid));
      for (const [uid, t] of this.tokens) { const m = modes.get(uid) ?? ['idle']; t.setMode(m[0], m[1]); }
      this.paintPlan();
      this.paintBurnZone();
    }
  }
  private paintSelection(modes: Map<string, [TokenState, number?]>, playable: Set<string>) {
    const s = this.state, me = s.players[0];
    const mine = s.phase === 'playing' && s.activePlayer === 0 && !this.busy && !this.over;
    if (!mine) return;
    const legal = legalActions(s);
    const sel = this.sel;
    if (!sel) {
      for (const a of legal) if (a.type === 'PlayCreature' || a.type === 'CastSpell') playable.add(a.card);
      return;
    }
    const tokenModes = (targets: Set<string>, rewardFor?: (uid: string) => number | undefined) => {
      for (const uid of this.tokens.keys()) {
        if (targets.has(uid)) {
          const own = locate(s, uid)?.player === 0;
          modes.set(uid, [own ? 'friendly' : 'target', own ? undefined : rewardFor?.(uid)]);
        } else modes.set(uid, ['dim']);
      }
    };
    const reward = (uid: string) => { const u = locate(s, uid); return u ? card(u.unit.cardId).reward : undefined; };
    if (sel.kind === 'hand') {
      const h = me.hand.find(c => c.uid === sel.uid);
      if (!h) return;
      const def = card(h.cardId);
      if (def.kind === 'creature') {
        for (let slot = 0; slot < 8; slot++) if (!me.board[slot]) this.slotMark(slot, legal.some(a => a.type === 'PlayCreature' && a.card === sel.uid && a.slot === slot), def.class);
      } else if (!NO_TARGET_SPELLS.has(def.id)) {
        tokenModes(new Set(legal.flatMap(a => a.type === 'CastSpell' && a.card === sel.uid && a.target ? [a.target] : [])), def.id === 'fire' || def.id === 'poglot' ? reward : undefined);
      } else this.boardGlow();
    } else if (sel.kind === 'token') {
      modes.set(sel.uid, ['selected']);
      const cls = card(locate(s, sel.uid)?.unit.cardId ?? 'opol').class;
      for (let slot = 0; slot < 8; slot++) if (!me.board[slot]) this.slotMark(slot, legal.some(a => a.type === 'Move' && a.unit === sel.uid && a.slot === slot), cls);
    } else if (sel.kind === 'lik') {
      for (let slot = 0; slot < 8; slot++) if (!me.board[slot]) this.slotMark(slot, legal.some(a => a.type === 'CastSpell' && a.card === sel.uid && a.target === sel.target && a.slot === slot));
    }
  }
  private slotMark(slot: number, ok: boolean, cls?: string | null) {
    const r = slotRect(0, slot), g = this.hl;
    if (ok && cls && WORLDS[this.state.worlds[slot >> 1]].native === cls) {
      const t = text(this, r.x + r.w / 2, r.y + r.h - 18, 'Родной мир\n+1 к атаке', { size: 10, font: 'text', align: 'center', bold: true, color: C.accent, stroke: true }).setOrigin(0.5);
      this.hlLabels.add(t);
    }
    const hovered = this.hover.slot === slot;
    const grow = hovered ? 5 : 0;
    if (ok) {
      panel(g, r.x - grow, r.y - grow, r.w + grow * 2, r.h + grow * 2, C.accent, C.accent, { cut: 3, alpha: hovered ? 0.3 : 0.12, border: 0 });
      strokeCut(g, r.x - grow, r.y - grow, r.w + grow * 2, r.h + grow * 2, hovered ? C.ink : C.accent, hovered ? 3 : 2, 3);
    } else {
      panel(g, r.x, r.y, r.w, r.h, C.blood, C.blood, { cut: 3, alpha: hovered ? 0.2 : 0.07, border: 0 });
      g.lineStyle(3, C.blood, 0.75);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      g.lineBetween(cx - 8, cy - 8, cx + 8, cy + 8); g.lineBetween(cx + 8, cy - 8, cx - 8, cy + 8);
    }
  }
  /** Shows (or hides) a translucent copy of the creature in the slot it would land in. */
  private showGhost(cardId: string | null, slot: number | null) {
    const key = cardId && slot !== null ? `${cardId}:${slot}` : '';
    if (key === this.ghostKey) return;
    this.ghostKey = key;
    this.tweens.killTweensOf(this.ghost);
    if (!key) { this.ghost.setVisible(false); return; }
    sound.tick(); haptic('light');
    const r = slotRect(0, slot!);
    this.ghost.setTexture(`t:${cardId}`).setDisplaySize(r.w, r.h).setPosition(r.x, r.y).setVisible(true).setAlpha(0);
    const sx = this.ghost.scaleX, sy = this.ghost.scaleY;
    this.ghost.setScale(sx * 0.86, sy * 0.86).setPosition(r.x + r.w * 0.07, r.y + r.h * 0.07);
    this.tweens.add({ targets: this.ghost, alpha: 0.6, scaleX: sx, scaleY: sy, x: r.x, y: r.y, duration: ms(140), ease: 'Back.Out' });
  }
  private boardGlow() {
    const g = this.hl;
    strokeCut(g, 6, 114, W - 12, 426, C.accent, 2, 5, this.hover.board ? 0.9 : 0.35);
  }

  /** Dotted arrows: who each of your creatures will hit when you end the turn. */
  private paintPlan() {
    const g = this.plan; g.clear();
    this.planLabels.removeAll(true);
    const s = this.state;
    if (s.phase !== 'playing' || s.activePlayer !== 0 || this.busy || this.over || this.drag) return;
    const hits = new Map<string, number>(), heroByWorld = new Map<number, number>();
    for (const a of previewCombat(s, 0)) {
      const from = this.tokens.get(a.attacker), loc = locate(s, a.attacker);
      if (!from || !loc) continue;
      let to: { x: number; y: number };
      if (a.target === 'hero') {
        const w = Math.floor(loc.slot / 2), r = worldRect(1, w);
        to = { x: r.x + r.w / 2, y: r.y + r.h - 30 };
        heroByWorld.set(w, (heroByWorld.get(w) ?? 0) + a.heroDamage);
      } else {
        const t = this.tokens.get(a.target); if (!t) continue;
        to = { x: t.cx, y: t.y + TOKEN_H - 8 };
        hits.set(a.target, (hits.get(a.target) ?? 0) + a.damage);
        if (a.heroDamage) { const w = Math.floor(loc.slot / 2); heroByWorld.set(w, (heroByWorld.get(w) ?? 0) + a.heroDamage); }
      }
      this.dottedArrow(g, from.cx, from.y + 6, to.x, to.y, a.target === 'hero' ? C.accent : C.blood);
    }
    for (const [target, dmg] of hits) { const p = this.tokens.get(target); if (p) this.planLabels.add(this.pill(p.cx, p.y + 22, `−${dmg}`, C.blood)); }
    for (const [w, dmg] of heroByWorld) { const r = worldRect(1, w); this.planLabels.add(this.pill(r.x + r.w / 2, r.y + r.h / 2, `−${dmg} ♥`, C.accent)); }
    // Threat: what the bot's creatures would hit through your empty worlds on its turn.
    for (const [w, dmg] of this.threats()) {
      const r = worldRect(0, w);
      this.planLabels.add(this.pill(r.x + r.w / 2, r.y + r.h / 2, `−${dmg} ♥`, C.blood));
    }
  }
  /** Damage the bot would deal to you through each empty world if its creatures struck right now. */
  threats(): Map<number, number> {
    const out = new Map<number, number>();
    if (this.state.phase !== 'playing' || this.state.activePlayer !== 0) return out;
    // Resolve my own end-of-turn combat and the bot's start of turn first (deaths, poison), on a copy.
    const next = apply(this.state, { type: 'EndTurn', player: 0 });
    if (!next.accepted || next.state.phase !== 'playing') return out;
    for (const a of previewCombat(next.state, 1)) {
      if (a.target !== 'hero') continue;
      const loc = locate(next.state, a.attacker);
      if (loc) { const w = Math.floor(loc.slot / 2); out.set(w, (out.get(w) ?? 0) + a.heroDamage); }
    }
    return out;
  }
  private pill(x: number, y: number, value: string, color: number) {
    const c = this.add.container(x, y);
    const t = text(this, 0, 0, value, { size: 15, color: color === C.accent ? C.accent : C.wound }).setOrigin(0.5);
    const w = Math.round(t.width + 14);
    const g = this.add.graphics();
    panel(g, -w / 2, -11, w, 22, C.deep, color, { cut: 3, alpha: 0.94, border: 1 });
    c.add([g, t]);
    return c;
  }
  private dottedArrow(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, color: number) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 10) return;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    g.fillStyle(color, 0.75);
    for (let d = 4; d < len - 12; d += 9) g.fillRect(Math.round(x1 + ux * d) - 1, Math.round(y1 + uy * d) - 1, 3, 3);
    const px = -uy, py = ux;
    g.fillTriangle(x2, y2, x2 - ux * 11 + px * 6, y2 - uy * 11 + py * 6, x2 - ux * 11 - px * 6, y2 - uy * 11 - py * 6);
  }
  private paintBurnZone() {
    const show = this.drag?.kind === 'card';
    this.burnZone.setVisible(show);
    if (!show) return;
    const g = this.burnZone.getData('g') as Phaser.GameObjects.Graphics, z = BURN_ZONE, hot = !!this.hover.burn;
    g.clear();
    panel(g, 0, 0, z.w, z.h, hot ? 0x4a1c0c : 0x1f1210, 0xff7a33, { cut: 5, alpha: 0.96 });
    strokeCut(g, 0, 0, z.w, z.h, 0xff7a33, 2, 5, hot ? 1 : 0.6);
  }

  // ---------------------------------------------------------------- buttons
  refreshButtons() {
    const s = this.state;
    const mine = s.phase === 'playing' && s.activePlayer === 0 && !this.over;
    const idle = mine && !this.busy;
    this.endBtn.setEnabled(idle).setText(mine ? 'Конец хода' : s.phase === 'over' ? 'Конец' : 'Ход Бота').setKind(mine ? 'main' : 'normal');
    for (const b of [this.burnBtnR, this.burnBtnL, this.playBtn, this.cancelBtn]) b.setVisible(false);
    // Nothing left to play: the end-turn button breathes so the next step is obvious.
    const stuck = idle && !this.sel && !legalActions(s).some(a => a.type === 'PlayCreature' || a.type === 'CastSpell');
    if (stuck && !this.endHintTween) {
      if (settings.reduceMotion) this.endHint.setAlpha(0.8);
      else this.endHintTween = this.tweens.add({ targets: this.endHint, alpha: { from: 0.15, to: 0.9 }, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    if (!stuck) { this.endHintTween?.stop(); this.endHintTween = undefined; this.endHint.setAlpha(0); }
    if (!mine) return;
    const sel = this.sel;
    if (sel?.kind === 'hand') {
      const h = s.players[0].hand.find(c => c.uid === sel.uid);
      const def = h ? card(h.cardId) : undefined;
      if (def && def.kind === 'spell' && NO_TARGET_SPELLS.has(def.id) && def.cost <= s.players[0].coins) { this.playBtn.setVisible(true); this.burnBtnL.setVisible(true); }
      else this.burnBtnR.setVisible(true);
    } else if (sel?.kind === 'lik') {
      this.cancelBtn.setVisible(true);
    }
    for (const b of [this.burnBtnR, this.burnBtnL, this.playBtn, this.cancelBtn]) b.setEnabled(idle);
  }

  /** Tap your creature: show its upgrade and move hints in the reserved action strip. */
  private openTokenMenu(uid: string) {
    this.closeTokenMenu();
    const t = this.tokens.get(uid), loc = locate(this.state, uid);
    if (!t || !loc) return;
    const cost = upgradeCost(loc.unit);
    const reason = explainAction(this.state, { type: 'Upgrade', player: 0, target: uid });
    const movable = loc.unit.enteredTurn === this.state.turn;
    const w = 360, h = 52;
    const x = 15, y = 540;
    const m = this.add.container(x, y).setDepth(960);
    const g = this.add.graphics();
    panel(g, 0, 0, w, h, C.panel, C.line, { cut: 5, alpha: 0.98, border: 1 });
    g.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains); // taps on the menu never reach cards below
    m.add(g);
    const btn = new Button(this, 4, 4, `Усилить · ${cost}`, () => {
      this.closeTokenMenu();
      void this.act({ type: 'Upgrade', player: 0, target: uid });
    }, { w: 166, h: 44, size: 20, icon: 'hammer', kind: reason ? 'normal' : 'main' });
    btn.setName('match-upgrade');
    m.add(btn);
    if (reason) btn.setEnabled(false);
    const note = reason ? (reason.length > 30 ? 'Сейчас нельзя усилить' : reason) : `+1 атака навсегда · ${cost} мон.`;
    m.add(text(this, 180, movable ? 15 : 26, note, { size: 11, font: 'text', color: C.muted, wrap: 173 }).setOrigin(0, 0.5));
    if (movable) m.add(text(this, 180, 36, 'Можно переставить', { size: 12, font: 'text', color: C.accent }).setOrigin(0, 0.5));
    m.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: m, scale: 1, alpha: 1, duration: ms(120), ease: 'Back.Out' });
    this.tokenMenu = m;
  }
  closeTokenMenu() { this.tokenMenu?.destroy(); this.tokenMenu = undefined; }
  private burnSelected() {
    if (this.sel?.kind !== 'hand') return;
    void this.act({ type: 'Burn', player: 0, card: this.sel.uid });
  }
  private playSelectedSpell() {
    if (this.sel?.kind !== 'hand') return;
    void this.act({ type: 'CastSpell', player: 0, card: this.sel.uid });
  }

  select(sel: Sel) {
    this.closeTokenMenu();
    this.sel = sel;
    if (sel) sound.card();
    this.layoutHand(true);
    this.paint();
    this.refreshButtons();
    this.setBanner(this.selBanner() ?? this.baseBanner(), 'info');
  }
  clearSel(redraw = true) {
    this.closeTokenMenu();
    this.sel = null; this.hover = {};
    if (redraw) { this.layoutHand(true); this.paint(); this.refreshButtons(); this.setBanner(this.baseBanner()); }
  }

  // ---------------------------------------------------------------- turn timer
  update(_: number, dt: number) {
    const g = this.timerG; g.clear();
    if (settings.turnTime === 0) this.timeLeft = null; // switched off mid-match from the pause menu
    if (this.timeLeft === null || this.over || this.state.activePlayer !== 0) { if (this.timerText.text) this.timerText.setText(''); return; }
    if (!this.busy && !this.modalOpen && !this.time.paused) this.timeLeft = Math.max(0, this.timeLeft - dt / 1000);
    const k = this.timeLeft / Math.max(1, this.turnLength), low = this.timeLeft <= 10;
    const color = low ? C.blood : C.accent;
    g.fillStyle(0x0a0c0e, 1); g.fillCircle(END_BTN.x + 150, END_BTN.y, 13);
    g.lineStyle(2.5, color, 1); g.beginPath(); g.arc(END_BTN.x + 150, END_BTN.y, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.strokePath();
    const label = String(Math.ceil(this.timeLeft));
    if (this.timerText.text !== label) this.timerText.setText(label);
    if (low !== this.lowTime) { this.lowTime = low; this.timerText.setColor(low ? HEX(C.wound) : HEX(C.accent)); }
    if (this.timeLeft <= 0 && !this.busy && !this.modalOpen) {
      this.timeLeft = null;
      this.setBanner('Время хода вышло', 'deny');
      this.cancelPress();
      void this.act({ type: 'EndTurn', player: 0 });
    }
  }

  // ---------------------------------------------------------------- input
  private setupInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => this.onDown(p, over));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', () => this.cancelPress());
  }

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (this.modalOpen) return;
    const top = over[0];
    let kind: Press['kind'] = 'none', uid: string | undefined;
    if (top instanceof HandCardView) { kind = 'hand'; uid = top.uid; }
    else if (top instanceof Token) { kind = 'token'; uid = top.uid; }
    else if (top) return; // buttons and overlays handle themselves
    this.press = { kind, uid, x: p.worldX, y: p.worldY, moved: false, long: false };
    if (kind !== 'none') {
      const press = this.press;
      press.timer = this.time.delayedCall(420, () => {
        if (this.press !== press || press.moved) return;
        press.long = true;
        this.openCardInspector(kind, uid!, false);
      });
    }
  }

  private onMove(p: Phaser.Input.Pointer) {
    const pr = this.press;
    if (!pr) return;
    if (this.modalOpen) { this.cancelPress(); return; }
    if (!pr.moved && Math.hypot(p.worldX - pr.x, p.worldY - pr.y) > 8) {
      pr.moved = true; pr.timer?.remove();
      if (pr.long) return;
      const idle = !this.busy && this.state.activePlayer === 0 && this.state.phase === 'playing' && !this.over;
      if (pr.kind === 'hand' && idle) this.startCardDrag(pr.uid!);
      else if (pr.kind === 'token' && idle) this.startTokenDrag(pr.uid!);
      else if (pr.kind !== 'none' && !idle) this.setBanner(this.state.activePlayer === 1 ? 'Сейчас ход Бота' : 'Подожди, идёт анимация');
    }
    if (!this.drag) return;
    if (this.drag.kind === 'card') this.moveCardDrag(p);
    else this.moveTokenDrag(p);
  }

  private onUp(p: Phaser.Input.Pointer) {
    const pr = this.press;
    if (this.modalOpen) { this.cancelPress(); return; }
    this.press = null;
    pr?.timer?.remove();
    if (!pr || pr.long) return;
    if (this.drag) {
      const d = this.drag; this.drag = null;
      if (d.kind === 'card') this.dropCard(d.uid, p.worldX, p.worldY - 60);
      else this.dropToken(d.uid, p.worldX, p.worldY - 30);
      return;
    }
    if (pr.moved) return;
    this.tap(pr, p.worldX, p.worldY);
  }

  cancelPress() {
    this.press?.timer?.remove(); this.press = null;
    if (this.drag) { this.drag = null; this.hover = {}; this.showGhost(null, null); this.layoutHand(true); this.sync(); }
  }

  private openCardInspector(kind: Press['kind'], uid: string, back: boolean) {
    if (this.drag) return;
    this.press?.timer?.remove();
    if (kind === 'hand') { const v = this.handViews.find(x => x.uid === uid); if (v) openInspector(this, v.cardId, undefined, undefined, back); }
    else { const t = this.tokens.get(uid); if (t) openInspector(this, t.cardId, locate(this.state, uid)?.unit ?? t.unit, undefined, back); }
    this.tut?.onInspect();
  }

  private startCardDrag(uid: string) {
    const v = this.handViews.find(x => x.uid === uid);
    if (!v) return;
    if (this.sel?.kind !== 'hand' || this.sel.uid !== uid) this.select({ kind: 'hand', uid });
    this.drag = { kind: 'card', uid };
    this.tweens.killTweensOf(v);
    v.setDepth(900);
    this.tweens.add({ targets: v, scale: 1.1, angle: 0, duration: ms(110) });
    this.paint();
  }
  private moveCardDrag(p: Phaser.Input.Pointer) {
    const v = this.handViews.find(x => x.uid === this.drag!.uid);
    if (!v) return;
    v.setPosition(Math.round(p.worldX), Math.round(p.worldY - 60));
    const def = card(v.cardId);
    const x = p.worldX, y = p.worldY - 60;
    const hover: Hover = {};
    if (p.worldY >= BURN_ZONE.y + 8 || contains(DISCARD, x, y)) hover.burn = true;
    else if (def.kind === 'creature') { const slot = slotAt(0, x, y); if (slot !== null) hover.slot = slot; }
    else if (NO_TARGET_SPELLS.has(def.id)) hover.board = y < 540 && y > 60;
    else { const tok = this.tokenAt(x, y); if (tok) hover.token = tok.uid; }
    if (hover.burn !== this.hover.burn || hover.slot !== this.hover.slot || hover.token !== this.hover.token || hover.board !== this.hover.board) {
      let reason: string | null = null;
      if (hover.burn) this.setBanner('Отпусти — карта сгорит, получишь 1 монету', 'hint');
      else if (hover.slot !== undefined) reason = explainAction(this.state, { type: 'PlayCreature', player: 0, card: v.uid, slot: hover.slot });
      else if (hover.token) reason = explainAction(this.state, { type: 'CastSpell', player: 0, card: v.uid, target: hover.token, ...(def.id === 'lik' ? { slot: this.firstLikSlot(v.uid, hover.token) } : {}) });
      this.hover = hover; this.paint();
      const landing = def.kind === 'creature' && hover.slot !== undefined && !reason;
      this.showGhost(landing ? def.id : null, hover.slot ?? null);
      // Over a free legal place the held card steps aside, so the preview in the slot is visible.
      this.tweens.add({ targets: v, scale: landing ? 0.62 : 1.1, alpha: landing ? 0.45 : 1, duration: ms(120), ease: 'Quad.Out' });
      if (reason) this.setBanner(reason, 'deny');
      else if (hover.slot !== undefined && def.kind === 'creature') this.setBanner(WORLDS[this.state.worlds[hover.slot >> 1]].native === def.class ? 'Отпусти — родной мир: +1 к атаке, пока стоит здесь' : 'Отпусти — карта встанет сюда', 'hint');
      else if (!hover.burn) this.setBanner(this.selBanner() ?? this.baseBanner());
    }
  }
  private dropCard(uid: string, x: number, y: number) {
    this.showGhost(null, null);
    const held = this.handViews.find(h => h.uid === uid);
    if (held) { this.tweens.killTweensOf(held); held.setAlpha(1); }
    const h = this.state.players[0].hand.find(c => c.uid === uid);
    const burn = this.hover.burn;
    this.hover = {};
    this.burnZone.setVisible(false);
    if (!h) { this.layoutHand(true); return; }
    const def = card(h.cardId);
    if (burn) { void this.act({ type: 'Burn', player: 0, card: uid }); return; }
    if (def.kind === 'creature') {
      const slot = slotAt(0, x, y);
      if (slot !== null) { void this.act({ type: 'PlayCreature', player: 0, card: uid, slot }); return; }
    } else if (NO_TARGET_SPELLS.has(def.id)) {
      if (y < 540 && y > 60) { void this.act({ type: 'CastSpell', player: 0, card: uid }); return; }
    } else {
      const tok = this.tokenAt(x, y);
      if (tok) { this.castOn(uid, def.id, tok.uid); return; }
    }
    sound.card();
    this.layoutHand(true); this.paint();
  }
  private castOn(uid: string, cardId: string, target: string) {
    if (cardId === 'lik') {
      const slot = this.firstLikSlot(uid, target);
      const reason = explainAction(this.state, { type: 'CastSpell', player: 0, card: uid, target, slot });
      if (slot < 0) { this.deny(reason && !reason.includes('мест') ? reason : 'Для копии нет подходящего места в твоих мирах.'); this.layoutHand(true); this.paint(); return; }
      this.select({ kind: 'lik', uid, target });
      return;
    }
    void this.act({ type: 'CastSpell', player: 0, card: uid, target });
  }
  private firstLikSlot(uid: string, target: string) {
    const a = legalActions(this.state).find(x => x.type === 'CastSpell' && x.card === uid && x.target === target && x.slot !== undefined);
    return a && a.type === 'CastSpell' ? a.slot! : -1;
  }

  /** Dragging your own creature moves it to another world (once per turn). */
  private startTokenDrag(uid: string) {
    const loc = locate(this.state, uid);
    if (!loc || loc.player !== 0) { this.setBanner('Двигать можно только своих существ'); return; }
    if (loc.unit.enteredTurn !== this.state.turn) { this.deny('Переставлять можно только тех, кого поставил в этом ходу'); return; }
    const t = this.tokens.get(uid)!;
    this.select({ kind: 'token', uid });
    this.drag = { kind: 'token', uid };
    t.setDepth(900);
    this.setBanner('Перетащи в золотое место — до конца хода можно переставлять', 'hint');
    this.paint();
  }
  private moveTokenDrag(p: Phaser.Input.Pointer) {
    const t = this.tokens.get(this.drag!.uid);
    if (!t) return;
    t.setPosition(Math.round(p.worldX - TOKEN_W / 2), Math.round(p.worldY - 30 - TOKEN_H / 2));
    const slot = slotAt(0, p.worldX, p.worldY - 30);
    if (slot !== (this.hover.slot ?? null)) {
      this.hover = slot === null ? {} : { slot };
      this.paint();
      const own = slot !== null && this.state.players[0].board[slot]?.uid === t.uid;
      const reason = slot !== null && !own ? explainAction(this.state, { type: 'Move', player: 0, unit: t.uid, slot }) : null;
      const landing = slot !== null && !own && !reason;
      this.showGhost(landing ? t.cardId : null, slot);
      t.setAlpha(landing ? 0.45 : 1);
      if (slot !== null && !own) {
        if (reason) this.setBanner(reason, 'deny'); else this.setBanner('Отпусти — существо встанет сюда', 'hint');
      }
    }
  }
  private dropToken(uid: string, x: number, y: number) {
    this.hover = {};
    this.showGhost(null, null);
    const slot = slotAt(0, x, y);
    const loc = locate(this.state, uid);
    if (slot !== null && loc && slot !== loc.slot) { void this.act({ type: 'Move', player: 0, unit: uid, slot }); return; }
    this.clearSel(false);
    this.sync();
  }

  tokenAt(x: number, y: number): Token | undefined {
    for (const t of this.tokens.values()) if (t.active && x >= t.x && x <= t.x + TOKEN_W && y >= t.y && y <= t.y + TOKEN_H) return t;
    return undefined;
  }

  private tap(pr: Press, x: number, y: number) {
    const s = this.state;
    const myTurn = s.phase === 'playing' && s.activePlayer === 0 && !this.over;
    // Double tap on any card opens it already turned to the description.
    // The first tap may already have lifted the card away, so the second one is matched by place and time.
    const lt = this.lastTap;
    if (lt.uid && this.time.now - lt.t < DOUBLE_TAP_MS && Math.hypot(x - lt.x, y - lt.y) < 36) {
      this.lastTap = { uid: '', kind: 'none', x: 0, y: 0, t: 0 };
      if (this.sel) this.clearSel();
      this.openCardInspector(lt.kind, lt.uid, true);
      return;
    }
    this.lastTap = { uid: pr.uid ?? '', kind: pr.kind, x, y, t: this.time.now };
    if (pr.kind === 'hand') {
      if (!myTurn || this.busy) { this.setBanner(myTurn ? 'Подожди, идёт анимация' : 'Сейчас ход Бота. Двойное касание — описание карты'); return; }
      if (this.sel?.kind === 'hand' && this.sel.uid === pr.uid) this.clearSel();
      else this.select({ kind: 'hand', uid: pr.uid! });
      return;
    }
    if (pr.kind === 'token') { this.tapToken(pr.uid!, myTurn); return; }
    for (const p of [0, 1] as PlayerId[]) for (let w = 0; w < 4; w++) {
      if (contains(worldIconRect(p, w), x, y)) {
        const wd = WORLDS[s.worlds[w]];
        this.setBanner(wd.native ? `${wd.name}: одна карта — любая, пара — только с картой класса ${CLASS_NAMES[wd.native]}` : 'Омут: одна карта — любая, пара — только одного класса', 'hint');
        this.tut?.onWorldIcon();
        return;
      }
    }
    if (contains(DECK, x, y)) { this.setBanner(`Общая колода: ${s.deck.length} карт. Каждый ход берёшь из неё одну.${s.fatigue ? ' Колода кончалась: −1 ♥ каждый ход' : ''}`, 'hint'); return; }
    if (contains(DISCARD, x, y)) { this.setBanner(`Сброс: ${s.discard.length} карт — сыгранные чары, сожжённые и погибшие. Когда колода опустеет, сброс замешается в неё`, 'hint'); return; }
    if (!myTurn || this.busy) { if (!this.busy) this.setBanner('Сейчас ход Бота'); return; }
    const sel = this.sel;
    const slot = slotAt(0, x, y);
    if (sel?.kind === 'hand') {
      const h = s.players[0].hand.find(c => c.uid === sel.uid)!;
      const def = card(h.cardId);
      if (def.kind === 'creature' && slot !== null) { void this.act({ type: 'PlayCreature', player: 0, card: sel.uid, slot }); return; }
      if (def.kind === 'spell' && NO_TARGET_SPELLS.has(def.id) && y > 60 && y < 540) { void this.act({ type: 'CastSpell', player: 0, card: sel.uid }); return; }
    }
    if (sel?.kind === 'lik' && slot !== null) { void this.act({ type: 'CastSpell', player: 0, card: sel.uid, target: sel.target, slot }); return; }
    if (sel?.kind === 'token' && slot !== null) { void this.act({ type: 'Move', player: 0, unit: sel.uid, slot }); return; }
    if (sel) { this.clearSel(); return; }
    if (slot !== null) {
      const dmg = this.threats().get(slot >> 1);
      this.setBanner(dmg ? `Мир открыт: в свой ход Бот ударит через него на ${dmg}. Поставь сюда карту из руки` : 'Выбери карту в руке, чтобы поставить её сюда', dmg ? 'deny' : 'info');
      return;
    }
    if (contains({ x: 0, y: 0, w: 284, h: 57 }, x, y) || contains({ x: 0, y: 774, w: 220, h: 70 }, x, y)) {
      const p: PlayerId = y < 100 ? 1 : 0, pl = s.players[p];
      this.setBanner(`${p ? 'Бот' : 'Ты'}: ${pl.hp} жизней, ${pl.coins} монет, ${pl.hand.length} карт в руке`, 'hint');
    }
  }

  private tapToken(uid: string, myTurn: boolean) {
    const s = this.state, loc = locate(s, uid);
    if (!loc) return;
    if (!myTurn || this.busy) { this.setBanner(this.busy ? 'Подожди, идёт анимация' : this.tokenInfo(uid)); return; }
    const sel = this.sel;
    if (sel?.kind === 'hand') {
      const h = s.players[0].hand.find(c => c.uid === sel.uid)!;
      const sd = card(h.cardId);
      if (sd.kind === 'spell' && !NO_TARGET_SPELLS.has(sd.id)) { this.castOn(sel.uid, sd.id, uid); return; }
      if (sd.kind === 'creature' && loc.player === 0) { this.deny('Место занято'); return; }
    }
    if (sel?.kind === 'token' && sel.uid === uid) { this.clearSel(); return; }
    if (loc.player === 0) {
      this.select({ kind: 'token', uid });
      this.setBanner(this.tokenInfo(uid));
      this.openTokenMenu(uid);
      return;
    }
    this.setBanner(this.tokenInfo(uid));
  }

  // ---------------------------------------------------------------- menus
  private recorded = false;
  /** Saves the match the moment the state changes; when it is over, counts the result exactly once. */
  persist() {
    if (this.tut) return;
    if (this.state.phase !== 'over') { saveMatch(this.state); return; }
    clearMatch();
    if (this.recorded) return;
    this.recorded = true;
    if (this.state.winner === 0) settings.wins++; else settings.losses++;
    saveSettings();
  }
  askConcede() {
    if (this.over) { this.leave('Menu'); return; }
    this.cancelPress();
    confirmConcede(this, () => {
      if (this.over) return;
      const t = apply(this.state, { type: 'Concede', player: 0 });
      this.prev = this.state; this.state = t.state;
      this.persist();
      this.over = true; this.timeLeft = null;
      this.clearSel(false); this.paint(); this.refreshButtons();
      resultOverlay(this);
    });
  }
  openPause() { if (!this.over && !this.leaving) { this.cancelPress(); pauseOverlay(this); } }
  /** A history entry that turns the browser/Android Back gesture into «Пауза» instead of leaving the match. */
  armBack() {
    if (this.over || this.leaving || this.backArmed) return;
    this.backArmed = true;
    overlays.push(() => {
      this.backArmed = false;
      // Let the history traversal settle before the pause registers its own entry.
      window.setTimeout(() => { if (this.sys.isActive() && !this.over && !this.leaving) this.openPause(); }, 60);
    });
  }
  /** True while a real window (inspector, pause, dialog) covers the board — the Back guard does not count. */
  get modalOpen() { return overlays.size > (this.backArmed ? 1 : 0); }
  /** Freezes the bot and all animations while a menu covers the board. */
  freeze(on: boolean) {
    this.time.paused = on;
    if (on) this.tweens.pauseAll(); else this.tweens.resumeAll();
  }
  leave(scene: 'Menu' | 'Match', data: object = {}) {
    if (this.leaving) return;
    this.leaving = true;
    overlays.clear();
    this.freeze(false);
    this.cameras.main.resetFX();
    this.cameras.main.fadeOut(300, 7, 10, 13);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
  }
}

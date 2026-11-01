import Phaser from 'phaser';
import { chooseAction } from '../../engine/bot';
import { apply, assertGameState, createGame } from '../../engine/rules';
import { shuffle } from '../../engine/rng';
import type { Action, GameEvent, GameState, HandCard } from '../../engine/types';
import { C, H, panel, saveSettings, settings, strokeCut, text, W } from '../core';
import { Button } from '../ui/Button';
import { AVATAR, worldIconRect } from './geometry';
import type { MatchScene } from './MatchScene';

/** Fixed deal: you go first with a Druzhinnik in hand; the bot answers with a scripted turn. */
export function tutorialState(): GameState {
  let s = createGame('omut-tutorial', { startingHp: 25 });
  const pool: HandCard[] = [...s.deck, ...s.players[0].hand, ...s.players[1].hand];
  const take = (id: string) => pool.splice(pool.findIndex(c => c.cardId === id), 1)[0];
  s.worlds = ['yav', 'nav', 'chasha', 'puchina'];
  s.players[0].hand = ['druzh', 'opol', 'kot', 'fire', 'luch'].map(take);
  s.players[1].hand = ['bes', 'kiki', 'mertv', 'zhaba', 'chert'].map(take);
  const draws = ['mertv', 'volk', 'upyr'].map(take); // your turn 1, bot turn 1, your turn 2
  const rest = shuffle(pool, 7).items;
  s.deck = [...rest, ...draws.reverse()];
  s.firstPlayer = 0; s.activePlayer = 0;
  s.players[0].coins = 3; s.players[0].stats.earned = 3;
  s.players[1].coins = 4; s.players[1].stats.earned = 4;
  s = apply(s, { type: 'Mulligan', player: 0, cards: [] }).state;
  s = apply(s, { type: 'Mulligan', player: 1, cards: [] }).state;
  assertGameState(s);
  return s;
}

type Step = 'hand' | 'icon' | 'end' | 'bot' | 'hit' | 'attack' | 'inspect' | 'free';

export class Tutorial {
  step: Step = 'hand';
  message: string | null = null;
  private layer?: Phaser.GameObjects.Container;
  private advanceTo: Step | null = null;
  private druzhWorld = 0;
  private druzhUid = '';
  private heroHit = false;

  constructor(private scene: MatchScene) {}

  async begin() { this.show('hand'); }

  /** Blocks everything the current step does not teach. */
  gate(a: Action): string | null {
    switch (this.step) {
      case 'hand': {
        if (a.type !== 'PlayCreature') return 'Сейчас — перетащи Дружинника в любой мир.';
        const h = this.scene.state.players[0].hand.find(c => c.uid === a.card);
        return h?.cardId === 'druzh' ? null : 'Сейчас нужен Дружинник: карта со щитом в руке.';
      }
      case 'icon': return 'Прочитай подсказку и нажми «Дальше».';
      case 'end': return null; // free to keep playing; the step moves on when the turn ends
      case 'hit': return 'Нажми «Дальше».';
      case 'attack': return null;
      case 'inspect': return null;
      default: return null;
    }
  }

  onEvent(e: GameEvent) {
    if (this.step === 'hand' && e.type === 'CardPlayed' && e.player === 0) { this.druzhWorld = e.slot >> 1; this.druzhUid = e.unit.uid; this.advanceTo = 'icon'; }
    if (this.step === 'bot' && e.type === 'PlayerDamaged' && e.player === 0) this.heroHit = true;
    if (this.step === 'end' && e.type === 'TurnStarted' && e.player === 1) { this.hide(); this.step = 'bot'; }
    if (this.step === 'attack' && e.type === 'AttackDeclared' && e.player === 0) this.advanceTo = 'inspect';
  }
  afterQueue() {
    // Hints wait for the player's own turn, never pop up while the bot is acting.
    if (this.advanceTo && this.scene.state.activePlayer === 0 && !this.scene.botRunning) { const s = this.advanceTo; this.advanceTo = null; this.show(s); }
  }
  onBotTurnEnd() { if (this.step === 'bot') this.show('hit'); else this.afterQueue(); }
  onWorldIcon() { if (this.step === 'icon') this.show('end'); }
  onInspect() { if (this.step === 'inspect') this.finish(); }

  /** Scripted first bot turn: Kikimora opposite the Druzhinnik, an Imp into an open world; at the end of the turn the Imp hits you. */
  botAction(s: GameState): Action | undefined {
    if (this.step !== 'bot') return chooseAction(s, 'easy') ?? undefined;
    const me = s.players[1];
    const find = (id: string) => me.hand.find(h => h.cardId === id);
    const kiki = find('kiki'), bes = find('bes');
    // The Druzhinnik may have been rearranged before the turn ended: read where it stands now.
    const dw = s.players[0].board.findIndex(u => u?.uid === this.druzhUid);
    if (dw >= 0) this.druzhWorld = dw >> 1;
    // The Imp goes where your side is empty, so it can show a strike through an open world.
    const mine = s.players[0].board;
    const openWorld = [1, 2, 3].map(d => (this.druzhWorld + d) % 4).find(w => !mine[w * 2] && !mine[w * 2 + 1]) ?? (this.druzhWorld + 1) % 4;
    if (kiki) return { type: 'PlayCreature', player: 1, card: kiki.uid, slot: this.druzhWorld * 2 };
    if (bes) return { type: 'PlayCreature', player: 1, card: bes.uid, slot: openWorld * 2 };
    return { type: 'EndTurn', player: 1 };
  }

  private show(step: Step) {
    this.step = step;
    this.hide();
    const sc = this.scene;
    const ix = worldIconRect(0, this.druzhWorld);
    const spec: Record<Exclude<Step, 'bot' | 'free'>, { text: string; hole: [number, number, number, number]; next?: string }> = {
      hand: { text: 'Это твоя рука. Монета в углу карты — её цена. Перетащи Дружинника в любой мир.', hole: [0, 342, W, 432] },
      icon: { text: 'Значок мира — его родной класс. Одну карту можно ставить в любой мир. Пару — только если одна из карт родного класса.', hole: [ix.x - 8, ix.y - 8, ix.w + 16, ix.h + 14], next: 'Дальше' },
      end: { text: 'Пока ход не закончен, только что поставленные карты можно переставлять. Можешь поставить ещё. Потом нажми «Конец хода» — в конце хода существа бьют сами.', hole: [0, 342, W, 502] },
      hit: { text: this.heroHit ? 'Бесёнок ударил в пустой мир напротив — это урон по твоим жизням. Закрывай пустые миры! Красная метка «−N» на мире предупреждает об угрозе.' : 'Бесёнок встал напротив твоей карты: удар принял на себя твой мир, а не жизни. Пустые миры напротив врага — опасны, следи за красными метками «−N».', hole: [AVATAR[0].x - 6, AVATAR[0].y - 8, 130, 60], next: 'Дальше' },
      attack: { text: 'Пунктир показывает, кого твои существа ударят в конце хода и сколько снимут. Ставь карты и жми «Конец хода».', hole: [0, 0, W, H] },
      inspect: { text: 'Двойное касание карты — её описание. Дальше сам!', hole: [0, 0, W, H], next: 'Понятно' },
    };
    if (step === 'bot' || step === 'free') return;
    const sp = spec[step];
    // The strip in the middle holds one line: a short version of the hint.
    const short: Record<string, string> = { hand: 'Перетащи Дружинника в любой мир', icon: 'Значок мира — его родной класс',
      end: 'Ставь карты и жми «Конец хода»', hit: 'Закрывай пустые миры', attack: 'Смотри на пунктир и жми «Конец хода»', inspect: 'Двойное касание — описание карты' };
    this.message = short[step] ?? null;
    sc.setBanner(this.message ?? '', 'hint');
    const [hx, hy, hw, hh] = sp.hole;
    const root = sc.add.container(0, 0).setDepth(4400);
    const dark = 0.62;
    const block = (x: number, y: number, w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      root.add(sc.add.rectangle(x, y, w, h, 0x000000, dark).setOrigin(0).setInteractive());
    };
    block(0, 0, W, hy); block(0, hy + hh, W, H - hy - hh); block(0, hy, hx, hh); block(hx + hw, hy, W - hx - hw, hh);
    const frame = sc.add.graphics();
    strokeCut(frame, hx, hy, hw, hh, C.gold, 2, 5);
    root.add(frame);
    sc.tweens.add({ targets: frame, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    const body = text(sc, 36, 0, sp.text, { size: 14, font: 'text', wrap: 270, line: 3 });
    const panelH = Math.ceil(body.height) + 30 + (sp.next ? 54 : 0);
    // Tall spotlights keep the hint at the very top so it never covers the button it points to.
    const py = hh > 500 ? (hy < 60 ? 330 : 62) : hy > 300 ? Math.max(62, hy - panelH - 14) : Math.min(H - panelH - 10, hy + hh + 14);
    const g = sc.add.graphics();
    panel(g, 20, py, 350, panelH, C.panel, C.gold, { cut: 6, shadow: true });
    body.setY(py + 15);
    root.add([g, body]);
    // Always a way out.
    const skip = new Button(sc, 314, py + 8, '', () => this.finish(), { w: 44, h: 32, kind: 'ghost' });
    skip.add(text(sc, 22, 16, '✕', { size: 16, font: 'text', color: C.muted }).setOrigin(0.5));
    root.add(skip);
    if (sp.next) {
      root.add(new Button(sc, 225, py + panelH - 56, sp.next, () => {
        if (step === 'icon') this.show('end');
        else if (step === 'hit') this.show('attack');
        else if (step === 'inspect') this.finish();
      }, { w: 130, h: 44, size: 16, kind: 'main' }));
    }
    this.layer = root;
    sc.paint();
    sc.refreshButtons();
  }
  private hide() { this.layer?.destroy(); this.layer = undefined; }
  private finish() {
    this.hide();
    this.advanceTo = null;
    this.step = 'free';
    this.message = null;
    settings.tutorialDone = true; saveSettings();
    this.scene.setBanner('Обучение пройдено. Доведи партию до конца!', 'hint');
  }
}

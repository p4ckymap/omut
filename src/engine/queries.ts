import { card, CLASS_NAMES, WORLDS } from './cards';
import type { Action, ClassId, Creature, GameState, PlayerId, WorldId } from './types';

export const opponent = (p: PlayerId): PlayerId => p === 0 ? 1 : 0;
export function locate(state: GameState, uid: string): { player: PlayerId; slot: number; unit: Creature } | undefined {
  for (const player of [0, 1] as const) {
    const slot = state.players[player].board.findIndex(u => u?.uid === uid);
    if (slot >= 0) return { player, slot, unit: state.players[player].board[slot]! };
  }
}
/** One creature may stand in any world. A pair needs at least one creature of the world's native class;
 * in the Omut (no native class) a pair must share one class. */
export function pairAllowed(world: WorldId, a: ClassId, b: ClassId): boolean {
  const native = WORLDS[world].native;
  return native ? a === native || b === native : a === b;
}
export function placementReason(state: GameState, player: PlayerId, classId: ClassId, slot: number, ignore?: string): string | null {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 8) return 'Выбери место в своём мире.';
  const board = state.players[player].board;
  if (board[slot] && board[slot]!.uid !== ignore) return 'Место занято.';
  const neighbor = board[slot ^ 1];
  if (!neighbor || neighbor.uid === ignore) return null;
  const world = state.worlds[Math.floor(slot / 2)];
  const other = card(neighbor.cardId).class!;
  if (pairAllowed(world, classId, other)) return null;
  if (world === 'omut') return 'В Омуте пара может быть только одного класса.';
  const native = CLASS_NAMES[WORLDS[world].native!];
  return `В мире ${WORLDS[world].name} пара возможна, только если одна из карт — ${native}. Одна карта может стоять где угодно.`;
}
export function hasPriority(unit: Creature): boolean {
  return !!card(unit.cardId).abilities.priority || unit.temporaryPriority;
}
export function priorityBlocks(state: GameState, player: PlayerId, slot: number): boolean {
  const board = state.players[player].board;
  return !hasPriority(board[slot]!) && !!board[slot ^ 1] && hasPriority(board[slot ^ 1]!);
}
export function canAttack(state: GameState, unit: Creature): boolean {
  return unit.attack > 0 && unit.attackedTurn !== state.turn &&
    (unit.enteredTurn !== state.turn || !!card(unit.cardId).abilities.rush);
}
export function income(personalTurn: number): number { return Math.min(5, 2 + Math.floor((personalTurn - 1) / 2)); }
export function upgradeCost(unit: Creature): number { return unit.cardId === 'svyat' ? 1 : 2; }

/** Who a creature hits when the turn ends: a Priority card opposite, else the card straight opposite,
 * else the other card in that world, else the enemy hero. Ranged shoots the best killable target anywhere. */
export function autoTarget(state: GameState, uid: string): string | 'hero' | null {
  const from = locate(state, uid);
  if (!from || !canAttack(state, from.unit)) return null;
  const enemy = opponent(from.player), board = state.players[enemy].board;
  const world = Math.floor(from.slot / 2);
  const opposite = [world * 2 + (from.slot & 1), world * 2 + ((from.slot & 1) ^ 1)].filter(s => board[s]);
  // A finishing blow through an empty world always wins.
  if (!opposite.length && from.unit.attack >= state.players[enemy].hp) return 'hero';
  if (card(from.unit.cardId).abilities.ranged) {
    let best: { uid: string; reward: number } | null = null;
    for (const u of board) {
      if (!u) continue;
      const dmg = Math.max(0, from.unit.attack - (card(u.cardId).abilities.shield ?? 0));
      const kills = dmg >= u.hp && !(card(u.cardId).abilities.steadfast && !u.steadfastUsed);
      const reward = card(u.cardId).reward;
      if (kills && reward > 0 && (!best || reward > best.reward)) best = { uid: u.uid, reward };
    }
    if (best) return best.uid;
  }
  if (!opposite.length) return 'hero';
  const prio = opposite.filter(s => hasPriority(board[s]!));
  return board[(prio.length ? prio : opposite)[0]]!.uid;
}
/** The strikes that would happen if the active player ended the turn now (board order, before any deaths). */
export function plannedAttacks(state: GameState, player: PlayerId): { attacker: string; target: string | 'hero' }[] {
  const out: { attacker: string; target: string | 'hero' }[] = [];
  for (const u of state.players[player].board) if (u) { const t = autoTarget(state, u.uid); if (t) out.push({ attacker: u.uid, target: t }); }
  return out;
}

export function explainAction(state: GameState, action: Action): string | null {
  if (state.phase === 'over') return 'Партия завершена.';
  if (action.player !== 0 && action.player !== 1) return 'Неизвестный игрок.';
  if (action.type === 'Concede') return null;
  if (action.player !== state.activePlayer) return 'Сейчас ход соперника.';
  const p = state.players[action.player];
  if (state.phase === 'mulligan') {
    if (action.type !== 'Mulligan') return 'Сначала заверши замену стартовой руки.';
    if (state.mulliganDone[action.player]) return 'Стартовую руку можно заменить только один раз.';
    if (!Array.isArray(action.cards) || new Set(action.cards).size !== action.cards.length ||
      action.cards.some(id => !p.hand.some(c => c.uid === id))) return 'Выбери разные карты из своей руки.';
    return null;
  }
  if (action.type === 'Mulligan') return 'Замена стартовой руки уже завершена.';
  if (action.type === 'EndTurn') return null;
  const lack = (cost: number) => p.coins < cost ? `Не хватает монет: нужно ${cost}, у тебя ${p.coins}.` : null;
  if (action.type === 'Upgrade') {
    const target = locate(state, action.target);
    if (!target || target.player !== action.player) return 'Выбери своё существо.';
    if (target.unit.upgradedTurn === state.turn) return 'Это существо уже закалено в этом ходу.';
    if (target.unit.upgrades >= 3) return 'Существо можно закалить не больше трёх раз за партию.';
    return lack(upgradeCost(target.unit));
  }
  if (action.type === 'Move') {
    const from = locate(state, action.unit);
    if (!from || from.player !== action.player) return 'Перемещать можно только своих существ.';
    if (from.unit.enteredTurn !== state.turn) return 'Переставлять можно только тех, кого поставил в этом ходу.';
    if (from.slot === action.slot) return 'Существо уже стоит здесь.';
    return placementReason(state, action.player, card(from.unit.cardId).class!, action.slot, action.unit);
  }
  if (action.type === 'Attack') {
    if (state.autoAttack) return 'Существа бьют сами в конце хода.';
    const from = locate(state, action.attacker);
    if (!from || from.player !== action.player) return 'Выбери своё существо.';
    if (from.unit.attack === 0) return 'Существо с нулевой атакой не атакует.';
    if (from.unit.attackedTurn === state.turn) return 'Это существо уже атаковало в этом ходу.';
    if (!canAttack(state, from.unit)) return 'Существо ждёт следующего хода: у него нет Рывка.';
    const enemy = opponent(action.player);
    const world = Math.floor(from.slot / 2);
    if (action.target === 'hero') {
      return state.players[enemy].board.slice(world * 2, world * 2 + 2).some(Boolean)
        ? 'По жизням можно бить только через пустой мир напротив.' : null;
    }
    const target = locate(state, action.target);
    if (!target || target.player !== enemy) return 'Выбери существо соперника.';
    if (card(from.unit.cardId).abilities.ranged) return null;
    if (Math.floor(target.slot / 2) !== world) return 'Атаковать можно только мир напротив.';
    if (priorityBlocks(state, enemy, target.slot)) return 'Сначала атакуй существо с Приоритетом в этом мире.';
    return null;
  }
  if (action.type !== 'PlayCreature' && action.type !== 'CastSpell' && action.type !== 'Burn') return 'Неизвестное действие.';
  const hand = p.hand.find(c => c.uid === action.card);
  if (!hand) return 'Этой карты нет в твоей руке.';
  if (action.type === 'Burn') return p.burnsThisTurn >= 2 ? 'За ход можно сжечь не больше двух карт.' : null;
  const def = card(hand.cardId);
  if (lack(def.cost)) return lack(def.cost);
  if (action.type === 'PlayCreature') {
    if (def.kind !== 'creature') return 'Это чары, а не существо.';
    return placementReason(state, action.player, def.class!, action.slot);
  }
  if (def.kind !== 'spell') return 'Эта карта — существо, а не чары.';
  if (def.id === 'krov' || def.id === 'koshel') {
    return action.target !== undefined || action.slot !== undefined ? 'Эти чары играются без цели.' : null;
  }
  const target = action.target ? locate(state, action.target) : undefined;
  if (!target) return 'Выбери существо на поле.';
  if (def.id === 'istoch' || def.id === 'znamya') {
    if (target.player !== action.player) return 'Выбери своё существо.';
  } else if (def.id === 'fire' || def.id === 'poglot') {
    if (target.player === action.player) return 'Выбери существо соперника.';
    if (def.id === 'fire' && priorityBlocks(state, target.player, target.slot)) return 'Сначала выбери существо с Приоритетом в этом мире.';
  }
  if ((def.id === 'poglot' || def.id === 'lik') && card(target.unit.cardId).rarity === 'legendary') return 'Эти чары не действуют на легендарных существ.';
  if (def.id === 'lik') return placementReason(state, action.player, card(target.unit.cardId).class!, action.slot ?? -1);
  return action.slot !== undefined ? 'Для этих чар место не выбирается.' : null;
}

export function legalActions(state: GameState): Action[] {
  if (state.phase === 'over') return [];
  const player = state.activePlayer, p = state.players[player];
  const result: Action[] = [];
  const add = (a: Action) => { if (!explainAction(state, a)) result.push(a); };
  if (state.phase === 'mulligan') {
    for (let mask = 0; mask < 1 << p.hand.length; mask++)
      add({ type: 'Mulligan', player, cards: p.hand.filter((_, i) => mask & (1 << i)).map(c => c.uid) });
    result.push({ type: 'Concede', player });
    return result;
  }
  for (const h of p.hand) {
    add({ type: 'Burn', player, card: h.uid });
    const def = card(h.cardId);
    if (def.cost > p.coins) continue;
    if (def.kind === 'creature') {
      for (let slot = 0; slot < 8; slot++) add({ type: 'PlayCreature', player, card: h.uid, slot });
    } else if (def.id === 'krov' || def.id === 'koshel') add({ type: 'CastSpell', player, card: h.uid });
    else for (const other of state.players) for (const unit of other.board) if (unit) {
      if (def.id === 'lik') for (let slot = 0; slot < 8; slot++) add({ type: 'CastSpell', player, card: h.uid, target: unit.uid, slot });
      else add({ type: 'CastSpell', player, card: h.uid, target: unit.uid });
    }
  }
  for (const unit of p.board) if (unit) {
    add({ type: 'Upgrade', player, target: unit.uid });
    // Creatures placed this turn may be rearranged freely until the turn ends.
    if (unit.enteredTurn === state.turn) for (let slot = 0; slot < 8; slot++) add({ type: 'Move', player, unit: unit.uid, slot });
    if (state.autoAttack || !canAttack(state, unit)) continue;
    add({ type: 'Attack', player, attacker: unit.uid, target: 'hero' });
    for (const enemy of state.players[opponent(player)].board) if (enemy)
      add({ type: 'Attack', player, attacker: unit.uid, target: enemy.uid });
  }
  result.push({ type: 'EndTurn', player });
  result.push({ type: 'Concede', player });
  return result;
}

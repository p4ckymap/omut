import { CARDS, card, WORLDS } from './cards';
import { attack, coins, creature, damage, drain, draw, gameOver, heal, remove, settleHome, startTurn, surface } from './effects';
import { autoTarget, explainAction, locate, opponent, upgradeCost } from './queries';
import { random, seedFrom, shuffle } from './rng';
import type { Action, GameEvent, GameOptions, GameState, HandCard, PlayerId, PlayerState, Transition, WorldId } from './types';
export { legalActions, explainAction, pairAllowed, placementReason, income, autoTarget, plannedAttacks } from './queries';

export function createGame(seed: string | number, opts: GameOptions = {}): GameState {
  const startingHp = opts.startingHp ?? 25;
  if (!Number.isInteger(startingHp) || startingHp < 10 || startingHp > 40 || startingHp % 5 !== 0)
    throw new Error('Стартовые жизни: от 10 до 40 с шагом 5.');
  const initialSeed = seedFrom(seed), toss = random(initialSeed);
  const firstPlayer: PlayerId = toss.value < 0.5 ? 0 : 1;
  const worlds = shuffle(Object.keys(WORLDS) as WorldId[], toss.seed);
  let nextUid = 1;
  const deck: HandCard[] = CARDS.flatMap(c => Array.from({ length: c.copies }, () => ({ uid: `c${nextUid++}`, cardId: c.id })));
  const shuffled = shuffle(deck, worlds.seed);
  const player = (id: PlayerId): PlayerState => ({ hp: startingHp, coins: id === firstPlayer ? 3 : 4, turns: 0,
    burnsThisTurn: 0, hand: [], board: Array(8).fill(null),
    stats: { kills: 0, earned: id === firstPlayer ? 3 : 4, spent: 0, burned: 0 } });
  const state: GameState = { version: 1, seed: initialSeed, rng: shuffled.seed, nextUid, steps: 0,
    worlds: worlds.items.slice(0, 4), players: [player(0), player(1)], deck: shuffled.items, discard: [],
    startingHp, firstPlayer, activePlayer: firstPlayer, phase: 'mulligan', mulliganDone: [false, false],
    turn: 0, fatigue: false, winner: null, autoAttack: opts.autoAttack ?? true };
  for (let i = 0; i < 5; i++) for (const p of [0, 1] as const) state.players[p].hand.push(state.deck.pop()!);
  return state;
}

function takeHand(s: GameState, player: PlayerId, uid: string): HandCard {
  const hand = s.players[player].hand;
  return hand.splice(hand.findIndex(c => c.uid === uid), 1)[0];
}
function cast(s: GameState, e: GameEvent[], a: Extract<Action, { type: 'CastSpell' }>) {
  const h = takeHand(s, a.player, a.card), def = card(h.cardId);
  coins(s, e, a.player, -def.cost, 'spell');
  s.discard.push(h);
  e.push({ type: 'SpellCast', player: a.player, card: { ...h }, target: a.target, slot: a.slot });
  switch (def.id) {
    case 'fire': damage(s, e, a.target!, 3, h.uid, a.player, 'spell'); break;
    case 'krov': drain(s, e, a.player, 2); break;
    case 'istoch': {
      heal(s, e, a.target!, 4);
      locate(s, a.target!)!.unit.poison = 0;
      e.push({ type: 'StatusApplied', target: a.target!, status: 'poison', value: 0 });
      break;
    }
    case 'znamya': {
      locate(s, a.target!)!.unit.temporaryPriority = true;
      e.push({ type: 'StatusApplied', target: a.target!, status: 'temporary-priority', value: 1 });
      break;
    }
    case 'koshel': draw(s, e, a.player); coins(s, e, a.player, 1, 'purse'); break;
    case 'poglot': remove(s, e, a.target!, a.player, 'destroy'); break;
    case 'lik': {
      const target = locate(s, a.target!)!.unit;
      const unit = creature({ uid: `c${s.nextUid++}`, cardId: target.cardId }, s.turn);
      s.players[a.player].board[a.slot!] = unit;
      e.push({ type: 'CardPlayed', player: a.player, slot: a.slot!, unit: { ...unit } });
      settleHome(s, e, a.player, a.slot!);
      surface(s, e, a.player, unit);
      break;
    }
    default: throw new Error(`Unimplemented spell: ${def.id}`);
  }
}

export function apply(state: GameState, action: Action): Transition {
  const reason = explainAction(state, action);
  if (reason) return { state, events: [{ type: 'ActionRejected', reason }], accepted: false };
  const s = structuredClone(state), events: GameEvent[] = [];
  s.steps++;
  const p = s.players[action.player];
  switch (action.type) {
    case 'Concede': gameOver(s, events, opponent(action.player), 'concede'); break;
    case 'Mulligan': {
      const returned = p.hand.filter(c => action.cards.includes(c.uid));
      p.hand = p.hand.filter(c => !action.cards.includes(c.uid));
      for (let i = 0; i < returned.length; i++) draw(s, events, action.player);
      const shuffled = shuffle([...s.deck, ...returned], s.rng); s.deck = shuffled.items; s.rng = shuffled.seed;
      s.mulliganDone[action.player] = true;
      events.push({ type: 'MulliganDone', player: action.player, replaced: returned.length });
      if (s.mulliganDone.every(Boolean)) {
        s.phase = 'playing'; s.activePlayer = s.firstPlayer; startTurn(s, events);
      } else s.activePlayer = opponent(action.player);
      break;
    }
    case 'PlayCreature': {
      const h = takeHand(s, action.player, action.card);
      coins(s, events, action.player, -card(h.cardId).cost, 'play');
      const unit = creature(h, s.turn); p.board[action.slot] = unit;
      events.push({ type: 'CardPlayed', player: action.player, slot: action.slot, unit: { ...unit } });
      settleHome(s, events, action.player, action.slot);
      surface(s, events, action.player, unit);
      break;
    }
    case 'CastSpell': cast(s, events, action); break;
    case 'Attack': attack(s, events, action.attacker, action.target); break;
    case 'Upgrade': {
      const unit = locate(s, action.target)!.unit, cost = upgradeCost(unit);
      coins(s, events, action.player, -cost, 'upgrade');
      unit.attack++; unit.upgrades++; unit.upgradedTurn = s.turn;
      events.push({ type: 'Upgraded', target: unit.uid, attack: unit.attack, upgrades: unit.upgrades, cost });
      break;
    }
    case 'Burn': {
      const h = takeHand(s, action.player, action.card); s.discard.push(h); p.burnsThisTurn++; p.stats.burned++;
      events.push({ type: 'CardBurned', player: action.player, card: { ...h } });
      coins(s, events, action.player, 1, 'burn');
      break;
    }
    case 'Move': {
      const from = locate(s, action.unit)!;
      p.board[from.slot] = null; p.board[action.slot] = from.unit; from.unit.movedTurn = s.turn;
      events.push({ type: 'Moved', player: action.player, unit: action.unit, from: from.slot, to: action.slot });
      settleHome(s, events, action.player, action.slot);
      break;
    }
    case 'EndTurn': {
      if (s.autoAttack) combat(s, events, action.player);
      if (s.phase === 'over') break;
      s.activePlayer = opponent(action.player); startTurn(s, events); break;
    }
  }
  return { state: s, events, accepted: true };
}

/** End-of-turn combat: every ready creature strikes once, left to right, top to bottom. */
function combat(s: GameState, e: GameEvent[], player: PlayerId) {
  const order = s.players[player].board.map(u => u?.uid).filter((x): x is string => !!x);
  const ready = order.filter(uid => autoTarget(s, uid) !== null).length;
  if (!ready) return;
  e.push({ type: 'CombatStarted', player, attacks: ready });
  for (const uid of order) {
    if (s.phase === 'over') return;
    const target = autoTarget(s, uid); // re-evaluated: earlier strikes may have changed the board
    if (target) attack(s, e, uid, target);
  }
}

export interface PlannedStrike { attacker: string; target: string | 'hero'; damage: number; heroDamage: number }
/** Exactly what end-of-turn combat would do right now, resolved on a copy (targets re-picked after every death). */
export function previewCombat(state: GameState, player: PlayerId): PlannedStrike[] {
  if (state.phase !== 'playing') return [];
  const s = structuredClone(state), e: GameEvent[] = [];
  combat(s, e, player);
  const out: PlannedStrike[] = [];
  for (const ev of e) {
    if (ev.type === 'AttackDeclared') out.push({ attacker: ev.attacker, target: ev.target, damage: 0, heroDamage: 0 });
    const cur = out[out.length - 1];
    if (!cur) continue;
    if (ev.type === 'DamageDealt' && ev.cause === 'attack' && ev.target === cur.target) cur.damage += ev.amount;
    // Everything the enemy hero loses during this strike: the blow itself, Ram overflow, Blood.
    if (ev.type === 'PlayerDamaged' && ev.player !== player) { cur.heroDamage += ev.amount; if (cur.target === 'hero' && ev.cause === 'attack') cur.damage += ev.amount; }
    if (ev.type === 'CardDied' && ev.cause === 'devour' && ev.unit.uid === cur.target) cur.damage = ev.unit.hp;
  }
  return out;
}

/** The attack preview uses the real resolver, so shields/deathstrikes cannot drift. */
export function previewAttack(state: GameState, action: Extract<Action, { type: 'Attack' }>): Transition {
  return apply(state, action);
}

export function assertGameState(s: GameState): void {
  const fail = (message: string): never => { throw new Error(`State invariant: ${message}`); };
  if (s.worlds.length !== 4 || new Set(s.worlds).size !== 4) fail('worlds');
  if (!s.worlds.every(w => w in WORLDS)) fail('unknown world');
  if (![0, 1].includes(s.activePlayer) || ![0, 1].includes(s.firstPlayer)) fail('player');
  if (s.phase === 'over' ? s.winner === null : s.winner !== null) fail('winner');
  const seen = new Set<string>();
  const identity = (h: HandCard) => { card(h.cardId); if (seen.has(h.uid)) fail('duplicate uid'); seen.add(h.uid); };
  for (const h of [...s.deck, ...s.discard]) { identity(h); if (card(h.cardId).token) fail('token in deck/discard'); }
  for (const p of s.players) {
    if (!Number.isInteger(p.coins) || p.coins < 0 || p.coins > 10) fail('coins');
    if (!Number.isInteger(p.hp) || p.hp < 0 || p.hp > s.startingHp + 5) fail('hp');
    if (p.board.length !== 8 || p.hand.length > 8 || p.burnsThisTurn > 2) fail('capacity');
    for (const h of p.hand) identity(h);
    for (const u of p.board) if (u) {
      identity(u);
      if (card(u.cardId).kind !== 'creature' || u.hp <= 0 || u.hp > u.maxHp || u.attack < 0 || u.poison < 0 || u.upgrades > 3) fail('creature');
      // Attack is always the printed value plus forgings plus the native-world bonus.
      if (u.attack !== card(u.cardId).attack + u.upgrades + (u.home ? 1 : 0)) fail('attack');
    }
  }
}

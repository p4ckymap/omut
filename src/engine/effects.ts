import { card, WORLDS } from './cards';
import { income, locate, opponent } from './queries';
import { shuffle } from './rng';
import type { Creature, GameEvent, GameState, HandCard, PlayerId } from './types';

export function creature(h: HandCard, turn: number): Creature {
  const def = card(h.cardId);
  return { ...h, attack: def.attack, hp: def.health, maxHp: def.health, poison: 0,
    steadfastUsed: false, upgrades: 0, enteredTurn: turn, attackedTurn: -1, upgradedTurn: -1, movedTurn: -1, temporaryPriority: false };
}
/** Native-world bonus: a creature in the world of its own class strikes for +1 while it stands there. */
export const HOME_BONUS = 1;
export function settleHome(s: GameState, e: GameEvent[], player: PlayerId, slot: number) {
  const unit = s.players[player].board[slot];
  if (!unit) return;
  const native = WORLDS[s.worlds[slot >> 1]].native;
  const should = !!native && native === card(unit.cardId).class;
  if (should === !!unit.home) return;
  unit.home = should;
  unit.attack = Math.max(0, unit.attack + (should ? HOME_BONUS : -HOME_BONUS));
  e.push({ type: 'StatusApplied', target: unit.uid, status: 'home', value: should ? 1 : 0 });
}
export function coins(s: GameState, events: GameEvent[], player: PlayerId, amount: number, reason: string) {
  const p = s.players[player], before = p.coins;
  p.coins = Math.max(0, Math.min(10, before + amount));
  const delta = p.coins - before;
  if (delta > 0) p.stats.earned += delta; else p.stats.spent -= delta;
  events.push({ type: 'CoinsChanged', player, delta, coins: p.coins, reason });
}
export function gameOver(s: GameState, e: GameEvent[], winner: PlayerId, reason: string) {
  if (s.phase === 'over') return;
  s.phase = 'over'; s.winner = winner;
  e.push({ type: 'GameOver', winner, reason });
}
export function damagePlayer(s: GameState, e: GameEvent[], player: PlayerId, amount: number, cause: string) {
  if (s.phase === 'over') return;
  const p = s.players[player], actual = Math.min(p.hp, Math.max(0, amount));
  p.hp -= actual;
  e.push({ type: 'PlayerDamaged', player, amount: actual, hp: p.hp, cause });
  if (p.hp === 0) gameOver(s, e, opponent(player), cause);
}
export function drain(s: GameState, e: GameEvent[], player: PlayerId, amount: number) {
  const taken = Math.min(amount, s.players[opponent(player)].hp);
  damagePlayer(s, e, opponent(player), taken, 'blood');
  if (s.phase === 'over') return;
  const p = s.players[player], before = p.hp;
  p.hp = Math.min(s.startingHp + 5, p.hp + taken);
  e.push({ type: 'Healed', player, target: 'hero', amount: p.hp - before, hp: p.hp });
}
export function heal(s: GameState, e: GameEvent[], uid: string, amount: number) {
  const found = locate(s, uid); if (!found) return;
  const before = found.unit.hp;
  found.unit.hp = Math.min(found.unit.maxHp, before + amount);
  e.push({ type: 'Healed', player: found.player, target: uid, amount: found.unit.hp - before, hp: found.unit.hp });
}
export function remove(s: GameState, e: GameEvent[], uid: string, killer: PlayerId, cause: string) {
  const found = locate(s, uid); if (!found) return;
  const { player, slot, unit } = found;
  s.players[player].board[slot] = null;
  if (!card(unit.cardId).token) s.discard.push({ uid: unit.uid, cardId: unit.cardId });
  e.push({ type: 'CardDied', player, slot, unit: structuredClone(unit), cause });
  const reward = card(unit.cardId).reward;
  const before = s.players[killer].coins;
  coins(s, e, killer, reward, 'reward');
  s.players[killer].stats.kills++;
  e.push({ type: 'RewardPaid', player: killer, card: uid, reward, received: s.players[killer].coins - before });
}
export function damage(s: GameState, e: GameEvent[], uid: string, amount: number,
  source: string, killer: PlayerId, cause: 'attack' | 'deathstrike' | 'spell' | 'poison') {
  const found = locate(s, uid);
  if (!found) return { dead: false, saved: false, amount: 0, overflow: 0 };
  const unit = found.unit, def = card(unit.cardId), before = unit.hp;
  const actual = Math.max(0, amount - ((cause === 'attack' || cause === 'deathstrike') ? def.abilities.shield ?? 0 : 0));
  unit.hp -= actual;
  e.push({ type: 'DamageDealt', target: uid, source, cause, amount: actual, hp: unit.hp });
  if (unit.hp > 0) return { dead: false, saved: false, amount: actual, overflow: 0 };
  if (def.abilities.steadfast && !unit.steadfastUsed) {
    unit.steadfastUsed = true; unit.hp = 1;
    e.push({ type: 'StatusApplied', target: uid, status: 'steadfast-used', value: 1 });
    return { dead: false, saved: true, amount: actual, overflow: 0 };
  }
  remove(s, e, uid, killer, cause);
  return { dead: true, saved: false, amount: actual, overflow: Math.max(0, actual - before) };
}
export function draw(s: GameState, e: GameEvent[], player: PlayerId) {
  if (!s.deck.length) {
    if (!s.fatigue) { s.fatigue = true; e.push({ type: 'FatigueStarted' }); }
    if (s.discard.length) {
      const shuffled = shuffle(s.discard, s.rng); s.rng = shuffled.seed; s.deck = shuffled.items; s.discard = [];
      e.push({ type: 'DeckReshuffled', count: s.deck.length });
    }
  }
  const h = s.deck.pop();
  if (!h) return; // Empty deck AND discard: fatigue still progresses; never recurse.
  const overflow = s.players[player].hand.length >= 8;
  if (overflow) s.discard.push(h); else s.players[player].hand.push(h);
  e.push({ type: 'CardDrawn', player, card: { ...h }, overflow });
}
export function startTurn(s: GameState, e: GameEvent[]) {
  const player = s.activePlayer, p = s.players[player];
  s.turn++; p.turns++; p.burnsThisTurn = 0;
  e.push({ type: 'TurnStarted', player, turn: s.turn, personalTurn: p.turns });
  draw(s, e, player);
  coins(s, e, player, income(p.turns), 'income');
  // Grouped, deterministic order: greed -> healing -> poison -> banner expiry.
  for (const u of p.board) if (u && card(u.cardId).abilities.greed)
    coins(s, e, player, card(u.cardId).abilities.greed!, 'greed');
  for (let slot = 0; slot < 8; slot++) {
    const u = p.board[slot], neighbor = p.board[slot ^ 1];
    if (u && neighbor && card(u.cardId).abilities.healer) heal(s, e, neighbor.uid, card(u.cardId).abilities.healer!);
  }
  for (const u of [...p.board]) if (u && u.poison) damage(s, e, u.uid, u.poison, 'poison', opponent(player), 'poison');
  for (const u of p.board) if (u?.temporaryPriority) {
    u.temporaryPriority = false; e.push({ type: 'StatusApplied', target: u.uid, status: 'temporary-priority', value: 0 });
  }
  if (s.fatigue) damagePlayer(s, e, player, 1, 'fatigue');
}
export function surface(s: GameState, e: GameEvent[], player: PlayerId, unit: Creature) {
  if (!card(unit.cardId).abilities.surface) return;
  const enemy = opponent(player);
  const targets = s.players[enemy].board.map((u, slot) => ({ u, slot }))
    .filter((x): x is { u: Creature; slot: number } => !!x.u && card(x.u.cardId).rarity !== 'legendary')
    .sort((a, b) => b.u.attack - a.u.attack || b.u.hp - a.u.hp || a.slot - b.slot);
  const target = targets[0]; if (!target) return;
  const before = structuredClone(target.u), after = creature({ uid: before.uid, cardId: 'frog' }, before.enteredTurn);
  after.attackedTurn = before.attackedTurn; // Transformation never grants another attack.
  s.players[enemy].board[target.slot] = after;
  e.push({ type: 'Transformed', player: enemy, slot: target.slot, before, after: { ...after } });
  settleHome(s, e, enemy, target.slot);
}
export function attack(s: GameState, e: GameEvent[], attacker: string, target: string) {
  const from = locate(s, attacker)!, unit = from.unit, abilities = card(unit.cardId).abilities;
  unit.attackedTurn = s.turn;
  e.push({ type: 'AttackDeclared', player: from.player, attacker, target });
  const enemy = opponent(from.player);
  if (target === 'hero') damagePlayer(s, e, enemy, unit.attack, 'attack');
  else {
    const victim = locate(s, target)!.unit;
    if (abilities.devour && victim.hp <= 3) {
      remove(s, e, target, from.player, 'devour');
    } else {
      const result = damage(s, e, target, unit.attack, attacker, from.player, 'attack');
      if (result.saved) return; // Step 2 explicitly ends the attack resolution.
      if (result.dead && !abilities.ranged && victim.attack > 0) {
        e.push({ type: 'DeathStrike', attacker: target, target: attacker, amount: victim.attack });
        damage(s, e, attacker, victim.attack, target, enemy, 'deathstrike');
      }
      if (!result.dead && result.amount > 0 && abilities.poison) {
        victim.poison += abilities.poison;
        e.push({ type: 'StatusApplied', target, status: 'poison', value: victim.poison });
      }
      // Both effects use the attacker's snapshot, even after its death.
      if (abilities.blood) drain(s, e, from.player, abilities.blood);
      if (abilities.ram && result.dead && result.overflow && s.phase !== 'over') damagePlayer(s, e, enemy, result.overflow, 'ram');
      return;
    }
  }
  if (abilities.blood && s.phase !== 'over') drain(s, e, from.player, abilities.blood);
}

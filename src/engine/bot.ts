import { card, WORLDS } from './cards';
import { autoTarget, locate, opponent } from './queries';
import { apply, legalActions, previewCombat } from './rules';
import { random, seedFrom } from './rng';
import type { Action, BotLevel, GameState } from './types';

export function chooseAction(state: GameState, level: BotLevel = 'medium'): Action | null {
  const actions = legalActions(state);
  if (!actions.length) return null;
  const player = state.activePlayer, me = state.players[player], enemy = state.players[opponent(player)];
  if (state.phase === 'mulligan') {
    const ids = me.hand.filter(h => card(h.cardId).cost > 4).map(h => h.uid).sort().join(',');
    return actions.find(a => a.type === 'Mulligan' && [...a.cards].sort().join(',') === ids)!;
  }
  // With auto combat, the end of the turn is itself an attack: if it already kills, just end the turn.
  const lethalAtEnd = !!state.autoAttack && state.phase === 'playing' &&
    previewCombat(state, player).reduce((n, a) => n + a.heroDamage, 0) >= enemy.hp;
  const waitingLegend = me.hand.some(h => card(h.cardId).rarity === 'legendary' && card(h.cardId).cost - me.coins >= 1 && card(h.cardId).cost - me.coins <= 2);
  const score = (a: Action): number => {
    switch (a.type) {
      case 'Attack': {
        const from = locate(state, a.attacker)!;
        if (a.target === 'hero') return from.unit.attack >= enemy.hp ? 100000 : 70 + from.unit.attack * 7;
        const target = locate(state, a.target)!.unit;
        const preview = apply(state, a);
        if (preview.state.winner === player) return 100000;
        const ownDead = !locate(preview.state, a.attacker), dead = !locate(preview.state, a.target);
        if (level === 'medium' && ownDead && card(from.unit.cardId).reward > card(target.cardId).reward) return -100;
        return dead ? 65 + card(target.cardId).reward * 6 - (ownDead ? card(from.unit.cardId).reward * 4 : 0)
          : 22 + Math.min(from.unit.attack, target.hp) * 2;
      }
      case 'PlayCreature': {
        const def = card(me.hand.find(c => c.uid === a.card)!.cardId);
        const start = Math.floor(a.slot / 2) * 2;
        const empty = !me.board[start] && !me.board[start + 1];
        const incoming = (enemy.board[start]?.attack ?? 0) + (enemy.board[start + 1]?.attack ?? 0);
        // The specification puts covering an exposed world before nonlethal attacks.
        const home = level === 'medium' && WORLDS[state.worlds[Math.floor(a.slot / 2)]].native === def.class ? 12 : 0;
        return 35 + def.cost * 4 + home + (level === 'medium' && empty ? incoming > 0 ? 100 + incoming * 5 : 24 : 0) + (def.abilities.rush ? 8 : 0);
      }
      case 'CastSpell': {
        const def = card(me.hand.find(c => c.uid === a.card)!.cardId);
        const target = a.target ? locate(state, a.target) : undefined;
        switch (def.id) {
          case 'krov': return enemy.hp <= 2 ? 100000 : 42;
          case 'koshel': return me.hand.length < 8 ? 58 : -1;
          case 'istoch': return target!.unit.poison ? 70 : target!.unit.maxHp - target!.unit.hp >= 2 ? 38 : -1;
          case 'znamya': return -1; // Do not spend merely to add a redundant defender.
          case 'fire': return target!.unit.hp <= 3 ? 65 + card(target!.unit.cardId).reward * 5 : 24;
          case 'poglot': return 48 + card(target!.unit.cardId).reward * 6;
          case 'lik': return 32 + card(target!.unit.cardId).cost * 4;
          default: return -1;
        }
      }
      case 'Upgrade': {
        if (waitingLegend) return -1;
        const unit = locate(state, a.target)!.unit;
        return 12 + unit.hp + (unit.attackedTurn !== state.turn ? 10 : 0);
      }
      case 'Burn': {
        if (me.coins >= 10) return -1;
        const def = card(me.hand.find(c => c.uid === a.card)!.cardId);
        const need = me.hand.some(h => h.uid !== a.card && card(h.cardId).cost > me.coins && card(h.cardId).cost <= me.coins + 2);
        if (!need && me.hand.length < 7) return -1;
        return 10 - def.cost + (def.kind === 'spell' && def.id === 'znamya' ? 4 : 0);
      }
      case 'Move': {
        if (lethalAtEnd) return -1;
        const from = locate(state, a.unit)!, unit = from.unit;
        const fw = Math.floor(from.slot / 2), tw = Math.floor(a.slot / 2);
        if (fw === tw) return -1;
        const mine = (w: number) => [me.board[w * 2], me.board[w * 2 + 1]].filter(u => u && u.uid !== unit.uid).length;
        const enemyAt = (w: number) => [enemy.board[w * 2], enemy.board[w * 2 + 1]].filter(Boolean) as NonNullable<typeof enemy.board[number]>[];
        const threat = (w: number) => enemyAt(w).reduce((n, u) => n + u.attack, 0);
        // Never open a world that is under threat.
        if (!mine(fw) && threat(fw) > 0) return -1;
        if (!mine(tw) && threat(tw) > 0) return 40 + threat(tw) * 5;
        const ready = unit.attack > 0 && !!card(unit.cardId).abilities.rush; // only this turn's creatures can move; only Rush strikes now
        const alreadyHitsHero = autoTarget(state, unit.uid) === 'hero';
        if (level === 'medium' && ready && !alreadyHitsHero && !enemyAt(tw).length && enemyAt(fw).length && unit.attack >= 2) return 30 + unit.attack * 4;
        return -1;
      }
      case 'EndTurn': return lethalAtEnd ? 100000 : 0;
      default: return -1;
    }
  };
  const scored = actions.map(action => ({ action, score: score(action) }));
  const best = Math.max(...scored.map(a => a.score));
  // Easy: a random useful attack/spell, but the most expensive deployable creature.
  const maxPlayableCost = Math.max(0, ...actions.filter(a => a.type === 'PlayCreature').map(a => card(me.hand.find(h => h.uid === a.card)!.cardId).cost));
  const candidates = level === 'easy' && best < 100000
    ? scored.filter(x => {
      const a = x.action;
      return x.score > 0 && (a.type !== 'PlayCreature' || card(me.hand.find(h => h.uid === a.card)!.cardId).cost === maxPlayableCost);
    })
    : scored.filter(x => x.score === best);
  const pool = candidates.length ? candidates : scored.filter(x => x.action.type === 'EndTurn');
  const index = Math.floor(random(seedFrom(`${state.rng}:${state.steps}:${level}`)).value * pool.length);
  return pool[index].action;
}

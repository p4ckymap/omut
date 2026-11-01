import { createGame, apply } from '../../src/engine/rules';
import { creature } from '../../src/engine/effects';
import type { GameState, PlayerId } from '../../src/engine/types';

export function setup(): GameState {
  const s = createGame('unit-test');
  s.phase = 'playing'; s.activePlayer = 0; s.firstPlayer = 0; s.turn = 1;
  s.mulliganDone = [true, true]; s.worlds = ['yav', 'nav', 'chasha', 'omut'];
  s.autoAttack = false; // unit tests drive attacks by hand; auto combat has its own tests
  s.deck = []; s.discard = []; s.nextUid = 100;
  for (const p of s.players) { p.hand = []; p.board.fill(null); p.coins = 10; p.turns = 1; }
  return s;
}
export function put(s: GameState, player: PlayerId, slot: number, id: string, props = {}) {
  const u = creature({ uid: `c${s.nextUid++}`, cardId: id }, 0);
  Object.assign(u, props); s.players[player].board[slot] = u; return u;
}
export function hand(s: GameState, player: PlayerId, id: string) {
  const h = { uid: `c${s.nextUid++}`, cardId: id }; s.players[player].hand.push(h); return h;
}
export function start(seed: number | string = 123) {
  let s = createGame(seed);
  for (let i=0;i<2;i++) s=apply(s,{type:'Mulligan',player:s.activePlayer,cards:[]}).state;
  return s;
}
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); for (const v of Object.values(value)) freeze(v); }
  return value;
}

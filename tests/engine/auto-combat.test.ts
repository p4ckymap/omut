import { expect, test } from 'vitest';
import { apply, assertGameState, autoTarget, legalActions, plannedAttacks, previewCombat } from '../../src/engine/rules';
import { locate } from '../../src/engine/queries';
import { hand, put, setup } from './helpers';

const auto = () => { const s = setup(); s.autoAttack = true; s.turn = 3; return s; };

test('ending the turn makes every ready creature strike by itself; manual Attack is not offered', () => {
  const s = auto();
  const a = put(s, 0, 0, 'druzh');           // opposite: enemy kiki
  const b = put(s, 0, 2, 'opol');            // opposite world empty -> hero
  put(s, 0, 4, 'kot', { enteredTurn: 3 });   // placed this turn, no rush -> waits
  const k = put(s, 1, 0, 'kiki');
  expect(legalActions(s).some(x => x.type === 'Attack')).toBe(false);
  expect(apply(s, { type: 'Attack', player: 0, attacker: a.uid, target: k.uid }).accepted).toBe(false);
  expect(plannedAttacks(s, 0)).toEqual([{ attacker: a.uid, target: k.uid }, { attacker: b.uid, target: 'hero' }]);
  const r = apply(s, { type: 'EndTurn', player: 0 });
  expect(r.events[0]).toMatchObject({ type: 'CombatStarted', player: 0, attacks: 2 });
  expect(locate(r.state, k.uid)).toBeUndefined();                    // kiki died
  expect(locate(r.state, a.uid)!.unit.hp).toBe(3);                   // deathstrike 2
  expect(r.events).toContainEqual(expect.objectContaining({ type: 'PlayerDamaged', player: 1, amount: 1, cause: 'attack' }));
  expect(r.state.activePlayer).toBe(1);
  assertGameState(r.state);
});

test('priority and the card straight opposite decide the target; ranged picks a kill anywhere', () => {
  const s = auto();
  const a = put(s, 0, 1, 'opol');
  const top = put(s, 1, 0, 'mertv'), bottom = put(s, 1, 1, 'kot');
  expect(autoTarget(s, a.uid)).toBe(bottom.uid);
  const d = put(s, 1, 0, 'druzh'); void top;
  expect(autoTarget(s, a.uid)).toBe(d.uid);
  const l = put(s, 0, 6, 'luch');
  const weak = put(s, 1, 3, 'upyr', { hp: 2 });
  expect(autoTarget(s, l.uid)).toBe(weak.uid);
});

test('a lethal strike in combat ends the match before the next turn starts', () => {
  const s = auto(); s.players[1].hp = 1;
  put(s, 0, 4, 'opol');
  const r = apply(s, { type: 'EndTurn', player: 0 });
  expect(r.state.phase).toBe('over'); expect(r.state.winner).toBe(0);
  expect(r.events.some(e => e.type === 'TurnStarted')).toBe(false);
});

test('creatures placed this turn can be rearranged freely; older ones stay put; the pair rule holds', () => {
  const s = auto();
  const h = put(s, 0, 0, 'opol', { enteredTurn: 3 }); // placed this turn
  put(s, 0, 2, 'mertv');                               // undead in Nav, placed earlier
  const r = apply(s, { type: 'Move', player: 0, unit: h.uid, slot: 3 }); // human + native undead: fine
  expect(r.accepted).toBe(true);
  expect(r.state.players[0].board[0]).toBeNull(); expect(r.state.players[0].board[3]!.uid).toBe(h.uid);
  expect(apply(r.state, { type: 'Move', player: 0, unit: h.uid, slot: 0 }).accepted).toBe(true); // and back again
  const old = r.state.players[0].board[2]!;
  const no = apply(r.state, { type: 'Move', player: 0, unit: old.uid, slot: 4 });
  expect(no.accepted).toBe(false);
  expect((no.events[0] as { reason: string }).reason).toContain('в этом ходу');
  const t = auto();
  put(t, 0, 4, 'opol');                                // human in Chasha (native: wild)
  const z = put(t, 0, 6, 'zhaba', { enteredTurn: 3 }); // monster in Omut, placed this turn
  const bad = apply(t, { type: 'Move', player: 0, unit: z.uid, slot: 5 });
  expect(bad.accepted).toBe(false);
  expect((bad.events[0] as { reason: string }).reason).toContain('Нечисть');
  void hand;
});

test('the preview matches the real combat, including a target re-picked after a death', () => {
  const s = auto();
  const d = put(s, 0, 0, 'druzh'), o = put(s, 0, 1, 'opol');
  put(s, 1, 1, 'mertv');                     // dies to the first strike; the second goes to the hero
  const plan = previewCombat(s, 0);
  expect(plan.map(p => [p.attacker, p.target])).toEqual([[d.uid, expect.any(String)], [o.uid, 'hero']]);
  const r = apply(s, { type: 'EndTurn', player: 0 });
  const real = r.events.filter(e => e.type === 'AttackDeclared').map(e => e.type === 'AttackDeclared' ? [e.attacker, e.target] : []);
  expect(real).toEqual(plan.map(p => [p.attacker, p.target]));
});

test('ranged finishes the hero through an empty world instead of a zero-reward kill', () => {
  const s = auto(); s.players[1].hp = 2;
  const l = put(s, 0, 0, 'luch');
  put(s, 1, 4, 'opol');
  expect(autoTarget(s, l.uid)).toBe('hero');
});

test('the bot moves a spare creature to close a threatened empty world', async () => {
  const { chooseAction } = await import('../../src/engine/bot');
  const s = auto(); s.players[0].coins = 0;
  put(s, 0, 0, 'opol'); const spare = put(s, 0, 1, 'mertv', { enteredTurn: 3 }); // Yav covered twice; spare placed this turn
  put(s, 1, 2, 'volk');                                          // threatens the empty Nav
  const a = chooseAction(s, 'medium');
  expect(a?.type).toBe('Move');
  if (a?.type === 'Move') { expect([2, 3]).toContain(a.slot); expect(a.unit).toBe(spare.uid); }
});

test('the bot ends the turn when its end-of-turn combat is already lethal, instead of moving', async () => {
  const { chooseAction } = await import('../../src/engine/bot');
  const s = auto(); s.activePlayer = 1; s.players[1].coins = 0; s.players[0].hp = 3;
  put(s, 1, 0, 'volk');                      // alone, nothing opposite: hits the hero for 4
  put(s, 0, 2, 'kiki');                      // a tempting target in another world
  expect(chooseAction(s, 'medium')?.type).toBe('EndTurn');
});

test('the bot finishes every turn in a handful of actions (no endless rearranging)', async () => {
  const { chooseAction } = await import('../../src/engine/bot');
  const { createGame } = await import('../../src/engine/rules');
  for (let seed = 0; seed < 60; seed++) {
    let s = createGame(`turns-${seed}`);
    while (s.phase === 'mulligan') s = apply(s, { type: 'Mulligan', player: s.activePlayer, cards: [] }).state;
    let perTurn = 0, turn = s.turn;
    for (let i = 0; i < 4000 && s.phase === 'playing'; i++) {
      const a = chooseAction(s, seed % 2 ? 'easy' : 'medium')!;
      s = apply(s, a).state;
      if (s.turn !== turn) { turn = s.turn; perTurn = 0; } else expect(++perTurn).toBeLessThan(25);
    }
    expect(s.phase).toBe('over');
  }
});

test('a creature in its native world strikes for +1 while it stays there', () => {
  const s = auto();
  const h = hand(s, 0, 'druzh');                                 // human; world 0 is Yav
  let r = apply(s, { type: 'PlayCreature', player: 0, card: h.uid, slot: 0 });
  const placed = r.state.players[0].board[0]!;
  expect(placed.attack).toBe(3); expect(placed.home).toBe(true);
  expect(r.events).toContainEqual(expect.objectContaining({ type: 'StatusApplied', status: 'home', value: 1 }));
  r = apply(r.state, { type: 'Move', player: 0, unit: placed.uid, slot: 6 }); // to the Omut: no native class
  expect(r.state.players[0].board[6]!.attack).toBe(2);
  r = apply(r.state, { type: 'Move', player: 0, unit: placed.uid, slot: 1 }); // back home
  expect(r.state.players[0].board[1]!.attack).toBe(3);
  assertGameState(r.state);
});

test('native bonus: forging stacks with it, leaving home removes exactly 1, a Frog is settled anew', () => {
  const s = auto(); s.worlds = ['yav', 'nav', 'chasha', 'puchina'];
  const h = hand(s, 0, 'druzh');
  let r = apply(s, { type: 'PlayCreature', player: 0, card: h.uid, slot: 0 });   // Yav: home, 3
  const uid = r.state.players[0].board[0]!.uid;
  r = apply(r.state, { type: 'Upgrade', player: 0, target: uid });                // 4
  expect(r.state.players[0].board[0]!.attack).toBe(4);
  r = apply(r.state, { type: 'Move', player: 0, unit: uid, slot: 2 });             // to Nav: 3 = base + forging
  expect(r.state.players[0].board[2]!.attack).toBe(3);
  assertGameState(r.state);
  // Baba Yaga turns a creature standing at home into a Frog: the Frog gets the bonus only in the Abyss.
  const f = auto(); f.worlds = ['yav', 'nav', 'chasha', 'puchina']; f.activePlayer = 1;
  put(f, 0, 6, 'smey', { home: true, attack: 4 });                                // monster at home in Puchina
  const y = hand(f, 1, 'yaga');
  const fr = apply(f, { type: 'PlayCreature', player: 1, card: y.uid, slot: 4 });
  const frog = fr.state.players[0].board[6]!;
  expect(frog.cardId).toBe('frog'); expect(frog.home).toBe(true); expect(frog.attack).toBe(2);
  assertGameState(fr.state);
});

test('native bonus applies to a copy made by «Пустой лик»', () => {
  const s = auto(); s.worlds = ['yav', 'nav', 'chasha', 'puchina'];
  const target = put(s, 1, 0, 'opol');
  const lik = hand(s, 0, 'lik');
  const r = apply(s, { type: 'CastSpell', player: 0, card: lik.uid, target: target.uid, slot: 1 });
  expect(r.accepted).toBe(true);
  expect(r.state.players[0].board[1]!).toMatchObject({ cardId: 'opol', home: true, attack: 2 });
});

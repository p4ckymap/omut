import { expect, test } from 'vitest';
import { apply, explainAction, previewAttack } from '../../src/engine/rules';
import { locate } from '../../src/engine/queries';
import { freeze, put, setup } from './helpers';

test('nonlethal strike is unilateral; attack only once per turn',()=>{
  const s=setup(),a=put(s,0,0,'opol'),b=put(s,1,0,'druzh');
  const r=apply(s,{type:'Attack',player:0,attacker:a.uid,target:b.uid});
  expect(locate(r.state,b.uid)!.unit.hp).toBe(4);expect(locate(r.state,a.uid)!.unit.hp).toBe(2);
  expect(r.events.some(e=>e.type==='DeathStrike')).toBe(false);
  expect(apply(r.state,{type:'Attack',player:0,attacker:a.uid,target:b.uid}).accepted).toBe(false);
});
test('summoning delay, rush and zero attack',()=>{
  const s=setup(),a=put(s,0,0,'opol',{enteredTurn:1}),rush=put(s,0,2,'volk',{enteredTurn:1}),zero=put(s,0,4,'zhaba');
  expect(explainAction(s,{type:'Attack',player:0,attacker:a.uid,target:'hero'})).toContain('Рывка');
  expect(explainAction(s,{type:'Attack',player:0,attacker:rush.uid,target:'hero'})).toBeNull();
  expect(explainAction(s,{type:'Attack',player:0,attacker:zero.uid,target:'hero'})).toContain('нулевой');
});
test('attack opposite world, priority, two priorities, and empty-world hero restriction',()=>{
  const s=setup(),a=put(s,0,0,'opol'),b=put(s,1,0,'opol'),guard=put(s,1,1,'druzh'),far=put(s,1,2,'opol');
  const attack=(target:string)=>explainAction(s,{type:'Attack',player:0,attacker:a.uid,target});
  expect(attack(b.uid)).toContain('Приоритетом');expect(attack(guard.uid)).toBeNull();expect(attack(far.uid)).toContain('напротив');expect(attack('hero')).not.toBeNull();
  b.temporaryPriority=true;expect(attack(b.uid)).toBeNull();
  expect(explainAction(s,{type:'Attack',player:1,attacker:guard.uid,target:a.uid})).toContain('ход');
});
test('ranged ignores foreign worlds and priority, but hero requires its opposite world empty',()=>{
  const s=setup(),a=put(s,0,0,'luch'),b=put(s,1,4,'opol');put(s,1,5,'druzh');put(s,1,0,'opol');
  expect(explainAction(s,{type:'Attack',player:0,attacker:a.uid,target:b.uid})).toBeNull();
  expect(explainAction(s,{type:'Attack',player:0,attacker:a.uid,target:'hero'})).not.toBeNull();
  s.players[1].board[0]=null;expect(explainAction(s,{type:'Attack',player:0,attacker:a.uid,target:'hero'})).toBeNull();
});
test('deathstrike uses current upgraded attack and both sides receive rewards in exact order',()=>{
  const s=setup();s.players[0].coins=0;s.players[1].coins=0;
  const a=put(s,0,0,'druzh',{attack:7,hp:2}),b=put(s,1,0,'upyr',{attack:4,upgrades:2});
  const r=apply(freeze(s),{type:'Attack',player:0,attacker:a.uid,target:b.uid});
  expect(r.state.players.map(p=>p.coins)).toEqual([2,2]);
  expect(locate(r.state,a.uid)).toBeUndefined();expect(locate(r.state,b.uid)).toBeUndefined();
  expect(r.events.map(e=>e.type)).toEqual(['AttackDeclared','DamageDealt','CardDied','CoinsChanged','RewardPaid','DeathStrike','DamageDealt','CardDied','CoinsChanged','RewardPaid']);
  expect(r.events.find(e=>e.type==='DeathStrike')).toMatchObject({amount:4});
  expect(r.events.filter(e=>e.type==='DeathStrike')).toHaveLength(1);
});
test('zero-attack corpse produces no deathstrike and zero-reward victim awards zero',()=>{
  const s=setup(),a=put(s,0,0,'svyat'),b=put(s,1,0,'zhaba');
  const r=apply(s,{type:'Attack',player:0,attacker:a.uid,target:b.uid});
  expect(r.events.some(e=>e.type==='DeathStrike')).toBe(false);expect(r.events.find(e=>e.type==='RewardPaid')).toMatchObject({reward:0,received:0});
});
test('shield reduces attack and deathstrike independently; never negative',()=>{
  const s=setup(),a=put(s,0,0,'svyat',{attack:10}),b=put(s,1,0,'svyat',{hp:2,attack:4});
  const r=apply(s,{type:'Attack',player:0,attacker:a.uid,target:b.uid});
  expect(r.events.filter(e=>e.type==='DamageDealt').map(e=>e.amount)).toEqual([9,3]);
  expect(locate(r.state,a.uid)!.unit.hp).toBe(6);
  const t=setup(),weak=put(t,0,0,'opol'),shield=put(t,1,0,'svyat');
  const q=apply(t,{type:'Attack',player:0,attacker:weak.uid,target:shield.uid});
  expect(locate(q.state,shield.uid)!.unit.hp).toBe(9);
});
test('target steadfast saves at 1 HP and immediately ends attack, without rewards or blood',()=>{
  const s=setup(),a=put(s,0,0,'upyr',{attack:10}),b=put(s,1,0,'skel');
  const r=apply(s,{type:'Attack',player:0,attacker:a.uid,target:b.uid});
  expect(locate(r.state,b.uid)!.unit.hp).toBe(1);expect(locate(r.state,b.uid)!.unit.steadfastUsed).toBe(true);
  expect(r.state.players[1].hp).toBe(25);
  expect(r.events.map(e=>e.type)).toEqual(['AttackDeclared','DamageDealt','StatusApplied']);
  r.state.turn++;const q=apply(r.state,{type:'Attack',player:0,attacker:a.uid,target:b.uid});
  expect(locate(q.state,b.uid)).toBeUndefined();expect(q.events.filter(e=>e.type==='DeathStrike')).toHaveLength(1);
});
test('attacker steadfast survives lethal deathstrike with 1 HP',()=>{
  const s=setup(),a=put(s,0,0,'koshey',{hp:1}),b=put(s,1,0,'opol');
  const r=apply(s,{type:'Attack',player:0,attacker:a.uid,target:b.uid});
  expect(locate(r.state,a.uid)!.unit).toMatchObject({hp:1,steadfastUsed:true});
  expect(r.events.filter(e=>e.type==='RewardPaid')).toHaveLength(1);
});
test('ranged lethal attack avoids deathstrike',()=>{
  const s=setup(),a=put(s,0,0,'luch'),b=put(s,1,4,'volk',{hp:2,attack:20});
  const r=apply(s,{type:'Attack',player:0,attacker:a.uid,target:b.uid});
  expect(locate(r.state,a.uid)!.unit.hp).toBe(3);expect(r.events.some(e=>e.type==='DeathStrike')).toBe(false);
});
test.each([1,2,3])('Kraken devours at %i HP through shield/steadfast, without deathstrike',hp=>{
  const s=setup(),a=put(s,0,0,'kraken'),b=put(s,1,0,'koshey',{hp,attack:20});
  const r=apply(s,{type:'Attack',player:0,attacker:a.uid,target:b.uid});
  expect(locate(r.state,b.uid)).toBeUndefined();expect(locate(r.state,a.uid)!.unit.hp).toBe(7);
  expect(r.events.find(e=>e.type==='CardDied')).toMatchObject({cause:'devour'});
});
test('Kraken uses normal attack above 3 HP',()=>{
  const s=setup(),a=put(s,0,0,'kraken'),b=put(s,1,0,'druzh',{hp:4});
  const r=apply(s,{type:'Attack',player:0,attacker:a.uid,target:b.uid});expect(locate(r.state,b.uid)!.unit.hp).toBe(1);
});
test('ram overflow follows shield subtraction and still works after attacker death',()=>{
  const s=setup(),a=put(s,0,0,'ognz',{hp:1}),b=put(s,1,0,'svyat',{hp:1});
  const r=apply(s,{type:'Attack',player:0,attacker:a.uid,target:b.uid});
  expect(locate(r.state,a.uid)).toBeUndefined();expect(r.state.players[1].hp).toBe(23);
  expect(r.events.at(-1)).toMatchObject({type:'PlayerDamaged',amount:2,cause:'ram'});
});
test('no ram overflow if target survives through steadfast',()=>{
  const s=setup(),a=put(s,0,0,'ognz'),b=put(s,1,0,'skel',{hp:1});
  const r=apply(s,{type:'Attack',player:0,attacker:a.uid,target:b.uid});expect(r.state.players[1].hp).toBe(25);
});
test('blood still drains after attacker death, with life cap starting+5',()=>{
  const s=setup(),a=put(s,0,0,'upyr',{hp:1}),b=put(s,1,0,'opol');s.players[0].hp=30;
  const r=apply(s,{type:'Attack',player:0,attacker:a.uid,target:b.uid});
  expect(locate(r.state,a.uid)).toBeUndefined();expect(r.state.players.map(p=>p.hp)).toEqual([30,24]);
});
test('lethal hero hit ends immediately, without subsequent blood healing',()=>{
  const s=setup(),a=put(s,0,0,'upyr');s.players[0].hp=10;s.players[1].hp=1;
  const r=apply(s,{type:'Attack',player:0,attacker:a.uid,target:'hero'});
  expect(r.state.winner).toBe(0);expect(r.state.players[0].hp).toBe(10);expect(r.events.at(-1)?.type).toBe('GameOver');
});
test('preview equals real result and leaves original state unchanged',()=>{
  const s=setup(),a=put(s,0,0,'smey'),b=put(s,1,0,'opol');const action={type:'Attack' as const,player:0 as const,attacker:a.uid,target:b.uid};
  freeze(s);expect(previewAttack(s,action)).toEqual(apply(s,action));expect(s.players[1].board[0]!.hp).toBe(2);
});

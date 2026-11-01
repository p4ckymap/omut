import { expect, test } from 'vitest';
import { apply, legalActions } from '../../src/engine/rules';
import { locate } from '../../src/engine/queries';
import { hand, put, setup } from './helpers';

test('fire deals 3 through Shield, respects local Priority, and pays reward without retaliation',()=>{
  let s=setup();s.players[0].coins=5;const spell=hand(s,0,'fire'),victim=put(s,1,0,'svyat');
  let r=apply(s,{type:'CastSpell',player:0,card:spell.uid,target:victim.uid});
  expect(locate(r.state,victim.uid)!.unit.hp).toBe(6);expect(r.state.players[0].coins).toBe(3);
  s=setup();const f=hand(s,0,'fire'),v=put(s,1,0,'upyr'),guard=put(s,1,1,'druzh');
  expect(apply(s,{type:'CastSpell',player:0,card:f.uid,target:v.uid}).accepted).toBe(false);
  s.players[1].board[1]=null;s.players[0].coins=2;r=apply(s,{type:'CastSpell',player:0,card:f.uid,target:v.uid});
  expect(r.state.players[0].coins).toBe(2);expect(r.events.filter(e=>e.type==='DeathStrike')).toHaveLength(0);
  expect(locate(r.state,guard.uid)).toBeUndefined();
});
test('fire triggers unused steadfast',()=>{
  const s=setup(),f=hand(s,0,'fire'),v=put(s,1,0,'skel',{hp:2});
  const r=apply(s,{type:'CastSpell',player:0,card:f.uid,target:v.uid});
  expect(locate(r.state,v.uid)!.unit).toMatchObject({hp:1,steadfastUsed:true});
});
test('blood spell drains two, caps healing, rejects redundant target',()=>{
  const s=setup(),h=hand(s,0,'krov');s.players[0].hp=29;
  expect(apply(s,{type:'CastSpell',player:0,card:h.uid,target:'bad'}).accepted).toBe(false);
  const r=apply(s,{type:'CastSpell',player:0,card:h.uid});expect(r.state.players.map(p=>p.hp)).toEqual([30,23]);expect(r.state.players[0].coins).toBe(8);
});
test('blood spell ends immediately on lethal drain',()=>{
  const s=setup(),h=hand(s,0,'krov');s.players[1].hp=1;s.players[0].hp=10;
  const r=apply(s,{type:'CastSpell',player:0,card:h.uid});expect(r.state.winner).toBe(0);expect(r.state.players[0].hp).toBe(10);
  expect(r.events.at(-1)?.type).toBe('GameOver');
});
test('spring heals four up to base max and removes all poison; own targets only',()=>{
  const s=setup(),h=hand(s,0,'istoch'),u=put(s,0,0,'druzh',{hp:1,poison:9}),enemy=put(s,1,0,'opol');
  expect(apply(s,{type:'CastSpell',player:0,card:h.uid,target:enemy.uid}).accepted).toBe(false);
  const r=apply(s,{type:'CastSpell',player:0,card:h.uid,target:u.uid});expect(locate(r.state,u.uid)!.unit).toMatchObject({hp:5,poison:0});
});
test('banner survives opponent turn and expires at beginning of owner turn; innate priority remains',()=>{
  let s=setup();const h=hand(s,0,'znamya'),u=put(s,0,0,'opol');
  s=apply(s,{type:'CastSpell',player:0,card:h.uid,target:u.uid}).state;
  s=apply(s,{type:'EndTurn',player:0}).state;expect(locate(s,u.uid)!.unit.temporaryPriority).toBe(true);
  s=apply(s,{type:'EndTurn',player:1}).state;expect(locate(s,u.uid)!.unit.temporaryPriority).toBe(false);
});
test('purse costs one, draws one and earns one; zero coins cannot pay upfront',()=>{
  const s=setup(),h=hand(s,0,'koshel');s.deck=[{uid:'next',cardId:'opol'}];s.players[0].coins=0;
  expect(apply(s,{type:'CastSpell',player:0,card:h.uid}).accepted).toBe(false);
  s.players[0].coins=10;const r=apply(s,{type:'CastSpell',player:0,card:h.uid});
  expect(r.state.players[0].coins).toBe(10);expect(r.state.players[0].hand).toEqual([{uid:'next',cardId:'opol'}]);expect(r.state.discard).toEqual([h]);
});
test('purse can reshuffle mid-turn; fatigue damage waits for the next turn start',()=>{
  const s=setup(),h=hand(s,0,'koshel');
  const r=apply(s,{type:'CastSpell',player:0,card:h.uid});
  expect(r.state.fatigue).toBe(true);expect(r.state.players.map(p=>p.hp)).toEqual([25,25]);
  expect(r.events.some(e=>e.type==='DeckReshuffled')).toBe(true);
});
test('destroy bypasses priority and steadfast; legendary targets forbidden',()=>{
  let s=setup();let h=hand(s,0,'poglot');const u=put(s,1,0,'skel');put(s,1,1,'druzh');
  let r=apply(s,{type:'CastSpell',player:0,card:h.uid,target:u.uid});
  expect(locate(r.state,u.uid)).toBeUndefined();expect(r.events.some(e=>e.type==='DeathStrike')).toBe(false);expect(r.state.players[0].coins).toBe(5);
  s=setup();h=hand(s,0,'poglot');const legend=put(s,1,0,'koshey');expect(apply(s,{type:'CastSpell',player:0,card:h.uid,target:legend.uid}).accepted).toBe(false);
});
test('copy uses base stats, fresh steadfast, no statuses/upgrades; original stays unchanged',()=>{
  const s=setup(),h=hand(s,0,'lik'),u=put(s,1,0,'skel',{attack:4,hp:1,poison:2,upgrades:3,steadfastUsed:true,temporaryPriority:true});
  const r=apply(s,{type:'CastSpell',player:0,card:h.uid,target:u.uid,slot:0});const copy=r.state.players[0].board[0]!;
  expect(copy).toMatchObject({cardId:'skel',attack:1,hp:4,poison:0,upgrades:0,steadfastUsed:false,temporaryPriority:false,enteredTurn:1});
  expect(copy.uid).not.toBe(u.uid);expect(locate(r.state,u.uid)!.unit).toEqual(u);
  expect(r.state.players[0].coins).toBe(5);
});
test('copy accepts own target, rejects legendary/occupied/mismatching placement',()=>{
  const s=setup(),h=hand(s,0,'lik'),u=put(s,0,0,'opol'),v=put(s,1,0,'zhaba'),l=put(s,1,2,'svyat');
  expect(apply(s,{type:'CastSpell',player:0,card:h.uid,target:u.uid,slot:1}).accepted).toBe(true);
  expect(apply(s,{type:'CastSpell',player:0,card:h.uid,target:l.uid,slot:2}).accepted).toBe(false);
  expect(apply(s,{type:'CastSpell',player:0,card:h.uid,target:v.uid,slot:0}).accepted).toBe(false);
  put(s,0,6,'opol');expect(apply(s,{type:'CastSpell',player:0,card:h.uid,target:v.uid,slot:7}).accepted).toBe(false);
});
test('Yaga picks highest current attack then current HP then earliest slot; legendary excluded; resets statuses',()=>{
  const s=setup(),h=hand(s,0,'yaga');put(s,1,0,'svyat',{attack:99});
  const low=put(s,1,2,'opol',{attack:4,hp:1});const strongest=put(s,1,3,'druzh',{attack:4,hp:3,poison:5,upgrades:2,temporaryPriority:true,attackedTurn:1});
  put(s,1,4,'smey',{attack:4,hp:3});
  const r=apply(s,{type:'PlayCreature',player:0,card:h.uid,slot:0});
  expect(locate(r.state,low.uid)!.unit.cardId).toBe('opol');
  expect(locate(r.state,strongest.uid)!.unit).toMatchObject({cardId:'frog',attack:1,hp:1,poison:0,upgrades:0,temporaryPriority:false,attackedTurn:1});
  expect(r.events.filter(e=>e.type==='Transformed')).toHaveLength(1);
});
test('Yaga with no eligible enemy does nothing else; dead frog token never enters discard',()=>{
  const s=setup(),h=hand(s,0,'yaga');put(s,1,2,'koshey');
  const r=apply(s,{type:'PlayCreature',player:0,card:h.uid,slot:0});expect(r.events.some(e=>e.type==='Transformed')).toBe(false);
  const frog=put(r.state,1,0,'frog');const attacker=put(r.state,0,1,'druzh');
  const q=apply(r.state,{type:'Attack',player:0,attacker:attacker.uid,target:frog.uid});expect(q.state.discard.some(c=>c.cardId==='frog')).toBe(false);
});
test('poison stacks only on positive ordinary damage, ticks on owner turn, ignores Shield',()=>{
  let s=setup();const a=put(s,0,0,'kiki'),b=put(s,0,1,'kiki'),v=put(s,1,0,'svyat');
  s=apply(s,{type:'Attack',player:0,attacker:a.uid,target:v.uid}).state;
  s=apply(s,{type:'Attack',player:0,attacker:b.uid,target:v.uid}).state;
  expect(locate(s,v.uid)!.unit).toMatchObject({hp:7,poison:2});
  const r=apply(s,{type:'EndTurn',player:0});expect(locate(r.state,v.uid)!.unit.hp).toBe(5);
  expect(r.events.find(e=>e.type==='DamageDealt' && e.cause==='poison')).toMatchObject({amount:2});
  s=setup();const weak=put(s,0,0,'kiki',{attack:1}),shield=put(s,1,0,'svyat');
  expect(locate(apply(s,{type:'Attack',player:0,attacker:weak.uid,target:shield.uid}).state,shield.uid)!.unit.poison).toBe(0);
});
test('deathstrike does not transfer poison',()=>{
  const s=setup(),a=put(s,0,0,'druzh'),b=put(s,1,0,'kiki');
  const r=apply(s,{type:'Attack',player:0,attacker:a.uid,target:b.uid});expect(locate(r.state,a.uid)!.unit.poison).toBe(0);
});
test('poison triggers steadfast once, then kills with reward, no deathstrike',()=>{
  let s=setup();const u=put(s,1,0,'skel',{hp:1,poison:3});s.players[0].coins=0;
  let r=apply(s,{type:'EndTurn',player:0});s=r.state;expect(locate(s,u.uid)!.unit).toMatchObject({hp:1,steadfastUsed:true});
  s=apply(s,{type:'EndTurn',player:1}).state;r=apply(s,{type:'EndTurn',player:0});
  expect(locate(r.state,u.uid)).toBeUndefined();expect(r.events.some(e=>e.type==='RewardPaid')).toBe(true);expect(r.events.some(e=>e.type==='DeathStrike')).toBe(false);
});
test('start effects order: income, greed, neighbor healing, poison; healer never heals itself or another world',()=>{
  const s=setup();s.activePlayer=1;s.players[0].coins=0;put(s,0,0,'kot',{hp:1});
  const patient=put(s,0,1,'opol',{hp:1,poison:1}),other=put(s,0,2,'druzh',{hp:1});put(s,0,4,'chert');
  const r=apply(s,{type:'EndTurn',player:1});expect(r.state.players[0].coins).toBe(3);
  expect(locate(r.state,patient.uid)!.unit.hp).toBe(1);expect(locate(r.state,other.uid)!.unit.hp).toBe(1);expect(r.state.players[0].board[0]!.hp).toBe(1);
  const types=r.events.map(e=>e.type);expect(types.indexOf('Healed')).toBeLessThan(types.indexOf('DamageDealt'));
});
test('spell action listing contains only legal targets and copy placements',()=>{
  const s=setup();for(const id of ['fire','poglot','lik','istoch','znamya'])hand(s,0,id);
  put(s,0,0,'opol');put(s,1,0,'svyat');put(s,1,2,'skel');put(s,1,3,'druzh');
  for(const a of legalActions(s))expect(apply(s,a).accepted).toBe(true);
});

import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { CARDS, card, WORLDS } from '../../src/engine/cards';
import { apply, createGame, assertGameState, explainAction, legalActions, pairAllowed, placementReason, income } from '../../src/engine/rules';
import { random, shuffle } from '../../src/engine/rng';
import type { ClassId, WorldId } from '../../src/engine/types';
import { freeze, hand, put, setup, start } from './helpers';

test('catalogue exactly matches the source table, including descriptions and numbers', () => {
  const text=readFileSync('docs/TZ-omut.md','utf8');
  const rows=text.split('\n').map(l=>l.split('|').slice(1,-1).map(s=>s.trim())).filter(r=>CARDS.some(c=>c.id===r[0]));
  expect(rows).toHaveLength(26); expect(CARDS).toHaveLength(26);
  for(const row of rows) {
    const c=card(row[0]);
    expect([c.name,c.cost,c.attack,c.health,c.reward,c.abilityText,c.description])
      .toEqual([row[1],+row[4],+row[5]||0,+row[6]||0,+row[7]||0,row[8],row[9]]);
    expect(c.focus).toHaveLength(2);
  }
  expect(CARDS.reduce((n,c)=>n+c.copies,0)).toBe(44);
  expect(CARDS.filter(c=>c.kind==='creature' && c.reward===0 && !c.token).map(c=>c.id)).toEqual(['opol','mertv','zhaba','bes']);
  expect(card('frog').copies).toBe(0); expect(()=>card('unknown')).toThrow();
});
test('engine has no Phaser, DOM, clock or Math.random dependencies',()=>{
  for(const name of readdirSync('src/engine')) {
    const source=readFileSync(`src/engine/${name}`,'utf8');
    expect(source).not.toMatch(/from ['"]phaser|\bwindow\.|\bdocument\.|Math\.random\(|Date\.now\(/);
  }
});
test('seeded creation and RNG reproducibility, without modifying inputs',()=>{
  expect(createGame('omut')).toEqual(createGame('omut'));
  expect(createGame('omut').deck).not.toEqual(createGame('other').deck);
  expect(shuffle(freeze([1,2,3,4]),0)).toEqual(shuffle([1,2,3,4],0));
  expect(random(0).value).toBeGreaterThanOrEqual(0);expect(random(0).value).toBeLessThan(1);
  expect(()=>createGame(Infinity)).toThrow();
});
test.each([10,15,20,25,30,35,40])('starting HP %i is supported',hp=>{
  const s=createGame(12,{startingHp:hp});assertGameState(s);
  expect(s.players.map(p=>p.hp)).toEqual([hp,hp]);
  expect(s.deck).toHaveLength(34);expect(s.players.map(p=>p.hand.length)).toEqual([5,5]);
  expect(s.players[s.firstPlayer].coins).toBe(3);expect(s.players[1-s.firstPlayer].coins).toBe(4);
  expect(new Set(s.worlds).size).toBe(4);
});
test.each([0,9,11,41,NaN,Infinity])('invalid starting HP %s rejected',hp=>expect(()=>createGame(1,{startingHp:hp})).toThrow());
test('mulligan draws replacements before returning old cards; only once; first turn draws and earns',()=>{
  let s=createGame(2);const first=s.activePlayer;const original=s.players[first].hand.map(c=>c.uid);
  const a=apply(freeze(s),{type:'Mulligan',player:first,cards:original});expect(a.accepted).toBe(true);s=a.state;
  expect(s.players[first].hand.every(c=>!original.includes(c.uid))).toBe(true);
  expect(s.deck.filter(c=>original.includes(c.uid))).toHaveLength(5);
  s=apply(s,{type:'Mulligan',player:s.activePlayer,cards:[]}).state;
  expect(s.phase).toBe('playing');expect(s.activePlayer).toBe(first);expect(s.players[first].hand).toHaveLength(6);expect(s.players[first].coins).toBe(5);
  expect(apply(s,{type:'Mulligan',player:first,cards:[]}).accepted).toBe(false);
});
test('reject duplicated/foreign mulligan IDs and wrong player without mutation',()=>{
  const s=freeze(createGame(2)),id=s.players[s.activePlayer].hand[0].uid;
  for(const cards of [[id,id],['bad']]) expect(apply(s,{type:'Mulligan',player:s.activePlayer,cards}).state).toBe(s);
  expect(apply(s,{type:'EndTurn',player:s.activePlayer}).accepted).toBe(false);
});
describe('pair matrix: all 150 world/class combinations',()=>{
  const classes:ClassId[]=['human','undead','wild','monster','demon'];
  for(const w of Object.keys(WORLDS) as WorldId[]) for(const a of classes) for(const b of classes)
    test(`${w}/${a}/${b}`,()=>expect(pairAllowed(w,a,b)).toBe(WORLDS[w].native ? WORLDS[w].native===a || WORLDS[w].native===b : a===b));
});
test('placement reasons are exact; occupied and out-of-range slots rejected',()=>{
  const s=setup();put(s,0,6,'opol');
  expect(placementReason(s,0,'monster',7)).toBe('В Омуте пара может быть только одного класса.');
  expect(placementReason(s,0,'human',6)).toBe('Место занято.');
  put(s,0,2,'opol');
  expect(placementReason(s,0,'monster',3)).toBe('В мире Навь пара возможна, только если одна из карт — Нежить. Одна карта может стоять где угодно.');
  expect(placementReason(s,0,'human',3)).not.toBeNull(); // two foreign creatures, even of one class
  expect(placementReason(s,0,'undead',3)).toBeNull();
  expect(placementReason(s,0,'human',-1)).not.toBeNull();
});
test('placement pays exact cost, produces snapshot event, and does not mutate input',()=>{
  const s=setup(),h=hand(s,0,'druzh');
  const result=apply(freeze(s),{type:'PlayCreature',player:0,card:h.uid,slot:0});
  expect(result.accepted).toBe(true);expect(result.state.players[0].coins).toBe(7);
  expect(s.players[0].board[0]).toBeNull();
  const event=result.events.find(e=>e.type==='CardPlayed')!;
  expect(event.unit.hp).toBe(5);result.state.players[0].board[0]!.hp=1;expect(event.unit.hp).toBe(5);
});
test('insufficient funds and foreign cards cannot be played',()=>{
  const s=setup(),h=hand(s,0,'koshey');s.players[0].coins=2;
  expect(explainAction(s,{type:'PlayCreature',player:0,card:h.uid,slot:0})).toBe('Не хватает монет: нужно 7, у тебя 2.');
  expect(apply(s,{type:'PlayCreature',player:0,card:'foreign',slot:0}).accepted).toBe(false);
});
test.each([[1,2],[2,2],[3,3],[4,3],[5,4],[6,4],[7,5],[20,5]])('income turn %i = %i',(turn,n)=>expect(income(turn)).toBe(n));
test('income uses personal turns and wallet caps at ten',()=>{
  let s=start(1);const first=s.activePlayer;
  for(let i=0;i<14;i++) {
    const result=apply(s,{type:'EndTurn',player:s.activePlayer});s=result.state;
    const e=result.events.find(e=>e.type==='TurnStarted')!;
    expect(e.personalTurn).toBe(s.players[s.activePlayer].turns);expect(s.players[s.activePlayer].coins).toBeLessThanOrEqual(10);
  }
  expect(s.players[first].turns).toBe(8);expect(s.players[1-first].turns).toBe(7);
});
test('burn pays one coin, discards card, caps wallet and resets per-turn limit',()=>{
  let s=setup();s.players[0].coins=9;const hs=['opol','kot','bes'].map(id=>hand(s,0,id));
  for(const h of hs.slice(0,2))s=apply(s,{type:'Burn',player:0,card:h.uid}).state;
  expect(s.players[0].coins).toBe(10);expect(s.discard).toHaveLength(2);
  expect(apply(s,{type:'Burn',player:0,card:hs[2].uid}).accepted).toBe(false);
  s=apply(s,{type:'EndTurn',player:0}).state;s=apply(s,{type:'EndTurn',player:1}).state;
  expect(s.players[0].burnsThisTurn).toBe(0);
});
test('upgrade is permanent, once a turn, max three; Svyatogor costs one',()=>{
  let s=setup();const u=put(s,0,0,'svyat');
  s=apply(s,{type:'Upgrade',player:0,target:u.uid}).state;
  expect(s.players[0].coins).toBe(9);expect(s.players[0].board[0]!.attack).toBe(6);
  expect(apply(s,{type:'Upgrade',player:0,target:u.uid}).accepted).toBe(false);
  for(let i=0;i<2;i++){s.turn+=2;s=apply(s,{type:'Upgrade',player:0,target:u.uid}).state;}
  s.turn+=2;expect(apply(s,{type:'Upgrade',player:0,target:u.uid}).accepted).toBe(false);expect(s.players[0].board[0]!.attack).toBe(8);
  const v=put(s,0,2,'opol');const before=s.players[0].coins;s=apply(s,{type:'Upgrade',player:0,target:v.uid}).state;expect(s.players[0].coins).toBe(before-2);
});
test('hand overflow goes straight to discard',()=>{
  let s=setup();s.activePlayer=1;for(let i=0;i<8;i++)hand(s,0,'opol');s.deck=[{uid:'drawn',cardId:'kot'}];
  const r=apply(s,{type:'EndTurn',player:1});expect(r.state.players[0].hand).toHaveLength(8);expect(r.state.discard[0].uid).toBe('drawn');
  expect(r.events.find(e=>e.type==='CardDrawn')).toMatchObject({overflow:true});
});
test('fatigue begins on reshuffle, affects active player only, persists; empty deck AND discard terminates',()=>{
  let s=setup();s.discard=[{uid:'old',cardId:'opol'}];
  let r=apply(s,{type:'EndTurn',player:0});s=r.state;
  expect(s.fatigue).toBe(true);expect(s.players.map(p=>p.hp)).toEqual([25,24]);
  expect(r.events.some(e=>e.type==='DeckReshuffled')).toBe(true);
  s.players[0].hp=1;r=apply(s,{type:'EndTurn',player:1});
  expect(r.state.phase).toBe('over');expect(r.state.winner).toBe(1);expect(r.events.at(-1)?.type).toBe('GameOver');
  expect(legalActions(r.state)).toEqual([]);
});
test('concede and all actions after game over',()=>{
  const s=start();const r=apply(s,{type:'Concede',player:0});expect(r.state.winner).toBe(1);
  expect(apply(r.state,{type:'EndTurn',player:1}).accepted).toBe(false);
});

import { expect, test } from 'vitest';
import { chooseAction } from '../../src/engine/bot';
import { apply, assertGameState, legalActions } from '../../src/engine/rules';
import { simulateGame } from '../../src/engine/simulate';
import { random } from '../../src/engine/rng';
import { freeze, hand, put, setup, start } from './helpers';

test('medium closes a threatened empty world before nonlethal attack',()=>{
  const s=setup();hand(s,0,'opol');put(s,1,2,'volk');put(s,0,0,'svyat');
  const a=chooseAction(s,'medium');expect(a?.type).toBe('PlayCreature');
  if(a?.type==='PlayCreature')expect([2,3]).toContain(a.slot);
});
test('medium avoids lethal deathstrike from a lower reward target',()=>{
  const s=setup();s.players[0].coins=0;put(s,0,0,'smey',{hp:1});put(s,1,0,'opol');
  expect(chooseAction(s,'medium')?.type).toBe('EndTurn');
});
test('lethal hero attack takes precedence over defensive deployment',()=>{
  const s=setup();hand(s,0,'opol');put(s,1,2,'volk');put(s,0,0,'svyat');s.players[1].hp=1;
  const a=chooseAction(s,'medium');expect(a?.type).toBe('Attack');if(a?.type==='Attack')expect(a.target).toBe('hero');
});
test('decision is pure and reproducible; bot never concedes',()=>{
  const s=freeze(start(44));expect(chooseAction(s)).toEqual(chooseAction(s));expect(chooseAction(s)?.type).not.toBe('Concede');
  const over=apply(s,{type:'Concede',player:0}).state;expect(chooseAction(over)).toBeNull();
});
test.each([10,25,40])('both bot levels terminate with valid actions at starting HP %i',hp=>{
  for(let seed=0;seed<20;seed++) {
    const r=simulateGame(`mix-${hp}-${seed}`,seed%2?['easy','medium']:['medium','easy'],hp);
    expect([0,1]).toContain(r.winner);expect(r.actions).toBeLessThan(5000);
  }
});
test('legal-action fuzz: 30 seeds; every action accepted; serialization/replay stable',()=>{
  for(let seed=0;seed<30;seed++) {
    let s=start(seed),rng=seed;
    for(let i=0;i<1000 && s.phase!=='over';i++) {
      const actions=legalActions(s).filter(a=>a.type!=='Concede');
      const next=random(rng);rng=next.seed;const a=actions[Math.floor(next.value*actions.length)];
      const snapshot=JSON.stringify(s),r=apply(s,a);
      expect(r.accepted).toBe(true);expect(JSON.stringify(s)).toBe(snapshot);
      expect(r).toEqual(apply(JSON.parse(snapshot),a));
      s=r.state;assertGameState(s);
    }
    expect(s.phase).toBe('over');
  }
});

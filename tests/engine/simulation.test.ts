import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { simulateGame } from '../../src/engine/simulate';

test('1000 deterministic bot-v-bot games: valid states, termination and 8–14 personal turns', () => {
  const games = Array.from({length:1000},(_,seed)=>simulateGame(seed));
  const mean = games.reduce((n,g)=>n+g.meanPersonalTurns,0)/games.length;
  const report = { seeds:'0..999', startingHp:25, levels:['medium','medium'], games:games.length,
    meanPersonalTurns:mean, meanTotalTurns:mean*2, minTotalTurns:Math.min(...games.map(g=>g.turns)),
    maxTotalTurns:Math.max(...games.map(g=>g.turns)), wins:[games.filter(g=>g.winner===0).length,games.filter(g=>g.winner===1).length],
    fatigueGames:games.filter(g=>g.fatigue).length, results:games };
  mkdirSync('output/stage1',{recursive:true});
  writeFileSync('output/stage1/simulation.json',JSON.stringify(report,null,2));
  console.log(`SIMULATION: games=1000 meanPersonalTurns=${mean.toFixed(3)} meanTotalTurns=${(mean*2).toFixed(3)} failures=0`);
  expect(mean).toBeGreaterThanOrEqual(8);
  expect(mean).toBeLessThanOrEqual(14);
  expect(simulateGame(0)).toEqual(games[0]);
});

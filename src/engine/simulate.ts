import { chooseAction } from './bot';
import { apply, assertGameState, createGame } from './rules';
import type { BotLevel, GameState } from './types';

export function simulateGame(seed: string | number, levels: [BotLevel, BotLevel] = ['medium', 'medium'], startingHp = 25) {
  let state: GameState = createGame(seed, { startingHp });
  let actions = 0;
  while (state.phase !== 'over') {
    if (++actions > 5000) throw new Error(`Simulation did not terminate: seed=${seed}`);
    const action = chooseAction(state, levels[state.activePlayer]);
    if (!action) throw new Error(`No action: seed=${seed}`);
    const result = apply(state, action);
    if (!result.accepted) throw new Error(`Illegal bot action: seed=${seed}`);
    state = result.state;
    assertGameState(state);
  }
  return { seed, winner: state.winner!, turns: state.turn, personalTurns: state.players.map(p => p.turns),
    meanPersonalTurns: (state.players[0].turns + state.players[1].turns) / 2, actions, fatigue: state.fatigue };
}

import { settleHome } from '../../engine/effects';
import { assertGameState } from '../../engine/rules';
import type { GameEvent, GameState } from '../../engine/types';

// The match in progress survives a reload or the phone killing the tab.
const KEY = 'omut.match.v1';

export function saveMatch(state: GameState) {
  if (state.phase !== 'playing') { clearMatch(); return; }
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: Date.now(), state })); } catch { /* storage full or blocked */ }
}

export function loadMatch(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { v: number; state: GameState };
    if (data.v !== 1 || data.state?.phase !== 'playing') return null;
    const s = data.state;
    // Saves from before auto combat / the native-world bonus are brought up to date.
    s.autoAttack ??= true;
    const ignored: GameEvent[] = [];
    for (const p of [0, 1] as const) for (let slot = 0; slot < 8; slot++) {
      const u = s.players[p].board[slot];
      if (u && u.home === undefined) { u.home = false; settleHome(s, ignored, p, slot); }
    }
    assertGameState(s); // a damaged save is dropped, never half-loaded
    return s;
  } catch { clearMatch(); return null; }
}

export function hasSavedMatch() { return loadMatch() !== null; }

export function clearMatch() { try { localStorage.removeItem(KEY); } catch { /* blocked */ } }

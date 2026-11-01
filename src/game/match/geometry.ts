import type { PlayerId } from '../../engine/types';

export const ROW_Y: Record<PlayerId, number> = { 0: 346, 1: 118 };
export const WORLD_X = [10, 104, 198, 292] as const;
export const WORLD_W = 88, WORLD_H = 190;
export const BANNER_Y = 327;
/** Bottom edge of the hand fan: the lowest, tilted card still clears the bottom panel (y 774). */
export const HAND_BOTTOM = 755;

export type Rect = { x: number; y: number; w: number; h: number };
export const contains = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function slotRect(player: PlayerId, slot: number): Rect {
  return { x: WORLD_X[slot >> 1] + 6, y: ROW_Y[player] + 5 + (slot & 1) * 84, w: 76, h: 80 };
}
export function worldRect(player: PlayerId, world: number): Rect {
  return { x: WORLD_X[world], y: ROW_Y[player], w: WORLD_W, h: WORLD_H };
}
/** The name plate along the bottom edge of a world. */
export function worldIconRect(player: PlayerId, world: number): Rect {
  return { x: WORLD_X[world] + 4, y: ROW_Y[player] + 171, w: 80, h: 16 };
}
export const AVATAR: Record<PlayerId, Rect> = { 0: { x: 12, y: 787, w: 44, h: 44 }, 1: { x: 12, y: 6, w: 44, h: 44 } };
export const PANEL_Y: Record<PlayerId, number> = { 0: 809, 1: 28 };
export const HP_X = 66, COIN_X = 132;
export const DECK: Rect = { x: 10, y: 62, w: 64, h: 50 };
export const DISCARD: Rect = { x: 316, y: 62, w: 64, h: 50 };
/** Where cards fly from / to: the middle of the pile plates. */
export const DECK_C = { x: DECK.x + DECK.w / 2, y: DECK.y + 17 };
export const DISCARD_C = { x: DISCARD.x + DISCARD.w / 2, y: DISCARD.y + 17 };
/** Burn drop zone, shown over the bottom panel while a hand card is dragged. */
export const BURN_ZONE: Rect = { x: 10, y: 788, w: 370, h: 50 };
export const LEFT_BTN = { x: 10, y: 540 }, RIGHT_BTN = { x: 270, y: 540 };
export const END_BTN = { x: 228, y: 785 };

export function slotAt(player: PlayerId, x: number, y: number): number | null {
  for (let s = 0; s < 8; s++) if (contains(slotRect(player, s), x, y)) return s;
  return null;
}
export function worldAt(player: PlayerId, x: number, y: number): number | null {
  for (let w = 0; w < 4; w++) if (contains(worldRect(player, w), x, y)) return w;
  return null;
}

// Serializable Mulberry32: no ambient randomness or clock dependencies.
export function seedFrom(value: string | number): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Seed must be finite');
    return value >>> 0;
  }
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}
export function random(seed: number): { value: number; seed: number } {
  const next = (seed + 0x6D2B79F5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next };
}
export function shuffle<T>(input: readonly T[], seed: number): { items: T[]; seed: number } {
  const items = [...input];
  for (let i = items.length - 1; i > 0; i--) {
    const r = random(seed); seed = r.seed;
    const j = Math.floor(r.value * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return { items, seed };
}

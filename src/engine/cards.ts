import data from '../data/cards.json';
import type { CardDefinition, ClassId, WorldId } from './types';

export const CLASS_NAMES: Record<ClassId, string> = { human: 'Люди', undead: 'Нежить', wild: 'Нечисть', monster: 'Чудища', demon: 'Бесы' };
export const WORLDS: Record<WorldId, { name: string; native: ClassId | null; icon: string; color: string }> = {
  yav: { name: 'Явь', native: 'human', icon: 'sun', color: '#F2C14E' },
  nav: { name: 'Навь', native: 'undead', icon: 'skull', color: '#E6E2D6' },
  chasha: { name: 'Чаща', native: 'wild', icon: 'eye', color: '#7FC25A' },
  puchina: { name: 'Пучина', native: 'monster', icon: 'tentacle', color: '#6FB3E8' },
  peklo: { name: 'Пекло', native: 'demon', icon: 'flame', color: '#FF7A33' },
  omut: { name: 'Омут', native: null, icon: 'swirl', color: '#8FE0CF' },
};
const definitions = data as CardDefinition[];
for (const c of definitions) {
  Object.freeze(c.abilities); Object.freeze(c.focus); Object.freeze(c);
}
export const CARDS: readonly CardDefinition[] = Object.freeze(definitions);
const lookup = new Map(CARDS.map(c => [c.id, c]));
export function card(id: string): CardDefinition {
  const result = lookup.get(id);
  if (!result) throw new Error(`Unknown card: ${id}`);
  return result;
}

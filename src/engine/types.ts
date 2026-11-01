export type PlayerId = 0 | 1;
export type ClassId = 'human' | 'undead' | 'wild' | 'monster' | 'demon';
export type WorldId = 'yav' | 'nav' | 'chasha' | 'puchina' | 'peklo' | 'omut';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Keyword = 'priority' | 'ranged' | 'rush' | 'shield' | 'steadfast' | 'greed' | 'blood' | 'poison' | 'healer' | 'ram' | 'devour' | 'surface';
export interface CardDefinition {
  id: string; name: string; kind: 'creature' | 'spell'; class: ClassId | null;
  rarity: Rarity; cost: number; attack: number; health: number; reward: number;
  abilities: Partial<Record<Keyword, number>>;
  abilityText: string; description: string; copies: number; token: boolean;
  world: WorldId; focus: [number, number];
}
export interface HandCard { uid: string; cardId: string }
export interface Creature extends HandCard {
  attack: number; hp: number; maxHp: number;
  poison: number; steadfastUsed: boolean; upgrades: number;
  enteredTurn: number; attackedTurn: number; upgradedTurn: number; movedTurn?: number;
  /** Standing in its native world: +1 attack while it stays there. */
  home?: boolean;
  temporaryPriority: boolean;
}
export interface PlayerState {
  hp: number; coins: number; turns: number; burnsThisTurn: number;
  hand: HandCard[]; board: (Creature | null)[];
  stats: { kills: number; earned: number; spent: number; burned: number };
}
export interface GameState {
  version: 1; seed: number; rng: number; nextUid: number; steps: number;
  worlds: WorldId[]; players: [PlayerState, PlayerState];
  deck: HandCard[]; discard: HandCard[];
  startingHp: number; firstPlayer: PlayerId; activePlayer: PlayerId;
  phase: 'mulligan' | 'playing' | 'over'; mulliganDone: [boolean, boolean];
  turn: number; fatigue: boolean; winner: PlayerId | null;
  /** Creatures strike by themselves when their owner ends the turn (manual Attack is then not offered). */
  autoAttack?: boolean;
}
export interface GameOptions { startingHp?: number; autoAttack?: boolean }
export type Action =
  | { type: 'Mulligan'; player: PlayerId; cards: string[] }
  | { type: 'PlayCreature'; player: PlayerId; card: string; slot: number }
  | { type: 'CastSpell'; player: PlayerId; card: string; target?: string; slot?: number }
  | { type: 'Attack'; player: PlayerId; attacker: string; target: string | 'hero' }
  | { type: 'Upgrade'; player: PlayerId; target: string }
  | { type: 'Move'; player: PlayerId; unit: string; slot: number }
  | { type: 'Burn'; player: PlayerId; card: string }
  | { type: 'EndTurn'; player: PlayerId }
  | { type: 'Concede'; player: PlayerId };

interface EventPayloads {
  TurnStarted: { player: PlayerId; turn: number; personalTurn: number };
  CardDrawn: { player: PlayerId; card: HandCard; overflow: boolean };
  CoinsChanged: { player: PlayerId; delta: number; coins: number; reason: string };
  CardPlayed: { player: PlayerId; slot: number; unit: Creature };
  SpellCast: { player: PlayerId; card: HandCard; target?: string; slot?: number };
  AttackDeclared: { player: PlayerId; attacker: string; target: string };
  DamageDealt: { target: string; amount: number; hp: number; source: string; cause: 'attack' | 'deathstrike' | 'spell' | 'poison' };
  Healed: { player: PlayerId; target: string | 'hero'; amount: number; hp: number };
  StatusApplied: { target: string; status: string; value: number };
  CardDied: { player: PlayerId; slot: number; unit: Creature; cause: string };
  DeathStrike: { attacker: string; target: string; amount: number };
  RewardPaid: { player: PlayerId; card: string; reward: number; received: number };
  PlayerDamaged: { player: PlayerId; amount: number; hp: number; cause: string };
  Transformed: { player: PlayerId; slot: number; before: Creature; after: Creature };
  Upgraded: { target: string; attack: number; upgrades: number; cost: number };
  Moved: { player: PlayerId; unit: string; from: number; to: number };
  CombatStarted: { player: PlayerId; attacks: number };
  CardBurned: { player: PlayerId; card: HandCard };
  GameOver: { winner: PlayerId; reason: string };
  DeckReshuffled: { count: number };
  FatigueStarted: Record<never, never>;
  MulliganDone: { player: PlayerId; replaced: number };
  ActionRejected: { reason: string };
}
export type GameEvent = { [K in keyof EventPayloads]: { type: K } & EventPayloads[K] }[keyof EventPayloads];
export interface Transition { state: GameState; events: GameEvent[]; accepted: boolean }
export type BotLevel = 'easy' | 'medium';

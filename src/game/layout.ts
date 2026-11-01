export const WIDTH = 390;
export const HEIGHT = 844;
export const ZONES = [
  { id: 'top', name: 'Верхняя панель', y: 0, height: 56 },
  { id: 'bot-hand', name: 'Рука бота', y: 60, height: 54 },
  { id: 'bot-worlds', name: 'Ряд бота', y: 118, height: 190 },
  { id: 'banner', name: 'Баннер', y: 312, height: 30 },
  { id: 'player-worlds', name: 'Твой ряд', y: 346, height: 190 },
  { id: 'hand', name: 'Рука', y: 540, height: 230 },
  { id: 'bottom', name: 'Нижняя панель', y: 774, height: 70 },
] as const;
export const WORLD_X = [10, 104, 198, 292] as const;

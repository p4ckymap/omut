import Phaser from 'phaser';

export const W = 390;
export const H = 844;
/** Canvas pixels per logical pixel. Logical layout stays 390×844; the camera zooms. */
// Never below ×2: on low-DPI screens the canvas is supersampled and downscaled, which keeps text and lines crisp.
export const Z = Math.max(2, Math.min(3, Math.ceil((window.devicePixelRatio || 1) *
  Math.min(window.innerWidth / W, window.innerHeight / H) - 0.1)));

export const C = {
  bg: 0x0c0d0e, panel: 0x16181a, panel2: 0x1f2225, line: 0x3b3f43, line2: 0x5a5f64,
  ink: 0xece6d6, muted: 0x9d988c, gold: 0xe2b33c, goldBg: 0x2a2208, blood: 0xe2483c, heal: 0x94d36c,
  deep: 0x070a0d, water: 0x0f1a20, wound: 0xff6a5e, deny: 0xff9a90,
} as const;
export const HEX = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
export const RARITY_COLOR = { common: 0xaeb2b7, rare: 0x4f8fd6, epic: 0xa35cff, legendary: 0xe2b33c } as const;
export const RARITY_NAME = { common: 'Обычная', rare: 'Редкая', epic: 'Эпическая', legendary: 'Легендарная' } as const;
export const CLASS_ICON = { human: 'sun', undead: 'skull', wild: 'eye', monster: 'tentacle', demon: 'flame' } as const;

type TextOpts = { size?: number; color?: number | string; font?: 'pixel' | 'text' | 'display'; bold?: boolean; align?: string; wrap?: number; stroke?: boolean; line?: number };
export const FONT = { ui: '"Golos Text", sans-serif', display: '"Ruslan Display", "Golos Text", serif' };
/** Text helper. 'pixel' (default) = bold UI type for numbers and labels; 'display' = title face; 'text' = body. */
export function text(scene: Phaser.Scene, x: number, y: number, value: string, o: TextOpts = {}) {
  const font = o.font ?? 'pixel';
  const size = font === 'pixel' ? Math.round((o.size ?? 16) * (o.size && o.size >= 32 ? 0.8 : 0.95)) : o.size ?? 16;
  const t = scene.add.text(x, y, value, {
    fontFamily: font === 'display' ? FONT.display : FONT.ui,
    fontSize: `${size}px`,
    fontStyle: font === 'pixel' || o.bold ? '700' : 'normal',
    color: typeof o.color === 'number' ? HEX(o.color) : o.color ?? HEX(C.ink),
    align: o.align ?? 'left',
    wordWrap: o.wrap ? { width: o.wrap, useAdvancedWrap: true } : undefined,
    lineSpacing: o.line ?? 0,
    stroke: o.stroke ? '#000000' : undefined,
    strokeThickness: o.stroke ? 4 : 0,
    resolution: Z,
  });
  return t;
}

export function setupCamera(scene: Phaser.Scene) {
  const cam = scene.cameras.main;
  cam.setZoom(Z);
  cam.centerOn(W / 2, H / 2);
  cam.setBackgroundColor(C.bg);
}

/** Panel: rounded corners (radius ≈ 1.6 × cut), 2px border, optional soft shadow underneath. */
export function panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number,
  fill: number, stroke: number, opts: { cut?: number; shadow?: boolean; alpha?: number; border?: number } = {}) {
  const r = Math.round((opts.cut ?? 4) * 1.6), b = opts.border ?? 2, a = opts.alpha ?? 1;
  if (opts.shadow) { g.fillStyle(0x000000, 0.45); g.fillRoundedRect(x, y + 4, w, h, r); }
  g.fillStyle(fill, a); g.fillRoundedRect(x, y, w, h, r);
  if (b > 0) { g.lineStyle(b, stroke, a); g.strokeRoundedRect(x + b / 2, y + b / 2, w - b, h - b, Math.max(1, r - b / 2)); }
}

/** Rounded outline with the stroke kept fully inside the box. */
export function strokeCut(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, width = 2, cut = 4, alpha = 1) {
  g.lineStyle(width, color, alpha);
  g.strokeRoundedRect(x + width / 2, y + width / 2, w - width, h - width, Math.max(1, Math.round(cut * 1.6) - width / 2));
}

/** Vector icon (see icons.ts), rasterised at boot for the canvas zoom. */
export function icon(scene: Phaser.Scene, x: number, y: number, name: string, size = 16) {
  return scene.add.image(x, y, `i:${name}`).setDisplaySize(size, size).setOrigin(0.5);
}

// ---------- settings ----------
export interface Settings { hp: number; bot: 'easy' | 'medium'; speed: 1 | 1.5 | 2; reduceMotion: boolean; volume: number; music: boolean; tutorialDone: boolean; wins: number; losses: number; turnTime: number }
const KEY = 'omut.settings.v1';
const DEFAULTS: Settings = { hp: 25, bot: 'medium', speed: 1, reduceMotion: false, volume: 70, music: true, tutorialDone: false, wins: 0, losses: 0, turnTime: 60 };
function loadSettings(): Settings {
  let raw: Partial<Settings> = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}; } catch { /* blocked storage or bad JSON */ }
  const s = { ...DEFAULTS, ...raw };
  // Never trust stored values: a broken speed or hp would freeze or crash the match.
  if (![1, 1.5, 2].includes(s.speed)) s.speed = 1;
  if (!Number.isInteger(s.hp) || s.hp < 10 || s.hp > 40 || s.hp % 5) s.hp = 25;
  if (s.bot !== 'easy' && s.bot !== 'medium') s.bot = 'medium';
  if (![0, 30, 45, 60, 90].includes(s.turnTime)) s.turnTime = 60;
  s.volume = Number.isFinite(s.volume) ? Math.max(0, Math.min(100, Math.round(s.volume / 10) * 10)) : 70;
  for (const k of ['reduceMotion', 'music', 'tutorialDone'] as const) s[k] = !!s[k];
  for (const k of ['wins', 'losses'] as const) s[k] = Number.isInteger(s[k]) && s[k] >= 0 ? s[k] : 0;
  if (!('reduceMotion' in raw) && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) s.reduceMotion = true;
  return s;
}
export const settings: Settings = loadSettings();
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ } }

/** Duration scaled by the animation-speed setting. */
export const ms = (v: number) => Math.round(v * 0.8 / settings.speed);

export function tween(scene: Phaser.Scene, cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise(resolve => {
    const done = cfg.onComplete;
    scene.tweens.add({ ...cfg, duration: ms(Number(cfg.duration ?? 300)), delay: ms(Number(cfg.delay ?? 0)),
      onComplete: (...a: unknown[]) => { (done as ((...x: unknown[]) => void) | undefined)?.(...a); resolve(); } });
  });
}
/** pointerup counts only if the press also started on this object (Phaser delivers ups to whatever is under the finger). */
export function onTap(obj: Phaser.GameObjects.GameObject, fn: (p: Phaser.Input.Pointer) => void) {
  let down = false;
  obj.on('pointerdown', () => { down = true; });
  obj.on('pointerout', () => { down = false; });
  obj.on('pointerup', (p: Phaser.Input.Pointer) => { if (down) { down = false; fn(p); } });
}
export function wait(scene: Phaser.Scene, v: number): Promise<void> {
  return new Promise(resolve => scene.time.delayedCall(ms(v), resolve));
}

// ---------- overlay stack: Esc and the browser Back button close the top overlay ----------
// Each overlay owns one history entry tagged with its depth; popstate closes everything above the
// depth it lands on, so Back, Forward and programmatic history.go() never drift out of sync.
interface Entry { hide: () => void; close: () => void; open: boolean }
const stack: Entry[] = [];
const goBack = (n: number) => { try { if (n) history.go(-n); } catch { /* sandboxed */ } };
export const overlays = {
  /** Registers an overlay; returns close(), which the overlay's own buttons must call. */
  push(hide: () => void): () => void {
    const entry: Entry = { hide, open: true, close: () => {
      if (!entry.open) return;
      entry.open = false;
      const i = stack.indexOf(entry);
      if (i >= 0) {
        const above = stack.splice(i);
        goBack(above.length);
        for (const e of above.slice(1)) if (e.open) { e.open = false; e.hide(); }
      }
      hide();
    } };
    stack.push(entry);
    try { history.pushState({ omut: stack.length }, ''); } catch { /* sandboxed */ }
    return entry.close;
  },
  closeTop() { stack[stack.length - 1]?.close(); },
  get size() { return stack.length; },
  /** Drops every overlay with one history jump. */
  clear() {
    const all = stack.splice(0);
    goBack(all.length);
    for (const e of all) if (e.open) { e.open = false; e.hide(); }
  },
};
window.addEventListener('popstate', () => {
  const depth = Number((history.state as { omut?: number } | null)?.omut ?? 0);
  // Detach first: a hide() may open a new overlay, which must not be swept up by this same pass.
  const closing = stack.splice(Math.max(0, depth)).reverse();
  for (const e of closing) if (e.open) { e.open = false; e.hide(); }
});
window.addEventListener('keydown', e => { if (e.key === 'Escape') overlays.closeTop(); });

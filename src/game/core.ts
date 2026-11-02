import Phaser from 'phaser';

export const W = 390;
export const H = 844;
/** Canvas pixels per logical pixel. Logical layout stays 390×844; the camera zooms. */
// Never below ×2: on low-DPI screens the canvas is supersampled and downscaled, which keeps text and lines crisp.
export const Z = Math.max(2, Math.min(3, Math.ceil((window.devicePixelRatio || 1) *
  Math.min(window.innerWidth / W, window.innerHeight / H) - 0.1)));

export const C = {
  bg: 0x11191f, panel: 0x17252e, panel2: 0x22313a, line: 0x304954, line2: 0x587888,
  ink: 0xf1ebdd, muted: 0x9bb3be, gold: 0xe2b33c, goldBg: 0x2a2208, blood: 0xe2483c, heal: 0x94d36c,
  deep: 0x0b1319, water: 0x132733, wound: 0xff6a5e, deny: 0xff9a90,
  accent: 0x93b8c6, accentBg: 0x233f4d, accentInk: 0x0b1a23,
} as const;
export const HEX = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
export const RARITY_COLOR = { common: 0xaeb2b7, rare: 0x4f8fd6, epic: 0xa35cff, legendary: 0xe2b33c } as const;
export const RARITY_NAME = { common: 'Обычная', rare: 'Редкая', epic: 'Эпическая', legendary: 'Легендарная' } as const;
export const CLASS_ICON = { human: 'sun', undead: 'skull', wild: 'eye', monster: 'tentacle', demon: 'flame' } as const;

type TextOpts = { size?: number; color?: number | string; font?: 'pixel' | 'text' | 'display'; bold?: boolean; align?: string; wrap?: number; stroke?: boolean; line?: number };
export const FONT = { ui: '"Golos Text", sans-serif', display: '"Tiny5", "Golos Text", sans-serif' };
/** Pixel headings and labels; small explanatory copy uses the readable body face. */
export function text(scene: Phaser.Scene, x: number, y: number, value: string, o: TextOpts = {}) {
  const font = o.font ?? 'pixel';
  const size = o.size ?? 16;
  const pixel = font === 'display' || (font === 'pixel' && size >= 14);
  const t = scene.add.text(x, y, value, {
    fontFamily: pixel ? FONT.display : FONT.ui,
    fontSize: `${size}px`,
    fontStyle: !pixel && (font === 'pixel' || o.bold) ? '700' : 'normal',
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
  document.documentElement.dataset.scene = scene.scene.key;
  const cam = scene.cameras.main;
  cam.setZoom(Z);
  cam.centerOn(W / 2, H / 2);
  cam.setBackgroundColor(C.bg);
}

/** Rectilinear two-step corners: the same pixel frame on every game surface. */
function cutPath(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, cut: number) {
  const c = Math.max(0, Math.min(cut, w / 4, h / 4));
  const s = c / 2;
  g.beginPath(); g.moveTo(x + c, y);
  g.lineTo(x + w - c, y); g.lineTo(x + w - c, y + s); g.lineTo(x + w - s, y + s);
  g.lineTo(x + w - s, y + c); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c);
  g.lineTo(x + w - s, y + h - c); g.lineTo(x + w - s, y + h - s); g.lineTo(x + w - c, y + h - s);
  g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h); g.lineTo(x + c, y + h - s);
  g.lineTo(x + s, y + h - s); g.lineTo(x + s, y + h - c); g.lineTo(x, y + h - c);
  g.lineTo(x, y + c); g.lineTo(x + s, y + c); g.lineTo(x + s, y + s);
  g.lineTo(x + c, y + s); g.closePath();
}

/** Stepped panel, inset border and optional pixel shadow. */
export function panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number,
  fill: number, stroke: number, opts: { cut?: number; shadow?: boolean; alpha?: number; border?: number } = {}) {
  const cut = opts.cut ?? 4, b = opts.border ?? 2, a = opts.alpha ?? 1;
  if (opts.shadow) { g.fillStyle(0x000000, 0.4 * a); cutPath(g, x, y + 4, w, h, cut); g.fillPath(); }
  g.fillStyle(fill, a); cutPath(g, x, y, w, h, cut); g.fillPath();
  if (b > 0) strokeCut(g, x, y, w, h, stroke, b, cut, a);
}

/** Pixel outline with the stroke kept fully inside the box. */
export function strokeCut(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, width = 2, cut = 4, alpha = 1) {
  g.lineStyle(width, color, alpha);
  cutPath(g, x + width / 2, y + width / 2, w - width, h - width, Math.max(0, cut - width / 2));
  g.strokePath();
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
interface Entry { hide: () => void; close: () => Promise<void>; open: boolean }
const stack: Entry[] = [];
/** Resolve after the browser finishes its asynchronous traversal, before starting a new scene. */
const goBack = (n: number): Promise<void> => new Promise(resolve => {
  if (!n) { resolve(); return; }
  let timer: ReturnType<typeof setTimeout>;
  const done = () => { window.removeEventListener('popstate', done); clearTimeout(timer); resolve(); };
  window.addEventListener('popstate', done, { once: true });
  // Some embedded browsers ignore history.go. They must not trap scene navigation.
  timer = setTimeout(done, 1000);
  try { history.go(-n); } catch { done(); }
});
export const overlays = {
  /** Registers an overlay; returns close(), which the overlay's own buttons must call. */
  push(hide: () => void): () => Promise<void> {
    const entry: Entry = { hide, open: true, close: () => {
      if (!entry.open) return Promise.resolve();
      entry.open = false;
      const i = stack.indexOf(entry);
      let settled = Promise.resolve();
      if (i >= 0) {
        const above = stack.splice(i);
        settled = goBack(above.length);
        for (const e of above.slice(1)) if (e.open) { e.open = false; e.hide(); }
      }
      hide();
      return settled;
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

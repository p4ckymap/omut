import { overlays } from './game/core';

interface TgWebApp {
  ready(): void; expand(): void; disableVerticalSwipes?(): void;
  setHeaderColor?(c: string): void; setBackgroundColor?(c: string): void; setBottomBarColor?(c: string): void;
  platform?: string;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; isVisible: boolean };
  HapticFeedback?: { impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void; notificationOccurred(t: 'error' | 'success' | 'warning'): void };
}
let tg: TgWebApp | undefined;

/** Telegram passes its launch data in the URL hash; only then is the SDK worth loading. */
const launchedFromTelegram = () => /tgWebApp(Data|Platform|Version)=/.test(location.hash);

/**
 * Telegram Mini App wiring: full height, no swipe-to-close (it fights card dragging), dark chrome, native Back.
 * The SDK is fetched only inside Telegram, so a slow telegram.org never delays the game in a normal browser.
 */
export function initTelegram() {
  if (!launchedFromTelegram()) return;
  const s = document.createElement('script');
  s.src = 'https://telegram.org/js/telegram-web-app.js?57';
  s.onload = () => {
    tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    tg.disableVerticalSwipes?.();
    tg.setHeaderColor?.('#0C0D0E');
    tg.setBackgroundColor?.('#0C0D0E');
    tg.setBottomBarColor?.('#0C0D0E');
    // Telegram's Back button closes the top window, or opens the pause during a match (same as Esc).
    tg.BackButton.onClick(() => overlays.closeTop());
    window.setInterval(() => {
      if (!tg) return;
      const want = overlays.size > 0;
      if (want !== tg.BackButton.isVisible) { if (want) tg.BackButton.show(); else tg.BackButton.hide(); }
    }, 250);
  };
  document.head.appendChild(s);
}

/** Light vibration on supported phones inside Telegram. */
export function haptic(kind: 'light' | 'medium' | 'heavy' | 'error' | 'success') {
  if (!tg?.HapticFeedback) return;
  if (kind === 'error' || kind === 'success') tg.HapticFeedback.notificationOccurred(kind);
  else tg.HapticFeedback.impactOccurred(kind);
}

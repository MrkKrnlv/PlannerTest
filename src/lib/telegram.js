// Telegram Mini App. Скрипт Telegram грузим только если нас реально открыли из Telegram:
// в обычном браузере и PWA он не нужен (а в РФ telegram.org может отвечать медленно).
const SCRIPT = 'https://telegram.org/js/telegram-web-app.js';

export function launchedFromTelegram() {
  if (location.hash.includes('tgWebAppData')) return true;
  try {
    return !!sessionStorage.getItem('__telegram__initParams');
  } catch {
    return false;
  }
}

let tg = null;

export function loadTelegram() {
  return new Promise((resolve) => {
    if (window.Telegram?.WebApp) return resolve((tg = window.Telegram.WebApp));
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.onload = () => resolve((tg = window.Telegram?.WebApp || null));
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

export const getTelegram = () => tg;

export function setupTelegramChrome() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  try {
    tg.disableVerticalSwipes?.();
  } catch {
    /* старые клиенты */
  }
  const apply = () => {
    const dark = tg.colorScheme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.tg = '1';
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    try {
      tg.setHeaderColor(bg);
      tg.setBackgroundColor(bg);
    } catch {
      /* setHeaderColor с hex есть не во всех версиях */
    }
  };
  apply();
  tg.onEvent('themeChanged', apply);
}

export function haptic(kind = 'light') {
  const h = tg?.HapticFeedback;
  if (!h) return;
  if (kind === 'success' || kind === 'warning' || kind === 'error') h.notificationOccurred(kind);
  else h.impactOccurred(kind);
}

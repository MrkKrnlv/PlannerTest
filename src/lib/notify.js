import { useStore } from '../store.js';
import { getTelegram, haptic } from './telegram.js';

let audio = null;
function beep() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audio.currentTime;
    [0, 0.25, 0.5].forEach((d) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
      o.connect(g).connect(audio.destination);
      o.start(t0 + d);
      o.stop(t0 + d + 0.2);
    });
  } catch {
    /* звук недоступен */
  }
}

/** Уведомление: системное, если разрешено и мы не в Telegram, плюс тост, звук и вибрация */
export async function notify(title, body, { sound = false } = {}) {
  useStore.getState().showToast(body ? `${title}. ${body}` : title);
  haptic('warning');
  navigator.vibrate?.([200, 100, 200]);
  if (sound) beep();
  if (getTelegram() || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: '/icons/icon-192.png', tag: title });
    else new Notification(title, { body, icon: '/icons/icon-192.png' });
  } catch {
    /* браузер не дал показать */
  }
}

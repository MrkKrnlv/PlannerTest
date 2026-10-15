import { useStore } from '../store.js';
import { api } from './api.js';

/**
 * Синк-движок:
 *  - любая правка помечает задачу "грязной" -> через 800 мс push
 *  - push: отправляем грязные задачи целиком, сервер решает по updated_at
 *  - pull: забираем всё с rev > нашего (страницами), мерджим
 *  - pull также при фокусе вкладки, возврате в сеть и раз в 30 с
 */
let timer = null;
let running = false;
let queued = false;

const PUSH_DELAY = 800;
const POLL_MS = 30_000;

export function scheduleSync(delay = PUSH_DELAY) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

export async function syncNow() {
  const s = useStore.getState();
  if (!s.token) return;
  if (!navigator.onLine) {
    s.setSync({ status: 'offline' });
    return;
  }
  if (running) {
    queued = true;
    return;
  }
  running = true;
  s.setSync({ status: 'syncing', error: null });

  try {
    // push
    const state = useStore.getState();
    const snapshot = Object.keys(state.dirty).map((id) => state.tasks[id]).filter(Boolean);
    for (let i = 0; i < snapshot.length; i += 200) {
      const chunk = snapshot.slice(i, i + 200);
      await api('/tasks/sync', { token: state.token, method: 'POST', body: { changes: chunk } });
      useStore.getState().markPushed(chunk);
    }

    // pull
    let more = true;
    while (more) {
      const { token, rev } = useStore.getState();
      const res = await api(`/tasks?since=${rev}`, { token });
      useStore.getState().applyRemote(res.tasks, res.rev);
      more = res.more;
    }

    useStore.getState().setSync({ status: 'ok', at: Date.now() });
  } catch (err) {
    const status = err.status === 401 ? 'auth' : navigator.onLine ? 'error' : 'offline';
    useStore.getState().setSync({ status, error: err.message });
  } finally {
    running = false;
    if (queued) {
      queued = false;
      scheduleSync(0);
    }
  }
}

let started = false;

export function startSync() {
  if (started) return;
  started = true;

  // любая новая грязная правка -> отложенный push
  useStore.subscribe((s, prev) => {
    if (s.dirty !== prev.dirty && Object.keys(s.dirty).length) scheduleSync();
    if (s.token && s.token !== prev.token) scheduleSync(0);
  });

  const pull = () => document.visibilityState === 'visible' && scheduleSync(0);
  document.addEventListener('visibilitychange', pull);
  window.addEventListener('focus', pull);
  window.addEventListener('online', () => scheduleSync(0));
  window.addEventListener('offline', () => useStore.getState().setSync({ status: 'offline' }));
  setInterval(pull, POLL_MS);

  scheduleSync(0);
}

import { useStore } from '../store.js';
import { api } from './api.js';

/**
 * Синк-движок. Две коллекции с одинаковой схемой:
 *  - задачи      POST /api/tasks/sync,  GET /api/tasks?since=rev
 *  - документы   POST /api/items/sync,  GET /api/items?since=rev
 * Любая правка помечает запись грязной -> через 800 мс push, затем pull дельты.
 * Pull ещё при фокусе вкладки, возврате в сеть и раз в 30 с.
 */
const COLLECTIONS = [
  { push: '/tasks/sync', pull: '/tasks', key: 'tasks', dirty: 'dirty', rev: 'rev', resKey: 'tasks', pushed: 'markPushed', apply: 'applyRemote' },
  { push: '/items/sync', pull: '/items', key: 'items', dirty: 'itemsDirty', rev: 'itemsRev', resKey: 'items', pushed: 'markItemsPushed', apply: 'applyRemoteItems' },
];

let timer = null;
let running = false;
let queued = false;

export function scheduleSync(delay = 800) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

export async function syncNow() {
  const s = useStore.getState();
  if (!s.token) return;
  if (!navigator.onLine) return s.setSync({ status: 'offline' });
  if (running) {
    queued = true;
    return;
  }
  running = true;
  s.setSync({ status: 'syncing', error: null });

  try {
    for (const c of COLLECTIONS) {
      const st = useStore.getState();
      const snapshot = Object.keys(st[c.dirty]).map((id) => st[c.key][id]).filter(Boolean);
      for (let i = 0; i < snapshot.length; i += 200) {
        const chunk = snapshot.slice(i, i + 200);
        await api(c.push, { token: st.token, method: 'POST', body: { changes: chunk } });
        useStore.getState()[c.pushed](chunk);
      }
    }
    for (const c of COLLECTIONS) {
      let more = true;
      while (more) {
        const st = useStore.getState();
        const res = await api(`${c.pull}?since=${st[c.rev]}`, { token: st.token });
        useStore.getState()[c.apply](res[c.resKey], res.rev);
        more = res.more;
      }
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
  useStore.subscribe((s, prev) => {
    const changed =
      (s.dirty !== prev.dirty && Object.keys(s.dirty).length) ||
      (s.itemsDirty !== prev.itemsDirty && Object.keys(s.itemsDirty).length);
    if (changed) scheduleSync();
    if (s.token && s.token !== prev.token) scheduleSync(0);
  });
  const pull = () => document.visibilityState === 'visible' && scheduleSync(0);
  document.addEventListener('visibilitychange', pull);
  window.addEventListener('focus', pull);
  window.addEventListener('online', () => scheduleSync(0));
  window.addEventListener('offline', () => useStore.getState().setSync({ status: 'offline' }));
  setInterval(pull, 30_000);
  scheduleSync(0);
}

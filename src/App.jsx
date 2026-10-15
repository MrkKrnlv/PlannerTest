import { useEffect, useState } from 'react';
import { useStore } from './store.js';
import { api } from './lib/api.js';
import { startSync } from './lib/sync.js';
import { launchedFromTelegram, loadTelegram, setupTelegramChrome } from './lib/telegram.js';
import { todayISO } from './lib/date.js';
import DayView from './components/DayView.jsx';
import WeekView from './components/WeekView.jsx';
import Settings from './components/Settings.jsx';
import TaskSheet from './components/TaskSheet.jsx';
import Connect from './components/Connect.jsx';
import SyncDot from './components/SyncDot.jsx';
import { IconDay, IconSettings, IconWeek } from './components/Icons.jsx';

const TABS = [
  ['day', 'День', IconDay],
  ['week', 'Неделя', IconWeek],
  ['settings', 'Настройки', IconSettings],
];

function useBoot() {
  const [state, setState] = useState({ ready: false, error: null });
  useEffect(() => {
    (async () => {
      if (launchedFromTelegram()) {
        const tg = await loadTelegram();
        if (tg?.initData) {
          setupTelegramChrome();
          try {
            const res = await api('/auth/telegram', { method: 'POST', body: { initData: tg.initData } });
            const prev = useStore.getState();
            // другой аккаунт Telegram на том же устройстве — начинаем с чистого листа
            if (prev.user && prev.user.id !== res.user.id) prev.logout();
            useStore.getState().setAuth(res);
          } catch (err) {
            if (!useStore.getState().token) {
              setState({ ready: true, error: `Не удалось войти через Telegram: ${err.message}` });
              return;
            }
          }
        }
      }
      startSync();
      setState({ ready: true, error: null });
    })();
  }, []);
  return state;
}

export default function App() {
  const { ready, error } = useBoot();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const setDate = useStore((s) => s.setDate);
  const signedIn = useStore((s) => !!s.token || s.localOnly);

  // после полуночи "сегодня" должно сдвинуться
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const s = useStore.getState();
      if (s.date < todayISO() && s.view !== 'week') setDate(todayISO());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [setDate]);

  if (!ready) return <div className="boot" aria-busy="true" />;
  if (!signedIn) return <Connect error={error} />;

  return (
    <div className="app">
      <nav className="nav" aria-label="Разделы">
        <div className="brand" aria-hidden="true">
          <span className="brand-strip" />
        </div>
        <ul className="nav-tabs">
          {TABS.map(([id, label, Icon]) => (
            <li key={id}>
              <button type="button" className="nav-tab" aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
                <Icon />
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
        <SyncDot />
      </nav>
      <main className="content">
        {view === 'day' && <DayView />}
        {view === 'week' && <WeekView />}
        {view === 'settings' && <Settings />}
      </main>
      <TaskSheet />
    </div>
  );
}

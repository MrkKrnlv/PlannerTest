import { useEffect, useState } from 'react';
import { useStore, liveItems, hasLog } from './store.js';
import { api } from './lib/api.js';
import { startSync } from './lib/sync.js';
import { launchedFromTelegram, loadTelegram, setupTelegramChrome } from './lib/telegram.js';
import { nowMin, todayISO } from './lib/date.js';
import { habitLogId, isScheduled } from './lib/habits.js';
import { notify } from './lib/notify.js';
import DayView from './components/day/DayView.jsx';
import CalendarView from './components/CalendarView.jsx';
import HabitsView from './components/HabitsView.jsx';
import GoalsView from './components/GoalsView.jsx';
import MoreView from './components/MoreView.jsx';
import TaskSheet from './components/TaskSheet.jsx';
import Connect from './components/Connect.jsx';
import SyncDot from './components/SyncDot.jsx';
import { fmtClock, leftMs, useTick } from './components/TimersView.jsx';
import { IconCalendar, IconDay, IconGoal, IconHabit, IconMore, IconTimer } from './components/Icons.jsx';

const TABS = [
  ['day', 'День', IconDay],
  ['calendar', 'Календарь', IconCalendar],
  ['habits', 'Привычки', IconHabit],
  ['goals', 'Цели', IconGoal],
  ['more', 'Ещё', IconMore],
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

/** Таймеры: по окончании уведомляем один раз */
function useTimerAlerts() {
  const timers = useStore((s) => s.timers);
  useEffect(() => {
    const check = () => {
      for (const t of useStore.getState().timers) {
        if (t.endsAt && !t.notified && t.endsAt <= Date.now()) {
          useStore.getState().markTimerNotified(t.id);
          notify(t.kind === 'focus' ? 'Фокус закончился' : 'Таймер готов', t.label, { sound: true });
        }
      }
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [timers.length]);
}

/** Напоминания привычек, пока приложение открыто */
function useHabitReminders() {
  useEffect(() => {
    const sent = new Set();
    const check = () => {
      const { items } = useStore.getState();
      const today = todayISO();
      for (const h of liveItems(items, 'habit')) {
        const key = `${h.id}:${today}`;
        if (!h.data.remind || h.data.archived || sent.has(key) || !isScheduled(h, today)) continue;
        const [hh, mm] = h.data.remind.split(':').map(Number);
        const late = nowMin() - (hh * 60 + mm);
        // в окне 30 минут после времени напоминания и если ещё не отмечено
        if (late >= 0 && late <= 30 && !hasLog(items, habitLogId(h.id, today))) {
          sent.add(key);
          notify('Привычка', h.data.name);
        }
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);
}

function TimerPill() {
  const timers = useStore((s) => s.timers);
  const setMoreView = useStore((s) => s.setMoreView);
  const onTimersPage = useStore((s) => s.view === 'more' && s.moreView === 'timers');
  useTick(timers.length > 0);
  if (!timers.length || onTimersPage) return null;
  const next = [...timers].sort((a, b) => leftMs(a) - leftMs(b)).find((t) => leftMs(t) > 0) || timers[0];
  const ms = leftMs(next);
  return (
    <button type="button" className="timer-pill" data-done={ms === 0 || undefined} onClick={() => setMoreView('timers')}>
      <IconTimer width={16} height={16} />
      <span className="timer-pill-clock">{ms === 0 ? 'готово' : fmtClock(ms)}</span>
      <span className="timer-pill-label">{next.label}</span>
      {timers.length > 1 && <span className="timer-pill-more">+{timers.length - 1}</span>}
    </button>
  );
}

function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action.run();
            useStore.setState({ toast: null });
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

export default function App() {
  const { ready, error } = useBoot();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const signedIn = useStore((s) => !!s.token || s.localOnly);
  useTimerAlerts();
  useHabitReminders();

  // после полуночи "сегодня" сдвигается; Ctrl+J — заметки
  useEffect(() => {
    let lastToday = todayISO();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const t = todayISO();
      if (t !== lastToday && useStore.getState().date === lastToday) useStore.getState().setDate(t);
      lastToday = t;
    };
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        useStore.getState().setMoreView('notes');
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  if (!ready) return <div className="boot" aria-busy="true" />;
  if (!signedIn) return <Connect error={error} />;

  return (
    <div className="app">
      <nav className="nav" aria-label="Разделы">
        <div className="brand" aria-hidden="true">
          <span />
          <span />
          <span />
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
        <TimerPill />
        {view === 'day' && <DayView />}
        {view === 'calendar' && <CalendarView />}
        {view === 'habits' && <HabitsView />}
        {view === 'goals' && <GoalsView />}
        {view === 'more' && <MoreView />}
      </main>
      <TaskSheet />
      <Toast />
    </div>
  );
}

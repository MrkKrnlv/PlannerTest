import { useEffect, useState } from 'react';
import { useStore, liveItems, hasLog } from './store.js';
import { api } from './lib/api.js';
import { startSync } from './lib/sync.js';
import { launchedFromTelegram, loadTelegram, setupTelegramChrome, syncTelegramColors } from './lib/telegram.js';
import { nowMin, todayISO } from './lib/date.js';
import { habitLogId, isScheduled } from './lib/habits.js';
import { notify } from './lib/notify.js';
import TodayView from './components/today/TodayView.jsx';
import PlansView from './components/PlansView.jsx';
import GrowthView from './components/GrowthView.jsx';
import MoreView from './components/MoreView.jsx';
import AddSheet from './components/sheets/AddSheet.jsx';
import PlanSheet from './components/sheets/PlanSheet.jsx';
import ReviewSheet from './components/sheets/ReviewSheet.jsx';
import SearchSheet from './components/sheets/SearchSheet.jsx';
import Onboarding from './components/Onboarding.jsx';
import TaskSheet from './components/TaskSheet.jsx';
import Connect from './components/Connect.jsx';
import SyncDot from './components/SyncDot.jsx';
import { fmtClock, leftMs, useTick } from './components/TimersView.jsx';
import { IconCalendar, IconGrowth, IconMore, IconTimer, IconToday, IconPlus } from './components/Icons.jsx';

const TABS = [
  ['today', 'Сегодня', IconToday],
  ['plans', 'Планы', IconCalendar],
  ['growth', 'Рост', IconGrowth],
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

/** Тема: ручной выбор > схема Telegram > системная */
function useTheme() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    const apply = () => {
      const root = document.documentElement;
      const scheme = theme !== 'auto' ? theme : root.dataset.tgScheme || null;
      if (scheme) root.dataset.theme = scheme;
      else delete root.dataset.theme;
      const dark = scheme ? scheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#090b12' : '#eef1f8'));
      syncTelegramColors();
    };
    apply();
    window.addEventListener('tgtheme', apply);
    return () => window.removeEventListener('tgtheme', apply);
  }, [theme]);
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
  const onboarded = useStore((s) => s.onboarded);
  const openSheet = useStore((s) => s.openSheet);
  useTimerAlerts();
  useHabitReminders();
  useTheme();

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
      if ((e.ctrlKey || e.metaKey) && ['k', 'л'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        useStore.getState().openSheet('search');
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

  const tab = (id, label, Icon) => (
    <li key={id}>
      <button type="button" className="nav-tab" aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
        <Icon />
        <span>{label}</span>
      </button>
    </li>
  );
  const addBtn = (
    <li className="nav-add-wrap">
      <button type="button" className="nav-add" onClick={() => openSheet('add', 'task')} aria-label="Добавить">
        <IconPlus width={26} height={26} />
        <span>Добавить</span>
      </button>
    </li>
  );

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      <nav className="nav glass-strong" aria-label="Разделы">
        <div className="brand" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <ul className="nav-tabs">
          {TABS.slice(0, 2).map(([id, l, I]) => tab(id, l, I))}
          {addBtn}
          {TABS.slice(2).map(([id, l, I]) => tab(id, l, I))}
        </ul>
        <SyncDot />
      </nav>
      <main className="content">
        <TimerPill />
        {view === 'today' && <TodayView />}
        {view === 'plans' && <PlansView />}
        {view === 'growth' && <GrowthView />}
        {view === 'more' && <MoreView />}
      </main>
      <TaskSheet />
      <AddSheet />
      <PlanSheet />
      <ReviewSheet />
      <SearchSheet />
      {!onboarded && <Onboarding />}
      <Toast />
    </div>
  );
}

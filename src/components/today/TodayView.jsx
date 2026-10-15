import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, liveTasks, byOrder, settingsOf } from '../../store.js';
import { dayMonth, formatShort, nowMin, relativeLabel, timeToMin, todayISO, weekdayLong, plural } from '../../lib/date.js';
import { capacity } from '../../lib/capacity.js';
import { pointsByDay, streak } from '../../lib/points.js';
import { haptic } from '../../lib/telegram.js';
import QuickAdd from '../QuickAdd.jsx';
import WeekRibbon from '../day/WeekRibbon.jsx';
import Agenda from '../day/Agenda.jsx';
import HabitsToday from '../day/HabitsToday.jsx';
import { IconSearch, IconWand, IconTimer, IconCheck, IconFlag } from '../Icons.jsx';

function useNow() {
  const [n, setN] = useState(nowMin);
  useEffect(() => {
    const id = setInterval(() => setN(nowMin()), 30_000);
    return () => clearInterval(id);
  }, []);
  return n;
}

function Ring({ done, total }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const p = total ? done / total : 0;
  return (
    <div className="ring" role="img" aria-label={`Сделано ${done} из ${total}`}>
      <svg viewBox="0 0 52 52" width="52" height="52">
        <circle cx="26" cy="26" r={r} className="ring-track" />
        <circle cx="26" cy="26" r={r} className="ring-fill" strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 26 26)" />
      </svg>
      <span className="ring-text">
        {done}
        <small>/{total}</small>
      </span>
    </div>
  );
}

/** Что делать прямо сейчас: текущая задача, ближайшая или что взять в свободное окно */
function pickNow(dayTasks, now) {
  const open = dayTasks.filter((t) => !t.done);
  const start = (t) => timeToMin(t.time);
  const current = open.find((t) => t.time && start(t) <= now && now < start(t) + t.duration_min);
  if (current) return { kind: 'now', task: current, left: start(current) + current.duration_min - now };
  const next = open.filter((t) => t.time && start(t) > now).sort((a, b) => start(a) - start(b))[0];
  const free = open.filter((t) => !t.time).sort((a, b) => Number(b.frog) - Number(a.frog) || a.priority - b.priority)[0];
  if (next && start(next) - now <= 45) return { kind: 'soon', task: next, in: start(next) - now };
  if (free) return { kind: 'free', task: free, until: next ? next.time : null };
  if (next) return { kind: 'soon', task: next, in: start(next) - now };
  if (dayTasks.length && !open.length) return { kind: 'done' };
  if (open.length) return { kind: 'late', task: open[0] };
  return { kind: 'empty' };
}

function NowCard({ dayTasks }) {
  const now = useNow();
  const { toggleDone, startTimer, openTask, openSheet, showToast, setMoreView } = useStore.getState();
  const pick = pickNow(dayTasks, now);

  if (pick.kind === 'empty') return null;
  if (pick.kind === 'done') {
    return (
      <section className="glass now now-done">
        <span className="now-label">Все задачи на сегодня сделаны</span>
        <p className="now-title">Хороший день. Осталось подвести итог.</p>
        <div className="now-actions">
          <button type="button" className="primary-btn" onClick={() => openSheet('review')}>
            Завершить день
          </button>
        </div>
      </section>
    );
  }

  const t = pick.task;
  const label =
    pick.kind === 'now'
      ? `Сейчас, осталось ${formatShort(pick.left)}`
      : pick.kind === 'soon'
        ? `Через ${formatShort(pick.in)}, в ${t.time}`
        : pick.kind === 'free'
          ? pick.until
            ? `Свободное окно до ${pick.until}`
            : 'Можно взять сейчас'
          : 'Не успел по времени';

  return (
    <section className="glass now" data-kind={pick.kind} data-frog={t.frog || undefined}>
      <span className="now-label">
        {t.frog && <IconFlag />}
        {label}
      </span>
      <button type="button" className="now-title" onClick={() => openTask(t.id)}>
        {t.title}
      </button>
      <span className="now-meta">
        {formatShort(t.duration_min)}
        {t.area ? `  #${t.area}` : ''}
      </span>
      <div className="now-actions">
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            startTimer({ kind: 'focus', label: t.title, minutes: t.duration_min >= 50 ? 50 : 25, taskId: t.id });
            haptic('light');
            showToast('Фокус запущен', { label: 'Таймеры', run: () => setMoreView('timers') });
          }}
        >
          <IconTimer width={18} height={18} />
          Фокус {t.duration_min >= 50 ? 50 : 25} мин
        </button>
        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            toggleDone(t.id);
            haptic('success');
          }}
        >
          <IconCheck width={18} height={18} />
          Готово
        </button>
      </div>
    </section>
  );
}

function PlanBar({ dayTasks }) {
  const items = useStore((s) => s.items);
  const openSheet = useStore((s) => s.openSheet);
  const c = capacity(dayTasks, settingsOf(items));
  const over = c.timeLoad > c.timeCap || c.headLoad > c.headCap;
  const untimed = dayTasks.filter((t) => !t.done && !t.time).length;
  return (
    <button type="button" className="glass planbar" data-over={over || undefined} onClick={() => openSheet('plan')}>
      <span className="planbar-meters">
        <span className="pmeter">
          <span className="pmeter-label">Время</span>
          <span className="pmeter-track">
            <span style={{ width: `${Math.min(100, (c.timeLoad / c.timeCap) * 100)}%` }} data-over={c.timeLoad > c.timeCap || undefined} />
          </span>
          <span className="pmeter-val">
            {formatShort(c.timeLoad)} / {formatShort(c.timeCap)}
          </span>
        </span>
        <span className="pmeter" data-tone="deep">
          <span className="pmeter-label">Голова</span>
          <span className="pmeter-track">
            <span style={{ width: `${Math.min(100, (c.headLoad / c.headCap) * 100)}%` }} data-over={c.headLoad > c.headCap || undefined} />
          </span>
          <span className="pmeter-val">
            {formatShort(c.headLoad)} / {formatShort(c.headCap)}
          </span>
        </span>
      </span>
      <span className="planbar-cta">
        <IconWand width={18} height={18} />
        {over ? 'Разгрузить' : untimed ? 'Спланировать' : 'Нагрузка'}
      </span>
    </button>
  );
}

function DayEnd({ date }) {
  const item = useStore((s) => s.items[`day:${date}`]);
  const openSheet = useStore((s) => s.openSheet);
  const data = item && !item.deleted ? item.data : {};
  if (data.reviewed) {
    return (
      <button type="button" className="glass dayend dayend-done" onClick={() => openSheet('review')}>
        <span className="dayend-title">Итог дня</span>
        <span className="dayend-sum">
          {data.mood ? `Настроение ${data.mood}/5` : ''}
          {data.mood && data.energy ? ', ' : ''}
          {data.energy ? `энергия ${data.energy}/5` : ''}
        </span>
        {data.good && <span className="dayend-good">{data.good}</span>}
      </button>
    );
  }
  return (
    <button type="button" className="glass dayend" onClick={() => openSheet('review')}>
      <span className="dayend-title">Завершить день</span>
      <span className="muted small">Разобрать хвосты, отметить настроение и записать, что было хорошего. Две минуты.</span>
    </button>
  );
}

export default function TodayView() {
  const date = useStore((s) => s.date);
  const tasksMap = useStore((s) => s.tasks);
  const openSheet = useStore((s) => s.openSheet);
  const inputRef = useRef(null);

  const all = useMemo(() => liveTasks(tasksMap), [tasksMap]);
  const dayTasks = useMemo(() => all.filter((t) => t.date === date).sort(byOrder), [all, date]);
  const byDay = useMemo(() => pointsByDay(all), [all]);
  const today = todayISO();
  const s = streak(byDay, today);
  const done = dayTasks.filter((t) => t.done).length;

  useEffect(() => {
    const onKey = (e) => {
      if (!['n', 'т'].includes(e.key.toLowerCase()) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const rel = relativeLabel(date);

  return (
    <div className="today">
      <header className="today-head">
        <div className="today-titles">
          <p className="today-kicker">
            {weekdayLong(date)}, {dayMonth(date)}
          </p>
          <h1 className="today-title">{rel || weekdayLong(date)}</h1>
          <p className="today-sub">
            {byDay[date] || 0} {plural(byDay[date] || 0, 'очко', 'очка', 'очков')}
            {s > 1 ? `, ${s} ${plural(s, 'день', 'дня', 'дней')} подряд` : ''}
          </p>
        </div>
        <div className="today-tools">
          <button type="button" className="glass-btn" onClick={() => openSheet('search')} aria-label="Поиск по задачам и заметкам">
            <IconSearch />
          </button>
          <Ring done={done} total={dayTasks.length} />
        </div>
      </header>

      <WeekRibbon />

      <div className="today-grid">
        <div className="today-main">
          {date === today && <NowCard dayTasks={dayTasks} />}
          <QuickAdd ref={inputRef} defaultDate={date} />
          <Agenda date={date} dayTasks={dayTasks} all={all} />
        </div>
        <aside className="today-side">
          <PlanBar dayTasks={dayTasks} />
          <HabitsToday date={date} />
          {date <= today && <DayEnd date={date} />}
        </aside>
      </div>
    </div>
  );
}

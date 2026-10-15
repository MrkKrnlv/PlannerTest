import { useEffect, useMemo, useRef } from 'react';
import { useStore, liveTasks, byOrder } from '../../store.js';
import { dayMonth, relativeLabel, todayISO, weekdayLong, plural } from '../../lib/date.js';
import { pointsByDay, streak } from '../../lib/points.js';
import QuickAdd from '../QuickAdd.jsx';
import WeekRibbon from './WeekRibbon.jsx';
import LoadPanel from './LoadPanel.jsx';
import Agenda from './Agenda.jsx';
import HabitsToday from './HabitsToday.jsx';
import DayJournal from './DayJournal.jsx';

export default function DayView() {
  const date = useStore((s) => s.date);
  const tasksMap = useStore((s) => s.tasks);
  const inputRef = useRef(null);

  const all = useMemo(() => liveTasks(tasksMap), [tasksMap]);
  const dayTasks = useMemo(() => all.filter((t) => t.date === date).sort(byOrder), [all, date]);
  const byDay = useMemo(() => pointsByDay(all), [all]);
  const today = todayISO();
  const s = streak(byDay, today);

  // N — быстрый ввод (и Т на русской раскладке)
  useEffect(() => {
    const onKey = (e) => {
      if (!['n', 'т'].includes(e.key.toLowerCase()) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const rel = relativeLabel(date);
  const wd = weekdayLong(date);

  return (
    <div className="day">
      <div className="day-main">
        <header className="dh o-head">
          <div className="dh-text">
            <h1 className="dh-title">{wd}</h1>
            <p className="dh-sub">
              {dayMonth(date)}
              {rel && <span className="dh-rel">{rel.toLowerCase()}</span>}
            </p>
          </div>
          <div className="dh-stats">
            <span className="stat">
              <b>{byDay[date] || 0}</b>
              <span>{plural(byDay[date] || 0, 'очко', 'очка', 'очков')}</span>
            </span>
            <span className="stat" title="Дней подряд хотя бы с одной сделанной задачей">
              <b>{s}</b>
              <span>{plural(s, 'день', 'дня', 'дней')} подряд</span>
            </span>
          </div>
        </header>
        <WeekRibbon className="o-ribbon" />
        <div className="o-quick">
          <QuickAdd ref={inputRef} defaultDate={date} />
        </div>
        <Agenda className="o-agenda" date={date} dayTasks={dayTasks} all={all} />
      </div>
      <aside className="day-side">
        <LoadPanel className="o-load" date={date} dayTasks={dayTasks} />
        <HabitsToday className="o-habits" date={date} />
        <DayJournal className="o-journal" date={date} />
      </aside>
    </div>
  );
}

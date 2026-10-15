import { useMemo } from 'react';
import { useStore, liveTasks, byOrder } from '../store.js';
import { addDays, weekRange, fromISO, todayISO, weekDays, weekdayShort, formatDuration } from '../lib/date.js';
import DayStrip from './DayStrip.jsx';
import { IconLeft, IconRight } from './Icons.jsx';

export default function WeekView() {
  const date = useStore((s) => s.date);
  const setDate = useStore((s) => s.setDate);
  const setView = useStore((s) => s.setView);
  const openTask = useStore((s) => s.openTask);
  const tasksMap = useStore((s) => s.tasks);

  const days = weekDays(date);
  const today = todayISO();
  const all = useMemo(() => liveTasks(tasksMap), [tasksMap]);
  const weekTotal = all.filter((t) => days.includes(t.date)).reduce((s, t) => s + t.duration_min, 0);

  const openDay = (d) => {
    setDate(d);
    setView('day');
  };

  return (
    <div className="week">
      <header className="week-head">
        <div>
          <h1 className="week-title">{weekRange(days[0], days[6])}</h1>
          <p className="muted small">На неделю запланировано {formatDuration(weekTotal) || '0 мин'}</p>
        </div>
        <nav className="day-nav" aria-label="Переключение недели">
          <button type="button" className="icon-btn" onClick={() => setDate(addDays(date, -7))} aria-label="Предыдущая неделя">
            <IconLeft />
          </button>
          {!days.includes(today) && (
            <button type="button" className="text-btn" onClick={() => setDate(today)}>
              Эта неделя
            </button>
          )}
          <button type="button" className="icon-btn" onClick={() => setDate(addDays(date, 7))} aria-label="Следующая неделя">
            <IconRight />
          </button>
        </nav>
      </header>

      <div className="week-grid">
        {days.map((d) => {
          const list = all.filter((t) => t.date === d).sort(byOrder);
          const weekend = [0, 6].includes(fromISO(d).getDay());
          return (
            <section key={d} className="wday" data-today={d === today || undefined} data-weekend={weekend || undefined}>
              <button type="button" className="wday-head" onClick={() => openDay(d)}>
                <span className="wday-name">{weekdayShort(d)}</span>
                <span className="wday-num">{fromISO(d).getDate()}</span>
              </button>
              <DayStrip tasks={list} compact />
              <ul className="wday-tasks">
                {list.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="wtask"
                      data-done={t.done || undefined}
                      data-pri={t.priority}
                      data-voice={t.source === 'voice' || undefined}
                      onClick={() => openTask(t.id)}
                    >
                      {t.time && <span className="wtask-time">{t.time}</span>}
                      <span className="wtask-title">{t.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {!list.length && (
                <button type="button" className="wday-empty" onClick={() => openDay(d)}>
                  Свободно
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

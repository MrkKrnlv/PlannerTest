import { useMemo, useRef, useEffect } from 'react';
import { useStore, liveTasks, byOrder } from '../store.js';
import { addDays, dayMonth, formatDuration, fromISO, relativeLabel, todayISO, weekdayLong } from '../lib/date.js';
import DayStrip from './DayStrip.jsx';
import QuickAdd from './QuickAdd.jsx';
import TaskRow from './TaskRow.jsx';
import Timeline from './Timeline.jsx';
import { IconLeft, IconRight } from './Icons.jsx';

const GROUPS = [
  ['morning', 'Утро'],
  ['afternoon', 'День'],
  ['evening', 'Вечер'],
  ['anytime', 'Когда получится'],
];

export default function DayView() {
  const date = useStore((s) => s.date);
  const setDate = useStore((s) => s.setDate);
  const tasksMap = useStore((s) => s.tasks);
  const moveTasks = useStore((s) => s.moveTasks);
  const inputRef = useRef(null);

  const today = todayISO();
  const all = useMemo(() => liveTasks(tasksMap), [tasksMap]);
  const dayTasks = useMemo(() => all.filter((t) => t.date === date).sort(byOrder), [all, date]);
  const overdue = useMemo(
    () => (date === today ? all.filter((t) => !t.done && t.date && t.date < today).sort((a, b) => a.date.localeCompare(b.date)) : []),
    [all, date, today]
  );

  // N — фокус на быстрый ввод
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() !== 'n' && e.key.toLowerCase() !== 'т') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
      if (useStore.getState().editingId) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const rel = relativeLabel(date);
  const d = fromISO(date);

  return (
    <div className="day">
      <div className="day-main">
        <header className="day-head">
          <div className="day-date">
            <span className="day-num">{d.getDate()}</span>
            <span className="day-words">
              <span className="day-rel">{rel || weekdayLong(date)}</span>
              <span className="muted">{rel ? `${weekdayLong(date)}, ${dayMonth(date)}` : dayMonth(date)}</span>
            </span>
          </div>
          <nav className="day-nav" aria-label="Переключение дня">
            <button type="button" className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Предыдущий день">
              <IconLeft />
            </button>
            {date !== today && (
              <button type="button" className="text-btn" onClick={() => setDate(today)}>
                Сегодня
              </button>
            )}
            <button type="button" className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Следующий день">
              <IconRight />
            </button>
          </nav>
        </header>

        <DayStrip tasks={dayTasks} />
        <QuickAdd ref={inputRef} defaultDate={date} />

        {overdue.length > 0 && (
          <section className="group group-overdue">
            <div className="group-head">
              <h2 className="section-title">Хвосты с прошлых дней</h2>
              <button type="button" className="text-btn" onClick={() => moveTasks(overdue.map((t) => t.id), today)}>
                Перенести на сегодня
              </button>
            </div>
            <ul className="tasks">
              {overdue.map((t) => (
                <TaskRow key={t.id} task={t} showDate />
              ))}
            </ul>
          </section>
        )}

        {dayTasks.length === 0 ? (
          <div className="empty">
            <p>На этот день задач нет.</p>
            <p className="muted">Напиши задачу в поле выше или надиктуй её боту в Telegram.</p>
          </div>
        ) : (
          GROUPS.map(([slot, label]) => {
            const list = dayTasks.filter((t) => t.slot === slot);
            if (!list.length) return null;
            return (
              <section key={slot} className="group">
                <div className="group-head">
                  <h2 className="section-title">{label}</h2>
                  <span className="muted small">{formatDuration(list.reduce((s, t) => s + t.duration_min, 0))}</span>
                </div>
                <ul className="tasks">
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>

      <aside className="day-side">
        <Timeline date={date} tasks={dayTasks} />
      </aside>
    </div>
  );
}

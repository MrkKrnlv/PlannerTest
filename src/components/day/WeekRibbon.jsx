import { useMemo } from 'react';
import { useStore, liveTasks, settingsOf } from '../../store.js';
import { addDays, fromISO, todayISO, weekDays, weekdayShort } from '../../lib/date.js';
import { capacity } from '../../lib/capacity.js';
import { IconLeft, IconRight } from '../Icons.jsx';

/** Лента недели: быстрый переход по дням и загрузка каждого дня */
export default function WeekRibbon({ className = '' }) {
  const date = useStore((s) => s.date);
  const setDate = useStore((s) => s.setDate);
  const tasksMap = useStore((s) => s.tasks);
  const items = useStore((s) => s.items);
  const settings = settingsOf(items);
  const days = weekDays(date);
  const today = todayISO();

  const loads = useMemo(() => {
    const all = liveTasks(tasksMap);
    return days.map((d) => {
      const c = capacity(all.filter((t) => t.date === d), settings);
      return Math.min(1.15, c.timeLoad / Math.max(c.timeCap, 1));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksMap, items, days[0]]);

  return (
    <nav className={`ribbon ${className}`} aria-label="Дни недели">
      <button type="button" className="icon-btn ribbon-arrow" onClick={() => setDate(addDays(date, -7))} aria-label="Предыдущая неделя">
        <IconLeft />
      </button>
      <ol className="ribbon-days">
        {days.map((d, i) => (
          <li key={d}>
            <button
              type="button"
              className="rday"
              aria-current={d === date ? 'date' : undefined}
              data-today={d === today || undefined}
              onClick={() => setDate(d)}
            >
              <span className="rday-wd">{weekdayShort(d)}</span>
              <span className="rday-num">{fromISO(d).getDate()}</span>
              <span className="rday-load" data-over={loads[i] > 1 || undefined}>
                <span style={{ width: `${Math.min(100, loads[i] * 100)}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="icon-btn ribbon-arrow" onClick={() => setDate(addDays(date, 7))} aria-label="Следующая неделя">
        <IconRight />
      </button>
    </nav>
  );
}

import { useMemo } from 'react';
import { useStore, liveItems, hasLog } from '../../store.js';
import { habitLogId, habitStreak, isScheduled } from '../../lib/habits.js';
import { haptic } from '../../lib/telegram.js';
import { IconCheck } from '../Icons.jsx';

export default function HabitsToday({ className = '', date }) {
  const items = useStore((s) => s.items);
  const { toggleLog, setGrowthMode, openSheet } = useStore.getState();
  const habits = useMemo(
    () => liveItems(items, 'habit').filter((h) => !h.data.archived && isScheduled(h, date)).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)),
    [items, date]
  );

  return (
    <section className={`glass habits-today ${className}`} aria-label="Привычки на день">
      <div className="card-head">
        <h2 className="card-title">Привычки</h2>
        <button type="button" className="text-btn" onClick={() => (habits.length ? setGrowthMode('habits') : openSheet('add', 'habit'))}>
          {habits.length ? 'Все' : 'Добавить'}
        </button>
      </div>
      {habits.length === 0 ? (
        <p className="muted small">Привычек на этот день нет. Добавь одну маленькую через «+».</p>
      ) : (
        <ul className="hchips">
          {habits.map((h) => {
            const done = hasLog(items, habitLogId(h.id, date));
            const s = habitStreak(h, items);
            return (
              <li key={h.id}>
                <button
                  type="button"
                  className="hchip"
                  data-color={h.data.color}
                  aria-pressed={done}
                  onClick={() => {
                    toggleLog(habitLogId(h.id, date), 'habit_log');
                    haptic(done ? 'light' : 'success');
                  }}
                >
                  <span className="hchip-box">
                    <IconCheck />
                  </span>
                  <span className="hchip-name">{h.data.name}</span>
                  {s > 1 && <span className="hchip-streak">{s}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

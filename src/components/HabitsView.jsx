import { useMemo, useState } from 'react';
import { useStore, liveItems, hasLog, uuid } from '../store.js';
import { addDays, fromISO, todayISO, weekdayShort, weekdayShortByIdx, WEEKDAYS_MON, plural, dayMonth } from '../lib/date.js';
import { habitLogId, habitMonthRate, habitStreak, isScheduled, HABIT_COLORS } from '../lib/habits.js';
import { getTelegram, haptic } from '../lib/telegram.js';
import { Sheet, Dot } from './ui.jsx';
import { IconBell, IconPlus } from './Icons.jsx';

const EMPTY = { name: '', days: [], color: 'cobalt', remind: '' };

function HabitForm({ habit, onClose }) {
  const { putItem, removeItem, patchItem } = useStore.getState();
  const [f, setF] = useState(habit ? { ...EMPTY, ...habit.data, remind: habit.data.remind || '' } : EMPTY);
  const toggleDay = (i) => setF((v) => ({ ...v, days: v.days.includes(i) ? v.days.filter((x) => x !== i) : [...v.days, i] }));

  const save = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    const data = { ...f, name: f.name.trim(), remind: f.remind || null };
    if (habit) patchItem(habit.id, 'habit', data);
    else putItem(`habit-${uuid()}`, 'habit', { ...data, order: Date.now() });
    haptic('success');
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={habit ? 'Привычка' : 'Новая привычка'}
      footer={
        <>
          {habit ? (
            <button
              type="button"
              className="text-btn danger"
              onClick={() => {
                removeItem(habit.id);
                onClose();
              }}
            >
              Удалить
            </button>
          ) : (
            <span />
          )}
          <button type="submit" form="habit-form" className="primary-btn">
            Сохранить
          </button>
        </>
      }
    >
      <form id="habit-form" className="form" onSubmit={save}>
        <label className="field">
          <span>Название</span>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Витамины, 10 000 шагов, чтение" required maxLength={60} autoFocus />
        </label>
        <fieldset className="field">
          <legend>Дни</legend>
          <div className="seg-control">
            <button type="button" aria-pressed={!f.days.length} onClick={() => setF({ ...f, days: [] })}>
              Каждый день
            </button>
            {WEEKDAYS_MON.map((i) => (
              <button key={i} type="button" aria-pressed={f.days.includes(i)} onClick={() => toggleDay(i)}>
                {weekdayShortByIdx(i)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>Цвет</legend>
          <div className="seg-control">
            {HABIT_COLORS.map((c) => (
              <button key={c} type="button" className="color-btn" aria-pressed={f.color === c} aria-label={c} onClick={() => setF({ ...f, color: c })}>
                <Dot color={c} />
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span>Напоминание</span>
          <input type="time" value={f.remind} onChange={(e) => setF({ ...f, remind: e.target.value })} />
        </label>
      </form>
    </Sheet>
  );
}

export default function HabitsView() {
  const items = useStore((s) => s.items);
  const toggleLog = useStore((s) => s.toggleLog);
  const [editing, setEditing] = useState(null); // null | 'new' | habit
  const [perm, setPerm] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'));
  const today = todayISO();
  const habits = useMemo(() => liveItems(items, 'habit').sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)), [items]);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const hasReminders = habits.some((h) => h.data.remind);
  const inTelegram = !!getTelegram();

  return (
    <div className="page habits">
      <header className="page-head">
        <div>
          <h1 className="page-title">Привычки</h1>
          <p className="muted small">Отмечай прямо здесь или на экране дня</p>
        </div>
        <button type="button" className="primary-btn" onClick={() => setEditing('new')}>
          <IconPlus />
          Привычка
        </button>
      </header>

      {hasReminders && perm !== 'granted' && (
        <div className="card notice">
          <IconBell />
          <p>
            {inTelegram || perm === 'unsupported'
              ? 'Внутри Telegram системные уведомления недоступны: напоминания покажутся, пока планер открыт.'
              : 'Разреши уведомления, чтобы напоминания приходили, пока планер открыт во вкладке или как приложение.'}
          </p>
          {!inTelegram && perm === 'default' && (
            <button type="button" className="secondary-btn" onClick={() => Notification.requestPermission().then(setPerm)}>
              Разрешить
            </button>
          )}
        </div>
      )}

      {habits.length === 0 && (
        <div className="empty">
          <p className="empty-title">Привычек пока нет</p>
          <p className="muted">Начни с одной маленькой: стакан воды утром или 10 минут чтения.</p>
        </div>
      )}

      <ul className="habit-list">
        {habits.map((h) => {
          const s = habitStreak(h, items, today);
          const rate = habitMonthRate(h, items, today);
          return (
            <li key={h.id} className="card habit" data-color={h.data.color}>
              <button type="button" className="habit-head" onClick={() => setEditing(h)}>
                <Dot color={h.data.color} />
                <span className="habit-name">{h.data.name}</span>
                <span className="habit-sub muted small">
                  {h.data.days?.length ? WEEKDAYS_MON.filter((i) => h.data.days.includes(i)).map(weekdayShortByIdx).join(', ') : 'каждый день'}
                  {h.data.remind ? `, напомню в ${h.data.remind}` : ''}
                </span>
              </button>
              <div className="habit-stats">
                <span>
                  <b>{s}</b> {plural(s, 'день', 'дня', 'дней')} подряд
                </span>
                <span>
                  <b>{rate}%</b> за месяц
                </span>
              </div>
              <ol className="habit-days">
                {days.map((d) => {
                  const sched = isScheduled(h, d);
                  const done = hasLog(items, habitLogId(h.id, d));
                  return (
                    <li key={d}>
                      <button
                        type="button"
                        className="hday"
                        data-done={done || undefined}
                        data-off={!sched || undefined}
                        data-today={d === today || undefined}
                        aria-pressed={done}
                        aria-label={`${dayMonth(d)}: ${done ? 'сделано' : 'не сделано'}`}
                        onClick={() => {
                          toggleLog(habitLogId(h.id, d), 'habit_log');
                          haptic(done ? 'light' : 'success');
                        }}
                      >
                        <span className="hday-wd">{weekdayShort(d)}</span>
                        <span className="hday-num">{fromISO(d).getDate()}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ul>

      {editing && <HabitForm habit={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

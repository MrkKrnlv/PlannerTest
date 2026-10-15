import { useMemo, useState } from 'react';
import { useStore, liveTasks, liveItems, settingsOf } from '../store.js';
import { addDays, formatShort, todayISO } from '../lib/date.js';
import { parseQuickAdd } from '../lib/parse.js';
import { haptic } from '../lib/telegram.js';
import { Segmented } from './ui.jsx';
import { WeekView, MonthView } from './CalendarView.jsx';
import { IconInbox, IconPlus } from './Icons.jsx';

function InboxView({ all }) {
  const { addTask, updateTask, openTask } = useStore.getState();
  const [text, setText] = useState('');
  const today = todayISO();
  const inbox = all.filter((t) => !t.date && !t.done).sort((a, b) => b.created_at - a.created_at);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Входящие</h1>
          <p className="muted small">Всё, что пока без даты. Разбирай раз в день: на сегодня, на завтра или в нужный день.</p>
        </div>
      </header>
      <form
        className="glass inline-add inbox-add"
        onSubmit={(e) => {
          e.preventDefault();
          const p = parseQuickAdd(text);
          if (!p.title) return;
          addTask({ ...p, date: p.date || null });
          setText('');
          haptic('light');
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Мысль или задача без даты" maxLength={300} />
        <button type="submit" className="icon-btn" aria-label="Добавить во входящие" disabled={!text.trim()}>
          <IconPlus />
        </button>
      </form>
      {inbox.length === 0 ? (
        <div className="empty">
          <IconInbox className="empty-icon" />
          <p className="empty-title">Входящие пусты</p>
          <p className="muted">Сюда попадают задачи без даты и то, что ты отложил при завершении дня.</p>
        </div>
      ) : (
        <ul className="inbox-list">
          {inbox.map((t) => (
            <li key={t.id} className="glass inbox-item">
              <button type="button" className="inbox-title" onClick={() => openTask(t.id)}>
                {t.title}
                <span className="muted small">
                  {formatShort(t.duration_min)}
                  {t.area ? `, #${t.area}` : ''}
                </span>
              </button>
              <span className="inbox-actions">
                <button type="button" className="chip-btn" onClick={() => updateTask(t.id, { date: today })}>
                  Сегодня
                </button>
                <button type="button" className="chip-btn" onClick={() => updateTask(t.id, { date: addDays(today, 1) })}>
                  Завтра
                </button>
                <label className="chip-btn chip-date">
                  Дата
                  <input type="date" aria-label="Выбрать дату" onChange={(e) => e.target.value && updateTask(t.id, { date: e.target.value })} />
                </label>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function PlansView() {
  const mode = useStore((s) => s.plansMode);
  const setPlansMode = useStore((s) => s.setPlansMode);
  const tasksMap = useStore((s) => s.tasks);
  const items = useStore((s) => s.items);
  const all = useMemo(() => liveTasks(tasksMap), [tasksMap]);
  const areas = useMemo(() => liveItems(items, 'area'), [items]);
  const settings = settingsOf(items);
  const inboxCount = all.filter((t) => !t.date && !t.done).length;

  return (
    <div className="page plans">
      <Segmented
        label="Планы"
        value={mode}
        onChange={setPlansMode}
        options={[
          ['inbox', inboxCount ? `Входящие ${inboxCount}` : 'Входящие'],
          ['week', 'Неделя'],
          ['month', 'Месяц'],
        ]}
      />
      {mode === 'inbox' && <InboxView all={all} />}
      {mode === 'week' && <WeekView all={all} settings={settings} areas={areas} />}
      {mode === 'month' && <MonthView all={all} settings={settings} />}
    </div>
  );
}

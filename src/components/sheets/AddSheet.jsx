import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, liveItems, uuid } from '../../store.js';
import { parseQuickAdd } from '../../lib/parse.js';
import { addDays, dayMonth, formatShort, relativeLabel, todayISO, weekdayShortByIdx, WEEKDAYS_MON, weekdayIdx } from '../../lib/date.js';
import { REPEAT_OPTIONS } from '../../lib/repeat.js';
import { HABIT_COLORS } from '../../lib/habits.js';
import { haptic } from '../../lib/telegram.js';
import { Sheet, Segmented, Dot } from '../ui.jsx';
import { IconBolt, IconFlag } from '../Icons.jsx';

const KINDS = [
  ['task', 'Задача'],
  ['habit', 'Привычка'],
  ['note', 'Заметка'],
  ['timer', 'Таймер'],
];
const DURATIONS = [15, 30, 60, 90, 120];
const TIMERS = [
  ['Фокус', 25, 'focus'],
  ['Глубоко', 50, 'focus'],
  ['Перерыв', 5, 'side'],
  ['Стирка', 60, 'side'],
  ['Духовка', 40, 'side'],
];

function TaskForm({ onDone }) {
  const date = useStore((s) => s.date);
  const items = useStore((s) => s.items);
  const addTask = useStore((s) => s.addTask);
  const areas = useMemo(() => liveItems(items, 'area'), [items]);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(date);
  const [duration, setDuration] = useState(null);
  const [repeat, setRepeat] = useState(null);
  const [days, setDays] = useState([]);
  const [frog, setFrog] = useState(false);
  const [deep, setDeep] = useState(null);
  const [area, setArea] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    setTimeout(() => ref.current?.focus(), 250);
  }, []);
  const parsed = title.trim() ? parseQuickAdd(title) : null;
  const today = todayISO();

  const submit = (e) => {
    e.preventDefault();
    if (!parsed?.title) return;
    const d = parsed.date || when;
    addTask({
      ...parsed,
      date: d,
      duration_min: parsed.duration_min || duration || 30,
      frog: frog || parsed.frog,
      priority: frog ? 1 : parsed.priority,
      deep: deep ?? (parsed.duration_min || duration || 30) >= 60,
      area: parsed.area || area,
      repeat: repeat && d ? { freq: repeat, ...(repeat === 'weekly' ? { days: days.length ? days : [weekdayIdx(d)] } : {}) } : null,
    });
    haptic('success');
    onDone(`Добавил «${parsed.title}»${d ? (d === today ? ' на сегодня' : `, ${relativeLabel(d)?.toLowerCase() || dayMonth(d)}`) : ' во входящие'}`);
  };

  const chips = [
    [today, 'Сегодня'],
    [addDays(today, 1), 'Завтра'],
    [null, 'Без даты'],
  ];

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>Что сделать</span>
        <input ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: созвон с клиентом в 16:00 1ч" maxLength={300} />
      </label>
      <fieldset className="field">
        <legend>Когда</legend>
        <div className="seg-control">
          {chips.map(([v, l]) => (
            <button key={l} type="button" aria-pressed={!parsed?.date && when === v} onClick={() => setWhen(v)}>
              {l}
            </button>
          ))}
          <input type="date" aria-label="Другая дата" value={when && !chips.some(([v]) => v === when) ? when : ''} onChange={(e) => e.target.value && setWhen(e.target.value)} className="date-chip" />
        </div>
        {parsed?.date && <p className="muted small">Дата из текста: {relativeLabel(parsed.date) || dayMonth(parsed.date)}</p>}
      </fieldset>
      <fieldset className="field">
        <legend>Длительность</legend>
        <div className="seg-control">
          {DURATIONS.map((m) => (
            <button key={m} type="button" aria-pressed={(parsed?.duration_min || duration || 30) === m} onClick={() => setDuration(m)}>
              {formatShort(m)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="toggles toggles-row">
        <button type="button" className="toggle" aria-pressed={frog || !!parsed?.frog} data-kind="frog" onClick={() => setFrog(!frog)}>
          <IconFlag />
          <b>Главное</b>
        </button>
        <button
          type="button"
          className="toggle"
          aria-pressed={deep ?? (parsed?.duration_min || duration || 30) >= 60}
          data-kind="deep"
          onClick={() => setDeep(!(deep ?? (parsed?.duration_min || duration || 30) >= 60))}
        >
          <IconBolt />
          <b>Глубоко</b>
        </button>
      </div>
      <fieldset className="field">
        <legend>Повтор</legend>
        <div className="seg-control">
          {REPEAT_OPTIONS.map(([v, l]) => (
            <button key={l} type="button" aria-pressed={repeat === v} onClick={() => setRepeat(v)} disabled={v && !when && !parsed?.date}>
              {l}
            </button>
          ))}
        </div>
        {repeat === 'weekly' && (
          <div className="seg-control">
            {WEEKDAYS_MON.map((i) => (
              <button key={i} type="button" aria-pressed={days.includes(i)} onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}>
                {weekdayShortByIdx(i)}
              </button>
            ))}
          </div>
        )}
      </fieldset>
      {areas.length > 0 && (
        <fieldset className="field">
          <legend>Сфера</legend>
          <div className="seg-control">
            {areas.map((a) => (
              <button key={a.id} type="button" aria-pressed={area === a.data.name} onClick={() => setArea(area === a.data.name ? null : a.data.name)}>
                <Dot color={a.data.color} />
                {a.data.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <button type="submit" className="primary-btn wide" disabled={!parsed?.title}>
        Добавить задачу
      </button>
    </form>
  );
}

function HabitForm({ onDone }) {
  const putItem = useStore((s) => s.putItem);
  const [name, setName] = useState('');
  const [days, setDays] = useState([]);
  const [color, setColor] = useState('cobalt');
  const [remind, setRemind] = useState('');
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        putItem(`habit-${uuid()}`, 'habit', { name: name.trim(), days, color, remind: remind || null, order: Date.now() });
        haptic('success');
        onDone(`Привычка «${name.trim()}» добавлена`);
      }}
    >
      <label className="field">
        <span>Привычка</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Витамины, 10 000 шагов, чтение" maxLength={60} autoFocus />
      </label>
      <fieldset className="field">
        <legend>Дни</legend>
        <div className="seg-control">
          <button type="button" aria-pressed={!days.length} onClick={() => setDays([])}>
            Каждый день
          </button>
          {WEEKDAYS_MON.map((i) => (
            <button key={i} type="button" aria-pressed={days.includes(i)} onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}>
              {weekdayShortByIdx(i)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend>Цвет</legend>
        <div className="seg-control">
          {HABIT_COLORS.map((c) => (
            <button key={c} type="button" className="color-btn" aria-pressed={color === c} aria-label={c} onClick={() => setColor(c)}>
              <Dot color={c} />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>Напомнить в</span>
        <input type="time" value={remind} onChange={(e) => setRemind(e.target.value)} />
      </label>
      <button type="submit" className="primary-btn wide" disabled={!name.trim()}>
        Добавить привычку
      </button>
    </form>
  );
}

function NoteForm({ onDone }) {
  const date = useStore((s) => s.date);
  const item = useStore((s) => s.items[`day:${date}`]);
  const patchItem = useStore((s) => s.patchItem);
  const [text, setText] = useState('');
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const prev = item && !item.deleted ? item.data.note : '';
        const stamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        patchItem(`day:${date}`, 'day', { note: `${prev ? `${prev}\n` : ''}${stamp} ${text.trim()}` });
        haptic('success');
        onDone('Заметка сохранена в итог дня');
      }}
    >
      <label className="field">
        <span>Заметка к дню {dayMonth(date)}</span>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Мысль, идея, что не забыть" maxLength={4000} autoFocus />
      </label>
      <button type="submit" className="primary-btn wide" disabled={!text.trim()}>
        Сохранить заметку
      </button>
    </form>
  );
}

function TimerForm({ onDone }) {
  const startTimer = useStore((s) => s.startTimer);
  return (
    <div className="timer-grid">
      {TIMERS.map(([l, m, kind]) => (
        <button
          key={l}
          type="button"
          className="glass timer-tile"
          onClick={() => {
            startTimer({ label: l, minutes: m, kind });
            haptic('light');
            onDone(`${l}: ${m} мин пошло`);
          }}
        >
          <b>{m}</b>
          <span>мин</span>
          <small>{l}</small>
        </button>
      ))}
    </div>
  );
}

/** Единая точка добавления: «+» в доке */
export default function AddSheet() {
  const open = useStore((s) => s.sheet === 'add');
  const kind = useStore((s) => s.addKind);
  const { closeSheet, openSheet, showToast } = useStore.getState();
  const done = (msg) => {
    closeSheet();
    showToast(msg);
  };
  return (
    <Sheet open={open} onClose={closeSheet} title="Добавить">
      <Segmented label="Что добавить" value={kind} onChange={(k) => openSheet('add', k)} options={KINDS} />
      {kind === 'task' && <TaskForm key="task" onDone={done} />}
      {kind === 'habit' && <HabitForm key="habit" onDone={done} />}
      {kind === 'note' && <NoteForm key="note" onDone={done} />}
      {kind === 'timer' && <TimerForm key="timer" onDone={done} />}
    </Sheet>
  );
}

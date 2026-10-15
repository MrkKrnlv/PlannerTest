import { useMemo, useState } from 'react';
import { useStore, liveItems } from '../store.js';
import { dayMonth, weekdayLong, fromISO } from '../lib/date.js';
import { IconSearch } from './Icons.jsx';

function highlight(text, q) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function NotesView() {
  const items = useStore((s) => s.items);
  const { setDate, setView } = useStore.getState();
  const [q, setQ] = useState('');
  const days = useMemo(
    () =>
      liveItems(items, 'day')
        .filter((d) => d.data.note || d.data.good)
        .map((d) => ({ date: d.id.slice(4), ...d.data }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [items]
  );
  const shown = q ? days.filter((d) => `${d.note || ''} ${d.good || ''}`.toLowerCase().includes(q.toLowerCase())) : days;

  return (
    <div className="page notes">
      <header className="page-head">
        <div>
          <h1 className="page-title">Заметки</h1>
          <p className="muted small">Заметки и итоги дней. Пишутся на экране дня.</p>
        </div>
      </header>
      <label className="search">
        <IconSearch />
        <span className="sr-only">Поиск по заметкам</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по заметкам" />
      </label>
      {shown.length === 0 && (
        <div className="empty">
          <p className="empty-title">{q ? 'Ничего не нашлось' : 'Заметок пока нет'}</p>
          {!q && <p className="muted">Открой день и запиши пару мыслей в блоке «Итог дня».</p>}
        </div>
      )}
      <ul className="note-list">
        {shown.map((d) => (
          <li key={d.date}>
            <button
              type="button"
              className="card note"
              onClick={() => {
                setDate(d.date);
                setView('day');
              }}
            >
              <span className="note-date">
                {dayMonth(d.date)}, {weekdayLong(d.date)}
                {fromISO(d.date).getFullYear() !== new Date().getFullYear() ? ` ${fromISO(d.date).getFullYear()}` : ''}
              </span>
              {(d.mood || d.energy) && (
                <span className="muted small">
                  {d.mood ? `настроение ${d.mood}/5` : ''}
                  {d.mood && d.energy ? ', ' : ''}
                  {d.energy ? `энергия ${d.energy}/5` : ''}
                </span>
              )}
              {d.good && <span className="note-good">{highlight(d.good, q)}</span>}
              {d.note && <span className="note-text">{highlight(d.note, q)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

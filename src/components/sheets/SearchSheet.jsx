import { useMemo, useState } from 'react';
import { useStore, liveTasks, liveItems } from '../../store.js';
import { dayMonth } from '../../lib/date.js';
import { Sheet } from '../ui.jsx';
import { IconSearch } from '../Icons.jsx';

const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е');

export default function SearchSheet() {
  const open = useStore((s) => s.sheet === 'search');
  const tasksMap = useStore((s) => s.tasks);
  const items = useStore((s) => s.items);
  const { closeSheet, openTask, setDate, setView } = useStore.getState();
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const n = norm(q.trim());
    if (n.length < 2) return { tasks: [], notes: [] };
    const tasks = liveTasks(tasksMap)
      .filter((t) => norm(t.title).includes(n) || norm(t.note).includes(n) || norm(t.area).includes(n))
      .sort((a, b) => (b.date || '9999').localeCompare(a.date || '9999'))
      .slice(0, 30);
    const notes = liveItems(items, 'day')
      .filter((d) => norm(d.data.note).includes(n) || norm(d.data.good).includes(n))
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 15);
    return { tasks, notes };
  }, [q, tasksMap, items]);

  return (
    <Sheet open={open} onClose={closeSheet} title="Поиск">
      <label className="search">
        <IconSearch />
        <span className="sr-only">Поиск</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Задачи, заметки, #сферы" autoFocus />
      </label>
      {q.trim().length >= 2 && !results.tasks.length && !results.notes.length && <p className="muted">Ничего не нашлось.</p>}
      {results.tasks.length > 0 && (
        <section className="sheet-section">
          <h3 className="section-title">Задачи</h3>
          <ul className="result-list">
            {results.tasks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    closeSheet();
                    openTask(t.id);
                  }}
                >
                  <span data-done={t.done || undefined}>{t.title}</span>
                  <span className="muted small">{t.date ? dayMonth(t.date) : 'без даты'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {results.notes.length > 0 && (
        <section className="sheet-section">
          <h3 className="section-title">Заметки</h3>
          <ul className="result-list">
            {results.notes.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => {
                    closeSheet();
                    setDate(d.id.slice(4));
                    setView('today');
                  }}
                >
                  <span className="clamp-2">{d.data.good || d.data.note}</span>
                  <span className="muted small">{dayMonth(d.id.slice(4))}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Sheet>
  );
}

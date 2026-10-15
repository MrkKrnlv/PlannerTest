import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store.js';
import { parseQuickAdd } from '../../lib/parse.js';
import { haptic } from '../../lib/telegram.js';
import { Scale } from '../ui.jsx';

/** Итог дня: настроение, энергия, что хорошего, заметка. Хранится документом day:<date>. */
export default function DayJournal({ className = '', date }) {
  const id = `day:${date}`;
  const item = useStore((s) => s.items[id]);
  const data = item && !item.deleted ? item.data : {};
  const { patchItem, addTask, showToast } = useStore.getState();
  const [note, setNote] = useState(data.note || '');
  const [good, setGood] = useState(data.good || '');
  const noteRef = useRef(null);
  const timer = useRef(null);
  const editing = useRef(false);
  const pending = useRef(null); // { id, patch } — несохранённые правки текста

  // при смене дня или приходе правки с другого устройства (если сейчас не печатаем)
  useEffect(() => {
    if (editing.current && pending.current?.id === id) return;
    setNote(data.note || '');
    setGood(data.good || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, item?.updated_at]);

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current) patchItem(pending.current.id, 'day', pending.current.patch);
    pending.current = null;
    editing.current = false;
  };
  const save = (patch) => {
    editing.current = true;
    pending.current = { id, patch: { ...(pending.current?.id === id ? pending.current.patch : {}), ...patch } };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };
  // уходим с дня — сохраняем недописанное в старый день
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => flush, [date]);

  const selectionToTask = () => {
    const el = noteRef.current;
    const text = el ? el.value.slice(el.selectionStart, el.selectionEnd).trim() : '';
    if (!text) {
      showToast('Выдели кусок заметки, и он станет задачей.');
      return;
    }
    const parsed = parseQuickAdd(text.split('\n')[0]);
    addTask({ ...parsed, title: parsed.title || text.slice(0, 120), date: parsed.date || date });
    haptic('success');
    showToast(`Добавил задачу «${(parsed.title || text).slice(0, 40)}».`);
  };

  return (
    <section className={`card journal ${className}`} aria-label="Итог дня">
      <div className="card-head">
        <h2 className="card-title">Итог дня</h2>
      </div>
      <Scale label="Настроение" low="плохо" high="отлично" value={data.mood ?? null} onChange={(v) => patchItem(id, 'day', { mood: v })} />
      <Scale label="Энергия" low="без сил" high="заряжен" value={data.energy ?? null} onChange={(v) => patchItem(id, 'day', { energy: v })} />
      <label className="field">
        <span>Что хорошего было</span>
        <input
          value={good}
          maxLength={300}
          onChange={(e) => {
            setGood(e.target.value);
            save({ good: e.target.value });
          }}
          placeholder="Одна вещь, за которую день был не зря"
        />
      </label>
      <label className="field">
        <span>Заметка</span>
        <textarea
          ref={noteRef}
          rows={4}
          value={note}
          maxLength={8000}
          onChange={(e) => {
            setNote(e.target.value);
            save({ note: e.target.value });
          }}
          placeholder="Мысли, идеи, что не забыть"
        />
      </label>
      <button type="button" className="text-btn" onClick={selectionToTask}>
        Сделать задачей выделенное
      </button>
    </section>
  );
}

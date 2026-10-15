import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, liveTasks } from '../store.js';
import { haptic } from '../lib/telegram.js';
import { IconClose } from './Icons.jsx';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const SLOTS = [
  ['morning', 'Утро'],
  ['afternoon', 'День'],
  ['evening', 'Вечер'],
  ['anytime', 'Когда получится'],
];
const PRIORITIES = [
  [1, 'Важно'],
  [2, 'Обычно'],
  [3, 'Не срочно'],
];

export default function TaskSheet() {
  const id = useStore((s) => s.editingId);
  const task = useStore((s) => (s.editingId ? s.tasks[s.editingId] : null));
  const tasksMap = useStore((s) => s.tasks);
  const { closeTask, updateTask, deleteTask } = useStore.getState();
  const [form, setForm] = useState(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    setForm(task ? { ...task } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (id && !dlg.open) dlg.showModal();
    if (!id && dlg.open) dlg.close();
  }, [id]);

  // задачу удалили на другом устройстве, пока она была открыта
  useEffect(() => {
    if (id && !task) closeTask();
  }, [id, task, closeTask]);

  const areas = useMemo(
    () => [...new Set(liveTasks(tasksMap).map((t) => t.area).filter(Boolean))].sort(),
    [tasksMap]
  );

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const patch = {};
    for (const k of ['title', 'date', 'time', 'slot', 'duration_min', 'area', 'priority', 'note', 'done']) {
      if (form[k] !== task[k]) patch[k] = form[k];
    }
    if (Object.keys(patch).length) updateTask(task.id, patch);
    haptic('light');
    closeTask();
  };

  const remove = () => {
    deleteTask(task.id);
    haptic('warning');
    closeTask();
  };

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      onClose={closeTask}
      onClick={(e) => e.target === dialogRef.current && closeTask()}
      aria-labelledby="sheet-title"
    >
      {form && task && (
        <form className="sheet-body" onSubmit={save}>
          <div className="sheet-head">
            <h2 id="sheet-title" className="sheet-title">Задача</h2>
            <button type="button" className="icon-btn" onClick={closeTask} aria-label="Закрыть">
              <IconClose />
            </button>
          </div>

          <label className="field">
            <span>Название</span>
            <input value={form.title} onChange={(e) => set({ title: e.target.value })} required maxLength={300} />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Дата</span>
              <input type="date" value={form.date || ''} onChange={(e) => set({ date: e.target.value || null })} />
            </label>
            <label className="field">
              <span>Время</span>
              <input
                type="time"
                value={form.time || ''}
                onChange={(e) => {
                  const time = e.target.value || null;
                  set({ time, slot: time ? (+time.slice(0, 2) < 12 ? 'morning' : +time.slice(0, 2) < 17 ? 'afternoon' : 'evening') : form.slot });
                }}
              />
            </label>
          </div>

          <fieldset className="field">
            <legend>Длительность</legend>
            <div className="seg-control">
              {DURATIONS.map((m) => (
                <button key={m} type="button" aria-pressed={form.duration_min === m} onClick={() => set({ duration_min: m })}>
                  {m < 60 ? `${m}м` : `${m / 60}ч`}
                </button>
              ))}
              <input
                type="number"
                min={5}
                max={720}
                step={5}
                value={form.duration_min}
                onChange={(e) => set({ duration_min: Math.max(5, Math.min(720, Number(e.target.value) || 5)) })}
                aria-label="Длительность в минутах"
              />
            </div>
          </fieldset>

          {!form.time && (
            <fieldset className="field">
              <legend>Часть дня</legend>
              <div className="seg-control">
                {SLOTS.map(([v, l]) => (
                  <button key={v} type="button" aria-pressed={form.slot === v} onClick={() => set({ slot: v })}>
                    {l}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="field">
            <legend>Приоритет</legend>
            <div className="seg-control">
              {PRIORITIES.map(([v, l]) => (
                <button key={v} type="button" aria-pressed={form.priority === v} onClick={() => set({ priority: v })}>
                  {l}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>Сфера</span>
            <input
              value={form.area || ''}
              onChange={(e) => set({ area: e.target.value.replace(/^#/, '') || null })}
              list="areas"
              placeholder="работа, учёба, дом"
              maxLength={40}
            />
            <datalist id="areas">
              {areas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span>Заметка</span>
            <textarea rows={3} value={form.note || ''} onChange={(e) => set({ note: e.target.value || null })} maxLength={2000} />
          </label>

          <div className="sheet-actions">
            <button type="button" className="text-btn danger" onClick={remove}>
              Удалить
            </button>
            <button type="submit" className="primary-btn">
              Сохранить
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

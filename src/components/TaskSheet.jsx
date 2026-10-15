import { useEffect, useMemo, useState } from 'react';
import { useStore, liveItems } from '../store.js';
import { addDays, slotFromTime } from '../lib/date.js';
import { haptic } from '../lib/telegram.js';
import { Sheet, Dot } from './ui.jsx';
import { IconBolt, IconFlag, IconTimer } from './Icons.jsx';

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
  const items = useStore((s) => s.items);
  const { closeTask, updateTask, deleteTask, clearOtherFrogs, startTimer, setMoreView, showToast } = useStore.getState();
  const [form, setForm] = useState(null);

  useEffect(() => {
    setForm(task ? { ...task } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    if (id && !task) closeTask();
  }, [id, task, closeTask]);

  const areas = useMemo(() => liveItems(items, 'area').sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)), [items]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = (e) => {
    e?.preventDefault();
    if (!form?.title.trim()) return;
    const patch = {};
    for (const k of ['title', 'date', 'time', 'slot', 'duration_min', 'area', 'priority', 'note', 'deep', 'frog', 'done']) {
      if (form[k] !== task[k]) patch[k] = form[k];
    }
    if (Object.keys(patch).length) updateTask(task.id, patch);
    if (patch.frog) clearOtherFrogs(task.id, form.date);
    haptic('light');
    closeTask();
  };

  const focus = (minutes) => {
    save();
    startTimer({ kind: 'focus', label: form.title, minutes, taskId: task.id });
    showToast(`Фокус ${minutes} мин: ${form.title}`, { label: 'Таймеры', run: () => setMoreView('timers') });
  };

  return (
    <Sheet
      open={!!(form && task)}
      onClose={closeTask}
      title="Задача"
      footer={
        form && (
          <>
            <button
              type="button"
              className="text-btn danger"
              onClick={() => {
                deleteTask(task.id);
                haptic('warning');
                closeTask();
              }}
            >
              Удалить
            </button>
            <button type="submit" form="task-form" className="primary-btn">
              Сохранить
            </button>
          </>
        )
      }
    >
      {form && (
        <form id="task-form" className="form" onSubmit={save}>
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
                  set({ time, slot: time ? slotFromTime(time) : form.slot });
                }}
              />
            </label>
          </div>
          <div className="quick-dates">
            <button type="button" className="chip-btn" onClick={() => set({ date: addDays(form.date || task.date, 1), time: null })}>
              На день позже
            </button>
            {form.time && (
              <button type="button" className="chip-btn" onClick={() => set({ time: null })}>
                Убрать время
              </button>
            )}
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

          <div className="toggles">
            <button type="button" className="toggle" aria-pressed={!!form.frog} data-kind="frog" onClick={() => set({ frog: !form.frog, priority: !form.frog ? 1 : form.priority })}>
              <IconFlag />
              <span>
                <b>Главное на день</b>
                <small>Одна задача, ради которой день удался</small>
              </span>
            </button>
            <button type="button" className="toggle" aria-pressed={!!form.deep} data-kind="deep" onClick={() => set({ deep: !form.deep })}>
              <IconBolt />
              <span>
                <b>Глубокая работа</b>
                <small>Автоплан поставит в пик энергии</small>
              </span>
            </button>
          </div>

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

          <fieldset className="field">
            <legend>Сфера</legend>
            <div className="seg-control">
              <button type="button" aria-pressed={!form.area} onClick={() => set({ area: null })}>
                Без сферы
              </button>
              {areas.map((a) => (
                <button key={a.id} type="button" aria-pressed={form.area?.toLowerCase() === a.data.name.toLowerCase()} onClick={() => set({ area: a.data.name })}>
                  <Dot color={a.data.color} />
                  {a.data.name}
                </button>
              ))}
              {form.area && !areas.some((a) => a.data.name.toLowerCase() === form.area.toLowerCase()) && (
                <button type="button" aria-pressed="true">
                  #{form.area}
                </button>
              )}
            </div>
          </fieldset>

          <label className="field">
            <span>Заметка</span>
            <textarea rows={3} value={form.note || ''} onChange={(e) => set({ note: e.target.value || null })} maxLength={2000} />
          </label>

          {!form.done && (
            <div className="focus-row">
              <IconTimer />
              <span>Фокус на задаче</span>
              <button type="button" className="chip-btn" onClick={() => focus(25)}>
                25 мин
              </button>
              <button type="button" className="chip-btn" onClick={() => focus(50)}>
                50 мин
              </button>
            </div>
          )}
        </form>
      )}
    </Sheet>
  );
}

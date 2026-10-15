import { useEffect, useMemo, useState } from 'react';
import { useStore, liveTasks } from '../../store.js';
import { addDays, formatShort } from '../../lib/date.js';
import { pointsByDay } from '../../lib/points.js';
import { haptic } from '../../lib/telegram.js';
import { Scale, Sheet } from '../ui.jsx';

const STEPS = ['Хвосты', 'Самочувствие', 'Главное'];

/** «Завершить день»: три коротких шага вместо формы на главном экране */
export default function ReviewSheet() {
  const open = useStore((s) => s.sheet === 'review');
  const date = useStore((s) => s.date);
  const tasksMap = useStore((s) => s.tasks);
  const item = useStore((s) => s.items[`day:${date}`]);
  const { closeSheet, updateTask, toggleDone, deleteTask, patchItem, showToast } = useStore.getState();
  const data = item && !item.deleted ? item.data : {};
  const [step, setStep] = useState(0);
  const [good, setGood] = useState('');
  const [note, setNote] = useState('');

  const open_ = useMemo(() => liveTasks(tasksMap).filter((t) => t.date === date && !t.done), [tasksMap, date]);

  useEffect(() => {
    if (!open) return;
    setStep(open_.length ? 0 : 1);
    setGood(data.good || '');
    setNote(data.note || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  const move = (t, to) => {
    updateTask(t.id, { date: to, time: null });
    haptic('light');
  };

  const finish = () => {
    patchItem(`day:${date}`, 'day', { good: good.trim() || null, note: note.trim() || null, reviewed: true });
    const pts = pointsByDay(liveTasks(useStore.getState().tasks))[date] || 0;
    haptic('success');
    closeSheet();
    showToast(pts ? `День закрыт: ${pts} очков` : 'День закрыт');
  };

  return (
    <Sheet open={open} onClose={closeSheet} title="Завершить день">
      <ol className="steps" aria-label="Шаги">
        {STEPS.map((s, i) => (
          <li key={s} data-active={i === step || undefined} data-done={i < step || undefined}>
            <button type="button" onClick={() => setStep(i)}>
              {s}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="sheet-section">
          {open_.length === 0 ? (
            <p>Все задачи дня закрыты. Отлично.</p>
          ) : (
            <>
              <p className="muted">Реши судьбу каждой несделанной задачи, чтобы завтра начать с чистого листа.</p>
              <ul className="triage">
                {open_.map((t) => (
                  <li key={t.id}>
                    <span className="triage-title">
                      {t.title}
                      <span className="muted small"> {formatShort(t.duration_min)}</span>
                    </span>
                    <span className="triage-actions">
                      <button type="button" className="chip-btn" onClick={() => toggleDone(t.id)}>
                        Сделано
                      </button>
                      <button type="button" className="chip-btn" onClick={() => move(t, addDays(date, 1))}>
                        Завтра
                      </button>
                      <button type="button" className="chip-btn" onClick={() => move(t, null)}>
                        Во входящие
                      </button>
                      <button type="button" className="chip-btn danger" onClick={() => deleteTask(t.id)}>
                        Удалить
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <button type="button" className="text-btn" onClick={() => open_.forEach((t) => move(t, addDays(date, 1)))}>
                Всё на завтра
              </button>
            </>
          )}
        </section>
      )}

      {step === 1 && (
        <section className="sheet-section">
          <Scale label="Настроение" low="плохо" high="отлично" value={data.mood ?? null} onChange={(v) => patchItem(`day:${date}`, 'day', { mood: v })} />
          <Scale label="Энергия" low="без сил" high="заряжен" value={data.energy ?? null} onChange={(v) => patchItem(`day:${date}`, 'day', { energy: v })} />
        </section>
      )}

      {step === 2 && (
        <section className="sheet-section form">
          <label className="field">
            <span>Что хорошего было</span>
            <input value={good} onChange={(e) => setGood(e.target.value)} maxLength={300} placeholder="Одна вещь, за которую день был не зря" />
          </label>
          <label className="field">
            <span>Заметка</span>
            <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={8000} placeholder="Мысли, выводы, что учесть завтра" />
          </label>
        </section>
      )}

      <div className="sheet-actions">
        {step > 0 ? (
          <button type="button" className="text-btn" onClick={() => setStep(step - 1)}>
            Назад
          </button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <button type="button" className="primary-btn" onClick={() => setStep(step + 1)}>
            Дальше
          </button>
        ) : (
          <button type="button" className="primary-btn" onClick={finish}>
            Закрыть день
          </button>
        )}
      </div>
    </Sheet>
  );
}

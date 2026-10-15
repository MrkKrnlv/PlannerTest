import { useMemo } from 'react';
import { useStore, liveTasks, byOrder, settingsOf } from '../../store.js';
import { capacity } from '../../lib/capacity.js';
import { autoplan } from '../../lib/autoplan.js';
import { addDays, formatShort, plural } from '../../lib/date.js';
import { haptic } from '../../lib/telegram.js';
import { Meter, Sheet } from '../ui.jsx';
import { IconWand } from '../Icons.jsx';

/** «Спланировать день»: нагрузка, что перенести и предпросмотр автоплана */
export default function PlanSheet() {
  const open = useStore((s) => s.sheet === 'plan');
  const date = useStore((s) => s.date);
  const tasksMap = useStore((s) => s.tasks);
  const items = useStore((s) => s.items);
  const { closeSheet, applyAutoplan, undoAutoplan, moveTasks, showToast, setMoreView } = useStore.getState();
  const settings = settingsOf(items);
  const dayTasks = useMemo(() => liveTasks(tasksMap).filter((t) => t.date === date).sort(byOrder), [tasksMap, date]);
  const c = capacity(dayTasks, settings);
  const plan = open ? autoplan(dayTasks, settings, date) : { placements: {}, unplaced: [] };
  const preview = Object.entries(plan.placements)
    .map(([id, time]) => ({ task: tasksMap[id], time }))
    .sort((a, b) => a.time.localeCompare(b.time));

  const apply = () => {
    applyAutoplan(date, plan.placements);
    haptic('success');
    closeSheet();
    showToast(`Расставил ${preview.length} ${plural(preview.length, 'задачу', 'задачи', 'задач')}`, { label: 'Отменить', run: undoAutoplan });
  };

  return (
    <Sheet open={open} onClose={closeSheet} title="Спланировать день">
      <div className="plan-meters">
        <Meter label="Время" value={c.timeLoad} max={c.timeCap} text={`${formatShort(c.timeLoad)} из ${formatShort(c.timeCap)}`} />
        <Meter label="Голова" tone="deep" value={c.headLoad} max={c.headCap} text={`${formatShort(c.headLoad)} из ${formatShort(c.headCap)}`} />
        <p className="muted small">
          «Время» — задачи против реально доступной части дня, незакрытые считаются с запасом ×1.5. «Голова» — часы глубокой работы.
        </p>
      </div>

      {c.suggestions.length > 0 && (
        <section className="sheet-section warn">
          <h3 className="section-title">День не влезает</h3>
          <p>Спокойно можно перенести на завтра:</p>
          <ul className="plain-list">
            {c.suggestions.map((t) => (
              <li key={t.id}>
                {t.title} <span className="muted">{formatShort(t.duration_min)}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              moveTasks(c.suggestions.map((t) => t.id), addDays(date, 1));
              haptic('light');
              showToast(`Перенёс на завтра: ${c.suggestions.length}`);
            }}
          >
            Перенести на завтра
          </button>
        </section>
      )}

      <section className="sheet-section">
        <h3 className="section-title">Расстановка по времени</h3>
        {preview.length === 0 ? (
          <p className="muted">
            {plan.unplaced.length ? 'Свободного времени не осталось.' : 'Все задачи уже стоят по времени или сделаны.'}
          </p>
        ) : (
          <>
            <p className="muted small">
              Главное и глубокая работа уходят в пик {settings.peakStart}–{settings.peakEnd}, мелочи после него, после каждого блока перерыв{' '}
              {settings.breakMin} мин, обед {settings.lunchStart}–{settings.lunchEnd} свободен.
            </p>
            <ol className="preview">
              {preview.map(({ task, time }) => (
                <li key={task.id} data-frog={task.frog || undefined}>
                  <span className="preview-time">{time}</span>
                  <span className="preview-title">{task.title}</span>
                  <span className="muted small">{formatShort(task.duration_min)}</span>
                </li>
              ))}
            </ol>
            {plan.unplaced.length > 0 && <p className="muted small">Не влезло: {plan.unplaced.map((t) => `«${t.title}»`).join(', ')}.</p>}
          </>
        )}
      </section>

      <div className="sheet-actions">
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            closeSheet();
            setMoreView('settings');
          }}
        >
          Мои часы
        </button>
        <button type="button" className="primary-btn" onClick={apply} disabled={!preview.length}>
          <IconWand width={18} height={18} />
          Расставить
        </button>
      </div>
    </Sheet>
  );
}

import { useStore } from '../store.js';
import { formatDuration } from '../lib/date.js';

/** Полоса дня: задачи как отрезки по длительности, отметка — дневная норма. */
export default function DayStrip({ tasks, compact = false }) {
  const capacity = useStore((s) => s.capacityMin);
  const openTask = useStore((s) => s.openTask);

  const total = tasks.reduce((sum, t) => sum + t.duration_min, 0);
  const doneMin = tasks.filter((t) => t.done).reduce((sum, t) => sum + t.duration_min, 0);
  const scale = Math.max(capacity, total, 1);
  const over = total - capacity;

  return (
    <div className={`strip ${compact ? 'strip-compact' : ''} ${over > 0 ? 'is-over' : ''}`}>
      <div className="strip-track" role="img" aria-label={`Запланировано ${formatDuration(total) || '0 мин'} из ${formatDuration(capacity)}`}>
        {tasks.map((t) => (
          <button
            key={t.id}
            type="button"
            className="seg"
            data-done={t.done || undefined}
            data-pri={t.priority === 1 || undefined}
            data-voice={t.source === 'voice' || undefined}
            style={{ flexBasis: `${(t.duration_min / scale) * 100}%` }}
            title={`${t.title}, ${formatDuration(t.duration_min)}`}
            tabIndex={compact ? -1 : 0}
            onClick={compact ? undefined : () => openTask(t.id)}
          />
        ))}
        <span className="strip-cap" style={{ left: `${(capacity / scale) * 100}%` }} />
      </div>
      {!compact && (
        <p className="strip-caption">
          <span>
            {total ? `${formatDuration(total)} из ${formatDuration(capacity)}` : 'День пока свободен'}
          </span>
          {over > 0 ? (
            <span className="strip-over">Перебор на {formatDuration(over)}</span>
          ) : total > 0 ? (
            <span>Сделано {formatDuration(doneMin) || '0 мин'}</span>
          ) : null}
        </p>
      )}
    </div>
  );
}

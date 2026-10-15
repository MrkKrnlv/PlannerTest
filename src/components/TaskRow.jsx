import { useStore } from '../store.js';
import { dayMonth, formatDuration } from '../lib/date.js';
import { haptic } from '../lib/telegram.js';
import { IconCheck, IconMic } from './Icons.jsx';

export default function TaskRow({ task, showDate = false }) {
  const toggleDone = useStore((s) => s.toggleDone);
  const openTask = useStore((s) => s.openTask);

  return (
    <li className="task" data-done={task.done || undefined} data-pri={task.priority}>
      <button
        type="button"
        className="check"
        aria-pressed={task.done}
        aria-label={task.done ? `Вернуть «${task.title}»` : `Отметить «${task.title}» сделанной`}
        onClick={() => {
          toggleDone(task.id);
          haptic(task.done ? 'light' : 'success');
        }}
      >
        <IconCheck />
      </button>
      <button type="button" className="task-body" onClick={() => openTask(task.id)}>
        <span className="task-title">
          <span className="mark">{task.title}</span>
        </span>
        <span className="task-meta">
          {showDate && task.date && <span className="meta-date">{dayMonth(task.date)}</span>}
          {task.time && <span className="meta-time">{task.time}</span>}
          <span>{formatDuration(task.duration_min)}</span>
          {task.area && <span className="meta-area">#{task.area}</span>}
          {task.source === 'voice' && (
            <span className="meta-voice" title="Добавлено голосом через бота">
              <IconMic /> голосом
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

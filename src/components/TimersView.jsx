import { useEffect, useState } from 'react';
import { useStore, liveTasks } from '../store.js';
import { todayISO } from '../lib/date.js';
import { IconPause, IconPlay, IconClose, IconPlus } from './Icons.jsx';

export const leftMs = (t) => (t.endsAt ? Math.max(0, t.endsAt - Date.now()) : t.pausedLeft ?? 0);
export const fmtClock = (ms) => {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};

export function useTick(active) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setN((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

const FOCUS = [
  [25, 'Фокус 25'],
  [50, 'Глубоко 50'],
  [5, 'Перерыв 5'],
];
const SIDE = [
  ['Стирка', 60],
  ['Духовка', 40],
  ['3D-печать', 180],
  ['Чайник', 3],
];

function TimerCard({ t }) {
  const { pauseTimer, resumeTimer, removeTimer, toggleDone, tasks } = useStore.getState();
  const ms = leftMs(t);
  const total = t.minutes * 60_000;
  const finished = ms === 0;
  const task = t.taskId ? tasks[t.taskId] : null;
  return (
    <li className="card timer" data-kind={t.kind} data-finished={finished || undefined}>
      <div className="timer-ring" style={{ '--p': `${(1 - ms / total) * 360}deg` }}>
        <span className="timer-clock">{finished ? 'Готово' : fmtClock(ms)}</span>
      </div>
      <div className="timer-info">
        <span className="timer-label">{t.label}</span>
        <span className="muted small">
          {t.kind === 'focus' ? 'Фокус' : 'Таймер'} на {t.minutes} мин{t.pausedLeft != null ? ', на паузе' : ''}
        </span>
        <div className="timer-actions">
          {!finished &&
            (t.endsAt ? (
              <button type="button" className="icon-btn" onClick={() => pauseTimer(t.id)} aria-label="Пауза">
                <IconPause />
              </button>
            ) : (
              <button type="button" className="icon-btn" onClick={() => resumeTimer(t.id)} aria-label="Продолжить">
                <IconPlay />
              </button>
            ))}
          {finished && task && !task.done && (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                toggleDone(task.id);
                removeTimer(t.id);
              }}
            >
              Задача сделана
            </button>
          )}
          <button type="button" className="icon-btn" onClick={() => removeTimer(t.id)} aria-label="Убрать таймер">
            <IconClose />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function TimersView() {
  const timers = useStore((s) => s.timers);
  const tasksMap = useStore((s) => s.tasks);
  const startTimer = useStore((s) => s.startTimer);
  const [label, setLabel] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [taskId, setTaskId] = useState('');
  useTick(timers.length > 0);

  const todayOpen = liveTasks(tasksMap).filter((t) => t.date === todayISO() && !t.done);
  const focusOn = (m, l) => {
    const task = taskId ? tasksMap[taskId] : null;
    startTimer({ kind: m === 5 ? 'side' : 'focus', label: m === 5 ? 'Перерыв' : task?.title || l, minutes: m, taskId: m === 5 ? null : task?.id || null });
  };

  return (
    <div className="page timers">
      <header className="page-head">
        <div>
          <h1 className="page-title">Таймеры</h1>
          <p className="muted small">Хранятся на этом устройстве и переживают перезагрузку</p>
        </div>
      </header>

      {timers.length > 0 && (
        <ul className="timer-list">
          {timers.map((t) => (
            <TimerCard key={t.id} t={t} />
          ))}
        </ul>
      )}

      <section className="card">
        <h2 className="card-title">Фокус</h2>
        {todayOpen.length > 0 && (
          <label className="field">
            <span>На задаче</span>
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">Без задачи</option>
              {todayOpen.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="seg-control">
          {FOCUS.map(([m, l]) => (
            <button key={m} type="button" onClick={() => focusOn(m, l)}>
              {l}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Побочный таймер</h2>
        <p className="muted small">Можно запускать несколько параллельно: стирка, духовка, печать.</p>
        <div className="seg-control">
          {SIDE.map(([l, m]) => (
            <button key={l} type="button" onClick={() => startTimer({ label: l, minutes: m })}>
              {l} {m} мин
            </button>
          ))}
        </div>
        <form
          className="inline-add"
          onSubmit={(e) => {
            e.preventDefault();
            startTimer({ label: label.trim() || 'Таймер', minutes });
            setLabel('');
          }}
        >
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Что ждём" maxLength={40} />
          <input type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(Math.max(1, Math.min(600, Number(e.target.value) || 1)))} aria-label="Минут" className="num-input" />
          <button type="submit" className="icon-btn" aria-label="Запустить">
            <IconPlus />
          </button>
        </form>
      </section>
    </div>
  );
}

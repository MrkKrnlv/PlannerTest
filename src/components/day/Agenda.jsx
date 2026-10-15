import { useEffect, useMemo, useState } from 'react';
import { useStore, liveItems } from '../../store.js';
import { dayMonth, formatDuration, formatShort, minToTime, nowMin, timeToMin, todayISO } from '../../lib/date.js';
import { areaColor } from '../../lib/areas.js';
import { haptic } from '../../lib/telegram.js';
import { IconBolt, IconCheck, IconFlag, IconMic } from '../Icons.jsx';

function useNow() {
  const [n, setN] = useState(nowMin);
  useEffect(() => {
    const id = setInterval(() => setN(nowMin()), 60_000);
    return () => clearInterval(id);
  }, []);
  return n;
}

function Check({ task }) {
  const toggleDone = useStore((s) => s.toggleDone);
  return (
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
  );
}

function Tags({ task, showDate }) {
  return (
    <span className="tags">
      {showDate && task.date && <span className="tag tag-late">{dayMonth(task.date)}</span>}
      {task.frog && (
        <span className="tag tag-frog">
          <IconFlag /> главное
        </span>
      )}
      {task.deep && !task.frog && (
        <span className="tag tag-deep">
          <IconBolt /> глубоко
        </span>
      )}
      {task.area && <span className="tag">#{task.area}</span>}
      {task.source === 'voice' && (
        <span className="tag tag-voice">
          <IconMic /> голосом
        </span>
      )}
    </span>
  );
}

/** Блок задачи со временем: высота растёт с длительностью */
function Block({ task, color, current }) {
  const openTask = useStore((s) => s.openTask);
  const start = timeToMin(task.time);
  const h = Math.max(64, Math.min(200, task.duration_min * 1.1));
  return (
    <li
      className="block"
      style={{ '--h': `${h}px` }}
      data-color={color || undefined}
      data-done={task.done || undefined}
      data-frog={task.frog || undefined}
      data-current={current || undefined}
    >
      <Check task={task} />
      <button type="button" className="block-body" onClick={() => openTask(task.id)}>
        <span className="block-time">
          {task.time}–{minToTime(start + task.duration_min)}
          <span className="muted"> {formatShort(task.duration_min)}</span>
        </span>
        <span className="block-title">{task.title}</span>
        <Tags task={task} />
      </button>
    </li>
  );
}

function Row({ task, color, showDate }) {
  const openTask = useStore((s) => s.openTask);
  return (
    <li className="row" data-color={color || undefined} data-done={task.done || undefined} data-frog={task.frog || undefined}>
      <Check task={task} />
      <button type="button" className="row-body" onClick={() => openTask(task.id)}>
        <span className="row-title">{task.title}</span>
        <span className="row-meta">
          <span>{formatShort(task.duration_min)}</span>
          <Tags task={task} showDate={showDate} />
        </span>
      </button>
    </li>
  );
}

export default function Agenda({ className = '', date, dayTasks, all }) {
  const items = useStore((s) => s.items);
  const moveTasks = useStore((s) => s.moveTasks);
  const areas = useMemo(() => liveItems(items, 'area'), [items]);
  const color = (t) => areaColor(areas, t.area);
  const now = useNow();
  const today = todayISO();
  const isToday = date === today;

  const overdue = isToday ? all.filter((t) => !t.done && t.date && t.date < today).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const timed = dayTasks.filter((t) => t.time).sort((a, b) => a.time.localeCompare(b.time));
  const untimed = dayTasks.filter((t) => !t.time);

  // лента со свободными окнами и отметкой "сейчас"
  const lane = [];
  let prevEnd = null;
  let nowPlaced = !isToday;
  for (const t of timed) {
    const start = timeToMin(t.time);
    const end = start + t.duration_min;
    if (!nowPlaced && now < start) {
      // окно до "сейчас" (уже прошло) и окно от "сейчас" до следующей задачи
      if (prevEnd != null && now - prevEnd >= 15) lane.push({ gap: now - prevEnd, key: `g${t.id}a` });
      lane.push({ now: true, key: 'now' });
      nowPlaced = true;
      const from = Math.max(prevEnd ?? now, now);
      if (start - from >= 15) lane.push({ gap: start - from, key: `g${t.id}` });
    } else if (prevEnd != null && start - prevEnd >= 15) {
      lane.push({ gap: start - prevEnd, key: `g${t.id}` });
    }
    lane.push({ task: t, current: isToday && now >= start && now < end, key: t.id });
    if (isToday && now >= start && now < end) nowPlaced = true;
    prevEnd = Math.max(prevEnd ?? 0, end);
  }
  if (!nowPlaced && timed.length) lane.push({ now: true, key: 'now' });

  return (
    <section className={`agenda ${className}`} aria-label="План дня">
      {overdue.length > 0 && (
        <div className="agenda-group group-late">
          <div className="group-head">
            <h2 className="group-title">Хвосты с прошлых дней</h2>
            <button type="button" className="text-btn" onClick={() => moveTasks(overdue.map((t) => t.id), today)}>
              Перенести на сегодня
            </button>
          </div>
          <ul className="rows">
            {overdue.map((t) => (
              <Row key={t.id} task={t} color={color(t)} showDate />
            ))}
          </ul>
        </div>
      )}

      {timed.length > 0 && (
        <div className="agenda-group">
          <div className="group-head">
            <h2 className="group-title">По времени</h2>
            <span className="muted small">{formatDuration(timed.reduce((s, t) => s + t.duration_min, 0))}</span>
          </div>
          <ol className="lane">
            {lane.map((x) =>
              x.task ? (
                <Block key={x.key} task={x.task} color={color(x.task)} current={x.current} />
              ) : x.now ? (
                <li key={x.key} className="lane-now">
                  <span>сейчас {minToTime(now)}</span>
                </li>
              ) : (
                <li key={x.key} className="lane-gap">
                  <span>свободно {formatShort(x.gap)}</span>
                </li>
              )
            )}
          </ol>
        </div>
      )}

      {untimed.length > 0 && (
        <div className="agenda-group">
          <div className="group-head">
            <h2 className="group-title">Без времени</h2>
            <span className="muted small">{formatDuration(untimed.reduce((s, t) => s + t.duration_min, 0))}</span>
          </div>
          <ul className="rows">
            {untimed.map((t) => (
              <Row key={t.id} task={t} color={color(t)} />
            ))}
          </ul>
        </div>
      )}

      {dayTasks.length === 0 && (
        <div className="empty">
          <p className="empty-title">На этот день ничего нет</p>
          <p className="muted">Напиши задачу в поле выше или надиктуй её боту голосовым.</p>
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { useStore } from '../store.js';
import { minToTime, timeToMin, todayISO } from '../lib/date.js';

const PX_PER_MIN = 1;

function useNowMin() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now.getHours() * 60 + now.getMinutes();
}

/** Раскладка пересекающихся задач по дорожкам */
function layout(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => (c.lanes = lanes));
    cluster = [];
  };
  for (const it of sorted) {
    if (it.start >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const used = new Set(cluster.filter((c) => c.end > it.start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    const p = { ...it, lane };
    cluster.push(p);
    placed.push(p);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return placed;
}

export default function Timeline({ date, tasks }) {
  const openTask = useStore((s) => s.openTask);
  const nowMin = useNowMin();
  const timed = tasks
    .filter((t) => t.time)
    .map((t) => ({ task: t, start: timeToMin(t.time), end: timeToMin(t.time) + t.duration_min }));

  const from = Math.min(7 * 60, ...timed.map((t) => Math.floor(t.start / 60) * 60));
  const to = Math.max(23 * 60, ...timed.map((t) => Math.ceil(t.end / 60) * 60));
  const hours = [];
  for (let m = from; m <= to; m += 60) hours.push(m);
  const isToday = date === todayISO();

  return (
    <section className="timeline" aria-label="Расписание">
      <h2 className="section-title">Расписание</h2>
      {!timed.length && <p className="muted small">Задачи со временем появятся здесь.</p>}
      <div className="tl-grid" style={{ height: (to - from) * PX_PER_MIN }}>
        {hours.map((m) => (
          <div key={m} className="tl-hour" style={{ top: (m - from) * PX_PER_MIN }}>
            <span>{minToTime(m)}</span>
          </div>
        ))}
        {isToday && nowMin >= from && nowMin <= to && (
          <div className="tl-now" style={{ top: (nowMin - from) * PX_PER_MIN }} aria-hidden="true" />
        )}
        {layout(timed).map(({ task, start, end, lane, lanes }) => (
          <button
            key={task.id}
            type="button"
            className="tl-block"
            data-done={task.done || undefined}
            data-pri={task.priority}
            data-voice={task.source === 'voice' || undefined}
            style={{
              top: (start - from) * PX_PER_MIN,
              height: Math.max(22, (end - start) * PX_PER_MIN - 2),
              left: `calc(3.25rem + (100% - 3.25rem) * ${lane / lanes})`,
              width: `calc((100% - 3.25rem) / ${lanes} - 4px)`,
            }}
            onClick={() => openTask(task.id)}
          >
            <span className="tl-time">{task.time}</span>
            <span className="tl-title">{task.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

import { useMemo } from 'react';
import { useStore, liveTasks, liveItems, byOrder, settingsOf } from '../store.js';
import {
  addDays, addMonths, fromISO, monthGrid, monthTitle, todayISO, weekDays, weekRange,
  weekdayShort, weekdayShortByIdx, weekdayPlural, formatShort, formatDuration, dayMonth, WEEKDAYS_MON, plural,
} from '../lib/date.js';
import { capacity } from '../lib/capacity.js';
import { pointsByDay, streak, weekdayRecords } from '../lib/points.js';
import { areaColor, sameArea } from '../lib/areas.js';
import { Segmented, Dot } from './ui.jsx';
import { IconLeft, IconRight, IconFlag } from './Icons.jsx';

function Nav({ title, sub, onPrev, onNext, onToday, showToday }) {
  return (
    <header className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="muted small">{sub}</p>}
      </div>
      <nav className="page-nav">
        {showToday && (
          <button type="button" className="text-btn" onClick={onToday}>
            Сейчас
          </button>
        )}
        <button type="button" className="icon-btn" onClick={onPrev} aria-label="Назад">
          <IconLeft />
        </button>
        <button type="button" className="icon-btn" onClick={onNext} aria-label="Вперёд">
          <IconRight />
        </button>
      </nav>
    </header>
  );
}

export function WeekView({ all, settings, areas }) {
  const date = useStore((s) => s.date);
  const { setDate, setView, openTask } = useStore.getState();
  const days = weekDays(date);
  const today = todayISO();
  const week = all.filter((t) => days.includes(t.date));
  const total = week.reduce((s, t) => s + t.duration_min, 0);

  const loads = days.map((d) => capacity(all.filter((t) => t.date === d), settings));
  // лёгкий день — будний с минимальной загрузкой
  const weekdaysIdx = [0, 1, 2, 3, 4].filter((i) => days[i] >= today);
  const lightIdx = weekdaysIdx.length
    ? weekdaysIdx.reduce((best, i) => (loads[i].timeLoad < loads[best].timeLoad ? i : best), weekdaysIdx[0])
    : -1;

  // баланс по сферам
  const byArea = {};
  for (const t of week) {
    const key = areas.find((a) => sameArea(a.data.name, t.area))?.data.name || t.area || 'без сферы';
    byArea[key] = (byArea[key] || 0) + t.duration_min;
  }
  const balance = Object.entries(byArea).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <Nav
        title={weekRange(days[0], days[6])}
        sub={`Запланировано ${formatDuration(total)}`}
        onPrev={() => setDate(addDays(date, -7))}
        onNext={() => setDate(addDays(date, 7))}
        onToday={() => setDate(today)}
        showToday={!days.includes(today)}
      />
      {balance.length > 0 && (
        <section className="card balance" aria-label="Баланс по сферам">
          <div className="balance-bar">
            {balance.map(([name, min]) => (
              <span key={name} data-color={areaColor(areas, name) || undefined} style={{ flexGrow: min }} title={`${name}: ${formatShort(min)}`} />
            ))}
          </div>
          <ul className="balance-legend">
            {balance.map(([name, min]) => (
              <li key={name}>
                <Dot color={areaColor(areas, name)} />
                {name} <span className="muted">{formatShort(min)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="week-grid">
        {days.map((d, i) => {
          const list = all.filter((t) => t.date === d).sort(byOrder);
          const c = loads[i];
          return (
            <section key={d} className="wday" data-today={d === today || undefined} data-past={d < today || undefined}>
              <button
                type="button"
                className="wday-head"
                onClick={() => {
                  setDate(d);
                  setView('today');
                }}
              >
                <span className="wday-name">{weekdayShort(d)}</span>
                <span className="wday-num">{fromISO(d).getDate()}</span>
                {i === lightIdx && list.length < 6 && <span className="wday-light">лёгкий день</span>}
              </button>
              <div className="mini-load" data-over={c.timeLoad > c.timeCap || undefined}>
                <span style={{ width: `${Math.min(100, (c.timeLoad / c.timeCap) * 100)}%` }} />
              </div>
              <ul className="wday-tasks">
                {list.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="wtask"
                      data-done={t.done || undefined}
                      data-frog={t.frog || undefined}
                      data-color={areaColor(areas, t.area) || undefined}
                      onClick={() => openTask(t.id)}
                    >
                      {t.time && <span className="wtask-time">{t.time}</span>}
                      <span className="wtask-title">{t.title}</span>
                    </button>
                  </li>
                ))}
                {!list.length && <li className="muted small wday-empty">Свободно</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

export function MonthView({ all, settings }) {
  const date = useStore((s) => s.date);
  const { setDate, setView } = useStore.getState();
  const today = todayISO();
  const weeks = monthGrid(date);
  const month = date.slice(0, 7);
  const byDay = useMemo(() => pointsByDay(all), [all]);
  const records = useMemo(() => weekdayRecords(byDay), [byDay]);
  const monthPoints = Object.entries(byDay).filter(([d]) => d.startsWith(month)).reduce((s, [, p]) => s + p, 0);
  const bestDay = Object.entries(byDay).filter(([d]) => d.startsWith(month)).sort((a, b) => b[1] - a[1])[0];
  const s = streak(byDay, today);
  const maxRecord = Math.max(1, ...Object.values(records).map((r) => r.points));

  return (
    <>
      <Nav
        title={monthTitle(date)}
        sub={`${monthPoints} ${plural(monthPoints, 'очко', 'очка', 'очков')} за месяц`}
        onPrev={() => setDate(addMonths(date, -1))}
        onNext={() => setDate(addMonths(date, 1))}
        onToday={() => setDate(today)}
        showToday={!date.startsWith(today.slice(0, 7))}
      />
      <div className="month">
        <div className="month-head">
          {WEEKDAYS_MON.map((i) => (
            <span key={i}>{weekdayShortByIdx(i)}</span>
          ))}
        </div>
        {weeks.map((w) => (
          <div key={w[0]} className="month-row">
            {w.map((d) => {
              const list = all.filter((t) => t.date === d);
              const c = capacity(list, settings);
              const done = list.filter((t) => t.done).length;
              const frogDone = list.some((t) => t.frog && t.done);
              return (
                <button
                  key={d}
                  type="button"
                  className="mcell"
                  data-out={!d.startsWith(month) || undefined}
                  data-today={d === today || undefined}
                  onClick={() => {
                    setDate(d);
                    setView('today');
                  }}
                  aria-label={`${dayMonth(d)}: задач ${list.length}, сделано ${done}, очков ${byDay[d] || 0}`}
                >
                  <span className="mcell-num">{fromISO(d).getDate()}</span>
                  {byDay[d] > 0 && <span className="mcell-pts">{byDay[d]}</span>}
                  {frogDone && <IconFlag className="mcell-frog" />}
                  {list.length > 0 && (
                    <span className="mcell-load" data-over={c.timeLoad > c.timeCap || undefined}>
                      <span style={{ width: `${Math.min(100, (c.timeLoad / c.timeCap) * 100)}%` }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="stats-grid">
        <section className="card stat-card">
          <span className="stat-big">{s}</span>
          <span className="muted">{plural(s, 'день', 'дня', 'дней')} подряд с сделанными задачами</span>
        </section>
        <section className="card stat-card">
          <span className="stat-big">{bestDay ? bestDay[1] : 0}</span>
          <span className="muted">{bestDay ? `лучший день месяца, ${dayMonth(bestDay[0])}` : 'лучший день месяца ещё впереди'}</span>
        </section>
        <section className="card records">
          <h2 className="card-title">Рекорды по дням недели</h2>
          <ul className="records-list">
            {WEEKDAYS_MON.map((i) => (
              <li key={i} title={records[i] ? `Рекорд по ${weekdayPlural(i)}: ${records[i].points}, ${dayMonth(records[i].date)}` : 'Пока нет'}>
                <span className="records-bar">
                  <span style={{ height: `${((records[i]?.points || 0) / maxRecord) * 100}%` }} />
                </span>
                <span className="records-val">{records[i]?.points || 0}</span>
                <span className="muted small">{weekdayShortByIdx(i)}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Очки: 10 за мелкую задачу, 25 за среднюю, 30 за большую, 40 за главную на день.</p>
        </section>
      </div>
    </>
  );
}

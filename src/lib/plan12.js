import { addDays, diffDays, todayISO, weekStart } from './date.js';

export const DEFAULT_PLAN = { start: weekStart(todayISO()), target: 85, title: '12 недель' };

/** Номер недели цикла: 1..12, 13 — неделя обзора, 0 — до старта, >13 — цикл закончился */
export const weekOf = (plan, date = todayISO()) => {
  const d = diffDays(date, plan.start);
  return d < 0 ? 0 : Math.floor(d / 7) + 1;
};
export const weekDates = (plan, week) => {
  const start = addDays(plan.start, (week - 1) * 7);
  return [start, addDays(start, 6)];
};

export const tacticLogId = (tacticId, week) => `tl:${tacticId}:${week}`;
export const tacticActive = (tactic, week) => {
  const w = tactic.data.weeks;
  return !w || w === 'all' || (Array.isArray(w) && w.includes(week));
};

/** Выполнение недели: сделано / запланировано шагов. null, если на неделю ничего нет. */
export function weekScore(tactics, items, week) {
  const active = tactics.filter((t) => tacticActive(t, week));
  if (!active.length) return null;
  const done = active.filter((t) => {
    const l = items[tacticLogId(t.id, week)];
    return l && !l.deleted;
  }).length;
  return Math.round((done / active.length) * 100);
}

/** Среднее по прошедшим и текущей неделе */
export function cycleScore(tactics, items, currentWeek) {
  const scores = [];
  for (let w = 1; w <= Math.min(12, currentWeek); w++) {
    const s = weekScore(tactics, items, w);
    if (s != null) scores.push(s);
  }
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
}

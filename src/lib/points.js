import { addDays, todayISO, weekdayIdx } from './date.js';

/** Очки за задачу: 10 мелкая, 25 средняя, 30 крупная, 40 главная задача дня */
export function taskPoints(t) {
  if (t.frog) return 40;
  if (t.duration_min <= 30) return 10;
  if (t.duration_min <= 90) return 25;
  return 30;
}

/** date -> очки за день (только сделанные задачи) */
export function pointsByDay(tasks) {
  const map = {};
  for (const t of tasks) {
    if (!t.done || !t.date) continue;
    map[t.date] = (map[t.date] || 0) + taskPoints(t);
  }
  return map;
}

/** Серия дней подряд хотя бы с одной сделанной задачей. Сегодня без очков серию не рвёт. */
export function streak(byDay, today = todayISO()) {
  let d = byDay[today] ? today : addDays(today, -1);
  let n = 0;
  while (byDay[d]) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Личные рекорды по дням недели: индекс дня недели -> { points, date } */
export function weekdayRecords(byDay) {
  const rec = {};
  for (const [date, points] of Object.entries(byDay)) {
    const wd = weekdayIdx(date);
    if (!rec[wd] || points > rec[wd].points) rec[wd] = { points, date };
  }
  return rec;
}

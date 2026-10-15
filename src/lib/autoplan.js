import { minToTime, nowMin, timeToMin, todayISO } from './date.js';

export const isDeep = (t) => !!t.deep || !!t.frog;

const round5 = (m) => Math.ceil(m / 5) * 5;

/**
 * Автоплан дня (логика Almanac):
 *  1. Главная задача и глубокая работа — в пик энергии.
 *  2. Мелочи — пачкой после пика.
 *  3. После каждого блока перерыв, обед свободен.
 *  4. Уже назначенное время и прошедшие часы не трогаем.
 * Возвращает { placements: {taskId: 'HH:MM'}, unplaced: [task] }.
 */
export function autoplan(dayTasks, settings, date) {
  const dayStart = timeToMin(settings.dayStart);
  const dayEnd = timeToMin(settings.dayEnd);
  const peakStart = timeToMin(settings.peakStart);
  const peakEnd = timeToMin(settings.peakEnd);
  const brk = settings.breakMin;

  const busy = [[timeToMin(settings.lunchStart), timeToMin(settings.lunchEnd)]];
  for (const t of dayTasks) {
    if (!t.time) continue;
    const s = timeToMin(t.time);
    busy.push([s, s + t.duration_min + brk]);
  }
  const earliest = date === todayISO() ? Math.max(dayStart, round5(nowMin() + 5)) : dayStart;

  const fits = (start, dur) => {
    if (start < earliest || start + dur > dayEnd) return false;
    return busy.every(([a, b]) => start + dur <= a || start >= b);
  };
  const findSlot = (from, dur) => {
    for (let m = Math.max(from, earliest); m + dur <= dayEnd; m += 5) {
      if (fits(m, dur)) return m;
    }
    return null;
  };

  const open = dayTasks.filter((t) => !t.done && !t.time);
  const deep = open
    .filter(isDeep)
    .sort((a, b) => Number(b.frog) - Number(a.frog) || a.priority - b.priority || b.duration_min - a.duration_min);
  const light = open
    .filter((t) => !isDeep(t))
    .sort((a, b) => a.priority - b.priority || a.duration_min - b.duration_min);

  const placements = {};
  const unplaced = [];
  const place = (t, from) => {
    const start = findSlot(from, t.duration_min) ?? findSlot(dayStart, t.duration_min);
    if (start == null) return unplaced.push(t);
    placements[t.id] = minToTime(start);
    busy.push([start, start + t.duration_min + brk]);
  };

  deep.forEach((t) => place(t, peakStart));
  light.forEach((t) => place(t, peakEnd));
  return { placements, unplaced };
}

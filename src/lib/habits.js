import { addDays, monthStart, todayISO, weekdayIdx } from './date.js';

export const habitLogId = (habitId, date) => `hl:${habitId}:${date}`;
export const isScheduled = (habit, date) => !habit.data.days?.length || habit.data.days.includes(weekdayIdx(date));

/** Серия: подряд выполненные запланированные дни. Сегодняшний невыполненный серию не рвёт. */
export function habitStreak(habit, items, today = todayISO()) {
  const done = (d) => !!items[habitLogId(habit.id, d)] && !items[habitLogId(habit.id, d)].deleted;
  let d = today;
  let n = 0;
  if (!done(d)) d = addDays(d, -1);
  for (let guard = 0; guard < 800; guard++) {
    if (isScheduled(habit, d)) {
      if (!done(d)) break;
      n++;
    }
    d = addDays(d, -1);
  }
  return n;
}

/** Процент за месяц: выполнено / запланировано до сегодня включительно */
export function habitMonthRate(habit, items, today = todayISO()) {
  let d = monthStart(today);
  let planned = 0;
  let done = 0;
  while (d <= today) {
    if (isScheduled(habit, d)) {
      planned++;
      const log = items[habitLogId(habit.id, d)];
      if (log && !log.deleted) done++;
    }
    d = addDays(d, 1);
  }
  return planned ? Math.round((done / planned) * 100) : 0;
}

export const HABIT_COLORS = ['cobalt', 'sun', 'rose', 'teal', 'violet', 'orange'];

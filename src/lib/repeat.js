import { addDays, addMonths, fromISO, weekdayIdx } from './date.js';

export const REPEAT_OPTIONS = [
  [null, 'Не повторять'],
  ['daily', 'Каждый день'],
  ['weekdays', 'По будням'],
  ['weekly', 'По дням недели'],
  ['monthly', 'Каждый месяц'],
];

/** Следующая дата повтора после date */
export function nextOccurrence(date, repeat) {
  if (!repeat?.freq) return null;
  switch (repeat.freq) {
    case 'daily':
      return addDays(date, 1);
    case 'weekdays': {
      let d = addDays(date, 1);
      while ([0, 6].includes(weekdayIdx(d))) d = addDays(d, 1);
      return d;
    }
    case 'weekly': {
      const days = repeat.days?.length ? repeat.days : [weekdayIdx(date)];
      let d = addDays(date, 1);
      for (let i = 0; i < 7; i++, d = addDays(d, 1)) if (days.includes(weekdayIdx(d))) return d;
      return addDays(date, 7);
    }
    case 'monthly': {
      const day = fromISO(date).getDate();
      const next = addMonths(date, 1); // 1-е число следующего месяца
      const last = fromISO(addDays(addMonths(next, 1), -1)).getDate();
      return `${next.slice(0, 8)}${String(Math.min(day, last)).padStart(2, '0')}`;
    }
    default:
      return null;
  }
}

export function repeatLabel(repeat) {
  if (!repeat?.freq) return null;
  if (repeat.freq === 'weekly' && repeat.days?.length) {
    const names = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    return `по ${[1, 2, 3, 4, 5, 6, 0].filter((d) => repeat.days.includes(d)).map((d) => names[d]).join(', ')}`;
  }
  return { daily: 'каждый день', weekdays: 'по будням', weekly: 'каждую неделю', monthly: 'каждый месяц' }[repeat.freq];
}

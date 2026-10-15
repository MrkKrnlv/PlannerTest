import { addDays, fromISO, todayISO, slotFromTime } from './date.js';

/**
 * Быстрый ввод: "созвон с клиентом 1.5ч в 16:00 завтра #работа !"
 * -> { title, time, duration_min, date, area, priority, slot }
 */
const WEEKDAYS = [
  [/^(вс|воскресенье)$/i, 0],
  [/^(пн|понедельник)$/i, 1],
  [/^(вт|вторник)$/i, 2],
  [/^(ср|среду|среда)$/i, 3],
  [/^(чт|четверг)$/i, 4],
  [/^(пт|пятницу|пятница)$/i, 5],
  [/^(сб|субботу|суббота)$/i, 6],
];

const RULES = [
  // приоритет: ! или !! — высокий, ~ — низкий
  { re: /(^|\s)!{1,2}(?=\s|$)/, apply: (r) => { r.priority = 1; } },
  { re: /(^|\s)~(?=\s|$)/, apply: (r) => { r.priority = 3; } },
  // сфера
  { re: /(^|\s)#([\p{L}\p{N}_-]{1,40})/u, apply: (r, m) => { r.area = m[2]; } },
  // длительность: 1.5ч, 90м, 2h, 45 мин
  {
    re: /(^|\s)(\d+(?:[.,]\d+)?)\s*(ч|час|часа|часов|h|м|мин|минут|минуты|m|min)(?=\s|$|[.,])/i,
    apply: (r, m) => {
      const n = parseFloat(m[2].replace(',', '.'));
      const hours = /^(ч|час|часа|часов|h)$/i.test(m[3]);
      r.duration_min = Math.round(hours ? n * 60 : n);
    },
  },
  // время: в 16:00, в 9, at 7.30, 18:30
  {
    re: /(^|\s)(?:(?:в|во|at|@)\s*(\d{1,2})(?:[:.](\d{2}))?|(\d{1,2}):(\d{2}))(?=\s|$)/i,
    apply: (r, m) => {
      const h = Number(m[2] ?? m[4]);
      const min = Number(m[3] ?? m[5] ?? 0);
      if (h < 24 && min < 60) r.time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      else return false;
    },
  },
  // дата
  { re: /(^|\s)(сегодня|today)(?=\s|$)/i, apply: (r) => { r.date = todayISO(); } },
  { re: /(^|\s)(послезавтра)(?=\s|$)/i, apply: (r) => { r.date = addDays(todayISO(), 2); } },
  { re: /(^|\s)(завтра|tomorrow)(?=\s|$)/i, apply: (r) => { r.date = addDays(todayISO(), 1); } },
  {
    re: /(^|\s)(?:в|во)?\s*(пн|вт|ср|чт|пт|сб|вс|понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)(?=\s|$)/i,
    apply: (r, m) => {
      const target = WEEKDAYS.find(([re]) => re.test(m[2]))[1];
      const today = todayISO();
      const diff = (target - fromISO(today).getDay() + 7) % 7;
      r.date = addDays(today, diff);
    },
  },
  // часть дня
  { re: /(^|\s)(утром)(?=\s|$)/i, apply: (r) => { r.slot = 'morning'; } },
  { re: /(^|\s)(днём|днем)(?=\s|$)/i, apply: (r) => { r.slot = 'afternoon'; } },
  { re: /(^|\s)(вечером)(?=\s|$)/i, apply: (r) => { r.slot = 'evening'; } },
];

export function parseQuickAdd(input) {
  let text = ` ${input.trim()} `;
  const result = {};
  for (const rule of RULES) {
    const m = text.match(rule.re);
    if (!m) continue;
    if (rule.apply(result, m) === false) continue;
    text = text.replace(m[0], m[1] || ' ');
  }
  result.title = text.replace(/\s+/g, ' ').trim();
  if (result.time && !result.slot) result.slot = slotFromTime(result.time);
  return result;
}

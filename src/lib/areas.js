import { diffDays, todayISO, weekDays } from './date.js';

// id детерминированные: если сферы создаются на двух устройствах сразу, они сольются, а не задвоятся
export const DEFAULT_AREAS = [
  { id: 'area-work', name: 'работа', color: 'cobalt', goal: 'Клиенты и проекты', weeklyMin: 1200 },
  { id: 'area-study', name: 'учёба', color: 'violet', goal: 'Курсы и книги', weeklyMin: 300 },
  { id: 'area-health', name: 'здоровье', color: 'teal', goal: 'Тренировки и сон', weeklyMin: 360 },
  { id: 'area-people', name: 'люди', color: 'rose', goal: 'Семья и друзья', weeklyMin: 240 },
  { id: 'area-home', name: 'дом', color: 'orange', goal: 'Быт без завалов', weeklyMin: 120 },
  { id: 'area-create', name: 'творчество', color: 'sun', goal: 'Свои проекты', weeklyMin: 300 },
];

export const AREA_COLORS = ['cobalt', 'violet', 'teal', 'rose', 'orange', 'sun'];

export const sameArea = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export const areaColor = (areas, name) => areas.find((a) => sameArea(a.data.name, name))?.data.color || null;

/** Прогресс сферы за неделю и давность последней активности */
export function areaStats(area, tasks, today = todayISO()) {
  const days = new Set(weekDays(today));
  const mine = tasks.filter((t) => sameArea(t.area, area.data.name));
  const weekDone = mine.filter((t) => t.done && days.has(t.date)).reduce((s, t) => s + t.duration_min, 0);
  const weekPlanned = mine.filter((t) => days.has(t.date)).reduce((s, t) => s + t.duration_min, 0);
  const lastDate = mine
    .filter((t) => t.done && t.date && t.date <= today)
    .map((t) => t.date)
    .sort()
    .pop();
  return {
    weekDone,
    weekPlanned,
    lastDate: lastDate || null,
    idleDays: lastDate ? diffDays(today, lastDate) : null,
  };
}

/** «Тихие» подсказки: сферы, которые давно забыты */
export function quietHints(areas, tasks, today = todayISO()) {
  return areas
    .map((a) => ({ area: a, ...areaStats(a, tasks, today) }))
    .filter((s) => s.idleDays == null || s.idleDays >= 7)
    .slice(0, 3);
}

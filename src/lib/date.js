const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayISO = () => toISO(new Date());
export const addDays = (iso, n) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Понедельник недели, в которую входит дата */
export const weekStart = (iso) => {
  const d = fromISO(iso);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return toISO(d);
};
export const weekDays = (iso) => {
  const start = weekStart(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

const WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WD_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export const weekdayShort = (iso) => WD_SHORT[fromISO(iso).getDay()];
export const weekdayLong = (iso) => WD_LONG[fromISO(iso).getDay()];
export const dayMonth = (iso) => {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
};

export function weekRange(fromIso, toIso) {
  const a = fromISO(fromIso);
  const b = fromISO(toIso);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`;
  return `${dayMonth(fromIso)} – ${dayMonth(toIso)}`;
}

export function relativeLabel(iso) {
  const today = todayISO();
  if (iso === today) return 'Сегодня';
  if (iso === addDays(today, 1)) return 'Завтра';
  if (iso === addDays(today, -1)) return 'Вчера';
  return null;
}

export const timeToMin = (t) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);
export const minToTime = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

export function formatDuration(min) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} мин`;
  if (!m) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

export function slotFromTime(time) {
  if (!time) return 'anytime';
  const h = Number(time.slice(0, 2));
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

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
export const diffDays = (a, b) => Math.round((fromISO(a) - fromISO(b)) / 86_400_000);

/** Понедельник недели, в которую входит дата */
export const weekStart = (iso) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
};
export const weekDays = (iso) => {
  const start = weekStart(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
export const addMonths = (iso, n) => {
  const d = fromISO(monthStart(iso));
  d.setMonth(d.getMonth() + n);
  return toISO(d);
};
/** Сетка месяца: недели с понедельника, 5–6 строк */
export const monthGrid = (iso) => {
  const first = monthStart(iso);
  const start = weekStart(first);
  const month = first.slice(0, 7);
  const weeks = [];
  let d = start;
  do {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
    d = addDays(d, 7);
  } while (d.slice(0, 7) === month);
  return weeks;
};

const WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WD_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WD_ACC = ['воскресеньям', 'понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export const WEEKDAYS_MON = [1, 2, 3, 4, 5, 6, 0];
export const weekdayIdx = (iso) => fromISO(iso).getDay();
export const weekdayShort = (iso) => WD_SHORT[weekdayIdx(iso)];
export const weekdayShortByIdx = (i) => WD_SHORT[i];
export const weekdayLong = (iso) => WD_LONG[weekdayIdx(iso)];
export const weekdayPlural = (i) => WD_ACC[i];
export const dayMonth = (iso) => {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
};
export const monthTitle = (iso) => {
  const d = fromISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
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
export const nowMin = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

export function formatDuration(min) {
  if (!min) return '0 мин';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} мин`;
  if (!m) return `${h} ч`;
  return `${h} ч ${m} мин`;
}
export const formatShort = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? (m ? `${h}ч ${m}м` : `${h}ч`) : `${m}м`;
};

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export function slotFromTime(time) {
  if (!time) return 'anytime';
  const h = Number(time.slice(0, 2));
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

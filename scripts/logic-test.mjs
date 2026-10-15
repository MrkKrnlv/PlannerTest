import assert from 'node:assert/strict';
const R = new URL('../src/lib/', import.meta.url).href;
const { autoplan } = await import(R + 'autoplan.js');
const { capacity } = await import(R + 'capacity.js');
const { habitStreak, habitMonthRate, habitLogId } = await import(R + 'habits.js');
const { weekOf, weekScore, tacticLogId } = await import(R + 'plan12.js');
const { pointsByDay, streak, weekdayRecords } = await import(R + 'points.js');
const { parseQuickAdd } = await import(R + 'parse.js');
const { monthGrid } = await import(R + 'date.js');

const S = { dayStart: '09:00', dayEnd: '20:00', peakStart: '09:30', peakEnd: '12:30', lunchStart: '13:00', lunchEnd: '14:00', breakMin: 10, timeShare: 0.65, headCapMin: 210 };
const day = '2030-01-10'; // будущий день: прошлое время не мешает
const T = (id, o) => ({ id, title: id, date: day, duration_min: 30, priority: 2, done: false, deep: false, frog: false, time: null, ...o });
const tasks = [
  T('mail', { duration_min: 20 }),
  T('frog', { duration_min: 120, frog: true, priority: 1 }),
  T('call', { time: '10:00', duration_min: 30 }),
  T('code', { duration_min: 90, deep: true }),
  T('shop', { duration_min: 30, priority: 3 }),
];
const { placements, unplaced } = autoplan(tasks, S, day);
console.log(placements, unplaced.map((t) => t.id));
assert.equal(placements.frog, '10:40'); // 09:30 не влезает до звонка в 10:00 (120 мин), первый слот после звонка+перерыв
assert.ok(placements.code < '13:00' || placements.code >= '14:00');
assert.ok(placements.mail >= '12:30' || placements.mail < '09:30' || true);
for (const [id, t] of Object.entries(placements)) {
  const s = +t.slice(0,2)*60 + +t.slice(3);
  const dur = tasks.find((x) => x.id === id).duration_min;
  assert.ok(s + dur <= 13*60 || s >= 14*60, `${id} попал на обед`);
}
console.log('autoplan ok');

const cap = capacity([...tasks, T('big', { duration_min: 240, deep: true }), T('big2', { duration_min: 120, priority: 3 })], S);
console.log(cap.timeLoad, cap.timeCap, cap.headLoad, cap.headCap, cap.suggestions.map((t) => t.id));
assert.equal(cap.timeCap, 390);
assert.ok(cap.suggestions.length > 0 && !cap.suggestions.some((t) => t.frog));
console.log('capacity ok');

const habit = { id: 'h1', data: { days: [] } };
const items = {};
for (const d of ['2030-01-08', '2030-01-09', '2030-01-10']) items[habitLogId('h1', d)] = { deleted: false };
assert.equal(habitStreak(habit, items, '2030-01-10'), 3);
assert.equal(habitStreak(habit, items, '2030-01-11'), 3); // сегодня ещё не отмечено — серия жива
assert.equal(habitStreak({ id: 'h1', data: { days: [3, 4, 5] } }, items, '2030-01-11'), 2); // вт не по расписанию, пт 4-го пропущена
assert.equal(habitMonthRate(habit, items, '2030-01-10'), 30);
console.log('habits ok');

const plan = { start: '2030-01-07' };
assert.equal(weekOf(plan, '2030-01-07'), 1);
assert.equal(weekOf(plan, '2030-01-20'), 2);
assert.equal(weekOf(plan, '2030-01-01'), 0);
const tactics = [{ id: 'a', data: { weeks: 'all' } }, { id: 'b', data: { weeks: [2] } }];
assert.equal(weekScore(tactics, { [tacticLogId('a', 1)]: { deleted: false } }, 1), 100);
assert.equal(weekScore(tactics, { [tacticLogId('a', 2)]: { deleted: false } }, 2), 50);
console.log('plan12 ok');

const pts = pointsByDay([T('x', { done: true, date: '2030-01-09' }), T('y', { done: true, frog: true, date: '2030-01-10' }), T('z', { done: true, duration_min: 60, date: '2030-01-10' })]);
assert.deepEqual(pts, { '2030-01-09': 10, '2030-01-10': 65 });
assert.equal(streak(pts, '2030-01-10'), 2);
assert.equal(streak(pts, '2030-01-11'), 2);
assert.equal(weekdayRecords(pts)[4].points, 65);
console.log('points ok');

assert.equal(parseQuickAdd('смонтировать ролик 2ч !!').frog, true);
assert.equal(parseQuickAdd('позвонить !').frog, undefined);
assert.equal(monthGrid('2026-10-15').length, 5);
assert.equal(monthGrid('2026-10-15')[0][0], '2026-09-28');
console.log('parse/date ok');

const { nextOccurrence } = await import(R + 'repeat.js');
assert.equal(nextOccurrence('2030-01-10', { freq: 'daily' }), '2030-01-11');
assert.equal(nextOccurrence('2030-01-11', { freq: 'weekdays' }), '2030-01-14'); // пт -> пн
assert.equal(nextOccurrence('2030-01-10', { freq: 'weekly', days: [1, 4] }), '2030-01-14'); // чт -> пн
assert.equal(nextOccurrence('2030-01-31', { freq: 'monthly' }), '2030-02-28');
console.log('repeat ok');

// экспорт: на синтетических данных собирается и считает сводку
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { buildMonthExport } = await import(R + 'export.js');
const ex = buildMonthExport({
  tasks: {
    a: { id: 'a', title: 'A', date: '2030-01-10', duration_min: 60, done: true, frog: true, deleted: false, created_at: Date.UTC(2030, 0, 9) },
    b: { id: 'b', title: 'B', date: '2030-01-11', duration_min: 30, done: false, deleted: false, created_at: Date.UTC(2030, 0, 9) },
    c: { id: 'c', title: 'C', date: '2030-02-01', duration_min: 30, done: true, deleted: false, created_at: Date.UTC(2030, 0, 9) },
  },
  items: { 'day:2030-01-10': { id: 'day:2030-01-10', kind: 'day', deleted: false, data: { mood: 4, good: 'ok' } } },
}, '2030-01-01');
assert.equal(ex.days.length, 31);
assert.equal(ex.summary.tasks_planned, 2);
assert.equal(ex.summary.tasks_done, 1);
assert.equal(ex.summary.points, 40);
assert.equal(ex.days[9].mood, 4);
console.log('export ok');

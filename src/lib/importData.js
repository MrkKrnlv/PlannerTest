import { useStore, liveItems, liveTasks, uuid } from '../store.js';
import { DEFAULT_AREAS } from './areas.js';
import { HABIT_COLORS } from './habits.js';

/**
 * Импорт набора данных одним JSON:
 * {
 *   "areas": "default",                       // или массив { name, color, goal, weeklyMin }
 *   "habits": [{ "name", "days"?, "remind"?, "color"? }],
 *   "tasks": [{ "title", "date"?, "time"?, "duration_min"?, "area"?, "priority"?, "deep"?, "frog"?,
 *               "repeat"?: { "freq", "days"? }, "checklist"?: ["шаг", ...] }],
 *   "settings": { "dayStart": "09:00", ... }
 * }
 * Повторный импорт того же файла ничего не задвоит: совпадения по названию пропускаются.
 */
export function importData(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || typeof data !== 'object') throw new Error('Ожидался JSON-объект');
  const s = useStore.getState();
  const res = { areas: 0, habits: 0, habitsUpdated: 0, tasks: 0, skipped: 0 };
  const norm = (x) => String(x || '').trim().toLowerCase();

  // сферы
  const existingAreas = liveItems(s.items, 'area');
  if (data.areas === 'default') {
    DEFAULT_AREAS.forEach(({ id, ...a }, i) => {
      if (existingAreas.some((e) => norm(e.data.name) === a.name)) return;
      s.putItem(id, 'area', { ...a, order: i });
      res.areas++;
    });
  } else if (Array.isArray(data.areas)) {
    data.areas.forEach((a, i) => {
      if (!a?.name || existingAreas.some((e) => norm(e.data.name) === norm(a.name))) return;
      s.putItem(`area-${uuid()}`, 'area', { name: norm(a.name), color: a.color || 'cobalt', goal: a.goal || '', weeklyMin: a.weeklyMin || 0, order: 100 + i });
      res.areas++;
    });
  }

  // привычки: совпадение по имени обновляет расписание и напоминание
  const habits = liveItems(s.items, 'habit');
  (data.habits || []).forEach((h, i) => {
    if (!h?.name) return;
    const same = habits.find((x) => norm(x.data.name) === norm(h.name));
    const patch = {
      ...(h.days ? { days: h.days } : {}),
      ...(h.remind !== undefined ? { remind: h.remind } : {}),
      ...(h.color ? { color: h.color } : {}),
    };
    if (same) {
      s.patchItem(same.id, 'habit', patch);
      res.habitsUpdated++;
    } else {
      s.putItem(`habit-${uuid()}`, 'habit', {
        name: h.name.trim(),
        days: h.days || [],
        remind: h.remind || null,
        color: h.color || HABIT_COLORS[i % HABIT_COLORS.length],
        order: Date.now() + i,
      });
      res.habits++;
    }
  });

  // задачи
  const tasks = liveTasks(s.tasks);
  (data.tasks || []).forEach((t) => {
    if (!t?.title) return;
    const dup = tasks.some(
      (x) => norm(x.title) === norm(t.title) && (t.repeat ? x.repeat?.freq === t.repeat.freq : x.date === (t.date ?? null) && (x.time || null) === (t.time || null))
    );
    if (dup) {
      res.skipped++;
      return;
    }
    s.addTask({
      title: t.title,
      date: t.date ?? null,
      time: t.time || null,
      duration_min: t.duration_min || 30,
      area: t.area || null,
      priority: t.priority || 2,
      deep: t.deep,
      frog: !!t.frog,
      note: t.note || null,
      repeat: t.repeat || null,
      checklist: Array.isArray(t.checklist) ? t.checklist.map((text) => ({ id: uuid().slice(0, 8), text, done: false })) : null,
    });
    res.tasks++;
  });

  if (data.settings && typeof data.settings === 'object') s.patchItem('settings', 'settings', data.settings);
  return res;
}

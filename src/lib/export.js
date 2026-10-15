import { liveItems, liveTasks, settingsOf } from '../store.js';
import { addDays, addMonths, monthStart, monthTitle, weekdayLong, diffDays } from './date.js';
import { habitLogId, isScheduled } from './habits.js';
import { pointsByDay, taskPoints } from './points.js';
import { sameArea } from './areas.js';
import { weekOf, weekScore } from './plan12.js';

/**
 * Экспорт месяца в один JSON для анализа в Claude:
 * задачи, привычки, итоги дней, сферы, цикл 12 недель и сводка цифр.
 */
export function buildMonthExport(state, month /* YYYY-MM-01 */) {
  const first = monthStart(month);
  const last = addDays(addMonths(first, 1), -1);
  const inMonth = (d) => d && d >= first && d <= last;
  const tasks = liveTasks(state.tasks);
  const items = state.items;
  const monthTasks = tasks.filter((t) => inMonth(t.date));
  const days = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);

  const areas = liveItems(items, 'area');
  const habits = liveItems(items, 'habit');
  const pts = pointsByDay(tasks);

  const export_ = {
    format: 'planner-month-export/v1',
    month: first.slice(0, 7),
    title: monthTitle(first),
    exported_at: new Date().toISOString(),
    settings: settingsOf(items),

    summary: {
      tasks_planned: monthTasks.length,
      tasks_done: monthTasks.filter((t) => t.done).length,
      minutes_planned: monthTasks.reduce((s, t) => s + t.duration_min, 0),
      minutes_done: monthTasks.filter((t) => t.done).reduce((s, t) => s + t.duration_min, 0),
      deep_minutes_done: monthTasks.filter((t) => t.done && (t.deep || t.frog)).reduce((s, t) => s + t.duration_min, 0),
      frogs_done: monthTasks.filter((t) => t.frog && t.done).length,
      frogs_planned: monthTasks.filter((t) => t.frog).length,
      points: days.reduce((s, d) => s + (pts[d] || 0), 0),
      voice_tasks: monthTasks.filter((t) => t.source === 'voice').length,
      still_open_past: monthTasks.filter((t) => !t.done && t.date < new Date().toISOString().slice(0, 10)).length,
    },

    days: days.map((d) => {
      const dayTasks = monthTasks.filter((t) => t.date === d);
      const j = items[`day:${d}`];
      const data = j && !j.deleted ? j.data : {};
      return {
        date: d,
        weekday: weekdayLong(d),
        points: pts[d] || 0,
        mood: data.mood ?? null,
        energy: data.energy ?? null,
        good: data.good || null,
        note: data.note || null,
        tasks: dayTasks.map((t) => ({
          title: t.title,
          done: t.done,
          time: t.time,
          duration_min: t.duration_min,
          area: t.area,
          priority: t.priority,
          deep: !!t.deep,
          frog: !!t.frog,
          repeat: t.repeat?.freq || null,
          source: t.source,
          points: t.done ? taskPoints(t) : 0,
          created_days_before: Math.max(0, diffDays(t.date, new Date(t.created_at).toISOString().slice(0, 10))),
        })),
        habits: habits
          .filter((h) => isScheduled(h, d))
          .map((h) => ({ name: h.data.name, done: !!items[habitLogId(h.id, d)] && !items[habitLogId(h.id, d)].deleted })),
      };
    }),

    habits: habits.map((h) => {
      const scheduled = days.filter((d) => isScheduled(h, d));
      const done = scheduled.filter((d) => items[habitLogId(h.id, d)] && !items[habitLogId(h.id, d)].deleted);
      return { name: h.data.name, days: h.data.days?.length ? h.data.days : 'every day', scheduled: scheduled.length, done: done.length };
    }),

    areas: areas.map((a) => {
      const mine = monthTasks.filter((t) => sameArea(t.area, a.data.name));
      return {
        name: a.data.name,
        goal: a.data.goal || null,
        weekly_target_min: a.data.weeklyMin || 0,
        minutes_done: mine.filter((t) => t.done).reduce((s, t) => s + t.duration_min, 0),
        tasks_done: mine.filter((t) => t.done).length,
        tasks_planned: mine.length,
      };
    }),

    inbox_open: tasks.filter((t) => !t.date && !t.done).map((t) => t.title),
  };

  const planItem = items.plan && !items.plan.deleted ? items.plan.data : null;
  if (planItem) {
    const goals = liveItems(items, 'goal');
    const tactics = liveItems(items, 'tactic');
    const week = weekOf(planItem);
    export_.twelve_week = {
      start: planItem.start,
      target: planItem.target,
      current_week: week,
      goals: goals.map((g) => ({
        title: g.data.title,
        tactics: tactics.filter((t) => t.data.goal === g.id).map((t) => t.data.title),
      })),
      weekly_scores: Array.from({ length: Math.min(12, Math.max(0, week)) }, (_, i) => ({ week: i + 1, score: weekScore(tactics, items, i + 1) })),
    };
  }
  return export_;
}

export const CLAUDE_PROMPT = `Ниже экспорт моего планера за месяц в JSON: задачи по дням (сделано или нет, длительность, сфера, глубокая работа, главная задача дня), привычки, настроение и энергия, заметки, сферы жизни и цикл 12 недель.

Проанализируй месяц:
1. Что получалось: дни и паттерны с лучшими результатами.
2. Где я переоцениваю себя: сколько планирую против сделанного, какие задачи кочуют и не делаются.
3. Связь настроения и энергии с нагрузкой и привычками.
4. Баланс сфер: что проседает относительно целей.
5. Три конкретных изменения на следующий месяц.

Пиши прямо, без воды, с цифрами из данных.`;

export function exportText(data) {
  return `${CLAUDE_PROMPT}\n\n\`\`\`json\n${JSON.stringify(data, null, 1)}\n\`\`\``;
}

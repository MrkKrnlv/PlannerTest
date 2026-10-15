import { timeToMin } from './date.js';
import { isDeep } from './autoplan.js';

/**
 * Две шкалы нагрузки, как в Almanac:
 *  - Время: занято из доли рабочего дня (timeShare). Открытые задачи идут с запасом ×1.5,
 *    потому что всё всегда занимает дольше, чем кажется.
 *  - Голова: минуты глубокой работы против headCapMin.
 */
export function capacity(dayTasks, settings) {
  const workMin =
    timeToMin(settings.dayEnd) - timeToMin(settings.dayStart) - (timeToMin(settings.lunchEnd) - timeToMin(settings.lunchStart));
  const timeCap = Math.round((workMin * settings.timeShare) / 5) * 5;
  const timeLoad = Math.round(
    dayTasks.reduce((s, t) => s + (t.done ? t.duration_min : t.duration_min * 1.5), 0)
  );
  const headLoad = dayTasks.filter(isDeep).reduce((s, t) => s + t.duration_min, 0);
  const headCap = settings.headCapMin;

  // что перенести, чтобы влезть: сначала неважное и не главное, большое вперёд
  const suggestions = [];
  let overTime = timeLoad - timeCap;
  let overHead = headLoad - headCap;
  if (overTime > 0 || overHead > 0) {
    const candidates = dayTasks
      .filter((t) => !t.done && !t.frog && !t.time)
      .sort((a, b) => b.priority - a.priority || b.duration_min - a.duration_min);
    for (const t of candidates) {
      if (overTime <= 0 && overHead <= 0) break;
      const helpsTime = overTime > 0;
      const helpsHead = overHead > 0 && isDeep(t);
      if (!helpsTime && !helpsHead) continue;
      suggestions.push(t);
      overTime -= t.duration_min * 1.5;
      if (isDeep(t)) overHead -= t.duration_min;
    }
  }

  return { timeLoad, timeCap, headLoad, headCap, suggestions };
}

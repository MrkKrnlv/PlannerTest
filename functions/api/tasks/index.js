import { json, readJson, HttpError } from '../../../server/http.js';
import { normalizeTask, upsertStatement, toClient } from '../../../server/tasks.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE = 500;

/**
 * GET /api/tasks?since=<rev>          — дельта для синка (включая удалённые)
 * GET /api/tasks?from=YYYY-MM-DD&to=… — живые задачи за период (для n8n-агента)
 */
export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const userId = data.user.id;
  const from = url.searchParams.get('from');

  if (from) {
    const to = url.searchParams.get('to') || from;
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new HttpError(400, 'from/to must be YYYY-MM-DD');
    const { results } = await env.DB.prepare(
      `SELECT * FROM tasks WHERE user_id = ? AND deleted = 0 AND date BETWEEN ? AND ?
       ORDER BY date, COALESCE(time, '99:99'), priority`
    ).bind(userId, from, to).all();
    return json({
      tasks: results.map((r) => ({
        id: r.id, title: r.title, date: r.date, time: r.time, slot: r.slot,
        duration_min: r.duration_min, area: r.area, priority: r.priority, done: !!r.done,
      })),
    });
  }

  const since = Math.max(0, Number(url.searchParams.get('since')) || 0);
  const { results } = await env.DB.prepare(
    'SELECT * FROM tasks WHERE user_id = ? AND rev > ? ORDER BY rev LIMIT ?'
  ).bind(userId, since, PAGE + 1).all();

  const more = results.length > PAGE;
  const page = more ? results.slice(0, PAGE) : results;
  return json({
    tasks: page.map(toClient),
    rev: page.length ? page[page.length - 1].rev : since,
    more,
  });
}

/**
 * POST /api/tasks  { tasks: [...], source?: 'voice' | 'api' }
 * Пакетное создание — сюда пишет n8n. id и время ставит сервер.
 */
export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const list = Array.isArray(body?.tasks) ? body.tasks : null;
  if (!list?.length) throw new HttpError(400, 'tasks[] is required');
  if (list.length > 50) throw new HttpError(400, 'max 50 tasks per request');

  const source = body.source === 'voice' ? 'voice' : 'api';
  const now = Date.now();
  const created = list.map((raw) => ({
    ...normalizeTask({ ...raw, source, done: false, deleted: false }, { requireId: false }),
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
  }));

  await env.DB.batch(created.map((t) => upsertStatement(env.DB, data.user.id, t)));
  return json({ created: created.map(({ id, title, date, time, slot, duration_min, area, priority }) =>
    ({ id, title, date, time, slot, duration_min, area, priority })) }, 201);
}

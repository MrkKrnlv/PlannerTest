import { json, readJson, HttpError } from '../http.js';
import { normalizeTask, upsertStatement } from '../tasks.js';

/**
 * POST /api/tasks/sync  { changes: [task, ...] }
 * Клиент отправляет изменённые задачи целиком. Сервер принимает правку, только если
 * её updated_at новее сохранённой (last-write-wins по строке). Потом клиент делает pull.
 */
export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const changes = Array.isArray(body?.changes) ? body.changes : null;
  if (!changes) throw new HttpError(400, 'changes[] is required');
  if (changes.length > 500) throw new HttpError(400, 'max 500 changes per request');
  if (!changes.length) return json({ ok: true, accepted: 0 });

  const tasks = changes.map((c) => normalizeTask(c));
  await env.DB.batch(tasks.map((t) => upsertStatement(env.DB, data.user.id, t)));
  return json({ ok: true, accepted: tasks.length });
}

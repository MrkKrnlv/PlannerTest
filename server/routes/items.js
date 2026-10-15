import { json, readJson, HttpError } from '../http.js';
import { normalizeItem, upsertItem, itemToClient } from '../items.js';

const PAGE = 500;

// GET /api/items?since=<rev> — дельта документов
export async function onRequestGet({ request, env, data }) {
  const since = Math.max(0, Number(new URL(request.url).searchParams.get('since')) || 0);
  const { results } = await env.DB.prepare('SELECT * FROM items WHERE user_id = ? AND rev > ? ORDER BY rev LIMIT ?')
    .bind(data.user.id, since, PAGE + 1)
    .all();
  const more = results.length > PAGE;
  const page = more ? results.slice(0, PAGE) : results;
  return json({ items: page.map(itemToClient), rev: page.length ? page[page.length - 1].rev : since, more });
}

// POST /api/items/sync { changes: [item] }
export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const changes = Array.isArray(body?.changes) ? body.changes : null;
  if (!changes) throw new HttpError(400, 'changes[] is required');
  if (changes.length > 500) throw new HttpError(400, 'max 500 changes per request');
  if (!changes.length) return json({ ok: true, accepted: 0 });
  const items = changes.map(normalizeItem);
  await env.DB.batch(items.map((it) => upsertItem(env.DB, data.user.id, it)));
  return json({ ok: true, accepted: items.length });
}

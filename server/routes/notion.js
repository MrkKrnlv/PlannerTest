import { json, readJson } from '../http.js';
import { connect, disconnect, syncUser } from '../notion.js';

const fresh = (env, id) => env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();

export async function getStatus({ env, data }) {
  const u = await fresh(env, data.user.id);
  if (!u.notion_db) return json({ connected: false });
  const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM tasks WHERE user_id = ? AND rev > ?').bind(u.id, u.notion_rev || 0).first();
  return json({
    connected: true,
    databaseUrl: `https://www.notion.so/${u.notion_db.replace(/-/g, '')}`,
    syncedAt: u.notion_synced_at,
    error: u.notion_error,
    pending: left?.n || 0,
  });
}

export async function postConnect({ request, env, data }) {
  const { token, page } = await readJson(request, 8 * 1024);
  const dbId = await connect(env, data.user, String(token || '').trim(), page);
  const u = await fresh(env, data.user.id);
  const res = await syncUser(env, u);
  return json({ ok: true, databaseUrl: `https://www.notion.so/${dbId.replace(/-/g, '')}`, ...res });
}

export async function postSync({ env, data }) {
  const u = await fresh(env, data.user.id);
  if (!u.notion_db) return json({ error: 'Notion не подключён' }, 400);
  return json({ ok: true, ...(await syncUser(env, u)) });
}

export async function postDisconnect({ env, data }) {
  await disconnect(env, data.user);
  return json({ ok: true });
}

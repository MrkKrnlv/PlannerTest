// Односторонний синк: задачи планера -> база данных Notion (её показывает Notion Calendar).
// Курсор синка — серверная ревизия задач (users.notion_rev), как у клиентов.
import { HttpError } from './http.js';

const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';
const PER_RUN = 35; // на бесплатном тарифе Worker делает до 50 внешних запросов за вызов
const OFFSET = '+03:00'; // Europe/Moscow без перехода на летнее время

async function notion(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'notion-version': VERSION, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Notion HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** id страницы из ссылки вида notion.so/Planner-1a2b...32 или из голого id */
export function parsePageId(input) {
  const hex = String(input || '').replace(/-/g, '').match(/[0-9a-f]{32}(?![0-9a-f])/gi);
  if (!hex) return null;
  const h = hex[hex.length - 1].toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function createDatabase(token, pageId) {
  const db = await notion(token, 'POST', '/databases', {
    parent: { type: 'page_id', page_id: pageId },
    title: [{ type: 'text', text: { content: 'Планер' } }],
    properties: {
      Задача: { title: {} },
      Когда: { date: {} },
      Готово: { checkbox: {} },
      Сфера: { select: {} },
      Минут: { number: { format: 'number' } },
      Главное: { checkbox: {} },
    },
  });
  return db.id;
}

const pad = (n) => String(n).padStart(2, '0');
function endTime(date, time, minutes) {
  const total = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + minutes;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMinutes(total);
  return `${d.toISOString().slice(0, 10)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00${OFFSET}`;
}

export function taskProperties(t) {
  return {
    Задача: { title: [{ type: 'text', text: { content: t.title.slice(0, 2000) } }] },
    Когда: {
      date: t.time
        ? { start: `${t.date}T${t.time}:00${OFFSET}`, end: endTime(t.date, t.time, t.duration_min) }
        : { start: t.date },
    },
    Готово: { checkbox: !!t.done },
    Сфера: { select: t.area ? { name: t.area.slice(0, 100).replace(/,/g, ' ') } : null },
    Минут: { number: t.duration_min },
    Главное: { checkbox: !!t.frog },
  };
}

/** Прогнать порцию изменений одного пользователя */
export async function syncUser(env, user) {
  const db = env.DB;
  const token = user.notion_token;
  const { results } = await db
    .prepare('SELECT * FROM tasks WHERE user_id = ? AND rev > ? ORDER BY rev LIMIT ?')
    .bind(user.id, user.notion_rev || 0, PER_RUN)
    .all();
  let lastRev = user.notion_rev || 0;
  let done = 0;

  try {
    for (const t of results) {
      const map = await db.prepare('SELECT page_id FROM notion_pages WHERE user_id = ? AND task_id = ?').bind(user.id, t.id).first();
      const gone = t.deleted || !t.date;
      if (gone) {
        if (map) {
          await notion(token, 'PATCH', `/pages/${map.page_id}`, { archived: true }).catch((e) => {
            if (e.status !== 404) throw e;
          });
          await db.prepare('DELETE FROM notion_pages WHERE user_id = ? AND task_id = ?').bind(user.id, t.id).run();
        }
      } else if (map) {
        try {
          await notion(token, 'PATCH', `/pages/${map.page_id}`, { archived: false, properties: taskProperties(t) });
        } catch (e) {
          if (e.status !== 404) throw e;
          // страницу удалили в Notion руками — создаём заново
          const page = await notion(token, 'POST', '/pages', { parent: { database_id: user.notion_db }, properties: taskProperties(t) });
          await db.prepare('UPDATE notion_pages SET page_id = ? WHERE user_id = ? AND task_id = ?').bind(page.id, user.id, t.id).run();
        }
      } else {
        const page = await notion(token, 'POST', '/pages', { parent: { database_id: user.notion_db }, properties: taskProperties(t) });
        await db.prepare('INSERT OR REPLACE INTO notion_pages (user_id, task_id, page_id) VALUES (?, ?, ?)').bind(user.id, t.id, page.id).run();
      }
      lastRev = t.rev;
      done++;
    }
    await db.prepare('UPDATE users SET notion_rev = ?, notion_synced_at = ?, notion_error = NULL WHERE id = ?').bind(lastRev, Date.now(), user.id).run();
  } catch (err) {
    await db
      .prepare('UPDATE users SET notion_rev = ?, notion_error = ? WHERE id = ?')
      .bind(lastRev, String(err.message || err).slice(0, 300), user.id)
      .run();
    if (err.status === 401 || err.status === 403) throw new HttpError(400, `Notion не пустил: ${err.message}`);
    throw err;
  }
  const left = await db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE user_id = ? AND rev > ?').bind(user.id, lastRev).first();
  return { synced: done, pending: left?.n || 0 };
}

export async function syncAll(env) {
  const { results } = await env.DB.prepare('SELECT * FROM users WHERE notion_token IS NOT NULL AND notion_db IS NOT NULL').all();
  for (const u of results) {
    try {
      await syncUser(env, u);
    } catch (err) {
      console.error('notion sync', u.id, err.message);
    }
  }
}

export async function connect(env, user, token, page) {
  if (!/^(secret_|ntn_)[A-Za-z0-9]{20,}$/.test(token || '')) throw new HttpError(400, 'Похоже, это не токен интеграции Notion (начинается с ntn_ или secret_)');
  const pageId = parsePageId(page);
  if (!pageId) throw new HttpError(400, 'Не нашёл id страницы в ссылке');
  let dbId;
  try {
    dbId = await createDatabase(token, pageId);
  } catch (err) {
    if (err.status === 404) throw new HttpError(400, 'Notion не видит страницу. Открой её, ••• → Connections → добавь свою интеграцию');
    if (err.status === 401) throw new HttpError(400, 'Notion не принял токен интеграции');
    throw new HttpError(400, `Notion: ${err.message}`);
  }
  await env.DB.prepare('DELETE FROM notion_pages WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare('UPDATE users SET notion_token = ?, notion_db = ?, notion_rev = 0, notion_synced_at = NULL, notion_error = NULL WHERE id = ?')
    .bind(token, dbId, user.id)
    .run();
  return dbId;
}

export async function disconnect(env, user) {
  await env.DB.prepare('DELETE FROM notion_pages WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare('UPDATE users SET notion_token = NULL, notion_db = NULL, notion_rev = 0, notion_synced_at = NULL, notion_error = NULL WHERE id = ?')
    .bind(user.id)
    .run();
}

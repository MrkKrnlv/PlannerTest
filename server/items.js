import { HttpError } from './http.js';

export const KINDS = new Set([
  'habit', // привычка
  'habit_log', // отметка привычки за день: id = hl:<habit>:<date>
  'day', // заметка и итог дня: id = day:<date>
  'area', // сфера жизни
  'plan', // цикл 12 недель: id = plan
  'goal', // цель цикла
  'tactic', // шаг к цели (еженедельный)
  'tactic_log', // отметка шага за неделю: id = tl:<tactic>:<week>
  'settings', // настройки дня: id = settings
]);

const ID_RE = /^[A-Za-z0-9_:.-]{1,120}$/;
const MAX_DATA = 16 * 1024;
const clampTs = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n < 8.64e15 ? n : Date.now();
};

export function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'item must be an object');
  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) throw new HttpError(400, 'item.id is invalid');
  if (!KINDS.has(raw.kind)) throw new HttpError(400, `item.kind is invalid: ${raw.kind}`);
  const data = JSON.stringify(raw.data && typeof raw.data === 'object' ? raw.data : {});
  if (data.length > MAX_DATA) throw new HttpError(413, 'item.data too large');
  return {
    id: raw.id,
    kind: raw.kind,
    data,
    deleted: raw.deleted ? 1 : 0,
    created_at: clampTs(raw.created_at),
    updated_at: clampTs(raw.updated_at),
  };
}

const UPSERT_SQL = `
INSERT INTO items (id, user_id, kind, data, deleted, created_at, updated_at, rev)
VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(rev), 0) + 1 FROM items))
ON CONFLICT(user_id, id) DO UPDATE SET
  kind = excluded.kind, data = excluded.data, deleted = excluded.deleted,
  updated_at = excluded.updated_at, rev = excluded.rev
WHERE excluded.updated_at > items.updated_at`;

export const upsertItem = (db, userId, it) =>
  db.prepare(UPSERT_SQL).bind(it.id, userId, it.kind, it.data, it.deleted, it.created_at, it.updated_at);

export const itemToClient = (r) => {
  let data = {};
  try {
    data = JSON.parse(r.data);
  } catch {
    /* битый документ — отдаём пустой */
  }
  return { id: r.id, kind: r.kind, data, deleted: !!r.deleted, created_at: r.created_at, updated_at: r.updated_at, rev: r.rev };
};

import { HttpError } from './http.js';

const SLOTS = new Set(['morning', 'afternoon', 'evening', 'anytime']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : null) || null;
const clampInt = (v, min, max, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export function slotFromTime(time) {
  if (!time) return 'anytime';
  const h = Number(time.slice(0, 2));
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

/** Приводит входящую задачу к схеме БД. Бросает 400 на мусор. */
export function normalizeTask(raw, { requireId = true } = {}) {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'task must be an object');
  const title = str(raw.title, 300);
  if (!title) throw new HttpError(400, 'task.title is required');

  const id = raw.id;
  if (requireId && (typeof id !== 'string' || !ID_RE.test(id))) throw new HttpError(400, 'task.id is invalid');

  const date = typeof raw.date === 'string' && DATE_RE.test(raw.date) ? raw.date : null;
  const time = typeof raw.time === 'string' && TIME_RE.test(raw.time) ? raw.time : null;
  const slot = SLOTS.has(raw.slot) ? raw.slot : slotFromTime(time);

  return {
    id: requireId ? id : null,
    title,
    date,
    slot,
    time,
    duration_min: clampInt(raw.duration_min, 5, 720, 30),
    area: str(raw.area, 40),
    priority: clampInt(raw.priority, 1, 3, 2),
    note: str(raw.note, 2000),
    deep: raw.deep ? 1 : 0,
    frog: raw.frog ? 1 : 0,
    done: raw.done ? 1 : 0,
    deleted: raw.deleted ? 1 : 0,
    source: ['app', 'voice', 'api'].includes(raw.source) ? raw.source : 'app',
    created_at: clampInt(raw.created_at, 0, 8.64e15, Date.now()),
    updated_at: clampInt(raw.updated_at, 0, 8.64e15, Date.now()),
  };
}

const COLS = [
  'id', 'user_id', 'title', 'date', 'slot', 'time', 'duration_min', 'area',
  'priority', 'note', 'deep', 'frog', 'done', 'deleted', 'source', 'created_at', 'updated_at',
];
const UPDATABLE = COLS.filter((c) => !['id', 'user_id', 'created_at'].includes(c));

// rev = MAX(rev)+1 считается внутри одного SQL-выражения. D1 — это SQLite с одним писателем,
// а batch() выполняется транзакцией, так что ревизии строго растут.
const UPSERT_SQL = `
INSERT INTO tasks (${COLS.join(', ')}, rev)
VALUES (${COLS.map(() => '?').join(', ')}, (SELECT COALESCE(MAX(rev), 0) + 1 FROM tasks))
ON CONFLICT(id) DO UPDATE SET
  ${UPDATABLE.map((c) => `${c} = excluded.${c}`).join(',\n  ')},
  rev = excluded.rev
WHERE excluded.updated_at > tasks.updated_at AND tasks.user_id = excluded.user_id`;

export function upsertStatement(db, userId, t) {
  return db.prepare(UPSERT_SQL).bind(...COLS.map((c) => (c === 'user_id' ? userId : t[c])));
}

/** Строка БД -> объект для клиента */
export const toClient = (r) => ({
  id: r.id,
  title: r.title,
  date: r.date,
  slot: r.slot,
  time: r.time,
  duration_min: r.duration_min,
  area: r.area,
  priority: r.priority,
  note: r.note,
  deep: !!r.deep,
  frog: !!r.frog,
  done: !!r.done,
  deleted: !!r.deleted,
  source: r.source,
  created_at: r.created_at,
  updated_at: r.updated_at,
  rev: r.rev,
});

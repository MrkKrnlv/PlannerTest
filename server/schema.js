// Схема создаётся сама при первом запросе к изолятору Worker.
// Поэтому вручную гонять SQL в консоли D1 не нужно: деплой, и всё.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, tg_id INTEGER UNIQUE, name TEXT,
    api_token TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, date TEXT,
    slot TEXT NOT NULL DEFAULT 'anytime', time TEXT, duration_min INTEGER NOT NULL DEFAULT 30,
    area TEXT, priority INTEGER NOT NULL DEFAULT 2, note TEXT,
    done INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'app', created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL, rev INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_user_rev ON tasks(user_id, rev)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_rev ON tasks(rev)`,
  // Всё остальное (привычки, отметки, заметки дня, сферы, цели 12 недель, настройки)
  // хранится как документы: kind + JSON. Синк такой же, как у задач.
  `CREATE TABLE IF NOT EXISTS items (
    id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL, rev INTEGER NOT NULL,
    PRIMARY KEY (user_id, id))`,
  `CREATE INDEX IF NOT EXISTS idx_items_user_rev ON items(user_id, rev)`,
  `CREATE INDEX IF NOT EXISTS idx_items_rev ON items(rev)`,
];

// Колонки, добавленные после первой версии
const TASK_COLUMNS = {
  deep: 'INTEGER NOT NULL DEFAULT 0', // глубокая работа — идёт в пик энергии
  frog: 'INTEGER NOT NULL DEFAULT 0', // главная задача дня
};

let ready = null;

export function ensureSchema(db) {
  if (!ready) {
    ready = (async () => {
      await db.batch(STATEMENTS.map((s) => db.prepare(s)));
      const { results } = await db.prepare('PRAGMA table_info(tasks)').all();
      const have = new Set(results.map((r) => r.name));
      const missing = Object.entries(TASK_COLUMNS).filter(([name]) => !have.has(name));
      for (const [name, def] of missing) {
        try {
          await db.prepare(`ALTER TABLE tasks ADD COLUMN ${name} ${def}`).run();
        } catch (err) {
          // параллельный изолятор мог успеть первым
          if (!String(err).includes('duplicate column')) throw err;
        }
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

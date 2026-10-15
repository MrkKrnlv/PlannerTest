-- Пользователи: Telegram-аккаунт + персональный токен для браузера
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,          -- 'tg:<telegram id>' или 'dev'
  tg_id       INTEGER UNIQUE,
  name        TEXT,
  api_token   TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

-- Задачи. Каждая строка синкается отдельно (last-write-wins по updated_at).
-- rev — серверный монотонный счётчик: клиенты забирают изменения "всё, что после rev N",
-- поэтому рассинхрон часов между устройствами не теряет правки.
CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  title        TEXT NOT NULL,
  date         TEXT,                     -- YYYY-MM-DD
  slot         TEXT NOT NULL DEFAULT 'anytime', -- morning | afternoon | evening | anytime
  time         TEXT,                     -- HH:MM
  duration_min INTEGER NOT NULL DEFAULT 30,
  area         TEXT,
  priority     INTEGER NOT NULL DEFAULT 2, -- 1 высокий, 2 обычный, 3 низкий
  note         TEXT,
  done         INTEGER NOT NULL DEFAULT 0,
  deleted      INTEGER NOT NULL DEFAULT 0, -- надгробие, чтобы удаления тоже синкались
  source       TEXT NOT NULL DEFAULT 'app', -- app | voice | api
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,         -- время правки на клиенте (для LWW)
  rev          INTEGER NOT NULL          -- серверная ревизия (для pull)
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_rev  ON tasks(user_id, rev);
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_rev       ON tasks(rev);

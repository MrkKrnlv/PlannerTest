# Планер

Планер дня, который живёт в браузере, ставится на телефон как приложение, открывается как Telegram Mini App и синхронизируется между всеми устройствами. Задачи можно надиктовать боту голосом: n8n расшифрует, AI-агент разложит по дням и добавит в планер.

Всё бесплатно в рамках free-тарифов Cloudflare (Workers со статикой и D1).

## Что умеет

- **День.** Задачи по частям дня, расписание по часам, полоса загрузки дня с нормой и предупреждением о переборе, «хвосты» с прошлых дней одной кнопкой переносятся на сегодня.
- **Быстрый ввод.** `созвон с клиентом 1.5ч в 16:00 завтра #работа !` → время, длительность, дата, сфера, приоритет. Понимает `завтра`, `послезавтра`, дни недели, `утром/днём/вечером`, `!` (важно), `~` (не срочно). Клавиша `N` ставит курсор в поле.
- **Неделя.** Семь дней с загрузкой и задачами.
- **Синхронизация.** Правки сохраняются мгновенно и работают без сети, на сервер уходят через ~1 секунду, с сервера подтягиваются при открытии, возврате во вкладку и раз в 30 секунд.
- **PWA.** Установка на главный экран, работа офлайн.
- **Telegram Mini App.** Вход без пароля через Telegram, тема и хаптики Telegram.
- **Голосовой ввод** через n8n (см. ниже). Такие задачи помечены «голосом».

## Архитектура

```
 Браузер / PWA / Mini App                Cloudflare                       n8n
 ┌──────────────────────┐   Bearer   ┌──────────────────────┐  service key  ┌──────────────────┐
 │ React + Zustand      │──────────▶│ Worker /api + статика│◀──────────────│ Telegram Trigger │
 │ localStorage (копия) │◀──────────│ D1 (SQLite)          │               │ Whisper → Agent  │
 └──────────────────────┘  дельта    └──────────────────────┘               └──────────────────┘
```

| Слой | Что |
|---|---|
| Фронт | React 19, Zustand 5 (persist в localStorage), Vite 8, чистый CSS, шрифты Onest и Unbounded (self-hosted) |
| API | Cloudflare Worker: `server/worker.js` отдаёт `/api/*`, остальное — статика из `dist/` |
| База | Cloudflare D1, задачи построчно |
| Офлайн | `public/sw.js`, `public/manifest.webmanifest` |

### Как устроен синк

1. Каждая правка поднимает у задачи `updated_at` и помечает её грязной.
2. **Push:** грязные задачи уходят целиком на `POST /api/tasks/sync`. Сервер применяет правку, только если её `updated_at` новее сохранённой (last-write-wins по задаче).
3. **Pull:** клиент забирает всё, что изменилось после его ревизии: `GET /api/tasks?since=<rev>`. `rev` — серверный счётчик, а не время клиента, поэтому если часы на телефоне спешат или отстают, правки не теряются.
4. Удаление — это надгробие `deleted = 1`, оно синкается как обычная правка, и задача не «воскресает» на другом устройстве.

Почему D1, а не KV: KV eventually consistent (запись расходится до минуты) и на бесплатном тарифе даёт 1000 записей в сутки. D1 — это SQLite с транзакциями, плюс n8n может добавлять отдельные задачи, не трогая остальные.

### Авторизация

| Кто | Как |
|---|---|
| Mini App | `initData` от Telegram → `POST /api/auth/telegram` проверяет подпись токеном бота и выдаёт персональный ключ |
| Браузер / PWA | Тот же персональный ключ: копируется в Mini App, «Настройки», «Ключ для браузера» |
| n8n | `X-Service-Key` + `X-Telegram-User-Id`: действует от имени конкретного пользователя Telegram |

Каждый пользователь Telegram получает своё пространство задач.

### API

| Метод | Путь | Для чего |
|---|---|---|
| POST | `/api/auth/telegram` | `{ initData }` → `{ token, user }` |
| GET | `/api/me` | текущий пользователь |
| GET | `/api/tasks?since=<rev>` | дельта для синка, включая удалённые |
| GET | `/api/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD` | живые задачи за период (контекст для агента) |
| POST | `/api/tasks/sync` | `{ changes: [task] }` — push с клиента |
| POST | `/api/tasks` | `{ source: 'voice', tasks: [...] }` — пакетное создание из n8n |

## Локальный запуск

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run build
npm run dev:api      # Worker: API и собранный фронт на http://localhost:8788
npm run dev          # во втором терминале: фронт с автообновлением на http://localhost:5173
```

На экране входа введи `dev`. Проверка API: `npm run test:api` (13 сценариев: вход через Telegram, синк, LWW, удаления, n8n, изоляция пользователей).

## Деплой

Через дашборд Cloudflare:

1. **База.** Storage & databases → D1 → Create, имя `planner`. Её id вписать в `wrangler.toml` → `database_id`. В консоли базы выполнить `migrations/0001_init.sql`.
2. **Worker.** Workers & Pages → Create → Import a repository → этот репо. Build command `npm run build`, Deploy command `npx wrangler deploy`. Имя Worker должно совпадать с `name` в `wrangler.toml`.
3. **Секреты.** Settings → Variables and Secrets → Add, тип **Secret**: `BOT_TOKEN`, `SERVICE_KEY`. Именно Secret: обычные переменные, которых нет в `wrangler.toml`, стираются при следующем деплое из Git.
4. Каждый пуш в `main` деплоится сам.

Или из консоли:

```bash
npx wrangler login
npx wrangler d1 create planner          # id -> wrangler.toml
npm run db:migrate
npx wrangler secret put BOT_TOKEN
npx wrangler secret put SERVICE_KEY     # openssl rand -hex 32
npm run deploy
```

## Бот и Mini App

1. `@BotFather` → `/newbot` → получишь токен (его же в `BOT_TOKEN`).
2. `/mybots` → бот → Bot Settings → Mini Apps → Menu Button → URL приложения с `https://`, текст «Планер».
3. Открой бота, нажми «Планер». Вход произойдёт сам.
4. В Mini App: «Настройки», «Ключ для браузера» → скопируй и вставь на компьютере.

## Голосовой ввод через n8n

Файл `n8n/voice-to-planner.json` → в n8n: Import from File.

```
Telegram Trigger → голосовое? ─да─→ скачать → Whisper ─┐
                              └нет──────────────────────┴→ текст → задачи на 7 дней → AI Agent → есть задачи? → POST /api/tasks → ответ в Telegram
```

После импорта:

1. **Credentials.** Telegram API (тот же токен бота), OpenAI, Header Auth с именем `Planner service key`: Name `x-service-key`, Value — твой `SERVICE_KEY`.
2. В узлах «Задачи на неделю» и «Добавить в планер» замени `https://plannertest.marksohokornilov.workers.dev (уже подставлен)` на свой адрес.
3. Модель в «OpenAI Chat Model» поставь по вкусу. Часовой пояс в выражениях — `Europe/Moscow`.
4. Активируй воркфлоу. Telegram Trigger требует, чтобы n8n был доступен по HTTPS.

Агент видит уже запланированное на неделю, поэтому не ставит задачи на занятое время, оценивает длительность, дробит размытые задачи и переносит лишнее, если день перегружен. Логика в системном промпте узла AI Agent. Пересобрать воркфлоу из исходника: `python3 scripts/build-n8n-workflow.py`.

У одного бота может быть только один вебхук, и его держит n8n. Mini App вебхук не нужен, так что конфликта нет.

## Ограничения

- LWW работает по задаче целиком: если одну задачу одновременно правят на двух устройствах, победит более поздняя правка.
- Надгробия удалённых задач не чистятся. Для личного планера это килобайты.
- Ключ браузера бессрочный, ротации пока нет.
- Из РФ `*.workers.dev` у части провайдеров открывается медленно или нестабильно. Проверь до публикации видео; при проблемах привяжи свой домен или вынеси фронт на другой хостинг.

## Структура

```
server/worker.js      точка входа Worker, роутинг /api
server/routes/        обработчики API (middleware.js — авторизация)
server/               валидация задач, upsert, crypto, users
migrations/           схема D1
src/store.js          состояние и действия
src/lib/sync.js       синк-движок
src/lib/parse.js      разбор быстрого ввода
src/lib/telegram.js   Mini App
src/components/       экраны и компоненты
public/               manifest, service worker, иконки
n8n/                  воркфлоу голосового ввода
scripts/              smoke-тест API, генерация иконок и воркфлоу
```

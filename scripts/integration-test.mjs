// Бот и синк с Notion целиком: настоящая SQLite (node:sqlite) вместо D1,
// подменённые Telegram Bot API, Workers AI и Notion API.
// Запуск: node scripts/integration-test.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ensureSchema } from '../server/schema.js';
import { getOrCreateTgUser } from '../server/users.js';
import { handleUpdate, todayInTz } from '../server/bot.js';
import { connect, syncUser, taskProperties, parsePageId } from '../server/notion.js';
import { normalizeTask, upsertStatement } from '../server/tasks.js';

// --- D1 поверх SQLite
function d1() {
  const sql = new DatabaseSync(':memory:');
  const stmt = (q, args = []) => ({
    bind: (...a) => stmt(q, a.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v))),
    all: async () => ({ results: sql.prepare(q).all(...args) }),
    first: async () => sql.prepare(q).get(...args) ?? null,
    run: async () => (sql.prepare(q).run(...args), { success: true }),
  });
  return {
    prepare: (q) => stmt(q),
    batch: async (list) => {
      sql.exec('BEGIN');
      try {
        for (const s of list) await s.run();
        sql.exec('COMMIT');
      } catch (e) {
        sql.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

const ok = (name) => console.log('ok  ', name);
const DB = d1();
await ensureSchema(DB);
await ensureSchema(DB); // повторно — без ошибок
ok('схема создаётся и повторный вызов безопасен');

// --- подмена внешних API
const calls = [];
let notionPage = 0;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ url: u, method: init.method || 'GET', body });
  const ok_ = (result) => new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } });
  if (u.includes('api.telegram.org/file/')) return new Response(new Uint8Array([1, 2, 3, 4, 5]).buffer, { status: 200 });
  if (u.includes('api.telegram.org/bot')) {
    const method = u.split('/').pop();
    if (method === 'getFile') return ok_({ ok: true, result: { file_path: 'voice/file_1.oga', file_size: 5 } });
    return ok_({ ok: true, result: { message_id: 1 } });
  }
  if (u.startsWith('https://api.notion.com/v1/databases')) return ok_({ id: '11111111-2222-3333-4444-555555555555' });
  if (u.startsWith('https://api.notion.com/v1/pages') && init.method === 'POST') return ok_({ id: `page-${++notionPage}` });
  if (u.startsWith('https://api.notion.com/v1/pages') && init.method === 'PATCH') return ok_({ id: u.split('/').pop() });
  throw new Error(`unexpected fetch ${u}`);
};

const today = todayInTz();
let aiCalls = [];
const AI = {
  run: async (model, input) => {
    aiCalls.push({ model, input });
    if (model.includes('whisper')) {
      assert.equal(typeof input.audio, 'string'); // base64
      return { text: 'завтра в десять созвон с клиентом на час и вечером тренировка' };
    }
    if (input.response_format && AI.failJson) throw new Error("JSON Mode couldn't be met");
    const payload = {
      tasks: [
        { title: 'Созвон с клиентом', date: '2001-01-01', time: '10:00', duration_min: 60, slot: 'morning', priority: 2, area: 'работа' },
        { title: 'Тренировка', date: today, time: null, duration_min: 90, slot: 'evening', priority: 2, deep: false },
      ],
      summary: 'Добавил созвон и тренировку.',
    };
    return { response: AI.failJson ? `Вот ответ: ${JSON.stringify(payload)}` : payload };
  },
};
const env = { DB, AI, BOT_TOKEN: '123:abc' };

// --- голосовое
await handleUpdate({ message: { chat: { id: 5 }, from: { id: 777, first_name: 'Марк' }, voice: { file_id: 'v1' } } }, env, 'https://planner.example');
let { results } = await DB.prepare("SELECT * FROM tasks WHERE user_id = 'tg:777' ORDER BY title").all();
assert.equal(results.length, 2);
assert.ok(results.every((t) => t.source === 'voice'));
assert.equal(results.find((t) => t.title === 'Созвон с клиентом').date, today); // дата в прошлом -> сегодня
assert.equal(aiCalls[0].model, '@cf/openai/whisper-large-v3-turbo');
const sent = calls.filter((c) => c.url.endsWith('/sendMessage'));
assert.equal(sent.length, 1);
assert.ok(sent[0].body.text.includes('Созвон с клиентом'));
assert.equal(sent[0].body.reply_markup.inline_keyboard[0][0].web_app.url, 'https://planner.example');
ok('голосовое: расшифровка, задачи в базе, ответ с кнопкой планера');

// --- модель не выдала JSON-схему: запасной путь
AI.failJson = true;
await handleUpdate({ message: { chat: { id: 5 }, from: { id: 777, first_name: 'Марк' }, text: 'то же самое текстом' } }, env, 'https://planner.example');
({ results } = await DB.prepare("SELECT * FROM tasks WHERE user_id = 'tg:777'").all());
assert.equal(results.length, 4);
assert.ok(results.some((t) => t.source === 'api'));
AI.failJson = false;
ok('запасной разбор, если JSON-режим не сработал');

// --- /start
calls.length = 0;
await handleUpdate({ message: { chat: { id: 5 }, from: { id: 777 }, text: '/start' } }, env, 'https://planner.example');
assert.ok(calls.find((c) => c.url.endsWith('/sendMessage')).body.text.startsWith('Привет'));
ok('/start отвечает подсказкой');

// --- Notion
assert.equal(parsePageId('https://www.notion.so/me/Planner-1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d?pvs=4'), '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d');
const p = taskProperties({ title: 'X', date: '2026-10-15', time: '23:30', duration_min: 60, done: false, frog: true, area: 'работа' });
assert.equal(p['Когда'].date.start, '2026-10-15T23:30:00+03:00');
assert.equal(p['Когда'].date.end, '2026-10-16T00:30:00+03:00');
assert.equal(taskProperties({ title: 'Y', date: '2026-10-15', time: null, duration_min: 30 })['Когда'].date.start, '2026-10-15');
ok('свойства страницы Notion: дата, время, переход через полночь');

let user = await getOrCreateTgUser(DB, 777, 'Марк');
await assert.rejects(connect(env, user, 'not-a-token', 'x'), /токен/);
await connect(env, user, 'ntn_' + 'a'.repeat(40), 'https://www.notion.so/Planner-1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d');
user = await DB.prepare("SELECT * FROM users WHERE id = 'tg:777'").first();
assert.equal(user.notion_db, '11111111-2222-3333-4444-555555555555');

// задача без даты в Notion не уходит
const noDate = { ...normalizeTask({ id: 'inbox-task-1', title: 'Без даты', updated_at: Date.now() }), date: null };
await DB.batch([upsertStatement(DB, user.id, noDate)]);
calls.length = 0;
let r = await syncUser(env, user);
assert.equal(r.synced, 5);
assert.equal(r.pending, 0);
assert.equal(calls.filter((c) => c.url.endsWith('/pages') && c.method === 'POST').length, 4);
let pages = (await DB.prepare("SELECT * FROM notion_pages WHERE user_id = 'tg:777'").all()).results;
assert.equal(pages.length, 4);
ok('первый синк: 4 задачи с датой стали страницами, задача без даты пропущена');

// правка и удаление
const [a, b] = (await DB.prepare("SELECT * FROM tasks WHERE user_id = 'tg:777' AND date IS NOT NULL ORDER BY title LIMIT 2").all()).results;
const later = Date.now() + 1000;
await DB.batch([
  upsertStatement(DB, user.id, normalizeTask({ ...a, done: true, updated_at: later })),
  upsertStatement(DB, user.id, normalizeTask({ ...b, deleted: true, updated_at: later })),
]);
user = await DB.prepare("SELECT * FROM users WHERE id = 'tg:777'").first();
calls.length = 0;
r = await syncUser(env, user);
assert.equal(r.synced, 2);
const patches = calls.filter((c) => c.method === 'PATCH');
assert.ok(patches.some((c) => c.body.archived === true));
assert.ok(patches.some((c) => c.body.properties?.['Готово']?.checkbox === true));
pages = (await DB.prepare("SELECT * FROM notion_pages WHERE user_id = 'tg:777'").all()).results;
assert.equal(pages.length, 3);
ok('правки обновляют страницу, удаление архивирует её');

user = await DB.prepare("SELECT * FROM users WHERE id = 'tg:777'").first();
r = await syncUser(env, user);
assert.equal(r.synced, 0);
ok('пустая дельта ничего не шлёт');

console.log('\nВсе интеграционные проверки пройдены');

// Прогон API против локального `wrangler pages dev` (по умолчанию http://localhost:8788).
// Запуск: node scripts/smoke-test.mjs   (нужны DEV_TOKEN=dev, SERVICE_KEY, BOT_TOKEN в .dev.vars)
import { createHmac, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:8788';
const DEV = process.env.DEV_TOKEN || 'dev';
const SERVICE_KEY = process.env.SERVICE_KEY || 'svc-test-key';
const BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-bot-token';

const call = async (method, path, { token, headers = {}, body } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
};

function makeInitData(user) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAHtest',
    user: JSON.stringify(user),
  });
  const dcs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  params.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return params.toString();
}

const ok = (name) => console.log('ok  ', name);

// свой id на каждый прогон, чтобы тест можно было гонять повторно на той же базе
const TG_ID = 100000 + Math.floor(Math.random() * 1e9);

// 1. Без токена — 401
assert.equal((await call('GET', '/api/me')).status, 401); ok('401 без токена');

// 2. Telegram-вход
const bad = await call('POST', '/api/auth/telegram', { body: { initData: makeInitData({ id: 42 }).replace(/hash=\w+/, 'hash=deadbeef') } });
assert.equal(bad.status, 401); ok('поддельный initData отклонён');

const tg = await call('POST', '/api/auth/telegram', { body: { initData: makeInitData({ id: TG_ID, first_name: 'Mark' }) } });
assert.equal(tg.status, 200);
assert.equal(tg.data.user.id, `tg:${TG_ID}`);
const token = tg.data.token; ok('вход через Telegram, получен токен');

// 3. Пуш задачи с устройства A
const id = randomUUID();
const t0 = Date.now();
const task = { id, title: 'Созвон с клиентом', date: '2026-10-15', time: '16:00', duration_min: 60, updated_at: t0, created_at: t0 };
assert.equal((await call('POST', '/api/tasks/sync', { token, body: { changes: [task] } })).status, 200);

// 4. Устройство B тянет с нуля
let pull = await call('GET', '/api/tasks?since=0', { token });
assert.equal(pull.data.tasks.length, 1);
assert.equal(pull.data.tasks[0].slot, 'afternoon');
const rev1 = pull.data.rev; ok('pull с нуля, слот выведен из времени');

// 5. Старая правка не перетирает новую (LWW)
await call('POST', '/api/tasks/sync', { token, body: { changes: [{ ...task, title: 'Новая', updated_at: t0 + 1000 }] } });
await call('POST', '/api/tasks/sync', { token, body: { changes: [{ ...task, title: 'Старая', updated_at: t0 + 500 }] } });
pull = await call('GET', `/api/tasks?since=${rev1}`, { token });
assert.equal(pull.data.tasks.length, 1);
assert.equal(pull.data.tasks[0].title, 'Новая'); ok('last-write-wins');
const rev2 = pull.data.rev;

// 6. Пустая дельта
assert.equal((await call('GET', `/api/tasks?since=${rev2}`, { token })).data.tasks.length, 0); ok('пустая дельта');

// 7. n8n через service key создаёт задачи от имени того же юзера Telegram
const svc = { 'x-service-key': SERVICE_KEY, 'x-telegram-user-id': String(TG_ID) };
const created = await call('POST', '/api/tasks', {
  headers: svc,
  body: { source: 'voice', tasks: [
    { title: 'Купить корм коту', date: '2026-10-16', slot: 'evening', duration_min: 20, priority: 3 },
    { title: 'Смонтировать ролик', date: '2026-10-16', time: '10:00', duration_min: 180, area: 'YouTube', priority: 1 },
  ] },
});
assert.equal(created.status, 201);
assert.equal(created.data.created.length, 2); ok('n8n создал 2 задачи');

assert.equal((await call('GET', '/api/me', { headers: { ...svc, 'x-service-key': 'wrong' } })).status, 401); ok('неверный service key отклонён');

// 8. Устройство A видит голосовые задачи в дельте
pull = await call('GET', `/api/tasks?since=${rev2}`, { token });
assert.equal(pull.data.tasks.length, 2);
assert.ok(pull.data.tasks.every((t) => t.source === 'voice')); ok('голосовые задачи пришли в дельте');

// 9. Контекст для агента по датам
const range = await call('GET', '/api/tasks?from=2026-10-15&to=2026-10-16', { headers: svc });
assert.equal(range.data.tasks.length, 3); ok('выборка по датам для агента');

// 10. Удаление = надгробие, тоже синкается
await call('POST', '/api/tasks/sync', { token, body: { changes: [{ ...task, title: 'Новая', deleted: true, updated_at: t0 + 2000 }] } });
pull = await call('GET', `/api/tasks?since=${pull.data.rev}`, { token });
assert.equal(pull.data.tasks[0].deleted, true);
assert.equal((await call('GET', '/api/tasks?from=2026-10-15&to=2026-10-15', { headers: svc })).data.tasks.length, 0);
ok('удаление синкается');

// 11. Чужой юзер не видит и не может перезаписать
const other = (await call('POST', '/api/auth/telegram', { body: { initData: makeInitData({ id: TG_ID + 1 }) } })).data.token;
assert.equal((await call('GET', '/api/tasks?since=0', { token: other })).data.tasks.length, 0);
await call('POST', '/api/tasks/sync', { token: other, body: { changes: [{ ...task, title: 'Взлом', updated_at: t0 + 9999 }] } });
const mine = await call('GET', '/api/tasks?since=0', { token });
assert.equal(mine.data.tasks.find((t) => t.id === id).title, 'Новая'); ok('изоляция пользователей');

// 12. Мусор отклоняется
assert.equal((await call('POST', '/api/tasks/sync', { token, body: { changes: [{ id: 'x', title: '' }] } })).status, 400); ok('валидация');

// 13. Документы (привычки, заметки дня и т.д.) синкаются так же
const hid = `habit-${TG_ID}`;
const it0 = Date.now();
await call('POST', '/api/items/sync', { token, body: { changes: [
  { id: hid, kind: 'habit', data: { name: 'Витамины', days: [1, 2, 3, 4, 5] }, updated_at: it0, created_at: it0 },
  { id: `hl:${hid}:2026-10-15`, kind: 'habit_log', data: { done: true }, updated_at: it0, created_at: it0 },
] } });
let items = await call('GET', '/api/items?since=0', { token });
assert.equal(items.data.items.length, 2);
assert.equal(items.data.items.find((i) => i.id === hid).data.name, 'Витамины');
await call('POST', '/api/items/sync', { token, body: { changes: [{ id: hid, kind: 'habit', data: { name: 'Старое' }, updated_at: it0 - 1 }] } });
items = await call('GET', `/api/items?since=${items.data.rev}`, { token });
assert.equal(items.data.items.length, 0); ok('документы: синк и LWW');
assert.equal((await call('GET', '/api/items?since=0', { token: other })).data.items.length, 0); ok('документы изолированы');
assert.equal((await call('POST', '/api/items/sync', { token, body: { changes: [{ id: 'x', kind: 'hack', data: {} }] } })).status, 400); ok('валидация документов');

// 14. Поля deep/frog у задач
await call('POST', '/api/tasks/sync', { token, body: { changes: [{ id: randomUUID(), title: 'Монтаж', date: '2026-10-20', deep: true, frog: true, updated_at: Date.now() }] } });
const deepTask = (await call('GET', '/api/tasks?from=2026-10-20&to=2026-10-20', { token })).data.tasks[0];
assert.ok(deepTask.deep && deepTask.frog); ok('deep и frog сохраняются');

console.log('\nВсе проверки пройдены');

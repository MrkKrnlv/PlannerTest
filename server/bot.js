// Telegram-бот прямо в Worker: голос -> Whisper (Workers AI) -> LLM (Workers AI) -> задачи в D1.
import { getOrCreateTgUser } from './users.js';
import { normalizeTask, upsertStatement } from './tasks.js';

export const TZ = 'Europe/Moscow';
const MODEL_ASR = '@cf/openai/whisper-large-v3-turbo';
const MODEL_LLM = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'; // поддерживает JSON-схему в ответе
const MAX_AUDIO_BYTES = 19 * 1024 * 1024; // Bot API отдаёт файлы до 20 МБ

const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export const todayInTz = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (iso) => WD[new Date(`${iso}T12:00:00Z`).getUTCDay()];

/** Секрет вебхука выводим из токена бота: отдельный секрет заводить не нужно */
export async function webhookSecret(botToken) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`planner-webhook:${botToken}`));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
}

export async function tg(env, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
  return data.result;
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          date: { type: 'string' },
          time: { type: ['string', 'null'] },
          duration_min: { type: 'integer' },
          slot: { type: 'string', enum: ['morning', 'afternoon', 'evening', 'anytime'] },
          area: { type: ['string', 'null'] },
          priority: { type: 'integer' },
          deep: { type: 'boolean' },
          frog: { type: 'boolean' },
        },
        required: ['title', 'date', 'duration_min', 'slot', 'priority'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['tasks', 'summary'],
};

const systemPrompt = (today) => `Ты ассистент-планировщик. Из сообщения пользователя (часто это расшифровка голосового с ошибками распознавания) извлекаешь задачи для планера. Отвечаешь строго JSON по схеме.

Сегодня ${today}, ${weekday(today)}. Даты пиши в формате YYYY-MM-DD.
Правила:
- Дата не названа — сегодня. «Завтра», «в пятницу», «на выходных» переводи в ближайшую будущую дату.
- time (HH:MM) ставь только если время названо явно, иначе null. slot: morning до 12:00, afternoon 12–17, evening после 17, иначе anytime.
- duration_min: если не сказано, оцени реалистично и кратно 5 (звонок 15–30, встреча 60, монтаж, код, учёба 90–180, бытовая мелочь 10–20).
- Размытую большую задачу разбей на 2–3 конкретных шага.
- priority: 1 — «срочно», «важно», «обязательно» или жёсткий дедлайн; 3 — «если успею»; иначе 2.
- area: одно слово из списка: работа, учёба, здоровье, люди, дом, творчество — только если очевидно, иначе null.
- deep: true для задач на концентрацию от 60 минут. frog: true максимум у одной задачи на день, только если пользователь назвал её главной.
- Учитывай уже запланированное: не ставь задачу на занятое время. Если день больше 8 часов, перенеси некритичное на следующий день и скажи об этом в summary.
- Не выдумывай задачи. Если задач нет (приветствие, вопрос), верни пустой tasks и коротко ответь в summary.
- summary: 1–3 предложения на «ты», по-русски, без смайликов: что и на какие дни добавил.`;

function extractJson(text) {
  if (text && typeof text === 'object') return text;
  const s = String(text || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('LLM вернула не JSON');
  return JSON.parse(s.slice(start, end + 1));
}

/** Разбор текста в задачи. Сначала строгий JSON-режим, при отказе модели — обычный ответ с поиском JSON. */
export async function parseTasks(env, text, context, today) {
  const messages = [
    { role: 'system', content: systemPrompt(today) },
    { role: 'user', content: `Уже запланировано на 7 дней: ${JSON.stringify(context)}\n\nСообщение пользователя:\n${text}` },
  ];
  let out;
  try {
    const r = await env.AI.run(MODEL_LLM, { messages, response_format: { type: 'json_schema', json_schema: SCHEMA }, max_tokens: 1500, temperature: 0.2 });
    out = extractJson(r.response);
  } catch {
    const r = await env.AI.run(MODEL_LLM, { messages, max_tokens: 1500, temperature: 0.2 });
    out = extractJson(r.response);
  }
  const tasks = Array.isArray(out.tasks) ? out.tasks.slice(0, 20) : [];
  return {
    tasks: tasks
      .filter((t) => t && typeof t.title === 'string' && t.title.trim())
      .map((t) => ({ ...t, date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) && t.date >= today ? t.date : today })),
    summary: typeof out.summary === 'string' ? out.summary : '',
  };
}

export async function transcribe(env, fileId) {
  const file = await tg(env, 'getFile', { file_id: fileId });
  if (file.file_size > MAX_AUDIO_BYTES) throw new Error('Голосовое слишком длинное');
  const res = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${file.file_path}`);
  if (!res.ok) throw new Error(`Не скачал голосовое: HTTP ${res.status}`);
  const r = await env.AI.run(MODEL_ASR, { audio: toBase64(await res.arrayBuffer()), language: 'ru' });
  return (r.text || '').trim();
}

const openButton = (origin) => ({ inline_keyboard: [[{ text: 'Открыть планер', web_app: { url: origin } }]] });

export async function handleUpdate(update, env, origin) {
  const msg = update.message;
  if (!msg?.chat || !msg.from || msg.from.is_bot) return;
  const chatId = msg.chat.id;
  const reply = (text, extra = {}) => tg(env, 'sendMessage', { chat_id: chatId, text, ...extra });

  try {
    if (/^\/(start|help)/.test(msg.text || '')) {
      await reply(
        'Привет. Надиктуй или напиши, что нужно сделать, например: «завтра в 10 созвон с клиентом на час, вечером тренировка, в пятницу смонтировать ролик». Я разложу задачи по дням с учётом загрузки и добавлю в планер.',
        { reply_markup: openButton(origin) }
      );
      return;
    }

    let text = msg.text || msg.caption || '';
    const voice = msg.voice || msg.audio || msg.video_note;
    if (voice) {
      await tg(env, 'sendChatAction', { chat_id: chatId, action: 'typing' });
      text = await transcribe(env, voice.file_id);
      if (!text) return reply('Не расслышал. Попробуй ещё раз, чуть ближе к микрофону.');
    }
    if (!text.trim()) return reply('Пришли текст или голосовое со списком дел.');
    await tg(env, 'sendChatAction', { chat_id: chatId, action: 'typing' });

    const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || msg.from.username || null;
    const user = await getOrCreateTgUser(env.DB, msg.from.id, name);
    const today = todayInTz();
    const { results: ctx } = await env.DB.prepare(
      `SELECT title, date, time, duration_min FROM tasks WHERE user_id = ? AND deleted = 0 AND done = 0 AND date BETWEEN ? AND ? ORDER BY date, time`
    )
      .bind(user.id, today, addDays(today, 6))
      .all();

    const { tasks, summary } = await parseTasks(env, text, ctx, today);
    if (tasks.length) {
      const now = Date.now();
      const rows = tasks.map((raw) => ({
        ...normalizeTask({ ...raw, source: voice ? 'voice' : 'api', done: false, deleted: false }, { requireId: false }),
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      }));
      await env.DB.batch(rows.map((t) => upsertStatement(env.DB, user.id, t)));
      const list = rows
        .map((t) => `• ${t.title}, ${t.date === today ? 'сегодня' : t.date === addDays(today, 1) ? 'завтра' : t.date}${t.time ? ` в ${t.time}` : ''}`)
        .join('\n');
      await reply(`${summary || 'Добавил.'}\n\n${list}`, { reply_markup: openButton(origin) });
    } else {
      await reply(summary || 'Задач в сообщении не нашёл.');
    }
  } catch (err) {
    console.error('bot error', err);
    await reply(`Не получилось обработать: ${String(err.message || err).slice(0, 200)}`).catch(() => {});
  }
}

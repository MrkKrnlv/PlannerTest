import { json, HttpError } from '../http.js';
import { timingSafeEqual } from '../crypto.js';
import { handleUpdate, tg, webhookSecret } from '../bot.js';

// POST /api/telegram/webhook — сюда Telegram шлёт сообщения боту (публичный путь, проверка по секрету)
export async function webhook({ request, env, ctx }) {
  if (!env.BOT_TOKEN) throw new HttpError(500, 'BOT_TOKEN is not configured');
  const secret = await webhookSecret(env.BOT_TOKEN);
  if (!timingSafeEqual(request.headers.get('x-telegram-bot-api-secret-token') || '', secret)) {
    return json({ error: 'forbidden' }, 403);
  }
  const update = await request.json().catch(() => null);
  const origin = new URL(request.url).origin;
  // Telegram ждёт быстрый ответ: обрабатываем в фоне
  if (update) ctx.waitUntil(handleUpdate(update, env, origin));
  return json({ ok: true });
}

// POST /api/telegram/setup — привязать бота к этому Worker: вебхук, кнопка меню, команды
export async function setup({ request, env }) {
  if (!env.BOT_TOKEN) throw new HttpError(500, 'BOT_TOKEN is not configured');
  if (!env.AI) throw new HttpError(500, 'Workers AI binding AI is not configured');
  const origin = new URL(request.url).origin;
  await tg(env, 'setWebhook', {
    url: `${origin}/api/telegram/webhook`,
    secret_token: await webhookSecret(env.BOT_TOKEN),
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });
  await tg(env, 'setChatMenuButton', { menu_button: { type: 'web_app', text: 'Планер', web_app: { url: origin } } });
  await tg(env, 'setMyCommands', { commands: [{ command: 'start', description: 'Как пользоваться' }] });
  const me = await tg(env, 'getMe');
  return json({ ok: true, bot: me.username, webhook: `${origin}/api/telegram/webhook` });
}

// GET /api/telegram/status
export async function status({ request, env }) {
  if (!env.BOT_TOKEN) return json({ configured: false });
  let info;
  try {
    info = await tg(env, 'getWebhookInfo');
  } catch (err) {
    return json({ configured: true, connected: false, lastError: `Telegram недоступен: ${err.message}`, ai: !!env.AI });
  }
  const origin = new URL(request.url).origin;
  const me = await tg(env, 'getMe').catch(() => null);
  return json({
    configured: true,
    bot: me?.username || null,
    connected: info.url === `${origin}/api/telegram/webhook`,
    url: info.url || null,
    pending: info.pending_update_count || 0,
    lastError: info.last_error_message || null,
    ai: !!env.AI,
  });
}

import { json, readJson, HttpError } from '../http.js';
import { validateInitData } from '../crypto.js';
import { getOrCreateTgUser, publicUser } from '../users.js';

// Mini App присылает initData -> проверяем подпись бота -> отдаём персональный токен.
// Дальше Mini App ходит в API с Bearer-токеном, как обычный браузер.
export async function onRequestPost({ request, env }) {
  if (!env.BOT_TOKEN) throw new HttpError(500, 'BOT_TOKEN is not configured');
  const { initData } = await readJson(request, 16 * 1024);
  const tgUser = await validateInitData(initData, env.BOT_TOKEN);
  if (!tgUser?.id) return json({ error: 'invalid initData' }, 401);

  const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || null;
  const user = await getOrCreateTgUser(env.DB, tgUser.id, name);
  return json({ token: user.api_token, user: publicUser(user) });
}

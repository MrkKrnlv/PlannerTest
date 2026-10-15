import { json, HttpError } from '../../server/http.js';
import { timingSafeEqual } from '../../server/crypto.js';
import { getOrCreateTgUser, getOrCreateDevUser } from '../../server/users.js';

const PUBLIC = new Set(['/api/health', '/api/auth/telegram']);

/**
 * Три способа авторизоваться:
 * 1. Authorization: Bearer <api_token>      — браузер/PWA и Mini App после входа
 * 2. X-Service-Key + X-Telegram-User-Id     — n8n действует от имени юзера Telegram
 * 3. Bearer <DEV_TOKEN>                     — только локально, если задан в .dev.vars
 */
async function resolveUser(request, env) {
  const db = env.DB;

  const serviceKey = request.headers.get('x-service-key');
  if (serviceKey) {
    if (!env.SERVICE_KEY || !timingSafeEqual(serviceKey, env.SERVICE_KEY)) return null;
    const tgId = Number(request.headers.get('x-telegram-user-id'));
    if (!Number.isSafeInteger(tgId) || tgId <= 0) throw new HttpError(400, 'x-telegram-user-id required');
    return getOrCreateTgUser(db, tgId, null);
  }

  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || token.length > 128) return null;

  const user = await db.prepare('SELECT * FROM users WHERE api_token = ?').bind(token).first();
  if (user) return user;

  if (env.DEV_TOKEN && timingSafeEqual(token, env.DEV_TOKEN)) return getOrCreateDevUser(db, token);
  return null;
}

export async function onRequest(context) {
  const { request, env, next, data } = context;
  try {
    if (!env.DB) throw new HttpError(500, 'D1 binding DB is not configured');
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    if (!PUBLIC.has(path)) {
      const user = await resolveUser(request, env);
      if (!user) return json({ error: 'unauthorized' }, 401);
      data.user = user;
    }
    return await next();
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: 'internal error' }, 500);
  }
}

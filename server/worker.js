// Точка входа Cloudflare Worker.
// /api/* обрабатывает код ниже, всё остальное — статика из dist/ (SPA).
import { json } from './http.js';
import { onRequest as middleware } from './routes/middleware.js';
import * as health from './routes/health.js';
import * as me from './routes/me.js';
import * as authTelegram from './routes/auth-telegram.js';
import * as tasks from './routes/tasks.js';
import * as tasksSync from './routes/tasks-sync.js';
import * as items from './routes/items.js';
import * as telegram from './routes/telegram.js';
import * as notionRoutes from './routes/notion.js';
import { ensureSchema } from './schema.js';
import { syncAll } from './notion.js';

const routes = {
  'GET /api/health': health.onRequestGet,
  'POST /api/auth/telegram': authTelegram.onRequestPost,
  'GET /api/me': me.onRequestGet,
  'GET /api/tasks': tasks.onRequestGet,
  'POST /api/tasks': tasks.onRequestPost,
  'POST /api/tasks/sync': tasksSync.onRequestPost,
  'GET /api/items': items.onRequestGet,
  'POST /api/items/sync': items.onRequestPost,
  'POST /api/telegram/webhook': telegram.webhook,
  'POST /api/telegram/setup': telegram.setup,
  'GET /api/telegram/status': telegram.status,
  'GET /api/notion/status': notionRoutes.getStatus,
  'POST /api/notion/connect': notionRoutes.postConnect,
  'POST /api/notion/sync': notionRoutes.postSync,
  'POST /api/notion/disconnect': notionRoutes.postDisconnect,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const path = url.pathname.replace(/\/+$/, '');
    const handler = routes[`${request.method} ${path}`];
    const data = {};
    const context = { request, env, ctx, data };
    // middleware: авторизация + перехват ошибок, затем сам обработчик
    return middleware({
      ...context,
      next: async () => (handler ? handler(context) : json({ error: 'not found' }, 404)),
    });
  },

  // cron из wrangler.toml: раз в 5 минут досылаем изменения в Notion
  async scheduled(event, env, ctx) {
    ctx.waitUntil(ensureSchema(env.DB).then(() => syncAll(env)));
  },
};

// Точка входа Cloudflare Worker.
// /api/* обрабатывает код ниже, всё остальное — статика из dist/ (SPA).
import { json } from './http.js';
import { onRequest as middleware } from './routes/middleware.js';
import * as health from './routes/health.js';
import * as me from './routes/me.js';
import * as authTelegram from './routes/auth-telegram.js';
import * as tasks from './routes/tasks.js';
import * as tasksSync from './routes/tasks-sync.js';

const routes = {
  'GET /api/health': health.onRequestGet,
  'POST /api/auth/telegram': authTelegram.onRequestPost,
  'GET /api/me': me.onRequestGet,
  'GET /api/tasks': tasks.onRequestGet,
  'POST /api/tasks': tasks.onRequestPost,
  'POST /api/tasks/sync': tasksSync.onRequestPost,
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
};

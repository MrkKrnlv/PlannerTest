import { randomToken } from './crypto.js';

export async function getOrCreateTgUser(db, tgId, name) {
  const id = `tg:${tgId}`;
  const existing = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (existing) {
    if (name && name !== existing.name) {
      await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, id).run();
      existing.name = name;
    }
    return existing;
  }
  const user = { id, tg_id: tgId, name: name || null, api_token: randomToken(), created_at: Date.now() };
  await db
    .prepare('INSERT OR IGNORE INTO users (id, tg_id, name, api_token, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(user.id, user.tg_id, user.name, user.api_token, user.created_at)
    .run();
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
}

export async function getOrCreateDevUser(db, token) {
  const existing = await db.prepare('SELECT * FROM users WHERE id = ?').bind('dev').first();
  if (existing) return existing;
  await db
    .prepare('INSERT INTO users (id, tg_id, name, api_token, created_at) VALUES (?, NULL, ?, ?, ?)')
    .bind('dev', 'Dev', token, Date.now())
    .run();
  return db.prepare('SELECT * FROM users WHERE id = ?').bind('dev').first();
}

export const publicUser = (u) => ({ id: u.id, tgId: u.tg_id, name: u.name });

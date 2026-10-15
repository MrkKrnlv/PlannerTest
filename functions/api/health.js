import { json } from '../../server/http.js';

export const onRequestGet = () => json({ ok: true, time: Date.now() });

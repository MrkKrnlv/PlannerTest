import { json } from '../http.js';

export const onRequestGet = () => json({ ok: true, time: Date.now() });

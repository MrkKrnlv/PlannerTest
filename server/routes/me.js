import { json } from '../http.js';
import { publicUser } from '../users.js';

export const onRequestGet = ({ data }) => json({ user: publicUser(data.user) });

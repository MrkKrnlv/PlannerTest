import { json } from '../../server/http.js';
import { publicUser } from '../../server/users.js';

export const onRequestGet = ({ data }) => json({ user: publicUser(data.user) });

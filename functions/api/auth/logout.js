// POST /api/auth/logout — delete the session row and clear the cookie.

import { json, clearCookieHeader } from '../../lib/http.js';
import { destroySession } from '../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    await destroySession(request, env);
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookieHeader() });
  } catch {
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookieHeader() });
  }
}

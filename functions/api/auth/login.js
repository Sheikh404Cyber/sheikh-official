// POST /api/auth/login — rate-limited; blocked accounts cannot log in.

import { json, fail, readJson, sameOrigin, sessionCookieHeader, clientIp } from '../../lib/http.js';
import {
  verifyPassword,
  createSession,
  SESSION_TTL_SECONDS,
  loginRateLimited,
  recordFailedLogin,
  clearFailedLogins,
} from '../../lib/auth.js';
import { publicUser } from '../../lib/util.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const ip = clientIp(request);
    if (await loginRateLimited(env.DB, ip)) {
      return fail(429, 'Too many failed attempts. Please try again in 15 minutes.');
    }

    const body = await readJson(request);
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password) return fail(400, 'Email and password are required');

    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

    const ok = user ? await verifyPassword(password, user.pass_hash, user.salt) : false;
    if (!ok) {
      await recordFailedLogin(env.DB, ip);
      return fail(401, 'Email or password is incorrect');
    }
    if (user.blocked) {
      return fail(403, 'This account has been blocked. Please contact the admin.');
    }

    await clearFailedLogins(env.DB, ip);
    const token = await createSession(env.DB, user.id);
    return json({ ok: true, user: publicUser(user) }, 200, {
      'Set-Cookie': sessionCookieHeader(token, SESSION_TTL_SECONDS),
    });
  } catch {
    return fail(500, 'Server error');
  }
}

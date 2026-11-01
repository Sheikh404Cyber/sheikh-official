// POST /api/admin/change-password — admin changes their own password.
// Requires the current password; the new one is rehashed with a fresh salt
// and all existing sessions are replaced by a fresh one (others log out).

import { json, fail, readJson, sameOrigin, sessionCookieHeader } from '../../lib/http.js';
import { requireAdmin, verifyPassword, hashPassword, createSession, destroyUserSessions, SESSION_TTL_SECONDS } from '../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const body = await readJson(request);
    const current = String(body?.current_password || '');
    const next = String(body?.new_password || '');
    if (next.length < 8) return fail(400, 'New password must be at least 8 characters');

    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.user.id).first();
    if (!row) return fail(404, 'User not found');

    const ok = await verifyPassword(current, row.pass_hash, row.salt);
    if (!ok) return fail(401, 'Current password is incorrect');

    const { hash, salt } = await hashPassword(next);
    await env.DB.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?')
      .bind(hash, salt, row.id)
      .run();

    await destroyUserSessions(env.DB, row.id);
    const token = await createSession(env.DB, row.id);
    return json({ ok: true }, 200, {
      'Set-Cookie': sessionCookieHeader(token, SESSION_TTL_SECONDS),
    });
  } catch {
    return fail(500, 'Server error');
  }
}

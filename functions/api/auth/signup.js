// POST /api/auth/signup — create an account and start a session.
// New accounts are NOT admins and cannot download until the admin
// grants can_download from the admin panel.

import { json, fail, readJson, sameOrigin, sessionCookieHeader } from '../../lib/http.js';
import { hashPassword, createSession, SESSION_TTL_SECONDS } from '../../lib/auth.js';
import { cleanStr, isEmail, publicUser } from '../../lib/util.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const body = await readJson(request);
    const name = cleanStr(body?.name, 100);
    const email = cleanStr(body?.email, 200).toLowerCase();
    const password = String(body?.password || '');

    if (!name) return fail(400, 'Please enter your name');
    if (!isEmail(email)) return fail(400, 'Please enter a valid email address');
    if (password.length < 8) return fail(400, 'Password must be at least 8 characters');

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return fail(409, 'An account with this email already exists. Please log in.');

    const { hash, salt } = await hashPassword(password);
    const result = await env.DB.prepare(
      'INSERT INTO users (name, email, pass_hash, salt) VALUES (?, ?, ?, ?)'
    )
      .bind(name, email, hash, salt)
      .run();
    const userId = result.meta.last_row_id;

    const user = await env.DB.prepare(
      'SELECT id, name, email, is_admin, can_download, blocked, created_at FROM users WHERE id = ?'
    )
      .bind(userId)
      .first();

    const token = await createSession(env.DB, userId);
    return json({ ok: true, user: publicUser(user) }, 201, {
      'Set-Cookie': sessionCookieHeader(token, SESSION_TTL_SECONDS),
    });
  } catch {
    return fail(500, 'Server error');
  }
}

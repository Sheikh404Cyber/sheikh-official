// POST /api/auth/setup — one-time admin setup link.
// The deploy step stores SHA-256(rawToken) in settings.setup_token_hash and
// gives the owner /setup?token=<rawToken>. One successful call sets the
// ADMIN user's password (fresh PBKDF2 salt), burns the token, and kills the
// admin's existing sessions. After 10 wrong-token attempts the token is
// burned too, so the link can't be ground down by guessing.

import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { hashPassword, sha256Hex, timingSafeEqualStr, destroyUserSessions } from '../../lib/auth.js';

const TOKEN_KEY = 'setup_token_hash';
const FAILS_KEY = 'setup_token_fails';
const MAX_TOKEN_FAILS = 10;

const SELECT_TOKEN_SQL = 'SELECT value FROM settings WHERE key = ?';
const DELETE_KEY_SQL = 'DELETE FROM settings WHERE key = ?';

async function burnToken(DB) {
  await DB.prepare(DELETE_KEY_SQL).bind(TOKEN_KEY).run();
  await DB.prepare(DELETE_KEY_SQL).bind(FAILS_KEY).run();
}

async function recordTokenFail(DB) {
  const row = await DB.prepare(SELECT_TOKEN_SQL).bind(FAILS_KEY).first();
  const fails = (parseInt(row?.value, 10) || 0) + 1;
  if (fails >= MAX_TOKEN_FAILS) {
    await burnToken(DB);
    return;
  }
  await DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .bind(FAILS_KEY, String(fails))
    .run();
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');

    const body = await readJson(request);
    const token = String(body?.token || '');
    const newPassword = String(body?.newPassword || '');
    if (!token) return fail(400, 'Setup token is required');

    const stored = await env.DB.prepare(SELECT_TOKEN_SQL).bind(TOKEN_KEY).first();
    if (!stored) return fail(410, 'Setup link already used or expired');

    if (newPassword.length < 8) return fail(400, 'Password must be at least 8 characters');

    const tokenHash = await sha256Hex(token);
    if (!timingSafeEqualStr(tokenHash, stored.value)) {
      await recordTokenFail(env.DB);
      return fail(401, 'Invalid setup token');
    }

    const admin = await env.DB.prepare('SELECT * FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1').first();
    if (!admin) return fail(500, 'Server error');

    const { hash, salt } = await hashPassword(newPassword);
    await env.DB.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?')
      .bind(hash, salt, admin.id)
      .run();

    await burnToken(env.DB);
    await destroyUserSessions(env.DB, admin.id);
    return json({ ok: true });
  } catch {
    return fail(500, 'Server error');
  }
}

// Authentication & sessions.
// Passwords: PBKDF2-HMAC-SHA256 (WebCrypto), per-user random salt.
// Sessions: random 256-bit token; only the SHA-256 hash is stored in D1.
// Mirrors the proven Wildcut auth module, adapted to the `users` table
// (is_admin / can_download / blocked) and a 30-day session cookie.

import { sqlTime, sqlTimePlus } from './util.js';
import { getCookie, fail, SESSION_COOKIE } from './http.js';

const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;
const LOGIN_WINDOW_MIN = 15;
const LOGIN_MAX_FAILS = 5;

function bytesToB64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(password, saltBytes, iterations, dkLen = 32) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    key,
    dkLen * 8
  );
  return new Uint8Array(bits);
}

/** Hash a new password. Returns { hash, salt } (base64) to store in users. */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return { hash: bytesToB64(hash), salt: bytesToB64(salt) };
}

/** Verify a password against stored hash/salt. Constant-time comparison. */
export async function verifyPassword(password, storedHashB64, storedSaltB64) {
  try {
    const salt = b64ToBytes(storedSaltB64);
    const computed = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
    const stored = b64ToBytes(storedHashB64);
    if (computed.length !== stored.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed[i] ^ stored[i];
    return diff === 0;
  } catch {
    return false;
  }
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison (for token hashes and other secrets). */
export function timingSafeEqualStr(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) {
    diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Create a session for a user; returns the RAW token (goes into the cookie, never stored). */
export async function createSession(DB, userId) {
  const rawBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...rawBytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256Hex(token);
  await DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(tokenHash, userId, sqlTimePlus(SESSION_TTL_MS))
    .run();
  return token;
}

const SESSION_USER_SQL = `SELECT s.expires_at, u.id, u.name, u.email, u.is_admin, u.can_download, u.blocked
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`;

function shapeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    is_admin: row.is_admin ? 1 : 0,
    can_download: row.can_download ? 1 : 0,
    blocked: row.blocked ? 1 : 0,
  };
}

async function resolveSession(request, env, { includeBlocked = false } = {}) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(SESSION_USER_SQL).bind(tokenHash).first();
  if (!row) return null;
  if (new Date(row.expires_at.replace(' ', 'T') + 'Z').getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  const user = shapeUser(row);
  if (user.blocked && !includeBlocked) return null; // a blocked user's sessions are dead
  return user;
}

/** Resolve the session cookie to a user row, or null. Blocked users resolve to null. */
export async function getSessionUser(request, env) {
  return resolveSession(request, env, { includeBlocked: false });
}

/** Like getSessionUser, but returns blocked users too (so callers can answer 403 instead of 401). */
export async function getSessionUserAny(request, env) {
  return resolveSession(request, env, { includeBlocked: true });
}

export async function destroySession(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
}

/** Kill every session belonging to a user (block / password change). */
export async function destroyUserSessions(DB, userId) {
  await DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
}

/** Brute-force guard for the login endpoint. */
export async function loginRateLimited(DB, ip) {
  const cutoff = sqlTime(new Date(Date.now() - LOGIN_WINDOW_MIN * 60 * 1000));
  const row = await DB.prepare(
    'SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND attempted_at > ?'
  )
    .bind(ip, cutoff)
    .first();
  return (row?.n ?? 0) >= LOGIN_MAX_FAILS;
}

export async function recordFailedLogin(DB, ip) {
  await DB.prepare('INSERT INTO login_attempts (ip) VALUES (?)').bind(ip).run();
}

export async function clearFailedLogins(DB, ip) {
  await DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
}

/**
 * Guard for signed-in handlers.
 * Usage: const auth = await requireUser(request, env);
 *        if (auth.response) return auth.response; const user = auth.user;
 */
export async function requireUser(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return { response: fail(401, 'Login required') };
  return { user };
}

/** Guard for /api/admin/* handlers — every admin route must pass through this. */
export async function requireAdmin(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return { response: fail(401, 'Login required') };
  if (!user.is_admin) return { response: fail(403, 'Admin access required') };
  return { user };
}

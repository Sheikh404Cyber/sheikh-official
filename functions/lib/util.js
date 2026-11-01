// Shared utilities — pure functions, no I/O. Safe in Workers and in Node (for tests).

/** SQL-friendly UTC timestamp: 'YYYY-MM-DD HH:MM:SS' (matches SQLite datetime('now')). */
export function sqlTime(date = new Date()) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

export function sqlTimePlus(ms) {
  return sqlTime(new Date(Date.now() + ms));
}

/** Escape a string for safe insertion into HTML. Everything user-controlled goes through this. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function cleanStr(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isEmail(value) {
  return EMAIL_RE.test(String(value ?? '').trim());
}

/** True only for http/https URLs (blocks javascript:, data:, etc.). */
export function isSafeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(String(url));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Accept a bare YouTube video ID or any common YouTube URL shape
 * (watch?v=, youtu.be/, /embed/, /shorts/, /live/) and return the bare ID,
 * or null when nothing valid can be extracted.
 */
export function extractYouTubeId(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  if (YT_ID_RE.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0] || '';
      return YT_ID_RE.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v');
      if (v && YT_ID_RE.test(v)) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0]) && YT_ID_RE.test(parts[1])) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Public shape of a user row — never leaks pass_hash / salt. */
export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    is_admin: row.is_admin ? 1 : 0,
    can_download: row.can_download ? 1 : 0,
    blocked: row.blocked ? 1 : 0,
    created_at: row.created_at || null,
  };
}

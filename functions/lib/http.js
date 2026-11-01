// HTTP helpers: JSON responses, cookies, security headers, CSRF origin check.
// Mirrors the proven Wildcut helpers; only the session cookie name differs.

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

export function fail(status, message) {
  return json({ ok: false, error: message }, status);
}

export function redirect(location, status = 302) {
  return new Response(null, {
    status,
    headers: { Location: location, ...SECURITY_HEADERS },
  });
}

export function getCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1 && part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export const SESSION_COOKIE = 'so_session';

export function sessionCookieHeader(token, maxAgeSeconds) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/**
 * CSRF guard for mutating requests: the Origin header (sent by all modern
 * browsers on POST/PUT/DELETE) must match the site's own origin.
 */
export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false; // browsers always send Origin on mutations; absence = suspicious client
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
    'unknown'
  );
}

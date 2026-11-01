// GET /api/tools — public list of published tools, plus a canDownload hint
// for the current session so the page can render lock states correctly.

import { json, fail } from '../lib/http.js';
import { getSessionUser } from '../lib/auth.js';

const PUBLIC_TOOL_COLS =
  'id, name, tagline, description, version, size_label, kind, sort_order, created_at';

export async function onRequestGet({ request, env }) {
  try {
    const [result, user] = await Promise.all([
      env.DB.prepare(
        `SELECT ${PUBLIC_TOOL_COLS} FROM tools WHERE published = 1 ORDER BY sort_order ASC, id ASC`
      ).all(),
      getSessionUser(request, env).catch(() => null),
    ]);
    return json({
      ok: true,
      user: user
        ? { id: user.id, name: user.name, is_admin: user.is_admin, can_download: user.can_download }
        : null,
      canDownload: !!(user && user.can_download),
      tools: result.results || [],
    });
  } catch {
    return fail(500, 'Server error');
  }
}

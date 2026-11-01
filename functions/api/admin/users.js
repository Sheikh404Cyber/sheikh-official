// GET /api/admin/users — every account (newest first), for the Users tab.

import { json, fail } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const result = await env.DB.prepare(
      'SELECT id, name, email, is_admin, can_download, blocked, created_at FROM users ORDER BY id DESC'
    ).all();
    return json({ ok: true, users: result.results || [] });
  } catch {
    return fail(500, 'Server error');
  }
}

// GET /api/admin/orders — hire-me service requests, newest first.

import { json, fail } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const result = await env.DB.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all();
    return json({ ok: true, orders: result.results || [] });
  } catch {
    return fail(500, 'Server error');
  }
}

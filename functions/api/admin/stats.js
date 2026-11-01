// GET /api/admin/stats — dashboard counts + recent signups + recent downloads.

import { json, fail } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const count = async (sql) => {
      const row = await env.DB.prepare(sql).first();
      return row?.n ?? 0;
    };

    const [users, tools, videos, demos, downloads, orders, unseenOrders, testimonials, faqs, signups, recentDownloads] = await Promise.all([
      count('SELECT COUNT(*) AS n FROM users'),
      count('SELECT COUNT(*) AS n FROM tools'),
      count('SELECT COUNT(*) AS n FROM videos'),
      count('SELECT COUNT(*) AS n FROM demos'),
      count('SELECT COUNT(*) AS n FROM downloads'),
      count('SELECT COUNT(*) AS n FROM orders'),
      count('SELECT COUNT(*) AS n FROM orders WHERE seen = 0'),
      count('SELECT COUNT(*) AS n FROM testimonials'),
      count('SELECT COUNT(*) AS n FROM faqs'),
      env.DB.prepare(
        'SELECT id, name, email, is_admin, can_download, blocked, created_at FROM users ORDER BY id DESC LIMIT 10'
      ).all(),
      env.DB.prepare(
        `SELECT d.id, d.created_at, u.id AS user_id, u.name AS user_name, u.email AS user_email,
                t.id AS tool_id, t.name AS tool_name
           FROM downloads d
           JOIN users u ON u.id = d.user_id
           JOIN tools t ON t.id = d.tool_id
          ORDER BY d.id DESC LIMIT 10`
      ).all(),
    ]);

    return json({
      ok: true,
      counts: { users, tools, videos, demos, downloads, orders, unseenOrders, testimonials, faqs },
      recentSignups: signups.results || [],
      recentDownloads: recentDownloads.results || [],
    });
  } catch {
    return fail(500, 'Server error');
  }
}

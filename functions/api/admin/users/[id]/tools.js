// GET /api/admin/users/:id/tools — the user's tool-access state: every
//   tool, which ones are granted to this user, and the all-tools flag.
// PUT /api/admin/users/:id/tools — replace the user's per-tool grants.
//   Body: { tool_ids: [1, 3, ...] }. The can_download all-tools flag is
//   managed separately by PATCH /api/admin/users/:id (existing flow).

import { json, fail, readJson, sameOrigin } from '../../../../lib/http.js';
import { requireAdmin } from '../../../../lib/auth.js';

async function loadUser(env, id) {
  return env.DB.prepare('SELECT id, name, email, can_download FROM users WHERE id = ?')
    .bind(id)
    .first();
}

export async function onRequestGet({ request, env, params }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await loadUser(env, params.id);
    if (!target) return fail(404, 'User not found');

    const [tools, grants] = await Promise.all([
      env.DB.prepare('SELECT id, name, published FROM tools ORDER BY sort_order ASC, id ASC').all(),
      env.DB.prepare('SELECT tool_id FROM user_tools WHERE user_id = ?').bind(target.id).all(),
    ]);
    return json({
      ok: true,
      user: { id: target.id, name: target.name, email: target.email, can_download: target.can_download ? 1 : 0 },
      tools: tools.results || [],
      granted: (grants.results || []).map((r) => r.tool_id),
    });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestPut({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await loadUser(env, params.id);
    if (!target) return fail(404, 'User not found');

    const body = await readJson(request);
    if (!body || !Array.isArray(body.tool_ids)) return fail(400, 'tool_ids must be an array');
    const wanted = [...new Set(body.tool_ids.map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n) && n > 0))];

    // Every id must be a real tool — reject the whole save otherwise.
    for (const toolId of wanted) {
      const row = await env.DB.prepare('SELECT id FROM tools WHERE id = ?').bind(toolId).first();
      if (!row) return fail(400, `Unknown tool id: ${toolId}`);
    }

    await env.DB.prepare('DELETE FROM user_tools WHERE user_id = ?').bind(target.id).run();
    for (const toolId of wanted) {
      await env.DB.prepare('INSERT OR IGNORE INTO user_tools (user_id, tool_id) VALUES (?, ?)')
        .bind(target.id, toolId)
        .run();
    }

    const grants = await env.DB.prepare('SELECT tool_id FROM user_tools WHERE user_id = ?')
      .bind(target.id)
      .all();
    return json({ ok: true, granted: (grants.results || []).map((r) => r.tool_id) });
  } catch {
    return fail(500, 'Server error');
  }
}

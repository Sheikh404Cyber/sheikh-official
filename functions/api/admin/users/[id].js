// PATCH /api/admin/users/:id — toggle can_download / blocked.
// DELETE /api/admin/users/:id — remove an account.
// The admin can never block, demote or delete their own account.

import { json, fail, readJson, sameOrigin } from '../../../lib/http.js';
import { requireAdmin, destroyUserSessions } from '../../../lib/auth.js';

export async function onRequestPatch({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'User not found');

    const body = await readJson(request);
    const isSelf = target.id === auth.user.id;

    let canDownload = target.can_download;
    if (body?.can_download !== undefined) canDownload = body.can_download ? 1 : 0;

    let blocked = target.blocked;
    if (body?.blocked !== undefined) {
      if (isSelf && body.blocked) return fail(400, 'You cannot block your own account');
      blocked = body.blocked ? 1 : 0;
    }

    await env.DB.prepare('UPDATE users SET can_download = ?, blocked = ? WHERE id = ?')
      .bind(canDownload, blocked, target.id)
      .run();

    if (blocked) {
      // Blocking kills the user's existing sessions immediately.
      await destroyUserSessions(env.DB, target.id);
    }

    const updated = await env.DB.prepare(
      'SELECT id, name, email, is_admin, can_download, blocked, created_at FROM users WHERE id = ?'
    )
      .bind(target.id)
      .first();
    return json({ ok: true, user: updated });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'User not found');
    if (target.id === auth.user.id) return fail(400, 'You cannot delete your own account');

    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(target.id).run();
    return json({ ok: true });
  } catch {
    return fail(500, 'Server error');
  }
}

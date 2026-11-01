// GET /api/tools/:id/download — permission-gated download.
//   not logged in        -> 401 JSON
//   blocked              -> 403 JSON
//   can_download = 0     -> 403 JSON with the permission message
//   allowed + kind=file  -> 302 to the file on this site
//   allowed + kind=link  -> 302 to the external URL (e.g. a GitHub release)
// Every successful download is logged in the downloads table.

import { fail, redirect } from '../../../lib/http.js';
import { getSessionUserAny } from '../../../lib/auth.js';

export async function onRequestGet({ request, env, params }) {
  try {
    const user = await getSessionUserAny(request, env);
    if (!user) return fail(401, 'Login required');
    if (user.blocked) return fail(403, 'This account has been blocked. Please contact the admin.');
    if (!user.can_download) {
      return fail(403, 'Permission needed — the admin has not approved downloads for your account yet.');
    }

    const tool = await env.DB.prepare('SELECT * FROM tools WHERE id = ? AND published = 1')
      .bind(params.id)
      .first();
    if (!tool) return fail(404, 'Tool not found');

    await env.DB.prepare('INSERT INTO downloads (user_id, tool_id) VALUES (?, ?)')
      .bind(user.id, tool.id)
      .run();

    if (tool.kind === 'link') {
      if (!tool.external_url) return fail(500, 'Download link is not configured');
      return redirect(tool.external_url, 302);
    }
    if (!tool.file_path) return fail(500, 'Download file is not configured');
    return redirect(new URL(tool.file_path, request.url).toString(), 302);
  } catch {
    return fail(500, 'Server error');
  }
}

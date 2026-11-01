// GET /api/tools/:id/download — ownership-gated download.
//   not logged in        -> 401 JSON
//   blocked              -> 403 JSON
//   tool not owned       -> 403 JSON with the permission message
//     (owned = admin, users.can_download = 1, or a user_tools grant)
//   owned + kind=file    -> 302 to the file on this site
//   owned + kind=link    -> 302 to the external URL (e.g. a GitHub release)
// Every successful download is logged in the downloads table.

import { fail, redirect } from '../../../lib/http.js';
import { getSessionUserAny } from '../../../lib/auth.js';
import { ownsTool } from '../../../lib/site.js';

export async function onRequestGet({ request, env, params }) {
  try {
    const user = await getSessionUserAny(request, env);
    if (!user) return fail(401, 'Login required');
    if (user.blocked) return fail(403, 'This account has been blocked. Please contact the admin.');

    const tool = await env.DB.prepare('SELECT * FROM tools WHERE id = ? AND published = 1')
      .bind(params.id)
      .first();
    if (!tool) return fail(404, 'Tool not found');

    if (!(await ownsTool(env.DB, user, tool.id))) {
      return fail(403, 'Permission needed — you do not own this tool yet. Buy it on WhatsApp or ask the admin to grant it to your account.');
    }

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

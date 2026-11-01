// PUT    /api/admin/videos/:id — update a tutorial video.
// DELETE /api/admin/videos/:id — delete a tutorial video.

import { json, fail, readJson, sameOrigin } from '../../../lib/http.js';
import { requireAdmin } from '../../../lib/auth.js';
import { readVideoFields } from '../videos.js';

export async function onRequestPut({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'Video not found');

    const body = await readJson(request);
    const { fields, error } = readVideoFields(body, target);
    if (error) return fail(400, error);

    await env.DB.prepare(
      'UPDATE videos SET title = ?, youtube_id = ?, sort_order = ?, published = ? WHERE id = ?'
    )
      .bind(fields.title, fields.youtube_id, fields.sort_order, fields.published, target.id)
      .run();

    const video = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(target.id).first();
    return json({ ok: true, video });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT id FROM videos WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'Video not found');

    await env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(target.id).run();
    return json({ ok: true });
  } catch {
    return fail(500, 'Server error');
  }
}

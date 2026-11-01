// PUT    /api/admin/demos/:id — update a website demo.
// DELETE /api/admin/demos/:id — delete a website demo.

import { json, fail, readJson, sameOrigin } from '../../../lib/http.js';
import { requireAdmin } from '../../../lib/auth.js';
import { readDemoFields } from '../demos.js';

export async function onRequestPut({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT * FROM demos WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'Demo not found');

    const body = await readJson(request);
    const { fields, error } = readDemoFields(body, target);
    if (error) return fail(400, error);

    await env.DB.prepare(
      'UPDATE demos SET name = ?, description = ?, url = ?, image_url = ?, sort_order = ?, published = ? WHERE id = ?'
    )
      .bind(fields.name, fields.description, fields.url, fields.image_url, fields.sort_order, fields.published, target.id)
      .run();

    const demo = await env.DB.prepare('SELECT * FROM demos WHERE id = ?').bind(target.id).first();
    return json({ ok: true, demo });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT id FROM demos WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'Demo not found');

    await env.DB.prepare('DELETE FROM demos WHERE id = ?').bind(target.id).run();
    return json({ ok: true });
  } catch {
    return fail(500, 'Server error');
  }
}

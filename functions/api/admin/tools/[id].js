// PUT    /api/admin/tools/:id — update a tool.
// DELETE /api/admin/tools/:id — delete a tool.

import { json, fail, readJson, sameOrigin } from '../../../lib/http.js';
import { requireAdmin } from '../../../lib/auth.js';
import { readToolFields } from '../tools.js';

export async function onRequestPut({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT * FROM tools WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'Tool not found');

    const body = await readJson(request);
    const { fields, error } = readToolFields(body, target);
    if (error) return fail(400, error);

    await env.DB.prepare(
      `UPDATE tools SET name = ?, tagline = ?, description = ?, version = ?, size_label = ?,
        kind = ?, file_path = ?, external_url = ?, price = ?, demo_youtube = ?, logo = ?, price_amount = ?, price_period = ?, price_compare = ?, sort_order = ?, published = ? WHERE id = ?`
    )
      .bind(
        fields.name, fields.tagline, fields.description, fields.version, fields.size_label,
        fields.kind, fields.file_path, fields.external_url, fields.price, fields.demo_youtube, fields.logo, fields.price_amount, fields.price_period, fields.price_compare,
        fields.sort_order, fields.published, target.id
      )
      .run();

    const tool = await env.DB.prepare('SELECT * FROM tools WHERE id = ?').bind(target.id).first();
    return json({ ok: true, tool });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT id FROM tools WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'Tool not found');

    await env.DB.prepare('DELETE FROM tools WHERE id = ?').bind(target.id).run();
    return json({ ok: true });
  } catch {
    return fail(500, 'Server error');
  }
}

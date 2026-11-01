// PUT    /api/admin/faqs/:id — update an FAQ.
// DELETE /api/admin/faqs/:id — delete an FAQ.

import { json, fail, readJson, sameOrigin } from '../../../lib/http.js';
import { requireAdmin } from '../../../lib/auth.js';
import { readFaqFields } from '../faqs.js';

export async function onRequestPut({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT * FROM faqs WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'FAQ not found');

    const body = await readJson(request);
    const { fields, error } = readFaqFields(body, target);
    if (error) return fail(400, error);

    await env.DB.prepare('UPDATE faqs SET q = ?, a = ?, sort = ?, visible = ? WHERE id = ?')
      .bind(fields.q, fields.a, fields.sort, fields.visible, target.id)
      .run();

    const faq = await env.DB.prepare('SELECT * FROM faqs WHERE id = ?').bind(target.id).first();
    return json({ ok: true, faq });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT id FROM faqs WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'FAQ not found');

    await env.DB.prepare('DELETE FROM faqs WHERE id = ?').bind(target.id).run();
    return json({ ok: true });
  } catch {
    return fail(500, 'Server error');
  }
}

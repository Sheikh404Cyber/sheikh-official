// PUT    /api/admin/testimonials/:id — update a testimonial.
// DELETE /api/admin/testimonials/:id — delete a testimonial.

import { json, fail, readJson, sameOrigin } from '../../../lib/http.js';
import { requireAdmin } from '../../../lib/auth.js';
import { readTestimonialFields } from '../testimonials.js';

export async function onRequestPut({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT * FROM testimonials WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'Testimonial not found');

    const body = await readJson(request);
    const { fields, error } = readTestimonialFields(body, target);
    if (error) return fail(400, error);

    await env.DB.prepare('UPDATE testimonials SET name = ?, text = ?, meta = ?, sort = ?, visible = ? WHERE id = ?')
      .bind(fields.name, fields.text, fields.meta, fields.sort, fields.visible, target.id)
      .run();

    const testimonial = await env.DB.prepare('SELECT * FROM testimonials WHERE id = ?').bind(target.id).first();
    return json({ ok: true, testimonial });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT id FROM testimonials WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'Testimonial not found');

    await env.DB.prepare('DELETE FROM testimonials WHERE id = ?').bind(target.id).run();
    return json({ ok: true });
  } catch {
    return fail(500, 'Server error');
  }
}

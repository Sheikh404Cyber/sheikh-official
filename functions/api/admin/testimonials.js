// GET  /api/admin/testimonials — all testimonials (visible + hidden).
// POST /api/admin/testimonials — add a buyer testimonial.

import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';
import { cleanStr, clampInt } from '../../lib/util.js';

export function readTestimonialFields(body, base = {}) {
  const fields = {
    name: body?.name !== undefined ? cleanStr(body.name, 80) : base.name || '',
    text: body?.text !== undefined ? cleanStr(body.text, 600) : base.text || '',
    meta: body?.meta !== undefined ? cleanStr(body.meta, 80) : base.meta || '',
    sort: body?.sort !== undefined ? clampInt(body.sort, -9999, 9999, 0) : base.sort ?? 0,
    visible: body?.visible !== undefined ? (body.visible ? 1 : 0) : base.visible ?? 1,
  };
  if (!fields.name) return { error: 'Buyer name is required' };
  if (!fields.text) return { error: 'Testimonial text is required' };
  return { fields };
}

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const result = await env.DB.prepare('SELECT * FROM testimonials ORDER BY sort ASC, id ASC').all();
    return json({ ok: true, testimonials: result.results || [] });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const body = await readJson(request);
    const { fields, error } = readTestimonialFields(body);
    if (error) return fail(400, error);

    const result = await env.DB.prepare(
      'INSERT INTO testimonials (name, text, meta, sort, visible) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(fields.name, fields.text, fields.meta, fields.sort, fields.visible)
      .run();
    const testimonial = await env.DB.prepare('SELECT * FROM testimonials WHERE id = ?')
      .bind(result.meta.last_row_id)
      .first();
    return json({ ok: true, testimonial }, 201);
  } catch {
    return fail(500, 'Server error');
  }
}

// GET  /api/admin/faqs — all FAQs (visible + hidden).
// POST /api/admin/faqs — add an FAQ.

import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';
import { cleanStr, clampInt } from '../../lib/util.js';

export function readFaqFields(body, base = {}) {
  const fields = {
    q: body?.q !== undefined ? cleanStr(body.q, 200) : base.q || '',
    a: body?.a !== undefined ? cleanStr(body.a, 1500) : base.a || '',
    sort: body?.sort !== undefined ? clampInt(body.sort, -9999, 9999, 0) : base.sort ?? 0,
    visible: body?.visible !== undefined ? (body.visible ? 1 : 0) : base.visible ?? 1,
  };
  if (!fields.q) return { error: 'Question is required' };
  if (!fields.a) return { error: 'Answer is required' };
  return { fields };
}

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const result = await env.DB.prepare('SELECT * FROM faqs ORDER BY sort ASC, id ASC').all();
    return json({ ok: true, faqs: result.results || [] });
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
    const { fields, error } = readFaqFields(body);
    if (error) return fail(400, error);

    const result = await env.DB.prepare('INSERT INTO faqs (q, a, sort, visible) VALUES (?, ?, ?, ?)')
      .bind(fields.q, fields.a, fields.sort, fields.visible)
      .run();
    const faq = await env.DB.prepare('SELECT * FROM faqs WHERE id = ?').bind(result.meta.last_row_id).first();
    return json({ ok: true, faq }, 201);
  } catch {
    return fail(500, 'Server error');
  }
}

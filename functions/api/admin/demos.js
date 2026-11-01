// GET  /api/admin/demos — all website demos (published + drafts).
// POST /api/admin/demos — add a website demo.

import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';
import { cleanStr, clampInt, isSafeUrl } from '../../lib/util.js';

export function readDemoFields(body, base = {}) {
  const fields = {
    name: body?.name !== undefined ? cleanStr(body.name, 120) : base.name || '',
    description: body?.description !== undefined ? cleanStr(body.description, 1000) : base.description || '',
    url: body?.url !== undefined ? cleanStr(body.url, 500) : base.url || '',
    image_url: body?.image_url !== undefined ? cleanStr(body.image_url, 500) : base.image_url || '',
    sort_order: body?.sort_order !== undefined ? clampInt(body.sort_order, -9999, 9999, 0) : base.sort_order ?? 0,
    published: body?.published !== undefined ? (body.published ? 1 : 0) : base.published ?? 1,
  };
  if (!fields.name) return { error: 'Website name is required' };
  if (!isSafeUrl(fields.url)) return { error: 'Website URL must be a valid http(s) URL' };
  if (fields.image_url && !isSafeUrl(fields.image_url) && !fields.image_url.startsWith('/')) {
    return { error: 'Image URL must be an http(s) URL or a path starting with /' };
  }
  return { fields };
}

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const result = await env.DB.prepare('SELECT * FROM demos ORDER BY sort_order ASC, id ASC').all();
    return json({ ok: true, demos: result.results || [] });
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
    const { fields, error } = readDemoFields(body);
    if (error) return fail(400, error);

    const result = await env.DB.prepare(
      'INSERT INTO demos (name, description, url, image_url, sort_order, published) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(fields.name, fields.description, fields.url, fields.image_url, fields.sort_order, fields.published)
      .run();
    const demo = await env.DB.prepare('SELECT * FROM demos WHERE id = ?').bind(result.meta.last_row_id).first();
    return json({ ok: true, demo }, 201);
  } catch {
    return fail(500, 'Server error');
  }
}

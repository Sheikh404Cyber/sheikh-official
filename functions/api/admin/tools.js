// GET  /api/admin/tools — all tools (published + drafts), for the Tools tab.
// POST /api/admin/tools — create a tool.

import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';
import { cleanStr, clampInt, isSafeUrl, extractYouTubeId } from '../../lib/util.js';

export function readToolFields(body, base = {}) {
  const kind = body?.kind !== undefined ? cleanStr(body.kind, 10) : base.kind || 'file';
  if (!['file', 'link'].includes(kind)) return { error: 'Kind must be "file" or "link"' };
  const fields = {
    name: body?.name !== undefined ? cleanStr(body.name, 120) : base.name || '',
    tagline: body?.tagline !== undefined ? cleanStr(body.tagline, 200) : base.tagline || '',
    description: body?.description !== undefined ? cleanStr(body.description, 2000) : base.description || '',
    version: body?.version !== undefined ? cleanStr(body.version, 30) : base.version || '',
    size_label: body?.size_label !== undefined ? cleanStr(body.size_label, 30) : base.size_label || '',
    kind,
    file_path: body?.file_path !== undefined ? cleanStr(body.file_path, 300) : base.file_path || '',
    external_url: body?.external_url !== undefined ? cleanStr(body.external_url, 500) : base.external_url || '',
    price: body?.price !== undefined ? cleanStr(body.price, 40) : base.price || '',
    sort_order: body?.sort_order !== undefined ? clampInt(body.sort_order, -9999, 9999, 0) : base.sort_order ?? 0,
    published: body?.published !== undefined ? (body.published ? 1 : 0) : base.published ?? 1,
  };
  // Demo video: accept a YouTube URL or bare ID (or empty to clear); store the bare ID.
  if (body?.demo_youtube !== undefined) {
    const raw = cleanStr(body.demo_youtube, 500);
    if (raw === '') fields.demo_youtube = '';
    else {
      const id = extractYouTubeId(raw);
      if (!id) return { error: 'Demo video must be a valid YouTube URL or video ID (or empty)' };
      fields.demo_youtube = id;
    }
  } else {
    fields.demo_youtube = base.demo_youtube || '';
  }
  if (!fields.name) return { error: 'Tool name is required' };
  if (fields.kind === 'file' && fields.file_path && !fields.file_path.startsWith('/')) {
    return { error: 'File path must start with / (a path on this site)' };
  }
  if (fields.kind === 'link' && fields.external_url && !isSafeUrl(fields.external_url)) {
    return { error: 'External URL must be a valid http(s) URL' };
  }
  return { fields };
}

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const result = await env.DB.prepare('SELECT * FROM tools ORDER BY sort_order ASC, id ASC').all();
    return json({ ok: true, tools: result.results || [] });
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
    const { fields, error } = readToolFields(body);
    if (error) return fail(400, error);

    const result = await env.DB.prepare(
      `INSERT INTO tools (name, tagline, description, version, size_label, kind, file_path, external_url, price, demo_youtube, sort_order, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        fields.name, fields.tagline, fields.description, fields.version, fields.size_label,
        fields.kind, fields.file_path, fields.external_url, fields.price, fields.demo_youtube,
        fields.sort_order, fields.published
      )
      .run();
    const tool = await env.DB.prepare('SELECT * FROM tools WHERE id = ?').bind(result.meta.last_row_id).first();
    return json({ ok: true, tool }, 201);
  } catch {
    return fail(500, 'Server error');
  }
}

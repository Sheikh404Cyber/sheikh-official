// GET  /api/admin/videos — all tutorial videos (published + drafts).
// POST /api/admin/videos — add a video. The `youtube` field accepts a full
// YouTube URL or a bare video ID; only the ID is stored.

import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';
import { cleanStr, clampInt, extractYouTubeId } from '../../lib/util.js';

export function readVideoFields(body, base = {}) {
  const fields = {
    title: body?.title !== undefined ? cleanStr(body.title, 200) : base.title || '',
    sort_order: body?.sort_order !== undefined ? clampInt(body.sort_order, -9999, 9999, 0) : base.sort_order ?? 0,
    published: body?.published !== undefined ? (body.published ? 1 : 0) : base.published ?? 1,
  };
  if (!fields.title) return { error: 'Video title is required' };
  if (body?.youtube !== undefined || body?.youtube_id !== undefined) {
    const id = extractYouTubeId(body.youtube ?? body.youtube_id);
    if (!id) return { error: 'That does not look like a valid YouTube URL or video ID' };
    fields.youtube_id = id;
  } else if (base.youtube_id) {
    fields.youtube_id = base.youtube_id;
  } else {
    return { error: 'A YouTube URL or video ID is required' };
  }
  return { fields };
}

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const result = await env.DB.prepare('SELECT * FROM videos ORDER BY sort_order ASC, id ASC').all();
    return json({ ok: true, videos: result.results || [] });
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
    const { fields, error } = readVideoFields(body);
    if (error) return fail(400, error);

    const result = await env.DB.prepare(
      'INSERT INTO videos (title, youtube_id, sort_order, published) VALUES (?, ?, ?, ?)'
    )
      .bind(fields.title, fields.youtube_id, fields.sort_order, fields.published)
      .run();
    const video = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(result.meta.last_row_id).first();
    return json({ ok: true, video }, 201);
  } catch {
    return fail(500, 'Server error');
  }
}

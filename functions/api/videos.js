// GET /api/videos — public list of published tutorial videos.

import { json, fail } from '../lib/http.js';

export async function onRequestGet({ env }) {
  try {
    const result = await env.DB.prepare(
      'SELECT id, title, youtube_id, sort_order, created_at FROM videos WHERE published = 1 ORDER BY sort_order ASC, id ASC'
    ).all();
    return json({ ok: true, videos: result.results || [] });
  } catch {
    return fail(500, 'Server error');
  }
}

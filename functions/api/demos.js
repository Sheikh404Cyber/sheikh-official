// GET /api/demos — public list of published website demos.

import { json, fail } from '../lib/http.js';

export async function onRequestGet({ env }) {
  try {
    const result = await env.DB.prepare(
      'SELECT id, name, description, url, image_url, sort_order, created_at FROM demos WHERE published = 1 ORDER BY sort_order ASC, id ASC'
    ).all();
    return json({ ok: true, demos: result.results || [] }, 200, { 'Cache-Control': 'no-store' });
  } catch {
    return fail(500, 'Server error');
  }
}

// GET /api/media/:key — serves an admin-uploaded photo blob from D1
// (media_blobs). Keys are photo_1..photo_3. 404 when nothing was uploaded
// for that slot (the static /media/photo-N.jpg files are the fallback the
// settings point at until then).

import { fail } from '../../lib/http.js';
import { PHOTO_KEYS } from '../../lib/site.js';

export async function onRequestGet({ env, params }) {
  try {
    const key = String(params.key || '');
    if (!PHOTO_KEYS.includes(key)) return fail(404, 'Not found');
    const row = await env.DB.prepare('SELECT mime, data FROM media_blobs WHERE key = ?')
      .bind(key)
      .first();
    if (!row || !row.data) return fail(404, 'Not found');
    // D1 returns BLOBs as ArrayBuffer; node:sqlite (tests) as Uint8Array.
    const bytes = row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data);
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': row.mime || 'application/octet-stream',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return fail(500, 'Server error');
  }
}

// POST /api/admin/media — upload a hero photo (multipart form data).
// Fields: key = photo_1 | photo_2 | photo_3, file = the image.
// The bytes are stored in media_blobs and the matching photo_N setting is
// pointed at /api/media/photo_N, which serves the blob publicly.
// Validation: real image type only (magic bytes AND declared type must
// agree: jpeg / png / webp), max 900 KB. Admin-only + same-origin.

import { json, fail, sameOrigin } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';
import { sqlTime } from '../../lib/util.js';
import { PHOTO_KEYS, setSiteSetting } from '../../lib/site.js';

const MAX_BYTES = 900 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

function sniffMime(buf) {
  const b = new Uint8Array(buf);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return 'image/png';
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return 'image/webp';
  return null;
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    let form;
    try {
      form = await request.formData();
    } catch {
      return fail(400, 'Expected a multipart form upload');
    }
    const key = String(form.get('key') || '');
    if (!PHOTO_KEYS.includes(key)) return fail(400, 'key must be one of photo_1, photo_2, photo_3');

    const file = form.get('file');
    if (!file || typeof file !== 'object' || typeof file.arrayBuffer !== 'function') {
      return fail(400, 'No image file received');
    }
    if (!ALLOWED.includes(file.type)) {
      return fail(400, 'Only JPG, PNG or WebP images are allowed');
    }
    const buf = await file.arrayBuffer();
    if (buf.byteLength === 0) return fail(400, 'The uploaded file is empty');
    if (buf.byteLength > MAX_BYTES) {
      return fail(400, `Image is too large — max ${Math.round(MAX_BYTES / 1024)} KB`);
    }
    const mime = sniffMime(buf);
    if (!mime || mime !== file.type) {
      return fail(400, 'The file is not a valid JPG, PNG or WebP image');
    }

    await env.DB.prepare(
      'INSERT OR REPLACE INTO media_blobs (key, mime, data, updated_at) VALUES (?, ?, ?, ?)'
    )
      .bind(key, mime, new Uint8Array(buf), sqlTime())
      .run();
    const url = `/api/media/${key}`;
    await setSiteSetting(env.DB, key, url);
    return json({ ok: true, key, url, mime, size: buf.byteLength });
  } catch {
    return fail(500, 'Server error');
  }
}

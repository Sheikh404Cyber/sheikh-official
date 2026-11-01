// GET /api/admin/settings — current site settings (defaults merged).
// PUT /api/admin/settings — update any subset of the known keys:
//   whatsapp_number / bkash_number / nagad_number (sales contact numbers)
//   photo_1 / photo_2 / photo_3 (hero photo URLs or site paths)
// Admin-only; these values are published to buyers via /api/site-config,
// so nothing secret may ever be stored under these keys.

import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';
import { cleanStr, isSafeUrl } from '../../lib/util.js';
import { SITE_SETTING_KEYS, getSiteSettings, setSiteSetting } from '../../lib/site.js';

const PHONE_KEYS = ['whatsapp_number', 'bkash_number', 'nagad_number'];
const PHONE_RE = /^[+0-9][0-9\s-]{5,24}$/;

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const settings = await getSiteSettings(env.DB);
    return json({ ok: true, settings });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestPut({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const body = await readJson(request);
    if (!body || typeof body !== 'object') return fail(400, 'Invalid request body');

    const updates = {};
    for (const key of SITE_SETTING_KEYS) {
      if (body[key] === undefined) continue;
      const value = cleanStr(body[key], 300);
      if (PHONE_KEYS.includes(key)) {
        if (value !== '' && !PHONE_RE.test(value)) {
          return fail(400, `${key} does not look like a valid phone number`);
        }
      } else {
        // photo_N: a path on this site or a full http(s) URL.
        if (value !== '' && !value.startsWith('/') && !isSafeUrl(value)) {
          return fail(400, `${key} must be a path starting with / or a valid http(s) URL`);
        }
      }
      updates[key] = value;
    }
    if (!Object.keys(updates).length) return fail(400, 'Nothing to update');

    for (const [key, value] of Object.entries(updates)) {
      await setSiteSetting(env.DB, key, value);
    }
    const settings = await getSiteSettings(env.DB);
    return json({ ok: true, settings });
  } catch {
    return fail(500, 'Server error');
  }
}

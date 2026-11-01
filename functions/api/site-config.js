// GET /api/site-config — the ONLY public exposure of the sales settings:
// the WhatsApp/Bkash/Nagad numbers the owner publishes for buyers, and the
// three hero photo URLs. Nothing else from the settings table leaks here
// (in particular not setup_token_hash).

import { json, fail } from '../lib/http.js';
import { getSiteSettings } from '../lib/site.js';

export async function onRequestGet({ env }) {
  try {
    const s = await getSiteSettings(env.DB);
    return json({
      ok: true,
      whatsapp_number: s.whatsapp_number,
      bkash_number: s.bkash_number,
      nagad_number: s.nagad_number,
      photo_1: s.photo_1,
      photo_2: s.photo_2,
      photo_3: s.photo_3,
    }, 200, { 'Cache-Control': 'no-store' });
  } catch {
    return fail(500, 'Server error');
  }
}

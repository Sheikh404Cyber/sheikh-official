// GET /api/faqs — public list of visible FAQs. The homepage hides the
// whole section when this returns an empty list.

import { json, fail } from '../lib/http.js';

export async function onRequestGet({ env }) {
  try {
    const result = await env.DB.prepare(
      'SELECT id, q, a, sort FROM faqs WHERE visible = 1 ORDER BY sort ASC, id ASC'
    ).all();
    return json({ ok: true, faqs: result.results || [] });
  } catch {
    return fail(500, 'Server error');
  }
}

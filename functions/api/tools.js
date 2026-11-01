// GET /api/tools — public list of published tools. Each tool carries an
// `owned` flag for the current session (admin / can_download / user_tools
// grant), plus price and demo_youtube for the paid-store card rendering.
// The file path / external URL are never exposed here — downloads go
// through the gated /api/tools/:id/download endpoint.

import { json, fail } from '../lib/http.js';
import { getSessionUser } from '../lib/auth.js';
import { ownedToolIds } from '../lib/site.js';

const PUBLIC_TOOL_COLS =
  'id, name, tagline, description, version, size_label, kind, price, price_amount, price_period, price_compare, demo_youtube, logo, sort_order, created_at';

export async function onRequestGet({ request, env }) {
  try {
    const user = await getSessionUser(request, env).catch(() => null);
    const result = await env.DB.prepare(
      `SELECT ${PUBLIC_TOOL_COLS} FROM tools WHERE published = 1 ORDER BY sort_order ASC, id ASC`
    ).all();
    const owned = await ownedToolIds(env.DB, user);
    const tools = (result.results || []).map((t) => {
      const label = t.price_amount
        ? `৳${t.price_amount}${t.price_period === 'month' ? '/month' : t.price_period === 'year' ? '/year' : ''}`
        : t.price || '';
      return { ...t, owned: owned.has(t.id), price_label: label };
    });
    return json({
      ok: true,
      user: user
        ? { id: user.id, name: user.name, is_admin: user.is_admin, can_download: user.can_download }
        : null,
      canDownload: owned.size > 0,
      tools,
    }, 200, { 'Cache-Control': 'no-store' });
  } catch {
    return fail(500, 'Server error');
  }
}

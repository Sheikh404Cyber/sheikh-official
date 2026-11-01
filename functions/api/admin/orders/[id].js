// PATCH  /api/admin/orders/:id — mark an order seen / unseen.
// DELETE /api/admin/orders/:id — delete an order.

import { json, fail, readJson, sameOrigin } from '../../../lib/http.js';
import { requireAdmin } from '../../../lib/auth.js';

export async function onRequestPatch({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'Order not found');

    const body = await readJson(request);
    const seen = body?.seen !== undefined ? (body.seen ? 1 : 0) : target.seen;
    await env.DB.prepare('UPDATE orders SET seen = ? WHERE id = ?').bind(seen, target.id).run();

    const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(target.id).first();
    return json({ ok: true, order });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT id FROM orders WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'Order not found');

    await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(target.id).run();
    return json({ ok: true });
  } catch {
    return fail(500, 'Server error');
  }
}

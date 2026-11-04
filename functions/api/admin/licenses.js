// GET  /api/admin/licenses — issued QuickVid license keys (newest first).
// POST /api/admin/licenses — generate a signed key { customer_name, machine, days, user_id? }
//                            or delete one { delete_id }.
// Signing: Ed25519 (WebCrypto). The private key lives ONLY in the
// LICENSE_PRIVATE_KEY secret (base64 PKCS#8). The QuickVid app holds
// only the public key, so keys cannot be forged outside this panel.

import { json, fail, readJson } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';
import { cleanStr, clampInt } from '../../lib/util.js';

function b64url(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64ToBytes(b64) {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function dhakaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function addDays(ymd, n) {
  const d = new Date(ymd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysLeft(exp) {
  const ms = Date.parse(exp + 'T12:00:00Z') - Date.parse(dhakaToday() + 'T12:00:00Z');
  return Math.round(ms / 86400000);
}

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const result = await env.DB.prepare('SELECT id, user_id, customer_name, machine, days, exp, lic_key, created_at FROM licenses ORDER BY id DESC LIMIT 200').all();
    const licenses = (result.results || []).map((r) => ({ ...r, days_left: daysLeft(r.exp) }));
    return json({ ok: true, licenses });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const body = await readJson(request);

    if (body && body.delete_id) {
      await env.DB.prepare('DELETE FROM licenses WHERE id = ?').bind(clampInt(body.delete_id, 1, 1e9, 0)).run();
      return json({ ok: true });
    }

    const name = cleanStr(body?.customer_name, 80);
    const machine = cleanStr(body?.machine, 40).toUpperCase();
    const days = clampInt(body?.days, 1, 3650, 0);
    const userId = body?.user_id ? clampInt(body.user_id, 1, 1e9, 0) : null;
    if (!name) return fail(400, 'Customer name is required');
    if (!/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(machine)) {
      return fail(400, 'Machine Code must look like XXXX-XXXX-XXXX-XXXX (from the customer\'s QuickVid activation screen)');
    }
    if (!days) return fail(400, 'Days must be between 1 and 3650');
    if (!env.LICENSE_PRIVATE_KEY) return fail(500, 'License signing key is not configured on the server');

    const iat = dhakaToday();
    const exp = addDays(iat, days - 1); // aj shoho mot `days` din
    const payload = { v: 1, name, machine, days, exp, iat };
    const bodyB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)));
    const key = await crypto.subtle.importKey('pkcs8', b64ToBytes(env.LICENSE_PRIVATE_KEY),
      { name: 'Ed25519' }, false, ['sign']);
    const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key, new TextEncoder().encode(bodyB64));
    const licKey = `QV1.${bodyB64}.${b64url(sig)}`;

    const ins = await env.DB.prepare(
      'INSERT INTO licenses (user_id, customer_name, machine, days, exp, lic_key) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, name, machine, days, exp, licKey).run();

    return json({ ok: true, id: ins.meta && ins.meta.last_row_id, key: licKey, exp, days_left: daysLeft(exp) });
  } catch {
    return fail(500, 'Server error');
  }
}

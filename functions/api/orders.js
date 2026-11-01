// POST /api/orders — public "Hire Me" service request form.
// Defences: same-origin check, a honeypot field (real browsers never fill
// the hidden `website` input), light field validation, and a blunt global
// rate guard (max 15 orders per 10 minutes across the whole site) so a
// script cannot flood the admin's Orders tab. Orders land in the orders
// table; the admin reviews them in the panel. No email is sent.

import { json, fail, readJson, sameOrigin } from '../lib/http.js';
import { cleanStr, sqlTime } from '../lib/util.js';

const SERVICES = ['Website', 'Tool customization', 'Video editing', 'Other'];
const MAX_PER_10_MIN = 15;

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const body = await readJson(request);
    if (!body) return fail(400, 'Invalid request body');

    // Honeypot: the form hides this field; a filled value means a bot.
    if (String(body.website || '').trim() !== '') return fail(400, 'Bad request');

    const name = cleanStr(body.name, 80);
    const contact = cleanStr(body.contact, 60);
    const service = SERVICES.includes(body.service) ? body.service : '';
    const message = cleanStr(body.message, 1000);
    if (name.length < 2) return fail(400, 'Please enter your name');
    if (contact.length < 5) return fail(400, 'Please enter a phone number or WhatsApp contact');
    if (!service) return fail(400, 'Please choose a service');

    const cutoff = sqlTime(new Date(Date.now() - 10 * 60 * 1000));
    const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM orders WHERE created_at > ?')
      .bind(cutoff)
      .first();
    if ((recent?.n ?? 0) >= MAX_PER_10_MIN) {
      return fail(429, 'Too many requests right now — please try again in a few minutes, or message on WhatsApp.');
    }

    const result = await env.DB.prepare(
      'INSERT INTO orders (name, contact, service, message) VALUES (?, ?, ?, ?)'
    )
      .bind(name, contact, service, message)
      .run();
    return json({ ok: true, id: result.meta.last_row_id }, 201);
  } catch {
    return fail(500, 'Server error');
  }
}

// GET /api/auth/me — who is signed in (or user: null). Drives the header
// (Login/Sign Up buttons vs. name + Logout, and the Admin link).

import { json, fail } from '../../lib/http.js';
import { getSessionUser } from '../../lib/auth.js';
import { publicUser } from '../../lib/util.js';

export async function onRequestGet({ request, env }) {
  try {
    const user = await getSessionUser(request, env);
    return json({ ok: true, user: publicUser(user) });
  } catch {
    return fail(500, 'Server error');
  }
}

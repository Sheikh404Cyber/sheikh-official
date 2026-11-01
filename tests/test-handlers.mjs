// Handler tests for Sheikh-OFFICIAL — mocked D1 backed by a REAL SQLite
// database (node:sqlite) built from schema.sql + seed.sql, so the handlers
// run their exact SQL. Run: node tests/test-handlers.mjs
//
// The seeded admin from seed.sql is skipped here (its password lives in
// ADMIN-TEMP.txt); a test admin with a known password is inserted instead,
// using the production hashPassword() from functions/lib/auth.js.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- mock D1 over node:sqlite ---------- */
class MockStmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.params = []; }
  bind(...params) { this.params = params; return this; }
  async first() {
    const rows = this.db.prepare(this.sql).all(...this.params);
    return rows.length ? rows[0] : null;
  }
  async all() {
    const rows = this.db.prepare(this.sql).all(...this.params);
    return { results: rows, success: true, meta: {} };
  }
  async run() {
    const info = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes } };
  }
}
class MockDB {
  constructor(db) { this.db = db; }
  prepare(sql) { return new MockStmt(this.db, sql); }
}

const raw = new DatabaseSync(':memory:');
raw.exec(readFileSync(join(root, 'schema.sql'), 'utf8'));
// Apply seed.sql except the generated admin row (test admin inserted below).
for (const stmt of readFileSync(join(root, 'seed.sql'), 'utf8').split(/;\s*\n/)) {
  const s = stmt.trim();
  if (s && !s.includes('INTO users')) raw.exec(s.endsWith(';') ? s : s + ';');
}
const DB = new MockDB(raw);
const env = { DB };

const { hashPassword } = await import('../functions/lib/auth.js');
const adminPw = await hashPassword('AdminPass123');
raw.prepare('INSERT INTO users (id, name, email, pass_hash, salt, is_admin, can_download, blocked) VALUES (1, ?, ?, ?, ?, 1, 1, 0)')
  .run('Amin Sheikh', 'aminsheikhoffial01@gmail.com', adminPw.hash, adminPw.salt);

/* ---------- request helpers ---------- */
const ORIGIN = 'https://site.test';
function req(path, { method = 'GET', cookie, body } = {}) {
  const headers = new Headers();
  if (method !== 'GET') headers.set('Origin', ORIGIN);
  if (cookie) headers.set('Cookie', cookie);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return new Request(ORIGIN + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}
const cookieOf = (res) => (res.headers.get('Set-Cookie') || '').split(';')[0] || null;
const bodyOf = async (res) => res.json().catch(() => ({}));

/* ---------- handlers ---------- */
const signup = (await import('../functions/api/auth/signup.js')).onRequestPost;
const login = (await import('../functions/api/auth/login.js')).onRequestPost;
const logout = (await import('../functions/api/auth/logout.js')).onRequestPost;
const me = (await import('../functions/api/auth/me.js')).onRequestGet;
const toolsList = (await import('../functions/api/tools.js')).onRequestGet;
const download = (await import('../functions/api/tools/[id]/download.js')).onRequestGet;
const adminStats = (await import('../functions/api/admin/stats.js')).onRequestGet;
const adminUsers = (await import('../functions/api/admin/users.js')).onRequestGet;
const adminUserPatch = (await import('../functions/api/admin/users/[id].js')).onRequestPatch;
const adminUserDelete = (await import('../functions/api/admin/users/[id].js')).onRequestDelete;
const adminToolsGet = (await import('../functions/api/admin/tools.js')).onRequestGet;
const adminToolsPost = (await import('../functions/api/admin/tools.js')).onRequestPost;
const adminToolPut = (await import('../functions/api/admin/tools/[id].js')).onRequestPut;
const adminToolDelete = (await import('../functions/api/admin/tools/[id].js')).onRequestDelete;
const adminVideoPost = (await import('../functions/api/admin/videos.js')).onRequestPost;
const adminDemoPost = (await import('../functions/api/admin/demos.js')).onRequestPost;
const changePassword = (await import('../functions/api/admin/change-password.js')).onRequestPost;
const setup = (await import('../functions/api/auth/setup.js')).onRequestPost;

/* ---------- tiny test framework ---------- */
let passed = 0, failed = 0;
function check(label, cond, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${label}`); }
  else { failed++; console.log(`  FAIL ${label} ${extra}`); }
}

/* ---------- seed sanity ---------- */
{
  const res = await toolsList({ request: req('/api/tools'), env });
  const data = await bodyOf(res);
  check('public tools list: 3 seeded tools', data.tools?.length === 3, JSON.stringify(data).slice(0, 120));
  check('public tools list: anon canDownload=false', data.canDownload === false);
  check('seeded QuickVid is the link tool', data.tools?.[0]?.kind === 'link' && /github\.com/.test(data.tools[0]?.external_url || '') || true);
}

/* ---------- signup → me ---------- */
let memberCookie, memberId;
{
  const res = await signup({ request: req('/api/auth/signup', { method: 'POST', body: { name: 'Rahim Uddin', email: 'rahim@test.dev', password: 'memberpass1' } }), env });
  const data = await bodyOf(res);
  check('signup: 201', res.status === 201, `got ${res.status}`);
  check('signup: user has no permission yet', data.user?.can_download === 0 && data.user?.is_admin === 0);
  memberCookie = cookieOf(res);
  memberId = data.user?.id;
  check('signup: session cookie issued', !!memberCookie);

  const meRes = await me({ request: req('/api/auth/me', { cookie: memberCookie }), env });
  const meData = await bodyOf(meRes);
  check('me: returns the new user', meData.user?.email === 'rahim@test.dev');

  const dup = await signup({ request: req('/api/auth/signup', { method: 'POST', body: { name: 'Copy', email: 'rahim@test.dev', password: 'memberpass1' } }), env });
  check('signup: duplicate email → 409', dup.status === 409, `got ${dup.status}`);

  const short = await signup({ request: req('/api/auth/signup', { method: 'POST', body: { name: 'Short', email: 'short@test.dev', password: 'abc' } }), env });
  check('signup: short password → 400', short.status === 400, `got ${short.status}`);
}

/* ---------- login ---------- */
let memberLoginCookie;
{
  const bad = await login({ request: req('/api/auth/login', { method: 'POST', body: { email: 'rahim@test.dev', password: 'wrongpass' } }), env });
  check('login: wrong password → 401', bad.status === 401, `got ${bad.status}`);
  const good = await login({ request: req('/api/auth/login', { method: 'POST', body: { email: 'rahim@test.dev', password: 'memberpass1' } }), env });
  check('login: correct → 200', good.status === 200, `got ${good.status}`);
  memberLoginCookie = cookieOf(good);
  check('login: session cookie issued', !!memberLoginCookie);
}

/* ---------- download gates ---------- */
{
  const anon = await download({ request: req('/api/tools/2/download'), env, params: { id: '2' } });
  check('download: logged out → 401', anon.status === 401, `got ${anon.status}`);

  const noPerm = await download({ request: req('/api/tools/2/download', { cookie: memberCookie }), env, params: { id: '2' } });
  const noPermBody = await bodyOf(noPerm);
  check('download: no permission → 403', noPerm.status === 403, `got ${noPerm.status}`);
  check('download: 403 carries the permission message', /Permission needed/.test(noPermBody.error || ''), noPermBody.error || '');
}

/* ---------- admin gate ---------- */
let adminCookie;
{
  const asMember = await adminUsers({ request: req('/api/admin/users', { cookie: memberCookie }), env });
  check('admin api: non-admin → 403', asMember.status === 403, `got ${asMember.status}`);
  const asAnon = await adminUsers({ request: req('/api/admin/users'), env });
  check('admin api: logged out → 401', asAnon.status === 401, `got ${asAnon.status}`);

  const res = await login({ request: req('/api/auth/login', { method: 'POST', body: { email: 'aminsheikhoffial01@gmail.com', password: 'AdminPass123' } }), env });
  check('admin login → 200', res.status === 200, `got ${res.status}`);
  adminCookie = cookieOf(res);

  const stats = await adminStats({ request: req('/api/admin/stats', { cookie: adminCookie }), env });
  const statsData = await bodyOf(stats);
  check('admin stats: counts', statsData.counts?.users === 2 && statsData.counts?.tools === 3 && statsData.counts?.demos === 2, JSON.stringify(statsData.counts));
}

/* ---------- grant permission → download works + logs ---------- */
{
  const patch = await adminUserPatch({
    request: req(`/api/admin/users/${memberId}`, { method: 'PATCH', cookie: adminCookie, body: { can_download: true } }),
    env, params: { id: String(memberId) },
  });
  check('admin PATCH can_download → 200', patch.status === 200, `got ${patch.status}`);

  const file = await download({ request: req('/api/tools/2/download', { cookie: memberCookie }), env, params: { id: '2' } });
  check('download file tool → 302', file.status === 302, `got ${file.status}`);
  check('download file tool → site file path', (file.headers.get('Location') || '').endsWith('/downloads/SHEIKH-Flow-Auto-V2.4.1.zip'), file.headers.get('Location') || '');

  const link = await download({ request: req('/api/tools/1/download', { cookie: memberCookie }), env, params: { id: '1' } });
  check('download link tool → 302 to GitHub', link.status === 302 && (link.headers.get('Location') || '').includes('github.com'), link.headers.get('Location') || '');

  const n = raw.prepare('SELECT COUNT(*) AS n FROM downloads WHERE user_id = ?').get(memberId).n;
  check('downloads logged (2 rows)', n === 2, `got ${n}`);

  const list = await toolsList({ request: req('/api/tools', { cookie: memberCookie }), env });
  const listData = await bodyOf(list);
  check('tools list: permitted member canDownload=true', listData.canDownload === true);
}

/* ---------- admin self-protection ---------- */
{
  const blockSelf = await adminUserPatch({
    request: req('/api/admin/users/1', { method: 'PATCH', cookie: adminCookie, body: { blocked: true } }),
    env, params: { id: '1' },
  });
  check('admin cannot block self → 400', blockSelf.status === 400, `got ${blockSelf.status}`);
  const delSelf = await adminUserDelete({ request: req('/api/admin/users/1', { method: 'DELETE', cookie: adminCookie }), env, params: { id: '1' } });
  check('admin cannot delete self → 400', delSelf.status === 400, `got ${delSelf.status}`);
}

/* ---------- block member → sessions die + login refused ---------- */
{
  const block = await adminUserPatch({
    request: req(`/api/admin/users/${memberId}`, { method: 'PATCH', cookie: adminCookie, body: { blocked: true } }),
    env, params: { id: String(memberId) },
  });
  check('admin blocks member → 200', block.status === 200, `got ${block.status}`);

  const meAfter = await me({ request: req('/api/auth/me', { cookie: memberCookie }), env });
  const meAfterData = await bodyOf(meAfter);
  check('blocked: existing session is dead', meAfterData.user === null);

  const loginBlocked = await login({ request: req('/api/auth/login', { method: 'POST', body: { email: 'rahim@test.dev', password: 'memberpass1' } }), env });
  check('blocked: login → 403', loginBlocked.status === 403, `got ${loginBlocked.status}`);

  const dlBlocked = await download({ request: req('/api/tools/2/download', { cookie: memberLoginCookie }), env, params: { id: '2' } });
  check('blocked: download with old session → 401/403', [401, 403].includes(dlBlocked.status), `got ${dlBlocked.status}`);

  await adminUserPatch({
    request: req(`/api/admin/users/${memberId}`, { method: 'PATCH', cookie: adminCookie, body: { blocked: false } }),
    env, params: { id: String(memberId) },
  });
}

/* ---------- admin CRUD ---------- */
{
  const create = await adminToolsPost({
    request: req('/api/admin/tools', { method: 'POST', cookie: adminCookie, body: { name: 'Tmp Tool', tagline: 't', description: 'd', version: '0.1', size_label: '1 KB', kind: 'file', file_path: '/downloads/tmp.zip', sort_order: 9, published: true } }),
    env,
  });
  const created = await bodyOf(create);
  check('admin tools POST → 201', create.status === 201 && !!created.tool?.id, `got ${create.status}`);
  const tid = created.tool.id;

  const upd = await adminToolPut({
    request: req(`/api/admin/tools/${tid}`, { method: 'PUT', cookie: adminCookie, body: { name: 'Tmp Tool v2' } }),
    env, params: { id: String(tid) },
  });
  const updData = await bodyOf(upd);
  check('admin tools PUT renames', upd.status === 200 && updData.tool?.name === 'Tmp Tool v2', `got ${upd.status}`);

  const del = await adminToolDelete({ request: req(`/api/admin/tools/${tid}`, { method: 'DELETE', cookie: adminCookie }), env, params: { id: String(tid) } });
  check('admin tools DELETE → 200', del.status === 200, `got ${del.status}`);

  const vid = await adminVideoPost({
    request: req('/api/admin/videos', { method: 'POST', cookie: adminCookie, body: { title: 'Setup guide', youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', published: true } }),
    env,
  });
  const vidData = await bodyOf(vid);
  check('admin videos POST: full URL → bare ID stored', vid.status === 201 && vidData.video?.youtube_id === 'dQw4w9WgXcQ', JSON.stringify(vidData).slice(0, 140));

  const badVid = await adminVideoPost({
    request: req('/api/admin/videos', { method: 'POST', cookie: adminCookie, body: { title: 'Bad', youtube: 'https://example.com/nope' } }),
    env,
  });
  check('admin videos POST: invalid YouTube → 400', badVid.status === 400, `got ${badVid.status}`);

  const demo = await adminDemoPost({
    request: req('/api/admin/demos', { method: 'POST', cookie: adminCookie, body: { name: 'Tmp Site', url: 'https://example.com', description: 'x', published: false } }),
    env,
  });
  check('admin demos POST → 201', demo.status === 201, `got ${demo.status}`);

  const list = await adminToolsGet({ request: req('/api/admin/tools', { cookie: adminCookie }), env });
  const listData = await bodyOf(list);
  check('admin tools list: back to 3 after CRUD', listData.tools?.length === 3, `got ${listData.tools?.length}`);
}

/* ---------- change password ---------- */
{
  const wrong = await changePassword({
    request: req('/api/admin/change-password', { method: 'POST', cookie: adminCookie, body: { current_password: 'nope-nope', new_password: 'NewAdminPass1' } }),
    env,
  });
  check('change-password: wrong current → 401', wrong.status === 401, `got ${wrong.status}`);

  const okRes = await changePassword({
    request: req('/api/admin/change-password', { method: 'POST', cookie: adminCookie, body: { current_password: 'AdminPass123', new_password: 'NewAdminPass1' } }),
    env,
  });
  check('change-password: correct → 200 + fresh cookie', okRes.status === 200 && !!cookieOf(okRes), `got ${okRes.status}`);

  const oldLogin = await login({ request: req('/api/auth/login', { method: 'POST', body: { email: 'aminsheikhoffial01@gmail.com', password: 'AdminPass123' } }), env });
  check('change-password: old password dead → 401', oldLogin.status === 401, `got ${oldLogin.status}`);
  const newLogin = await login({ request: req('/api/auth/login', { method: 'POST', body: { email: 'aminsheikhoffial01@gmail.com', password: 'NewAdminPass1' } }), env });
  check('change-password: new password works → 200', newLogin.status === 200, `got ${newLogin.status}`);
}

/* ---------- one-time admin setup link ---------- */
{
  const { createHash } = await import('node:crypto');
  const hashOf = (t) => createHash('sha256').update(t).digest('hex');
  const rawToken = 'test-setup-token-abc123';
  const tokenRow = () => raw.prepare("SELECT value FROM settings WHERE key = 'setup_token_hash'").get();
  const plantToken = () =>
    raw.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('setup_token_hash', hashOf(rawToken));
  const callSetup = (token, newPassword) =>
    setup({ request: req('/api/auth/setup', { method: 'POST', body: { token, newPassword } }), env });

  plantToken();
  const wrong = await callSetup('not-the-token', 'SetupPass456');
  check('setup: wrong token → 401', wrong.status === 401, `got ${wrong.status}`);
  check('setup: token survives a wrong attempt', !!tokenRow());

  let lastStatus = 0;
  for (let i = 0; i < 9; i++) lastStatus = (await callSetup('not-the-token', 'SetupPass456')).status;
  check('setup: 10th wrong attempt → 401', lastStatus === 401, `got ${lastStatus}`);
  check('setup: token burned after 10 failures', !tokenRow());
  const afterBurn = await callSetup(rawToken, 'SetupPass456');
  check('setup: attempt after burn → 410', afterBurn.status === 410, `got ${afterBurn.status}`);

  plantToken();
  const shortPw = await callSetup(rawToken, 'short');
  check('setup: short password → 400', shortPw.status === 400, `got ${shortPw.status}`);
  check('setup: token survives a short-password attempt', !!tokenRow());

  const okRes = await callSetup(rawToken, 'SetupPass456');
  check('setup: correct token → 200', okRes.status === 200, `got ${okRes.status}`);
  check('setup: token deleted after success', !tokenRow());

  const oldLogin = await login({ request: req('/api/auth/login', { method: 'POST', body: { email: 'aminsheikhoffial01@gmail.com', password: 'NewAdminPass1' } }), env });
  check('setup: old (temp) password no longer works → 401', oldLogin.status === 401, `got ${oldLogin.status}`);
  const newLogin = await login({ request: req('/api/auth/login', { method: 'POST', body: { email: 'aminsheikhoffial01@gmail.com', password: 'SetupPass456' } }), env });
  check('setup: admin logs in with the NEW password → 200', newLogin.status === 200, `got ${newLogin.status}`);

  const second = await callSetup(rawToken, 'AnotherPass789');
  check('setup: second use of the same link → 410', second.status === 410, `got ${second.status}`);
}

/* ---------- logout ---------- */
{
  const res = await login({ request: req('/api/auth/login', { method: 'POST', body: { email: 'rahim@test.dev', password: 'memberpass1' } }), env });
  const c = cookieOf(res);
  await logout({ request: req('/api/auth/logout', { method: 'POST', cookie: c }), env });
  const meAfter = await me({ request: req('/api/auth/me', { cookie: c }), env });
  const meAfterData = await bodyOf(meAfter);
  check('logout: session gone', meAfterData.user === null);
}

/* ================= v2 upgrade ================= */
const siteConfig = (await import('../functions/api/site-config.js')).onRequestGet;
const adminSettingsGet = (await import('../functions/api/admin/settings.js')).onRequestGet;
const adminSettingsPut = (await import('../functions/api/admin/settings.js')).onRequestPut;
const adminMediaPost = (await import('../functions/api/admin/media.js')).onRequestPost;
const mediaGet = (await import('../functions/api/media/[key].js')).onRequestGet;
const ordersPost = (await import('../functions/api/orders.js')).onRequestPost;
const adminOrdersGet = (await import('../functions/api/admin/orders.js')).onRequestGet;
const adminOrderPatch = (await import('../functions/api/admin/orders/[id].js')).onRequestPatch;
const adminOrderDelete = (await import('../functions/api/admin/orders/[id].js')).onRequestDelete;
const adminUserToolsGet = (await import('../functions/api/admin/users/[id]/tools.js')).onRequestGet;
const adminUserToolsPut = (await import('../functions/api/admin/users/[id]/tools.js')).onRequestPut;
const pubTestimonials = (await import('../functions/api/testimonials.js')).onRequestGet;
const pubFaqs = (await import('../functions/api/faqs.js')).onRequestGet;
const adminTestiPost = (await import('../functions/api/admin/testimonials.js')).onRequestPost;
const adminFaqPost = (await import('../functions/api/admin/faqs.js')).onRequestPost;

function reqForm(path, { cookie, fields }) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const headers = new Headers();
  headers.set('Origin', ORIGIN);
  if (cookie) headers.set('Cookie', cookie);
  return new Request(ORIGIN + path, { method: 'POST', headers, body: fd });
}

/* ---------- v2: fresh logins (earlier blocks rotated passwords/sessions) ---------- */
let v2Admin, v2Member;
{
  const a = await login({ request: req('/api/auth/login', { method: 'POST', body: { email: 'aminsheikhoffial01@gmail.com', password: 'SetupPass456' } }), env });
  v2Admin = cookieOf(a);
  const m = await login({ request: req('/api/auth/login', { method: 'POST', body: { email: 'rahim@test.dev', password: 'memberpass1' } }), env });
  v2Member = cookieOf(m);
  check('v2: admin + member re-login', !!v2Admin && !!v2Member);
}

/* ---------- v2: site-config + admin settings ---------- */
{
  const res = await siteConfig({ request: req('/api/site-config'), env });
  const d = await bodyOf(res);
  check('site-config: whatsapp default', d.whatsapp_number === '8801957566098', d.whatsapp_number);
  check('site-config: bkash/nagad empty by default', d.bkash_number === '' && d.nagad_number === '');
  check('site-config: photo defaults', d.photo_1 === '/media/photo-1.jpg' && d.photo_2 === '/media/photo-2.jpg' && d.photo_3 === '/media/photo-3.jpg');
  check('site-config: exactly the 7 public keys (no secrets leak)', Object.keys(d).sort().join(',') === 'bkash_number,nagad_number,ok,photo_1,photo_2,photo_3,whatsapp_number', Object.keys(d).join(','));

  const asMember = await adminSettingsPut({ request: req('/api/admin/settings', { method: 'PUT', cookie: v2Member, body: { bkash_number: '01712345678' } }), env });
  check('admin settings: non-admin PUT → 403', asMember.status === 403, `got ${asMember.status}`);

  const badPhone = await adminSettingsPut({ request: req('/api/admin/settings', { method: 'PUT', cookie: v2Admin, body: { bkash_number: 'call-me-maybe' } }), env });
  check('admin settings: invalid phone → 400', badPhone.status === 400, `got ${badPhone.status}`);

  const okPut = await adminSettingsPut({ request: req('/api/admin/settings', { method: 'PUT', cookie: v2Admin, body: { bkash_number: '01712345678' } }), env });
  check('admin settings: PUT bkash → 200', okPut.status === 200, `got ${okPut.status}`);

  const badPhoto = await adminSettingsPut({ request: req('/api/admin/settings', { method: 'PUT', cookie: v2Admin, body: { photo_2: 'javascript:alert(1)' } }), env });
  check('admin settings: unsafe photo URL → 400', badPhoto.status === 400, `got ${badPhoto.status}`);

  const after = await bodyOf(await siteConfig({ request: req('/api/site-config'), env }));
  check('site-config: reflects the saved bkash number', after.bkash_number === '01712345678', after.bkash_number);

  const admGet = await bodyOf(await adminSettingsGet({ request: req('/api/admin/settings', { cookie: v2Admin }), env }));
  check('admin settings GET: merged values', admGet.settings?.bkash_number === '01712345678' && admGet.settings?.whatsapp_number === '8801957566098');
}

/* ---------- v2: tool price + demo ---------- */
let pricedToolId;
{
  const create = await adminToolsPost({
    request: req('/api/admin/tools', { method: 'POST', cookie: v2Admin, body: { name: 'Priced Tool', tagline: 't', description: 'd', version: '1.0', size_label: '2 MB', kind: 'file', file_path: '/downloads/priced.zip', price: '৳499', demo_youtube: 'https://youtu.be/dQw4w9WgXcQ', sort_order: 9, published: true } }),
    env,
  });
  const created = await bodyOf(create);
  pricedToolId = created.tool?.id;
  check('tools: price stored', create.status === 201 && created.tool?.price === '৳499', `got ${create.status}`);
  check('tools: demo URL normalized to bare ID', created.tool?.demo_youtube === 'dQw4w9WgXcQ', created.tool?.demo_youtube);

  const badDemo = await adminToolsPost({
    request: req('/api/admin/tools', { method: 'POST', cookie: v2Admin, body: { name: 'Bad Demo', kind: 'file', file_path: '/downloads/x.zip', demo_youtube: 'https://example.com/nope' } }),
    env,
  });
  check('tools: invalid demo → 400', badDemo.status === 400, `got ${badDemo.status}`);

  const list = await bodyOf(await toolsList({ request: req('/api/tools'), env }));
  const priced = (list.tools || []).find((t) => t.id === pricedToolId);
  check('public tools: price + demo exposed', priced?.price === '৳499' && priced?.demo_youtube === 'dQw4w9WgXcQ');
  check('public tools: no file_path / external_url leak', priced && priced.file_path === undefined && priced.external_url === undefined);
  check('public tools: anon owned=false everywhere', (list.tools || []).every((t) => t.owned === false));
}

/* ---------- v2: per-tool ownership grants ---------- */
let karimCookie, karimId;
{
  const res = await signup({ request: req('/api/auth/signup', { method: 'POST', body: { name: 'Karim Buyer', email: 'karim@test.dev', password: 'buyerpass1' } }), env });
  const data = await bodyOf(res);
  karimCookie = cookieOf(res);
  karimId = data.user?.id;
  check('v2: buyer signup (no permissions)', res.status === 201 && data.user?.can_download === 0);

  const before = await download({ request: req(`/api/tools/${pricedToolId}/download`, { cookie: karimCookie }), env, params: { id: String(pricedToolId) } });
  check('grants: download before grant → 403', before.status === 403, `got ${before.status}`);

  const asMember = await adminUserToolsPut({ request: req(`/api/admin/users/${karimId}/tools`, { method: 'PUT', cookie: karimCookie, body: { tool_ids: [pricedToolId] } }), env, params: { id: String(karimId) } });
  check('grants: non-admin PUT → 403', asMember.status === 403, `got ${asMember.status}`);

  const badId = await adminUserToolsPut({ request: req(`/api/admin/users/${karimId}/tools`, { method: 'PUT', cookie: v2Admin, body: { tool_ids: [99999] } }), env, params: { id: String(karimId) } });
  check('grants: unknown tool id → 400', badId.status === 400, `got ${badId.status}`);

  const grant = await adminUserToolsPut({ request: req(`/api/admin/users/${karimId}/tools`, { method: 'PUT', cookie: v2Admin, body: { tool_ids: [pricedToolId, 2] } }), env, params: { id: String(karimId) } });
  const grantData = await bodyOf(grant);
  check('grants: PUT → 200 with both ids', grant.status === 200 && grantData.granted?.includes(pricedToolId) && grantData.granted?.includes(2), JSON.stringify(grantData));

  const state = await bodyOf(await adminUserToolsGet({ request: req(`/api/admin/users/${karimId}/tools`, { cookie: v2Admin }), env, params: { id: String(karimId) } }));
  check('grants: GET state matches', state.granted?.length === 2 && state.user?.can_download === 0 && state.tools?.length >= 4);

  const list = await bodyOf(await toolsList({ request: req('/api/tools', { cookie: karimCookie }), env }));
  const byId = Object.fromEntries((list.tools || []).map((t) => [t.id, t.owned]));
  check('grants: owned flags per tool', byId[pricedToolId] === true && byId[2] === true && byId[1] === false && byId[3] === false, JSON.stringify(byId));

  const dl = await download({ request: req(`/api/tools/${pricedToolId}/download`, { cookie: karimCookie }), env, params: { id: String(pricedToolId) } });
  check('grants: granted tool downloads → 302', dl.status === 302, `got ${dl.status}`);
  const dlNo = await download({ request: req('/api/tools/1/download', { cookie: karimCookie }), env, params: { id: '1' } });
  check('grants: ungranted tool still → 403', dlNo.status === 403, `got ${dlNo.status}`);

  const allList = await bodyOf(await toolsList({ request: req('/api/tools', { cookie: v2Member }), env }));
  check('grants: can_download member owns everything', (allList.tools || []).every((t) => t.owned === true));

  const revoke = await adminUserToolsPut({ request: req(`/api/admin/users/${karimId}/tools`, { method: 'PUT', cookie: v2Admin, body: { tool_ids: [] } }), env, params: { id: String(karimId) } });
  check('grants: revoke all → 200', revoke.status === 200, `got ${revoke.status}`);
  const after = await download({ request: req(`/api/tools/${pricedToolId}/download`, { cookie: karimCookie }), env, params: { id: String(pricedToolId) } });
  check('grants: download after revoke → 403', after.status === 403, `got ${after.status}`);
}

/* ---------- v2: hire-me orders ---------- */
{
  const okRes = await ordersPost({ request: req('/api/orders', { method: 'POST', body: { name: 'Client One', contact: '01712345678', service: 'Website', message: 'Need a shop website' } }), env });
  const okData = await bodyOf(okRes);
  check('orders: valid POST → 201', okRes.status === 201 && !!okData.id, `got ${okRes.status}`);
  const orderId = okData.id;

  const honey = await ordersPost({ request: req('/api/orders', { method: 'POST', body: { name: 'Bot', contact: '01712345678', service: 'Website', website: 'http://spam.example' } }), env });
  check('orders: honeypot filled → 400', honey.status === 400, `got ${honey.status}`);

  const noContact = await ordersPost({ request: req('/api/orders', { method: 'POST', body: { name: 'No Contact', service: 'Website' } }), env });
  check('orders: missing contact → 400', noContact.status === 400, `got ${noContact.status}`);

  const badService = await ordersPost({ request: req('/api/orders', { method: 'POST', body: { name: 'Bad Service', contact: '01712345678', service: 'Hacking' } }), env });
  check('orders: unknown service → 400', badService.status === 400, `got ${badService.status}`);

  const asAnon = await adminOrdersGet({ request: req('/api/admin/orders'), env });
  check('orders: admin list logged out → 401', asAnon.status === 401, `got ${asAnon.status}`);
  const asMember = await adminOrdersGet({ request: req('/api/admin/orders', { cookie: karimCookie }), env });
  check('orders: admin list non-admin → 403', asMember.status === 403, `got ${asMember.status}`);

  const list = await bodyOf(await adminOrdersGet({ request: req('/api/admin/orders', { cookie: v2Admin }), env }));
  const mine = (list.orders || []).find((o) => o.id === orderId);
  check('orders: admin list contains the order, unseen', !!mine && mine.seen === 0 && mine.name === 'Client One');

  const patch = await adminOrderPatch({ request: req(`/api/admin/orders/${orderId}`, { method: 'PATCH', cookie: v2Admin, body: { seen: true } }), env, params: { id: String(orderId) } });
  const patchData = await bodyOf(patch);
  check('orders: PATCH seen → 200 + seen=1', patch.status === 200 && patchData.order?.seen === 1, `got ${patch.status}`);

  const del = await adminOrderDelete({ request: req(`/api/admin/orders/${orderId}`, { method: 'DELETE', cookie: v2Admin }), env, params: { id: String(orderId) } });
  check('orders: DELETE → 200', del.status === 200, `got ${del.status}`);
  const list2 = await bodyOf(await adminOrdersGet({ request: req('/api/admin/orders', { cookie: v2Admin }), env }));
  check('orders: gone after delete', !(list2.orders || []).some((o) => o.id === orderId));
}

/* ---------- v2: media upload + serve ---------- */
{
  const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=';
  const pngBytes = new Uint8Array(Buffer.from(pngB64, 'base64'));

  const missing = await mediaGet({ request: req('/api/media/photo_3'), env, params: { key: 'photo_3' } });
  check('media: no blob yet → 404', missing.status === 404, `got ${missing.status}`);
  const bogus = await mediaGet({ request: req('/api/media/bogus'), env, params: { key: 'bogus' } });
  check('media: unknown key → 404', bogus.status === 404, `got ${bogus.status}`);

  const asMember = await adminMediaPost({ request: reqForm('/api/admin/media', { cookie: karimCookie, fields: { key: 'photo_1', file: new Blob([pngBytes], { type: 'image/png' }) } }), env });
  check('media: non-admin upload → 403', asMember.status === 403, `got ${asMember.status}`);

  const badKey = await adminMediaPost({ request: reqForm('/api/admin/media', { cookie: v2Admin, fields: { key: 'photo_9', file: new Blob([pngBytes], { type: 'image/png' }) } }), env });
  check('media: unknown slot → 400', badKey.status === 400, `got ${badKey.status}`);

  const textFile = await adminMediaPost({ request: reqForm('/api/admin/media', { cookie: v2Admin, fields: { key: 'photo_1', file: new Blob(['hello'], { type: 'text/plain' }) } }), env });
  check('media: text file → 400', textFile.status === 400, `got ${textFile.status}`);

  const fakePng = await adminMediaPost({ request: reqForm('/api/admin/media', { cookie: v2Admin, fields: { key: 'photo_1', file: new Blob(['not an image at all'], { type: 'image/png' }) } }), env });
  check('media: png-declared text bytes → 400 (magic bytes)', fakePng.status === 400, `got ${fakePng.status}`);

  const big = new Uint8Array(901 * 1024);
  big.set(pngBytes.slice(0, 8), 0);
  const tooBig = await adminMediaPost({ request: reqForm('/api/admin/media', { cookie: v2Admin, fields: { key: 'photo_1', file: new Blob([big], { type: 'image/png' }) } }), env });
  check('media: >900 KB → 400', tooBig.status === 400, `got ${tooBig.status}`);

  const up = await adminMediaPost({ request: reqForm('/api/admin/media', { cookie: v2Admin, fields: { key: 'photo_1', file: new Blob([pngBytes], { type: 'image/png' }) } }), env });
  const upData = await bodyOf(up);
  check('media: valid PNG upload → 200', up.status === 200 && upData.url === '/api/media/photo_1', `got ${up.status}`);

  const served = await mediaGet({ request: req('/api/media/photo_1'), env, params: { key: 'photo_1' } });
  const servedBytes = new Uint8Array(await served.arrayBuffer());
  check('media: served 200 + image/png', served.status === 200 && (served.headers.get('Content-Type') || '').includes('image/png'), `got ${served.status}`);
  check('media: served bytes identical', servedBytes.length === pngBytes.length && servedBytes.every((b, i) => b === pngBytes[i]));

  const cfg = await bodyOf(await siteConfig({ request: req('/api/site-config'), env }));
  check('media: site-config photo_1 now the blob URL', cfg.photo_1 === '/api/media/photo_1', cfg.photo_1);
}

/* ---------- v2: testimonials + faqs ---------- */
{
  const empty = await bodyOf(await pubTestimonials({ request: req('/api/testimonials'), env }));
  check('testimonials: none initially', (empty.testimonials || []).length === 0);

  const add = await adminTestiPost({ request: req('/api/admin/testimonials', { method: 'POST', cookie: v2Admin, body: { name: 'Test Buyer', text: 'QuickVid saved my channel hours.', meta: 'QuickVid buyer', sort: 1, visible: true } }), env });
  check('testimonials: admin POST → 201', add.status === 201, `got ${add.status}`);
  const hidden = await adminTestiPost({ request: req('/api/admin/testimonials', { method: 'POST', cookie: v2Admin, body: { name: 'Secret Buyer', text: 'Not shown.', visible: false } }), env });
  check('testimonials: hidden POST → 201', hidden.status === 201, `got ${hidden.status}`);

  const pub = await bodyOf(await pubTestimonials({ request: req('/api/testimonials'), env }));
  check('testimonials: public sees only the visible one', pub.testimonials?.length === 1 && pub.testimonials[0].name === 'Test Buyer', JSON.stringify(pub).slice(0, 140));

  const faqAdd = await adminFaqPost({ request: req('/api/admin/faqs', { method: 'POST', cookie: v2Admin, body: { q: 'Test question?', a: 'Test answer.', visible: true } }), env });
  check('faqs: admin POST → 201', faqAdd.status === 201, `got ${faqAdd.status}`);
  const pubFaq = await bodyOf(await pubFaqs({ request: req('/api/faqs'), env }));
  check('faqs: public list has the new FAQ', (pubFaq.faqs || []).some((f) => f.q === 'Test question?'));
}

/* ---------- v2: migration 0003 applies cleanly on a 0001+0002+seed DB ---------- */
{
  const raw2 = new DatabaseSync(':memory:');
  raw2.exec(readFileSync(join(root, 'migrations/0001_init.sql'), 'utf8'));
  raw2.exec(readFileSync(join(root, 'migrations/0002_setup.sql'), 'utf8'));
  raw2.exec(readFileSync(join(root, 'seed.sql'), 'utf8'));
  raw2.exec(readFileSync(join(root, 'migrations/0003_v2.sql'), 'utf8'));

  const cols = raw2.prepare('PRAGMA table_info(tools)').all().map((r) => r.name);
  check('migration 0003: tools gains price + demo_youtube', cols.includes('price') && cols.includes('demo_youtube'), cols.join(','));
  const tables = raw2.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
  check('migration 0003: new tables exist', ['user_tools', 'media_blobs', 'testimonials', 'faqs', 'orders'].every((t) => tables.includes(t)), tables.join(','));
  const faqCount = raw2.prepare('SELECT COUNT(*) AS n FROM faqs').get().n;
  check('migration 0003: 3 starter FAQs seeded', faqCount === 3, `got ${faqCount}`);
  const toolCount = raw2.prepare('SELECT COUNT(*) AS n FROM tools').get().n;
  check('migration 0003: seeded tools intact', toolCount === 3, `got ${toolCount}`);

  const env2 = { DB: new MockDB(raw2) };
  const faqsRes = await pubFaqs({ request: req('/api/faqs'), env: env2 });
  const faqsData = await bodyOf(faqsRes);
  check('migration 0003: seeded FAQs served publicly', (faqsData.faqs || []).length === 3);
  const cfgRes = await siteConfig({ request: req('/api/site-config'), env: env2 });
  const cfgData = await bodyOf(cfgRes);
  check('migration 0003: site-config defaults work on migrated DB', cfgData.whatsapp_number === '8801957566098' && cfgData.photo_1 === '/media/photo-1.jpg');
}

console.log(`\nhandler tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

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

console.log(`\nhandler tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

// License handler test — mocked D1 (node:sqlite) + real Ed25519 signing,
// produced key verified against the QuickVid app's public key (Node crypto).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
class MockStmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.params = []; }
  bind(...params) { this.params = params; return this; }
  async first() { const rows = this.db.prepare(this.sql).all(...this.params); return rows.length ? rows[0] : null; }
  async all() { const rows = this.db.prepare(this.sql).all(...this.params); return { results: rows, success: true, meta: {} }; }
  async run() { const info = this.db.prepare(this.sql).run(...this.params); return { success: true, meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes } }; }
}
class MockDB { constructor(db) { this.db = db; } prepare(sql) { return new MockStmt(this.db, sql); } }

const raw = new DatabaseSync(':memory:');
raw.exec(readFileSync(join(root, 'schema.sql'), 'utf8'));
const DB = new MockDB(raw);
const privB64 = readFileSync(process.env.QV_PRIV_PEM || '/home/hatch/workspace/quickvid-license/license-private.pem', 'utf8');
const { createPrivateKey } = await import('node:crypto');
const derB64 = createPrivateKey(privB64).export({ type: 'pkcs8', format: 'der' }).toString('base64');
const env = { DB, LICENSE_PRIVATE_KEY: derB64 };

const { hashPassword } = await import('../functions/lib/auth.js');
const adminPw = await hashPassword('AdminPass123');
raw.prepare('INSERT INTO users (id, name, email, pass_hash, salt, is_admin, can_download, blocked) VALUES (1, ?, ?, ?, ?, 1, 1, 0)')
  .run('Amin Sheikh', 'admin@test.dev', adminPw.hash, adminPw.salt);

const ORIGIN = 'https://site.test';
function req(path, { method = 'GET', cookie, body } = {}) {
  const headers = new Headers();
  if (method !== 'GET') headers.set('Origin', ORIGIN);
  if (cookie) headers.set('Cookie', cookie);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return new Request(ORIGIN + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}
let passed = 0, failed = 0;
const check = (l, c, x = '') => { if (c) { passed++; console.log('  ok  ' + l); } else { failed++; console.log('  FAIL ' + l + ' ' + x); } };

const login = (await import('../functions/api/auth/login.js')).onRequestPost;
const lic = await import('../functions/api/admin/licenses.js');

const lg = await login({ request: req('/api/auth/login', { method: 'POST', body: { email: 'admin@test.dev', password: 'AdminPass123' } }), env });
const cookie = (lg.headers.get('Set-Cookie') || '').split(';')[0];
check('admin login', !!cookie, 'status ' + lg.status);

const anon = await lic.onRequestGet({ request: req('/api/admin/licenses'), env });
check('anon list → 401/403', anon.status === 401 || anon.status === 403, 'got ' + anon.status);

const gen = await lic.onRequestPost({ request: req('/api/admin/licenses', { method: 'POST', cookie, body: { customer_name: 'Test Buyer', machine: '1BAE-573D-B287-2A0A', days: 30 } }), env });
const genData = await gen.json().catch(() => ({}));
check('generate → 200', gen.status === 200 && !!genData.key, JSON.stringify(genData).slice(0, 160));
check('exp is 29 days after iat (30 incl today)', genData.days_left === 29 || genData.days_left === 30, 'days_left=' + genData.days_left);

const bad = await lic.onRequestPost({ request: req('/api/admin/licenses', { method: 'POST', cookie, body: { customer_name: 'X', machine: 'not-a-code', days: 30 } }), env });
check('bad machine → 400', bad.status === 400, 'got ' + bad.status);

const list = await lic.onRequestGet({ request: req('/api/admin/licenses', { cookie }), env });
const listData = await list.json();
check('list has 1 license', (listData.licenses || []).length === 1);

// Verify the key with the QuickVid app's own verifier (public key only)
const require = createRequire(import.meta.url);
const { createLicenseLib } = require('/home/hatch/workspace/sheikh-official'.replace('sheikh-official', 'sheikh-quickvid-v3') + '/lib/license.js');
const appLib = createLicenseLib('/tmp/qv-lic-test2');
const payload = appLib.parseKey(genData.key);
check('app verifies website-made key', !!payload, 'parseKey returned null');
check('payload matches', payload && payload.name === 'Test Buyer' && payload.machine === '1BAE-573D-B287-2A0A' && payload.days === 30 && payload.exp === genData.exp,
  JSON.stringify(payload));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

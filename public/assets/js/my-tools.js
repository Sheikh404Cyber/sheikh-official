// My Tools page: login-required library of the tools the user owns.
// Ownership comes from /api/tools (per-tool `owned` flag for the session).

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function ownedCard(tool, idx) {
  return `
  <article class="card reveal in" style="--rd:${(idx % 3) * 0.08}s">
    <div class="icon">🛠️</div>
    <h3>${esc(tool.name)}</h3>
    ${tool.tagline ? `<div class="tagline">${esc(tool.tagline)}</div>` : ''}
    ${tool.description ? `<p>${esc(tool.description)}</p>` : '<p></p>'}
    <div class="chips">
      ${tool.version ? `<span class="chip acc">v${esc(tool.version)}</span>` : ''}
      ${tool.size_label ? `<span class="chip">${esc(tool.size_label)}</span>` : ''}
      <span class="chip">${tool.kind === 'link' ? 'External download' : 'Direct download'}</span>
    </div>
    <div class="foot">
      <span class="open-badge">✓ You own this</span>
      <a class="btn primary small" href="/api/tools/${tool.id}/download">⬇ Download</a>
    </div>
  </article>`;
}

(async function boot() {
  let user = null;
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    user = data.user || null;
  } catch { /* treated as logged out */ }
  if (!user) {
    location.href = '/login';
    return;
  }
  $('#headerActions').innerHTML = `
    <span class="user-chip">👋 ${esc(user.name.split(' ')[0])}</span>
    <button class="btn small" id="logoutBtn" type="button">Logout</button>`;
  $('#logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/';
  });

  const grid = $('#myToolsGrid');
  try {
    const res = await fetch('/api/tools');
    const data = await res.json();
    const owned = (data.tools || []).filter((t) => t.owned);
    if (!owned.length) {
      grid.innerHTML = `
        <div class="empty-state"><span class="big">🛒</span>
          You don't own any tools yet.<br>
          <a class="btn whatsapp" href="/#tools" style="margin-top:16px">Browse Tools &amp; Buy</a>
        </div>`;
      return;
    }
    grid.innerHTML = owned.map(ownedCard).join('');
  } catch {
    grid.innerHTML = '<div class="empty-state"><span class="big">⚠️</span>Could not load your tools. Please refresh the page.</div>';
  }
})();

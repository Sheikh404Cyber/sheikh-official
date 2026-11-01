// Sheikh-OFFICIAL admin panel: dashboard, user permissions, and full
// CRUD for tools / videos / websites, plus the password settings form.

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (ts) => {
  if (!ts) return '';
  const d = new Date(String(ts).replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

function toast(msg, isErr = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  $('#toastZone').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .4s, transform .4s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 420);
  }, 3400);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

let me = null;

/* ---------- tabs ---------- */
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-page').forEach((p) => p.classList.toggle('active', p.id === `tab-${btn.dataset.tab}`));
  });
});

$('#logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.href = '/login';
});

/* ---------- dashboard ---------- */
async function loadDashboard() {
  const data = await api('/api/admin/stats');
  const c = data.counts;
  $('#statCards').innerHTML = [
    ['👥', c.users, 'Users'],
    ['🛠️', c.tools, 'Tools'],
    ['🎬', c.videos, 'Videos'],
    ['🌐', c.demos, 'Websites'],
    ['⬇', c.downloads, 'Downloads'],
  ]
    .map(([icon, n, l]) => `<div class="stat-card"><div class="n">${icon} ${n}</div><div class="l">${l}</div></div>`)
    .join('');

  $('#recentSignups').innerHTML = data.recentSignups.length
    ? `<table><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Status</th></tr></thead><tbody>${data.recentSignups
        .map(
          (u) => `<tr><td>${esc(u.name)}${u.is_admin ? ' <span class="pill gold">Admin</span>' : ''}</td><td>${esc(u.email)}</td><td>${fmtDate(u.created_at)}</td><td>${
            u.blocked ? '<span class="pill red">Blocked</span>' : u.can_download ? '<span class="pill acc">Can download</span>' : '<span class="pill">No permission</span>'
          }</td></tr>`
        )
        .join('')}</tbody></table>`
    : '<p class="empty-line">No signups yet.</p>';

  $('#recentDownloads').innerHTML = data.recentDownloads.length
    ? `<table><thead><tr><th>User</th><th>Tool</th><th>When</th></tr></thead><tbody>${data.recentDownloads
        .map((d) => `<tr><td>${esc(d.user_name)}<div class="sub">${esc(d.user_email)}</div></td><td>${esc(d.tool_name)}</td><td>${fmtDate(d.created_at)}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="empty-line">No downloads yet.</p>';
}

/* ---------- users ---------- */
async function loadUsers() {
  const data = await api('/api/admin/users');
  const box = $('#usersTable');
  if (!data.users.length) {
    box.innerHTML = '<p class="empty-line">No users yet.</p>';
    return;
  }
  box.innerHTML = `<table><thead><tr><th>User</th><th>Joined</th><th>Download</th><th>Blocked</th><th></th></tr></thead><tbody>${data.users
    .map((u) => {
      const self = me && u.id === me.id;
      return `<tr data-user="${u.id}">
        <td><b>${esc(u.name)}</b>${u.is_admin ? ' <span class="pill gold">Admin</span>' : ''}<div class="sub">${esc(u.email)}</div></td>
        <td>${fmtDate(u.created_at)}</td>
        <td><label class="switch" title="Allow tool downloads"><input type="checkbox" data-act="can_download" ${u.can_download ? 'checked' : ''}><span class="track"></span></label></td>
        <td><label class="switch" title="Block this user"><input type="checkbox" data-act="blocked" ${u.blocked ? 'checked' : ''} ${self ? 'disabled' : ''}><span class="track"></span></label></td>
        <td>${self ? '<span class="pill">You</span>' : `<button class="btn small danger" type="button" data-act="delete">Delete</button>`}</td>
      </tr>`;
    })
    .join('')}</tbody></table>`;

  box.querySelectorAll('input[type="checkbox"][data-act]').forEach((input) => {
    input.addEventListener('change', async () => {
      const tr = input.closest('tr');
      const id = tr.dataset.user;
      const field = input.dataset.act;
      try {
        await api(`/api/admin/users/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ [field]: input.checked }),
        });
        toast(field === 'can_download' ? (input.checked ? 'Download permission granted' : 'Download permission removed') : input.checked ? 'User blocked' : 'User unblocked');
        loadDashboard();
      } catch (e) {
        input.checked = !input.checked;
        toast(e.message, true);
      }
    });
  });
  box.querySelectorAll('button[data-act="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      if (!confirm('Delete this user account? This cannot be undone.')) return;
      try {
        await api(`/api/admin/users/${tr.dataset.user}`, { method: 'DELETE' });
        toast('User deleted');
        loadUsers();
        loadDashboard();
      } catch (e) {
        toast(e.message, true);
      }
    });
  });
}

/* ---------- generic entity CRUD (tools / videos / demos) ---------- */
function entityManager(cfg) {
  const state = { items: [] };

  async function load() {
    const data = await api(cfg.apiPath);
    state.items = data[cfg.key] || [];
    const list = $(cfg.listSel);
    if (!state.items.length) {
      list.innerHTML = '<p class="empty-line">Nothing here yet. Add the first one above.</p>';
      return;
    }
    list.innerHTML = state.items
      .map(
        (item) => `<div class="entity-row" data-id="${item.id}">
          <div class="grow"><div class="t">${esc(cfg.title(item))}</div><div class="s">${esc(cfg.subtitle(item))}</div></div>
          ${item.published ? '<span class="pill acc">Published</span>' : '<span class="pill">Hidden</span>'}
          <div class="row-actions">
            <button class="btn small" type="button" data-edit="${item.id}">Edit</button>
            <button class="btn small danger" type="button" data-del="${item.id}">Delete</button>
          </div>
        </div>`
      )
      .join('');
    list.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => {
        const item = state.items.find((x) => String(x.id) === b.dataset.edit);
        if (item) cfg.fill(item);
      })
    );
    list.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm(`Delete "${cfg.title(state.items.find((x) => String(x.id) === b.dataset.del) || {})}"? This cannot be undone.`)) return;
        try {
          await api(`${cfg.apiPath}/${b.dataset.del}`, { method: 'DELETE' });
          toast('Deleted');
          cfg.reset();
          load();
          loadDashboard();
        } catch (e) {
          toast(e.message, true);
        }
      })
    );
  }

  $(cfg.formSel).addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $(cfg.idSel).value;
    try {
      await api(id ? `${cfg.apiPath}/${id}` : cfg.apiPath, {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(cfg.collect()),
      });
      toast(id ? 'Saved' : 'Added');
      cfg.reset();
      load();
      loadDashboard();
    } catch (err) {
      toast(err.message, true);
    }
  });
  $(cfg.cancelSel).addEventListener('click', () => cfg.reset());

  return { load };
}

/* tools */
const toolsMgr = entityManager({
  apiPath: '/api/admin/tools',
  key: 'tools',
  listSel: '#toolsList',
  formSel: '#toolForm',
  idSel: '#toolId',
  cancelSel: '#toolCancelBtn',
  title: (t) => t.name,
  subtitle: (t) =>
    `${t.tagline || ''}${t.version ? ` · v${t.version}` : ''}${t.size_label ? ` · ${t.size_label}` : ''} · ${t.kind === 'link' ? t.external_url : t.file_path}`,
  collect: () => ({
    name: $('#toolName').value,
    tagline: $('#toolTagline').value,
    description: $('#toolDesc').value,
    version: $('#toolVersion').value,
    size_label: $('#toolSize').value,
    kind: $('#toolKind').value,
    file_path: $('#toolFile').value,
    external_url: $('#toolUrl').value,
    sort_order: parseInt($('#toolSort').value, 10) || 0,
    published: $('#toolPublished').checked,
  }),
  fill: (t) => {
    $('#toolId').value = t.id;
    $('#toolName').value = t.name || '';
    $('#toolTagline').value = t.tagline || '';
    $('#toolDesc').value = t.description || '';
    $('#toolVersion').value = t.version || '';
    $('#toolSize').value = t.size_label || '';
    $('#toolKind').value = t.kind || 'file';
    $('#toolSort').value = t.sort_order ?? 0;
    $('#toolFile').value = t.file_path || '';
    $('#toolUrl').value = t.external_url || '';
    $('#toolPublished').checked = !!t.published;
    syncToolKind();
    $('#toolFormTitle').textContent = '✏️ Edit tool';
    $('#toolSaveBtn').textContent = 'Update Tool';
    $('#toolCancelBtn').classList.remove('hidden');
    $('#toolForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  reset: () => {
    $('#toolForm').reset();
    $('#toolId').value = '';
    $('#toolKind').value = 'file';
    $('#toolPublished').checked = true;
    syncToolKind();
    $('#toolFormTitle').textContent = '➕ Add a tool';
    $('#toolSaveBtn').textContent = 'Save Tool';
    $('#toolCancelBtn').classList.add('hidden');
  },
});

function syncToolKind() {
  const link = $('#toolKind').value === 'link';
  $('#toolFileWrap').classList.toggle('hidden', link);
  $('#toolUrlWrap').classList.toggle('hidden', !link);
}
$('#toolKind').addEventListener('change', syncToolKind);

/* videos */
const videosMgr = entityManager({
  apiPath: '/api/admin/videos',
  key: 'videos',
  listSel: '#videosList',
  formSel: '#videoForm',
  idSel: '#videoId',
  cancelSel: '#videoCancelBtn',
  title: (v) => v.title,
  subtitle: (v) => `youtube.com/watch?v=${v.youtube_id}`,
  collect: () => ({
    title: $('#videoTitle').value,
    youtube: $('#videoYoutube').value,
    sort_order: parseInt($('#videoSort').value, 10) || 0,
    published: $('#videoPublished').checked,
  }),
  fill: (v) => {
    $('#videoId').value = v.id;
    $('#videoTitle').value = v.title || '';
    $('#videoSort').value = v.sort_order ?? 0;
    $('#videoYoutube').value = `https://www.youtube.com/watch?v=${v.youtube_id}`;
    $('#videoPublished').checked = !!v.published;
    $('#videoFormTitle').textContent = '✏️ Edit video';
    $('#videoSaveBtn').textContent = 'Update Video';
    $('#videoCancelBtn').classList.remove('hidden');
    $('#videoForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  reset: () => {
    $('#videoForm').reset();
    $('#videoId').value = '';
    $('#videoPublished').checked = true;
    $('#videoFormTitle').textContent = '➕ Add a video';
    $('#videoSaveBtn').textContent = 'Save Video';
    $('#videoCancelBtn').classList.add('hidden');
  },
});

/* demos */
const demosMgr = entityManager({
  apiPath: '/api/admin/demos',
  key: 'demos',
  listSel: '#demosList',
  formSel: '#demoForm',
  idSel: '#demoId',
  cancelSel: '#demoCancelBtn',
  title: (d) => d.name,
  subtitle: (d) => d.url,
  collect: () => ({
    name: $('#demoName').value,
    description: $('#demoDesc').value,
    url: $('#demoUrl').value,
    image_url: $('#demoImage').value,
    sort_order: parseInt($('#demoSort').value, 10) || 0,
    published: $('#demoPublished').checked,
  }),
  fill: (d) => {
    $('#demoId').value = d.id;
    $('#demoName').value = d.name || '';
    $('#demoDesc').value = d.description || '';
    $('#demoUrl').value = d.url || '';
    $('#demoImage').value = d.image_url || '';
    $('#demoSort').value = d.sort_order ?? 0;
    $('#demoPublished').checked = !!d.published;
    $('#demoFormTitle').textContent = '✏️ Edit website';
    $('#demoSaveBtn').textContent = 'Update Website';
    $('#demoCancelBtn').classList.remove('hidden');
    $('#demoForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  reset: () => {
    $('#demoForm').reset();
    $('#demoId').value = '';
    $('#demoPublished').checked = true;
    $('#demoFormTitle').textContent = '➕ Add a website';
    $('#demoSaveBtn').textContent = 'Save Website';
    $('#demoCancelBtn').classList.add('hidden');
  },
});

/* ---------- settings: change password ---------- */
$('#pwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const next = $('#pwNew').value;
  if (next !== $('#pwAgain').value) {
    toast('The two new passwords do not match', true);
    return;
  }
  try {
    await api('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: $('#pwCurrent').value, new_password: next }),
    });
    $('#pwForm').reset();
    toast('Password updated');
  } catch (err) {
    toast(err.message, true);
  }
});

/* ---------- boot / admin gate ---------- */
(async function boot() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.user || !data.user.is_admin) {
      location.href = '/login';
      return;
    }
    me = data.user;
    $('#adminName').textContent = me.name;
    $('#adminEmail').textContent = me.email;
    syncToolKind();
    await Promise.all([loadDashboard(), loadUsers(), toolsMgr.load(), videosMgr.load(), demosMgr.load()]);
  } catch {
    location.href = '/login';
  }
})();

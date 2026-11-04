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
  const unseen = c.unseenOrders || 0;
  const badge = $('#ordersBadge');
  if (badge) {
    badge.textContent = unseen;
    badge.classList.toggle('hidden', !unseen);
  }
  $('#statCards').innerHTML = [
    ['👥', c.users, 'Users'],
    ['🛠️', c.tools, 'Tools'],
    ['🎬', c.videos, 'Videos'],
    ['🌐', c.demos, 'Websites'],
    ['⬇', c.downloads, 'Downloads'],
    ...(c.orders !== undefined ? [['🧾', c.orders, unseen ? `Orders · ${unseen} new` : 'Orders']] : []),
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
  box.innerHTML = `<table><thead><tr><th>User</th><th>Joined</th><th>All tools</th><th>Blocked</th><th></th></tr></thead><tbody>${data.users
    .map((u) => {
      const self = me && u.id === me.id;
      return `<tr data-user="${u.id}">
        <td><b>${esc(u.name)}</b>${u.is_admin ? ' <span class="pill gold">Admin</span>' : ''}<div class="sub">${esc(u.email)}</div></td>
        <td>${fmtDate(u.created_at)}</td>
        <td><label class="switch" title="Allow ALL tool downloads"><input type="checkbox" data-act="can_download" ${u.can_download ? 'checked' : ''}><span class="track"></span></label></td>
        <td><label class="switch" title="Block this user"><input type="checkbox" data-act="blocked" ${u.blocked ? 'checked' : ''} ${self ? 'disabled' : ''}><span class="track"></span></label></td>
        <td><div class="row-actions"><button class="btn small" type="button" data-act="tools">Tools access</button>${self ? '<span class="pill">You</span>' : `<button class="btn small danger" type="button" data-act="delete">Delete</button>`}</div></td>
      </tr>`;
    })
    .join('')}</tbody></table>`;

  box.querySelectorAll('button[data-act="tools"]').forEach((btn) => {
    btn.addEventListener('click', () => openUserTools(btn.closest('tr').dataset.user));
  });

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

/* ---------- per-user tool grants ---------- */
let grantUserId = null;
async function openUserTools(userId) {
  try {
    const data = await api(`/api/admin/users/${userId}/tools`);
    grantUserId = userId;
    $('#userToolsTitle').textContent = `Tools access — ${data.user.name} (${data.user.email})`;
    const list = $('#userToolsList');
    if (!data.tools.length) {
      list.innerHTML = '<p class="empty-line">No tools exist yet.</p>';
    } else {
      list.innerHTML = data.tools
        .map(
          (t) => `<label class="inline-check"><input type="checkbox" data-grant="${t.id}" ${data.granted.includes(t.id) ? 'checked' : ''}> ${esc(t.name)}${t.published ? '' : ' <span class="pill">Hidden</span>'}</label>`
        )
        .join('');
    }
    if (data.user.can_download) {
      list.insertAdjacentHTML('afterbegin', '<p class="empty-line">ℹ️ This user already has the ALL-tools switch on — per-tool ticks below only matter while that switch is off.</p>');
    }
    $('#userToolsPanel').classList.remove('hidden');
    $('#userToolsPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    toast(e.message, true);
  }
}
$('#userToolsSave').addEventListener('click', async () => {
  if (!grantUserId) return;
  const toolIds = [...document.querySelectorAll('[data-grant]:checked')].map((el) => parseInt(el.dataset.grant, 10));
  try {
    await api(`/api/admin/users/${grantUserId}/tools`, { method: 'PUT', body: JSON.stringify({ tool_ids: toolIds }) });
    toast('Tool access saved');
  } catch (e) {
    toast(e.message, true);
  }
});
$('#userToolsClose').addEventListener('click', () => {
  grantUserId = null;
  $('#userToolsPanel').classList.add('hidden');
});

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
          ${(cfg.isPublished ? cfg.isPublished(item) : item.published) ? '<span class="pill acc">Published</span>' : '<span class="pill">Hidden</span>'}
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
    `${t.tagline || ''}${t.version ? ` · v${t.version}` : ''}${t.size_label ? ` · ${t.size_label}` : ''}${t.price_amount ? ` · ৳${t.price_amount}${t.price_period === 'month' ? '/month' : t.price_period === 'year' ? '/year' : ''}` : t.price ? ` · ${t.price}` : ''} · ${t.kind === 'link' ? t.external_url : t.file_path}`,
  collect: () => ({
    name: $('#toolName').value,
    tagline: $('#toolTagline').value,
    description: $('#toolDesc').value,
    version: $('#toolVersion').value,
    size_label: $('#toolSize').value,
    price: $('#toolPrice').value,
    price_amount: $('#toolPriceAmount').value,
    price_period: $('#toolPricePeriod').value,
    price_compare: $('#toolPriceCompare').value,
    demo_youtube: $('#toolDemo').value,
    logo: $('#toolLogo').value,
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
    $('#toolPrice').value = t.price || '';
    $('#toolPriceAmount').value = t.price_amount ?? '';
    $('#toolPricePeriod').value = t.price_period || 'once';
    $('#toolPriceCompare').value = t.price_compare ?? '';
    $('#toolDemo').value = t.demo_youtube ? `https://www.youtube.com/watch?v=${t.demo_youtube}` : '';
    $('#toolLogo').value = t.logo || '';
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

/* ---------- photos ---------- */
const PHOTO_LABELS = { photo_1: 'Photo 1 — main (middle)', photo_2: 'Photo 2 — left', photo_3: 'Photo 3 — right' };
let siteSettings = {};
const photoBust = {}; // cache-busters so a fresh upload previews immediately

async function loadSettings() {
  const data = await api('/api/admin/settings');
  siteSettings = data.settings || {};
  $('#setWhatsapp').value = siteSettings.whatsapp_number || '';
  $('#setBkash').value = siteSettings.bkash_number || '';
  $('#setNagad').value = siteSettings.nagad_number || '';
  renderPhotoSlots();
}

function renderPhotoSlots() {
  const box = $('#photoSlots');
  box.innerHTML = Object.keys(PHOTO_LABELS)
    .map((key) => {
      const url = siteSettings[key] || '';
      const preview = photoBust[key] ? `${url}${url.includes('?') ? '&' : '?'}v=${photoBust[key]}` : url;
      return `<div class="panel-box photo-slot">
        <h2>${PHOTO_LABELS[key]}</h2>
        <div class="photo-row">
          <img class="photo-preview" src="${esc(preview)}" alt="${key} preview" id="prev-${key}">
          <div class="grow">
            <div class="field"><label for="url-${key}">Image URL or path</label><input id="url-${key}" value="${esc(url)}"></div>
            <div class="form-actions">
              <button class="btn primary" type="button" data-saveurl="${key}">Save URL</button>
              <label class="btn" style="cursor:pointer">Upload image<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="${key}" hidden></label>
            </div>
            <p class="sub" style="color:var(--muted);font-size:12.5px;margin-top:8px">Uploads replace the photo immediately (max 900 KB).</p>
          </div>
        </div>
      </div>`;
    })
    .join('');

  box.querySelectorAll('[data-saveurl]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.saveurl;
      try {
        const data = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ [key]: $(`#url-${key}`).value }) });
        siteSettings = data.settings;
        renderPhotoSlots();
        toast(`${PHOTO_LABELS[key]} saved`);
      } catch (e) {
        toast(e.message, true);
      }
    });
  });
  box.querySelectorAll('[data-upload]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const key = input.dataset.upload;
      const fd = new FormData();
      fd.append('key', key);
      fd.append('file', file);
      try {
        const res = await fetch('/api/admin/media', { method: 'POST', body: fd });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(out.error || 'Upload failed');
        photoBust[key] = Date.now();
        toast(`${PHOTO_LABELS[key]} uploaded`);
        await loadSettings();
      } catch (e) {
        toast(e.message, true);
      }
      input.value = '';
    });
  });
}

/* ---------- reviews (testimonials) ---------- */
const testiMgr = entityManager({
  apiPath: '/api/admin/testimonials',
  key: 'testimonials',
  listSel: '#testiList',
  formSel: '#testiForm',
  idSel: '#testiId',
  cancelSel: '#testiCancelBtn',
  isPublished: (t) => t.visible,
  title: (t) => t.name,
  subtitle: (t) => `${t.meta || ''}${t.meta ? ' — ' : ''}${(t.text || '').slice(0, 90)}`,
  collect: () => ({
    name: $('#testiName').value,
    meta: $('#testiMeta').value,
    text: $('#testiText').value,
    sort: parseInt($('#testiSort').value, 10) || 0,
    visible: $('#testiVisible').checked,
  }),
  fill: (t) => {
    $('#testiId').value = t.id;
    $('#testiName').value = t.name || '';
    $('#testiMeta').value = t.meta || '';
    $('#testiText').value = t.text || '';
    $('#testiSort').value = t.sort ?? 0;
    $('#testiVisible').checked = !!t.visible;
    $('#testiFormTitle').textContent = '✏️ Edit review';
    $('#testiSaveBtn').textContent = 'Update Review';
    $('#testiCancelBtn').classList.remove('hidden');
    $('#testiForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  reset: () => {
    $('#testiForm').reset();
    $('#testiId').value = '';
    $('#testiVisible').checked = true;
    $('#testiFormTitle').textContent = '➕ Add a review';
    $('#testiSaveBtn').textContent = 'Save Review';
    $('#testiCancelBtn').classList.add('hidden');
  },
});

/* ---------- faq ---------- */
const faqMgr = entityManager({
  apiPath: '/api/admin/faqs',
  key: 'faqs',
  listSel: '#faqList',
  formSel: '#faqForm',
  idSel: '#faqId',
  cancelSel: '#faqCancelBtn',
  isPublished: (f) => f.visible,
  title: (f) => f.q,
  subtitle: (f) => (f.a || '').slice(0, 110),
  collect: () => ({
    q: $('#faqQ').value,
    a: $('#faqA').value,
    sort: parseInt($('#faqSort').value, 10) || 0,
    visible: $('#faqVisible').checked,
  }),
  fill: (f) => {
    $('#faqId').value = f.id;
    $('#faqQ').value = f.q || '';
    $('#faqA').value = f.a || '';
    $('#faqSort').value = f.sort ?? 0;
    $('#faqVisible').checked = !!f.visible;
    $('#faqFormTitle').textContent = '✏️ Edit FAQ';
    $('#faqSaveBtn').textContent = 'Update FAQ';
    $('#faqCancelBtn').classList.remove('hidden');
    $('#faqForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  reset: () => {
    $('#faqForm').reset();
    $('#faqId').value = '';
    $('#faqVisible').checked = true;
    $('#faqFormTitle').textContent = '➕ Add an FAQ';
    $('#faqSaveBtn').textContent = 'Save FAQ';
    $('#faqCancelBtn').classList.add('hidden');
  },
});

/* ---------- orders ---------- */
async function loadOrders() {
  const data = await api('/api/admin/orders');
  const box = $('#ordersList');
  const unseen = (data.orders || []).filter((o) => !o.seen).length;
  const badge = $('#ordersBadge');
  if (badge) {
    badge.textContent = unseen;
    badge.classList.toggle('hidden', !unseen);
  }
  if (!data.orders.length) {
    box.innerHTML = '<p class="empty-line">No orders yet. Requests from the Hire Me form will appear here.</p>';
    return;
  }
  box.innerHTML = data.orders
    .map(
      (o) => `<div class="entity-row ${o.seen ? '' : 'order-new'}" data-order="${o.id}">
        <div class="grow">
          <div class="t">${esc(o.name)} ${o.seen ? '' : '<span class="pill gold">New</span>'} <span class="pill acc">${esc(o.service)}</span></div>
          <div class="s">📞 ${esc(o.contact)} · ${fmtDate(o.created_at)}</div>
          ${o.message ? `<div style="margin-top:6px">${esc(o.message)}</div>` : ''}
        </div>
        <div class="row-actions">
          <button class="btn small" type="button" data-seen="${o.id}">${o.seen ? 'Mark unseen' : 'Mark seen'}</button>
          <button class="btn small danger" type="button" data-del-order="${o.id}">Delete</button>
        </div>
      </div>`
    )
    .join('');
  box.querySelectorAll('[data-seen]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const order = data.orders.find((o) => String(o.id) === btn.dataset.seen);
      try {
        await api(`/api/admin/orders/${btn.dataset.seen}`, { method: 'PATCH', body: JSON.stringify({ seen: !(order && order.seen) }) });
        loadOrders();
        loadDashboard();
      } catch (e) {
        toast(e.message, true);
      }
    });
  });
  box.querySelectorAll('[data-del-order]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this order? This cannot be undone.')) return;
      try {
        await api(`/api/admin/orders/${btn.dataset.delOrder}`, { method: 'DELETE' });
        toast('Order deleted');
        loadOrders();
        loadDashboard();
      } catch (e) {
        toast(e.message, true);
      }
    });
  });
}

/* ---------- settings: sales numbers ---------- */
$('#salesForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        whatsapp_number: $('#setWhatsapp').value,
        bkash_number: $('#setBkash').value,
        nagad_number: $('#setNagad').value,
      }),
    });
    siteSettings = data.settings;
    toast('Numbers saved');
  } catch (err) {
    toast(err.message, true);
  }
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
    await Promise.all([
      loadDashboard(), loadUsers(), toolsMgr.load(), videosMgr.load(), demosMgr.load(),
      loadSettings(), testiMgr.load(), faqMgr.load(), loadOrders(), loadLicenses(),
    ]);
  } catch {
    location.href = '/login';
  }
})();

/* ---------- license keys (QuickVid) ---------- */
async function loadLicenses() {
  const box = $('#licList');
  if (!box) return;
  try {
    const data = await api('/api/admin/licenses');
    const rows = data.licenses || [];
    if (!rows.length) { box.innerHTML = '<p class="empty-line">No keys issued yet.</p>'; return; }
    box.innerHTML = `<table class="admin-table"><thead><tr><th>Buyer</th><th>Machine</th><th>Days</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>${
      rows.map((r) => `<tr>
        <td>${esc(r.customer_name)}</td><td style="font-family:monospace">${esc(r.machine)}</td>
        <td>${r.days}</td><td>${esc(r.exp)}</td>
        <td>${r.days_left >= 0 ? `<span class="pill">${r.days_left} days left</span>` : '<span class="pill gold">Expired</span>'}</td>
        <td style="white-space:nowrap"><button class="btn small" type="button" data-lic-copy="${r.id}">Copy key</button> <button class="btn small" type="button" data-lic-del="${r.id}">Delete</button></td>
      </tr>`).join('')
    }</tbody></table>`;
    box.querySelectorAll('[data-lic-copy]').forEach((b) => b.addEventListener('click', () => {
      const r = rows.find((x) => x.id === +b.dataset.licCopy);
      if (r) navigator.clipboard.writeText(r.lic_key).then(() => toast('Key copied'));
    }));
    box.querySelectorAll('[data-lic-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Delete this key record? (A key the buyer already activated keeps working until its days end — deleting here only removes the record.)')) return;
      try { await api('/api/admin/licenses', { method: 'POST', body: JSON.stringify({ delete_id: +b.dataset.licDel }) }); toast('Record deleted'); loadLicenses(); }
      catch (err) { toast(err.message, true); }
    }));
  } catch (err) {
    box.innerHTML = `<p class="empty-line">${esc(err.message)}</p>`;
  }
}
$('#licDays')?.addEventListener('change', () => {
  $('#licCustomWrap').classList.toggle('hidden', $('#licDays').value !== 'custom');
});
$('#licForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const isTrial = $('#licDays').value === 'trial3';
  const days = isTrial ? 3 : ($('#licDays').value === 'custom' ? +$('#licCustomDays').value : +$('#licDays').value);
  try {
    const data = await api('/api/admin/licenses', {
      method: 'POST',
      body: JSON.stringify({ customer_name: $('#licName').value.trim(), machine: $('#licMachine').value.trim().toUpperCase(), days, trial: isTrial }),
    });
    $('#licResult').classList.remove('hidden');
    $('#licKeyOut').value = data.key;
    toast('Key generated — expires ' + data.exp);
    loadLicenses();
  } catch (err) { toast(err.message, true); }
});
$('#licCopyBtn')?.addEventListener('click', () => {
  navigator.clipboard.writeText($('#licKeyOut').value).then(() => toast('Key copied — now send it to the buyer'));
});

// Sheikh-OFFICIAL homepage: hero animation, header auth state, and
// DB-driven Tools / Tutorials / Websites sections with lock logic.

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, isErr = false) {
  const zone = $('#toastZone');
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  zone.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .4s, transform .4s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 420);
  }, 3600);
}

/* ---------- hero letter reveal ---------- */
(function splitHero() {
  const h1 = $('#heroName');
  if (!h1) return;
  const text = h1.textContent;
  h1.setAttribute('aria-label', text);
  h1.textContent = '';
  let i = 0;
  for (const ch of text) {
    const span = document.createElement('span');
    span.className = 'hl' + (i >= 5 ? ' acc' : ''); // "SHEIKH" in accent
    span.style.setProperty('--d', `${(i * 0.055).toFixed(2)}s`);
    span.textContent = ch === ' ' ? ' ' : ch;
    span.setAttribute('aria-hidden', 'true');
    h1.appendChild(span);
    i++;
  }
})();

/* ---------- header auth state ---------- */
let currentUser = null;
async function initHeader() {
  const box = $('#headerActions');
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    currentUser = data.user || null;
  } catch {
    currentUser = null;
  }
  if (!currentUser) return; // default Login / Sign Up markup stays
  box.innerHTML = `
    ${currentUser.is_admin ? '<a class="btn ghost small hide-sm" href="/admin">Admin</a>' : ''}
    <span class="user-chip">👋 ${esc(currentUser.name.split(' ')[0])}</span>
    <button class="btn small" id="logoutBtn" type="button">Logout</button>`;
  $('#logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    location.reload();
  });
}

/* ---------- reveal on scroll ---------- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
      }
    }
  },
  { threshold: 0.12 }
);
function watchReveals(root = document) {
  root.querySelectorAll('.reveal:not(.in)').forEach((el) => revealObserver.observe(el));
}

/* ---------- animated counters ---------- */
const counterObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      counterObserver.unobserve(e.target);
      const el = e.target;
      const target = parseInt(el.dataset.target || '0', 10);
      const suffix = el.dataset.suffix || '';
      const dur = 1300;
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  },
  { threshold: 0.4 }
);
function setCounter(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.dataset.target = String(value);
  counterObserver.observe(el);
}

/* ---------- tools ---------- */
function toolCard(tool, state, idx) {
  const permitted = state.canDownload;
  const badge = permitted
    ? '<span class="open-badge">✓ Unlocked</span>'
    : '<span class="lock-badge">🔒 Locked</span>';
  const button = permitted
    ? `<a class="btn primary small" href="/api/tools/${tool.id}/download">⬇ Download</a>`
    : `<button class="btn small" type="button" data-locked="${tool.id}">🔒 Locked — Login &amp; Get Permission</button>`;
  return `
  <article class="card reveal" style="--rd:${(idx % 3) * 0.08}s">
    <div class="icon">🛠️</div>
    <h3>${esc(tool.name)}</h3>
    ${tool.tagline ? `<div class="tagline">${esc(tool.tagline)}</div>` : ''}
    ${tool.description ? `<p>${esc(tool.description)}</p>` : '<p></p>'}
    <div class="chips">
      ${tool.version ? `<span class="chip acc">v${esc(tool.version)}</span>` : ''}
      ${tool.size_label ? `<span class="chip">${esc(tool.size_label)}</span>` : ''}
      <span class="chip">${tool.kind === 'link' ? 'External download' : 'Direct download'}</span>
    </div>
    <div class="foot">${badge}${button}</div>
  </article>`;
}

async function loadTools() {
  const grid = $('#toolsGrid');
  try {
    const res = await fetch('/api/tools');
    const data = await res.json();
    const tools = data.tools || [];
    setCounter('statTools', tools.length);
    if (!tools.length) {
      grid.innerHTML = '<div class="empty-state"><span class="big">🧰</span>No tools published yet — check back soon.</div>';
      return;
    }
    const state = { canDownload: !!data.canDownload };
    grid.innerHTML = tools.map((t, i) => toolCard(t, state, i)).join('');
    grid.querySelectorAll('[data-locked]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!currentUser) {
          toast('Please log in or sign up first — then ask the admin for download permission.');
          setTimeout(() => (location.href = '/login'), 900);
        } else {
          toast('Permission needed — the admin has not approved downloads for your account yet.', true);
        }
      });
    });
    watchReveals(grid);
  } catch {
    grid.innerHTML = '<div class="empty-state"><span class="big">⚠️</span>Could not load the tools. Please refresh the page.</div>';
  }
}

/* ---------- tutorials ---------- */
function videoCard(video, idx) {
  return `
  <article class="card video-card reveal" style="--rd:${(idx % 3) * 0.08}s">
    <button class="video-thumb" type="button" data-yt="${esc(video.youtube_id)}" aria-label="Play video: ${esc(video.title)}">
      <img src="https://i.ytimg.com/vi/${esc(video.youtube_id)}/hqdefault.jpg" alt="" loading="lazy">
      <span class="play"><span>▶</span></span>
    </button>
    <h3>${esc(video.title)}</h3>
  </article>`;
}

async function loadVideos() {
  const grid = $('#videosGrid');
  try {
    const res = await fetch('/api/videos');
    const data = await res.json();
    const videos = data.videos || [];
    setCounter('statTutorials', videos.length);
    if (!videos.length) {
      grid.innerHTML =
        '<div class="empty-state"><span class="big">🎬</span>Tutorial videos are coming soon.<br>New setup and how-to videos for every tool will appear here.</div>';
      return;
    }
    grid.innerHTML = videos.map(videoCard).join('');
    grid.querySelectorAll('.video-thumb').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.yt;
        btn.outerHTML = `<div class="video-thumb"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0" title="Tutorial video" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
      });
    });
    watchReveals(grid);
  } catch {
    grid.innerHTML = '<div class="empty-state"><span class="big">⚠️</span>Could not load the tutorials. Please refresh the page.</div>';
  }
}

/* ---------- website demos ---------- */
function demoCard(demo, idx) {
  const host = (() => {
    try { return new URL(demo.url).hostname; } catch { return ''; }
  })();
  const shot = demo.image_url
    ? `<div class="shot"><img src="${esc(demo.image_url)}" alt="${esc(demo.name)}" loading="lazy"></div>`
    : `<div class="shot">${esc(demo.name.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase())}</div>`;
  return `
  <article class="card demo-card reveal" style="--rd:${(idx % 3) * 0.08}s">
    ${shot}
    <h3>${esc(demo.name)}</h3>
    ${demo.description ? `<p>${esc(demo.description)}</p>` : '<p></p>'}
    <div class="foot">
      <span class="chip">${esc(host)}</span>
      <a class="btn primary small" href="${esc(demo.url)}" target="_blank" rel="noopener">Visit Site →</a>
    </div>
  </article>`;
}

async function loadDemos() {
  const grid = $('#demosGrid');
  try {
    const res = await fetch('/api/demos');
    const data = await res.json();
    const demos = data.demos || [];
    setCounter('statWebsites', demos.length);
    if (!demos.length) {
      grid.innerHTML = '<div class="empty-state"><span class="big">🌐</span>No websites to show yet.</div>';
      return;
    }
    grid.innerHTML = demos.map(demoCard).join('');
    watchReveals(grid);
  } catch {
    grid.innerHTML = '<div class="empty-state"><span class="big">⚠️</span>Could not load the websites. Please refresh the page.</div>';
  }
}

/* ---------- boot ---------- */
document.querySelectorAll('[data-count]:not([id])').forEach((el) => {
  el.dataset.target = '100'; // the static "100% Free" stat
  counterObserver.observe(el);
});
watchReveals();
initHeader();
loadTools();
loadVideos();
loadDemos();

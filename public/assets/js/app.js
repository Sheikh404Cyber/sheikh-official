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
  // Note: no Admin link here on purpose — the owner opens /admin directly.
  box.innerHTML = `
    <a class="btn ghost small hide-sm" href="/my-tools">My Tools</a>
    <span class="user-chip">👋 ${esc(currentUser.name.split(' ')[0])}</span>
    <button class="btn small" id="logoutBtn" type="button">Logout</button>`;
  $('#logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    location.reload();
  });
}

/* ---------- site config (photos + sales numbers) ---------- */
const siteConfig = {
  whatsapp_number: '8801957566098',
  bkash_number: '',
  nagad_number: '',
  photo_1: '/media/photo-1.jpg',
  photo_2: '/media/photo-2.jpg',
  photo_3: '/media/photo-3.jpg',
};
async function loadSiteConfig() {
  try {
    const res = await fetch('/api/site-config');
    const data = await res.json();
    if (data.ok) Object.assign(siteConfig, data);
  } catch { /* keep defaults */ }
  const setSrc = (id, url) => {
    const el = document.getElementById(id);
    if (el && url && el.getAttribute('src') !== url) el.src = url;
  };
  setSrc('heroPhoto1', siteConfig.photo_1);
  setSrc('heroPhoto2', siteConfig.photo_2);
  setSrc('heroPhoto3', siteConfig.photo_3);
  setSrc('aboutPhoto', siteConfig.photo_1);
  // How-to-Buy payment lines: shown only when the number is set.
  const pay = (lineId, num) => {
    const line = document.getElementById(lineId);
    if (!line) return false;
    if (num) {
      line.querySelector('b').textContent = num;
      line.classList.remove('hidden');
      return true;
    }
    return false;
  };
  const anyPay = pay('payBkash', siteConfig.bkash_number) | pay('payNagad', siteConfig.nagad_number);
  const fb = document.getElementById('payFallback');
  if (fb) fb.classList.toggle('hidden', !!anyPay);
}
const waNumber = () => String(siteConfig.whatsapp_number || '').replace(/\D/g, '') || '8801957566098';

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
function buyLink(tool) {
  const msg = `Assalamu Alaikum! Ami SHEIKH OFFICIAL theke '${tool.name}'${tool.price ? ` (${tool.price})` : ''} kinte chai.`;
  return `https://wa.me/${waNumber()}?text=${encodeURIComponent(msg)}`;
}

function toolCard(tool, idx) {
  const owned = !!tool.owned;
  const badge = owned
    ? '<span class="open-badge">✓ You own this</span>'
    : '<span class="lock-badge">🔒 Locked</span>';
  const button = owned
    ? `<a class="btn primary small" href="/api/tools/${tool.id}/download">⬇ Download</a>`
    : `<a class="btn whatsapp small" href="${buyLink(tool)}" target="_blank" rel="noopener">🛒 Buy on WhatsApp</a>`;
  const demo = tool.demo_youtube
    ? `<button class="btn ghost small demo-toggle" type="button" data-demo="${esc(tool.demo_youtube)}" aria-expanded="false">▶ Watch demo</button>
       <div class="demo-box hidden"></div>`
    : '';
  return `
  <article class="card reveal" style="--rd:${(idx % 3) * 0.08}s">
    ${tool.logo ? '<div class="icon has-logo"><img src="' + esc(tool.logo) + '" alt="" loading="lazy"></div>' : '<div class="icon">🛠️</div>'}
    <h3>${esc(tool.name)}</h3>
    ${tool.tagline ? `<div class="tagline">${esc(tool.tagline)}</div>` : ''}
    ${tool.description ? `<p>${esc(tool.description)}</p>` : '<p></p>'}
    <div class="chips">
      ${tool.price ? `<span class="chip price">💰 ${esc(tool.price)}</span>` : ''}
      ${tool.version ? `<span class="chip acc">v${esc(tool.version)}</span>` : ''}
      ${tool.size_label ? `<span class="chip">${esc(tool.size_label)}</span>` : ''}
      <span class="chip">${tool.kind === 'link' ? 'External download' : 'Direct download'}</span>
    </div>
    ${demo}
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
    grid.innerHTML = tools.map((t, i) => toolCard(t, i)).join('');
    grid.querySelectorAll('[data-demo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const box = btn.parentElement.querySelector('.demo-box');
        const open = btn.getAttribute('aria-expanded') === 'true';
        if (open) {
          box.classList.add('hidden');
          box.innerHTML = '';
          btn.setAttribute('aria-expanded', 'false');
          btn.textContent = '▶ Watch demo';
        } else {
          box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(btn.dataset.demo)}?rel=0" title="Tool demo video" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
          box.classList.remove('hidden');
          btn.setAttribute('aria-expanded', 'true');
          btn.textContent = '✕ Hide demo';
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

/* ---------- testimonials ---------- */
async function loadTestimonials() {
  const section = $('#testimonials');
  const grid = $('#testiGrid');
  if (!section || !grid) return;
  try {
    const res = await fetch('/api/testimonials');
    const data = await res.json();
    const items = data.testimonials || [];
    if (!items.length) return; // section stays hidden
    grid.innerHTML = items
      .map(
        (t, i) => `
      <article class="card testi-card reveal" style="--rd:${(i % 3) * 0.08}s">
        <div class="quote">”</div>
        <p>${esc(t.text)}</p>
        <div class="who"><div class="nm">${esc(t.name)}</div>${t.meta ? `<div class="mt">${esc(t.meta)}</div>` : ''}</div>
      </article>`
      )
      .join('');
    section.classList.remove('hidden');
    watchReveals(grid);
    watchReveals(section);
  } catch { /* section stays hidden */ }
}

/* ---------- faq ---------- */
async function loadFaqs() {
  const section = $('#faq');
  const list = $('#faqList');
  if (!section || !list) return;
  try {
    const res = await fetch('/api/faqs');
    const data = await res.json();
    const items = data.faqs || [];
    if (!items.length) return; // section stays hidden
    list.innerHTML = items
      .map(
        (f) => `
      <div class="faq-item reveal">
        <button class="faq-q" type="button" aria-expanded="false"><span>${esc(f.q)}</span><span class="chev">▾</span></button>
        <div class="faq-a"><p>${esc(f.a)}</p></div>
      </div>`
      )
      .join('');
    section.classList.remove('hidden');
    list.querySelectorAll('.faq-item').forEach((item) => {
      const btn = item.querySelector('.faq-q');
      const panel = item.querySelector('.faq-a');
      btn.addEventListener('click', () => {
        const open = item.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
        panel.style.maxHeight = open ? `${panel.scrollHeight}px` : '0px';
      });
    });
    watchReveals(list);
    watchReveals(section);
  } catch { /* section stays hidden */ }
}

/* ---------- hire me form ---------- */
(function initHire() {
  const form = $('#hireForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = $('#hireError');
    const btn = $('#hireSubmit');
    errBox.classList.remove('show');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    // The hidden `website` input is a bot honeypot and must stay empty.
    const message = $('#hireMessage').value.trim();
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: $('#hireName').value,
          contact: $('#hireContact').value,
          service: $('#hireService').value,
          message,
          website: $('#hireWebsite').value,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || 'Something went wrong. Please try again.');
      form.reset();
      $('#hireDone').classList.remove('hidden');
      toast('Request sent — I will contact you soon.');
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Request';
    }
  });
})();

/* ---------- boot ---------- */
document.querySelectorAll('[data-count]:not([id])').forEach((el) => {
  el.dataset.target = '100'; // the static "100%" stat
  counterObserver.observe(el);
});
watchReveals();
initHeader();
(async () => {
  await loadSiteConfig(); // buy buttons + payment lines need the numbers first
  loadTools();
})();
loadVideos();
loadDemos();
loadTestimonials();
loadFaqs();

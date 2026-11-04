# TECH STACK — SHEIKH OFFICIAL

Decision (per the rebuild brief, Part 4 + Rule 11): **preserve the existing,
working architecture** — a live members platform with auth, D1 data, admin
CMS and license signing — and add the smallest library set that reproduces
the reference experience. A React/Vite rewrite was rejected: it would break
every working system for no user-visible gain.

## Platform

- **Cloudflare Pages** (static `public/` + Pages Functions) — deploy:
  `wrangler pages deploy public --project-name sheikh-official`.
- **D1 (SQLite)** for users/tools/videos/demos/orders/settings; schema in
  `schema.sql`. GitHub repo is backup + release host (pushes do NOT deploy).

## Frontend

- Hand-written HTML/CSS/JS, no build step. Shared `style.css` design tokens
  (see DESIGN_SYSTEM.md); per-page JS (`app.js`, `auth.js`, `my-tools.js`,
  `admin.js`, `theme.js`).
- Fonts self-hosted woff2: Poppins (UI), Anton (display), Caveat (script).
  Zero external requests for fonts/CSS/JS.

## Motion libraries (self-hosted in `public/assets/js/vendor/`)

| Library | Version source | Why |
|---|---|---|
| GSAP core | npm `gsap` (3.13-era, now fully free) | timeline-grade easing, quickTo magnetic/cursor |
| ScrollTrigger | same package | scroll-linked parallax, reveal triggers |
| SplitText | same package (free since GSAP's Webflow release) | word-mask headline reveals — the brief's first choice, properly available |
| Lenis | npm `lenis` | smooth scrolling synced to ScrollTrigger |

Loaded only on the homepage, before `app.js`/`motion.js`. All are additive
enhancements; the site is fully functional without them.

## Media

- Hero portrait: owner-supplied triptych cutout, served as WebP
  (`amin-triptych.webp`, 268 KB; PNG master kept alongside).
- Card/demo/tutorial images lazy-loaded (`loading="lazy"` in templates).

## How to run / change things

- Edit content (tools, videos, demos, FAQs, reviews, settings) in `/admin` —
  no code changes needed.
- Change the accent: one variable, `--acc` in `style.css` `:root`
  (+ `[data-theme="light"]` override).
- Replace the hero portrait: swap `public/media/amin-triptych.webp`
  (keep the 2:1 ratio and transparent background) — no code change.
- Motion behaviour: `public/assets/js/motion.js` + the `.reveal` system in
  `style.css` (see ANIMATION_GUIDE.md).

# QA REPORT — Editorial rebuild (2026-11-05)

Method: local static server + stubbed live APIs, puppeteer-core driving
headless Chromium; screenshots inspected frame-by-frame. Live deploy
verified by fetching the production URL and assets after each deploy.

## Tested & passed

- **Visual:** hero composition vs reference frames — script/name/role/lead/
  CTAs/socials left, stats right, solid accent giant band behind portrait,
  triptych portrait in front. Tools section: headline cascade, card-inside
  sequence, ghost numbers, wipe reveals all visible in mid-animation frames.
- **Libraries:** GSAP + ScrollTrigger + SplitText + Lenis all load from
  local vendor files; `html.gsap` + `html.lenis` present; SplitText word
  wrappers present in section headlines; zero horizontal overflow at
  1440 / 1280 / 1024 / 768 / 390 / 360 px.
- **Console:** no JS errors. One sandbox-only resource failure
  (ERR_TUNNEL_CONNECTION_FAILED for an external thumbnail through the test
  proxy) — environment artifact, not a site defect.
- **Functional (unchanged systems):** tools/tutorials/demos render from the
  live APIs; counters settle at real values (4 / 2 / 1 / 100%); theme
  toggle, login/signup/admin routes untouched by this rebuild.
- **Performance:** hero image optimized PNG 1.94 MB → WebP 268 KB;
  card images lazy-loaded; motion libs total ~137 KB, homepage only.
- **Reduced motion:** media-query fallbacks present for every animation
  system; motion.js exits early under `prefers-reduced-motion`.

## Tested with limits

- **Cursor ring + magnetic buttons:** implemented and gated on
  `(pointer:fine)`, but the headless test browser reports no fine pointer,
  so the behaviours could not be exercised in automation. Code-reviewed;
  needs one human check on a real desktop.
- **Light theme with red accent:** variables swapped and contrast-checked
  by token values; not screenshot-verified this round.

## Status by brief deliverable

| Item | Status |
|---|---|
| REFERENCE_ANALYSIS.md | Completed |
| DESIGN_SYSTEM.md | Completed |
| ANIMATION_GUIDE.md | Completed |
| TECH_STACK.md | Completed |
| README.md | Completed (editorial section appended) |
| Accent = reference red, site-wide | Completed |
| Loader / assembly grammar / wipe / line-rise / row slides | Completed (v3–v4) |
| Solid giant band + letter fly-in + bold long-travel motion | Completed (v5) |
| Triptych hero portrait (owner-supplied) | Completed (v6) |
| GSAP + ScrollTrigger + SplitText + Lenis (local) | Completed (v7) |
| Magnetic CTAs, cursor ring | Completed (human check pending, see above) |
| Responsive QA at 6 widths | Completed (overflow = 0 everywhere) |
| Reference Awards/Skills/Journey/Before-After sections | **Not implemented — no source content exists** for the owner; the brief forbids inventing content (Rules 09/12). Will build immediately when content is supplied. |
| Live reference URL inspection | **Unable to verify — no URL was provided**; recordings were the only source. |

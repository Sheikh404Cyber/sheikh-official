# ANIMATION GUIDE — SHEIKH OFFICIAL motion system

Two cooperating layers. The CSS layer is the foundation and works alone;
the JS layer (GSAP) upgrades it when libraries load. Nothing depends on the
JS layer for visibility of content in reduced-motion or failure cases.

## Layer 1 — CSS reveal system (`public/assets/css/style.css`)

- **Loader:** `#edLoader` — black overlay, pulsing logo mark, fades out at
  ~0.55 s; the hero timeline is retimed to start as it lifts.
- **Hero timeline (load):** giant word letters fly in from alternating sides
  (JS-split spans, .8 s + letter stagger) → script → name letters → triptych
  portrait rises (92 px + scale, `edCutIn`) → subtitle/location/lead/CTAs/
  socials staggered fade-ups → stats slide from right → signature.
- **Scroll reveals:** `.reveal` + IntersectionObserver (`.in`). Travel 30–70 px,
  duration .95 s, easing `cubic-bezier(.22,1.12,.36,1)` (spring landing).
  Section heads cascade internally (kicker → h2 → lead). Grid cards wait
  +0.18 s so the headline lands first, then rise left→right via `--rd`
  stagger; **card children then cascade** (image first, text after).
- **Image reveals:** card/about images wipe left→right via `clip-path`
  (0.95–1.2 s) while the img settles from scale 1.16 → 1; hover zoom kept.
- **Rows:** FAQ items, contact buttons, process steps slide from the left.
- **Footer giant:** two lines rise through overflow masks, line stagger .14 s.
- **Ambient:** 7 twinkling sparkles around the hero portrait (CSS loop);
  accent triangle cursor trail (JS, fine pointers, throttled spawns).
- **Counters:** stats count up on entry (app.js).

## Layer 2 — GSAP system (`public/assets/js/motion.js`, vendor libs local)

- **Lenis** smooth scroll (duration 1.15), synced to ScrollTrigger via the
  GSAP ticker; in-page anchors are routed through `lenis.scrollTo` (−64 px
  header offset).
- **SplitText** word-mask reveal on every `.section-head h2` (words rise
  115% → 0, stagger .06, `power3.out`, trigger at 88% viewport, once).
  When active, `<html>` gets `.gsap` and CSS hands the h2 transform over.
- **Hero parallax:** giant band drifts `yPercent 34`, triptych `y −30`,
  scrubbed over the hero's scroll-out.
- **Magnetic CTAs:** hero + header primary buttons attract toward the
  pointer (×0.25/×0.35, `quickTo` .4 s) and spring back on leave.
- **Cursor ring:** 34 px accent ring follower (quickTo .35 s), scales to
  1.7× over links/buttons/cards/inputs. Desktop fine pointers only.

## Rules

- Animate only `transform`, `opacity`, `clip-path`.
- Every animation fires once, on entry — no scroll-jacking, no loops except
  ambient sparkles/trail.
- `prefers-reduced-motion`: loader/sparkles/trail off, reveals show final
  states, motion.js exits immediately (no Lenis, no GSAP animations).
- If a vendor file 404s, layer 1 carries the site unchanged.

# DESIGN SYSTEM — SHEIKH OFFICIAL (editorial system)

All tokens below are the live CSS variables in `public/assets/css/style.css`.
The accent was switched from teal to the reference red on 2026-11-05 by the
owner's order ("coloure lal daw").

## Color tokens

| Token | Dark theme | Light theme | Use |
|---|---|---|---|
| `--bg` | `#05090c` | `#f4f7f8` | page background |
| `--bg2` | `#08131a` | `#e9eff1` | alt background |
| `--surface` | `#0b151d` | `#ffffff` | cards |
| `--surface2` | `#0e1a24` | `#f0f4f5` | raised cards |
| `--acc` | `#e10600` | `#8f0400` | THE accent (reference red) |
| `--acc-deep` | `#8f0400` | `#8f0400` | accent gradients/depth |
| `--acc-soft` | `rgba(230,6,0,.12)` | same | accent washes |
| `--border` | `rgba(230,6,0,.18)` | same | accent-tinted hairlines |
| `--border-soft` | `rgba(255,255,255,.08)` | `rgba(10,25,32,.1)` | neutral hairlines |
| `--text` | `#e9f4f3` | `#0c1a20` | primary text |
| `--muted` | `#93a8ad` | `#5a6d73` | secondary text |

Rule: one accent only. No gradients except the accent's own (logo lockups and
the hero name's accent half). No glassmorphism, no random glows.

## Typography tokens

| Role | Font | Pattern |
|---|---|---|
| Display / giant word / numbers | Anton 400 (self-hosted) | uppercase, `clamp()` sizes, letter-spacing ~0.01em |
| Section headlines | Anton 400 | uppercase sentence headlines ending with "." |
| Script accents | Caveat 600–700 (variable, self-hosted) | "Hello, I'm", signature; slight −3° tilt |
| Body / UI | Poppins 400/500/600/700/800 (self-hosted) | 15–17 px body, 1.6 line-height |
| Kickers | Poppins 700 | 11–12 px, uppercase, letter-spacing .34em, accent or muted |
| Ghost card numbers | Anton | accent at ~14% opacity, section counter (01, 02…) |

Fluid sizes: hero name `clamp(56px, 8.5vw, 118px)`; giant word
`clamp(130px, 19.5vw, 300px)`; section h2 `clamp(34px, 5vw, 58px)`.

## Layout tokens

- Content width: `--wrap: min(1200px, 92vw)`, centered.
- Section padding: ~110 px top/bottom desktop, ~70 px mobile.
- Section-head margin-bottom: ~44 px; kicker→h2→lead cascade inside.
- Grid: tools/videos/demos = `repeat(auto-fill, minmax(250px, 1fr))`, gap 20 px.
- Breakpoints: 1080 px (hero condenses), 900 px (single column), 640 px
  (compact type), QA-verified at 1440/1280/1024/768/390/360.
- Image ratios: card media 16:9; hero portrait = supplied cutout at natural
  ratio (current: 2:1 triptych, bottom-masked).

## Motion tokens (see ANIMATION_GUIDE.md for the full system)

- Reveal distance: 30–70 px travel; duration .5–1.2 s; easing
  `cubic-bezier(.22,1.12,.36,1)` (spring landing) for CSS layer,
  GSAP `power3.out` / `back.out(1.4)` for the JS layer.
- Assembly order is law: headline first → content left→right / top→bottom →
  inside a card: image first, text after.
- Everything animates once, on entry; `prefers-reduced-motion` disables the
  system and shows final states.

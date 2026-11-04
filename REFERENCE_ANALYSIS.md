# REFERENCE ANALYSIS — RENANDO Portfolio (reference) → SHEIKH OFFICIAL (target)

Source material: two screen recordings supplied by the site owner on 2026-11-05
(`Screen Recording 2026-11-05 043704.mp4` + a second, closer recording, 31 s).
The reference was recorded inside a page-builder preview (localhost:5500), so the
recordings show the site's real load/scroll animations playing in the canvas.
No live reference URL was provided; every finding below is classified as
**Confirmed** (visible in the recordings), **Hypothesis** (reasonable technical
inference, not directly observable), or **Unknown** (cannot be verified without
the live site).

## A. Visual Identity

- **Design philosophy (Confirmed):** Dark editorial portfolio. The page is a
  stage: near-black background, white type, ONE vivid accent. Nothing is
  pre-rendered in view — every section *assembles* on entry.
- **Visual style (Confirmed):** Brutalist-leaning oversized condensed
  typography, generous negative space, thin borders, minimal decoration
  except floating geometric sparkles.
- **Brand personality (Confirmed):** Confident, cinematic, craftsman-like.
- **Color palette (Confirmed as relationships; exact source hex Unknown):**
  background near-black (~#0A0A0B), text white (~#FFFFFF), muted grey text,
  accent vivid red (implementation token chosen: `#E10600`, see DESIGN_SYSTEM.md),
  accent used for: giant word, numbers, years, primary button, kickers.
- **Typography (Confirmed):** Condensed grotesque display face (Anton class)
  for hero word, headlines, big numbers; a script face (Caveat class) for
  "Hello, I'm" and the signature; a clean grotesque for body/UI (Poppins on
  the target site). Kickers are small, letter-spaced, uppercase, accent or
  muted, formatted `NN / SECTION NAME`.
- **Spacing (Confirmed):** Very large section padding; headlines sit far above
  their content; content max-width ~1200 px class.
- **Borders/radius (Confirmed):** Thin 1 px borders, mostly square or mildly
  rounded cards; the reference leans square/brutalist.
- **Background treatment (Confirmed):** Flat near-black with a very subtle
  radial glow behind the hero portrait.
- **Image treatment (Confirmed):** Person is a background-removed cutout
  standing IN FRONT of the giant word; project images are cinematic 16:9
  stills with a play affordance; images reveal by wipe, never by plain fade.

## B. Layout Analysis

- **Header (Confirmed):** Slim fixed bar: logo left, nav center/right,
  one filled accent CTA at the far right.
- **Hero (Confirmed):** Full viewport. Left column: script line → giant name →
  role → short paragraph → CTA row → socials. Center/right: large portrait
  cutout. Far right: vertical stats stack (big accent number + small label)
  + script signature under it. Behind everything, at portrait mid-height, a
  SOLID accent word band spanning the full width (reference: "PORTFOLIO").
- **Sections in order (Confirmed):** 01 Works (filter tabs under headline,
  3-col card grid) → client logo strip → Recognition ("THE WORK. THE
  RECOGNITION." + giant counter "10" + award rows with accent years) →
  Before/After ("FROM RAW. TO REAL.", image panel right) → Story headline →
  Process steps 01–05 → (further sections below the recorded area, Unknown) →
  Footer with giant two-line "LET'S WORK TOGETHER." + contact rows.
- **Grid (Confirmed):** Works = 3 columns desktop; rows (awards, footer
  contacts) are full-width list rows with hairline dividers.
- **Mobile (Hypothesis):** Single column stacking; giant word scales with vw;
  stats become a horizontal row. Not visible in the recordings.

## C. Animation Analysis (durations are frame-based estimates)

| Element | Initial | Final | Trigger | Dur. | Delay/Stagger | Easing feel | Direction | Repeats |
|---|---|---|---|---|---|---|---|---|
| Loader mark | black screen, small logo | fades out | page load | ~0.6 s | — | ease-out | fade | once |
| Giant hero word | letters offset ±X, invisible | letters settled, solid | load, after loader | ~0.8 s | per-letter ~0.06 s | spring/overshoot | from both sides | once |
| Hero script/name/role/para/CTAs/socials | 20–40 px below, invisible | in place | load sequence | 0.5–0.9 s | cascade 0.1–0.2 s steps | ease-out | up | once |
| Portrait cutout | below + slightly small | standing | load | ~1 s | mid-sequence | ease-out | up + scale | once |
| Hero stats | off right edge | in place | load | ~0.7 s | per-stat stagger | ease-out | from right | once |
| Ambient sparkles | — | twinkle loop | always | ~3 s loop | random offsets | ease-in-out | scale/rotate | infinite |
| Cursor sparkles | — | triangle trail follows pointer | pointer move | ~0.5 s life | per-move spawn | ease-out | follows | continuous |
| Section headline | 30–50 px below, invisible | in place | scroll into view | ~0.8 s | kicker → title → text | ease-out | up | once |
| Work cards | 40–70 px below, invisible; image box empty | image wipes in, then number/title | scroll into view | 0.7–1.2 s | left→right stagger; inside card: image first, text after | ease-out / spring | up; image left→right wipe | once |
| Logo strip items | invisible/small | in place | scroll into view | ~0.5 s | sequential | ease-out | fade/scale | once |
| Award rows | off left/right, invisible | in place, year accent | scroll into view | ~0.6 s | top→bottom cascade | ease-out | from side | once |
| Big counter | 0 | target number | scroll into view | ~1.5 s | — | ease-out | count up | once |
| Before/After image | empty frame | image wipes in slices | scroll into view | ~1 s | — | ease-out | left→right wipe | once |
| Footer giant lines | masked below | lines rise | scroll into view | ~0.85 s | per-line 0.14 s | ease-out | up through mask | once |
| Hero on scroll-out | in place | drifts/fades (parallax) | scroll | scrub | — | linear | up slower | continuous |

## D. Interaction Analysis

- **Confirmed:** sparkle triangle cursor trail (multi-colour triangles,
  standard arrow cursor kept). Scroll drives every reveal; sections never
  animate before entering.
- **Hypothesis:** card hover = image zoom; primary buttons have a fill/Shift
  hover; smooth-scroll library (Lenis-class) underlies the buttery scroll;
  headline reveals are SplitText-class word/line animations (GSAP ecosystem).
- **Unknown:** menu behaviour, filter-tab functionality, page transitions,
  form behaviour — not exercised in the recordings.

## Target mapping (SHEIKH OFFICIAL)

Reference Works → Tools + Tutorials + Websites(demos); Recognition → the
site's real stats (4 tools / 2 websites / 1 tutorial / 100% quality — real
data only); Process → existing "From Idea. To Product." 5 steps; Footer CTA →
existing giant footer. Reference sections with NO source content on the
target (Awards list, Skills bars, Journey timeline, Before/After) are NOT
fabricated — see QA_REPORT.md status table.

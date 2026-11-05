/* SHEIKH OFFICIAL — motion system layer.
   GSAP + ScrollTrigger + SplitText + Lenis, all self-hosted under /assets/js/vendor/.
   Purely additive: if any library fails to load, the CSS reveal system underneath
   still runs the site exactly as before. Respects prefers-reduced-motion. */
(() => {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !window.gsap || !window.ScrollTrigger) return;
  document.documentElement.classList.add('gsap');
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);

  /* ---- Lenis smooth scroll, synced with ScrollTrigger ---- */
  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id && id.length > 1 && document.querySelector(id)) {
          e.preventDefault();
          lenis.scrollTo(id, { offset: -64 });
        }
      });
    });
  }

  /* ---- Section headlines: word-by-word masked rise ---- */
  if (window.SplitText) {
    document.querySelectorAll('.section-head h2').forEach((h2) => {
      try {
        const split = new SplitText(h2, { type: 'words', mask: 'words' });
        gsap.from(split.words, {
          yPercent: 115, duration: 0.9, ease: 'power3.out', stagger: 0.06,
          scrollTrigger: { trigger: h2, start: 'top 88%', once: true },
        });
      } catch (err) { /* CSS cascade stays as the fallback */ }
    });
  }

  /* ---- Hero parallax while scrolling out ----
     The SHEIKH band now lives INSIDE .ed-tri (locked stage): it rides the
     portrait's parallax. No separate tween — they must never separate. */
  gsap.to('.ed-tri', {
    y: -30, ease: 'none',
    scrollTrigger: { trigger: '.ed-hero', start: 'top top', end: 'bottom top', scrub: true },
  });

  /* ---- Fine-pointer extras: magnetic CTAs + cursor ring ---- */
  if (window.matchMedia && matchMedia('(pointer:fine)').matches) {
    document.querySelectorAll('.hero-ctas .btn, .site-header .btn').forEach((btn) => {
      const xTo = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3' });
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.25);
        yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });

    const ring = document.createElement('div');
    ring.id = 'cursorRing';
    ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ring);
    const rx = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3' });
    addEventListener('pointermove', (e) => { rx(e.clientX); ry(e.clientY); }, { passive: true });
    document.addEventListener('mouseover', (e) => {
      ring.classList.toggle('on', !!e.target.closest('a, button, .card, input, textarea, select, label'));
    });
  }
})();

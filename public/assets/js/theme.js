// Day / dark theme switch (Wildcut-style slider) — dark is the default; choice saved per browser.
(function () {
  var root = document.documentElement;
  var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13.6A8.4 8.4 0 1 1 10.4 4a6.9 6.9 0 0 0 9.6 9.6z"/></svg>';
  function paint() {
    var light = root.dataset.theme === 'light';
    document.querySelectorAll('[data-theme-btn]').forEach(function (b) {
      var knob = b.querySelector('.knob');
      if (knob) knob.innerHTML = light ? MOON : SUN;
      b.setAttribute('aria-checked', light ? 'true' : 'false');
      b.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to day mode');
    });
  }
  document.querySelectorAll('[data-theme-btn]').forEach(function (b) {
    b.addEventListener('click', function () {
      var light = root.dataset.theme !== 'light';
      if (light) root.dataset.theme = 'light'; else delete root.dataset.theme;
      try { localStorage.setItem('so_theme', light ? 'light' : 'dark'); } catch (e) {}
      paint();
    });
  });
  paint();
})();

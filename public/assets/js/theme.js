// Day / dark theme toggle — dark is the default; the choice is saved per browser.
(function () {
  var root = document.documentElement;
  function paint() {
    var light = root.dataset.theme === 'light';
    document.querySelectorAll('[data-theme-btn]').forEach(function (b) {
      b.textContent = light ? '\u{1F319}' : '\u2600\uFE0F';
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

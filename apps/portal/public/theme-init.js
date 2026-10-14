// Apply the stored theme before first paint so a dark-mode user never sees a
// flash of the light canvas. A file rather than an inline script so the
// Content-Security-Policy can forbid inline script outright.
(function () {
  try {
    var stored = localStorage.getItem('enzo-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();

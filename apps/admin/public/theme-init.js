// Apply the stored theme before first paint so a dark-mode user never sees a
// flash of the light canvas. A file rather than an inline script so the
// Content-Security-Policy can forbid inline script outright.
(function () {
  try {
    var stored = localStorage.getItem('enzo-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
  // The opening animation (src/components/Splash.tsx) is due on this load: mark
  // the page so the stylesheet paints its green before the app's code arrives.
  // The same rule as due() there: first load, or 8 hours since it last played.
  try {
    var last = Number(localStorage.getItem('enzo:splash-at'));
    if (!last || Date.now() - last >= 288e5) document.documentElement.classList.add('splash-due');
  } catch (e) {
    document.documentElement.classList.add('splash-due');
  }
})();

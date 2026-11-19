/* DAWAPPS theme + standalone chrome.
   Load synchronously in <head> (after the theme-color meta) so there is no flash. */
(function () {
  'use strict';
  var KEY = 'daw-theme';
  var root = document.documentElement;
  var D = (window.DAW = window.DAW || {});

  var embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
  if (embedded) root.classList.add('embedded');

  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function system() {
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function current() { var s = saved(); return s === 'dark' || s === 'light' ? s : system(); }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#10131b' : '#f5f7fb');
    try { window.dispatchEvent(new CustomEvent('daw-theme', { detail: theme })); } catch (e) {}
  }
  function set(theme) {
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    apply(theme);
  }

  D.theme = {
    embedded: embedded,
    get: current,
    set: set,
    toggle: function () { set(current() === 'dark' ? 'light' : 'dark'); }
  };

  apply(current());

  // Keep every open document (hub + iframe) in sync.
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(current()); });
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (!saved()) apply(current()); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  // Inside the hub workspace, Esc asks the hub to close the panel.
  if (embedded) {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        try { parent.postMessage({ daw: 'close' }, location.origin); } catch (err) {}
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    apply(current());
    if (embedded || document.body.hasAttribute('data-bare')) return;

    var bar = document.createElement('header');
    bar.className = 'daw-bar';
    bar.innerHTML =
      '<a href="../index.html" aria-label="Back to DAWAPPS hub">← DAWAPPS</a>' +
      '<button type="button" class="secondary" id="daw-theme-btn"></button>';
    document.body.insertBefore(bar, document.body.firstChild);

    var btn = bar.querySelector('#daw-theme-btn');
    function label() { btn.textContent = current() === 'dark' ? '☀ Light' : '☾ Dark'; }
    btn.addEventListener('click', function () { D.theme.toggle(); });
    window.addEventListener('daw-theme', label);
    label();
  });
})();

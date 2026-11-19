/* DAWAPPS shared helpers: DAW.$, copy, toast, download, debounce, store, esc */
(function () {
  'use strict';
  var D = (window.DAW = window.DAW || {});

  D.$ = function (id) { return document.getElementById(id); };

  D.debounce = function (fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  };

  var toastEl, toastTimer;
  D.toast = function (msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 1600);
  };

  D.copy = function (text, btn) {
    function done(ok) {
      D.toast(ok ? 'Copied to clipboard' : 'Copy failed');
      if (btn && ok) {
        var original = btn.dataset.label || btn.textContent;
        btn.dataset.label = original;
        btn.textContent = 'Copied ✓';
        clearTimeout(btn._t);
        btn._t = setTimeout(function () { btn.textContent = original; }, 1200);
      }
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove();
      done(ok);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    } else {
      fallback();
    }
  };

  D.download = function (blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  };

  D.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  D.store = {
    get: function (key, fallback) {
      try { var v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    }
  };
})();

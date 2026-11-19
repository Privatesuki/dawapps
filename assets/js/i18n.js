/* DAWAPPS i18n — dictionary-based translation of the whole UI, no markup changes needed.
 *
 *  - English text in the HTML/JS is the source key. Dictionaries live in assets/i18n/<code>.js and set
 *    window.DAW_I18N[code] = { "English text": "Translation", ... }.
 *  - Text nodes, placeholder / title / aria-label / alt attributes and <title> are translated, including
 *    text that app scripts insert later (MutationObserver).
 *  - Keys may contain "{}" placeholders ("Showing {} of {}"). Digits in a string are matched automatically.
 *  - Mark an element translate="no" (or data-no-i18n) to leave it alone.
 *  - The chosen language is saved in localStorage ("daw-lang") and shared by the hub and the embedded apps.
 *
 *  API: DAW.i18n.langs, .get(), .set(code), .t(text)  · event "daw-lang" on window.
 */
(function () {
  'use strict';
  var D = (window.DAW = window.DAW || {});
  var KEY = 'daw-lang';
  var LANGS = [
    { c: 'en', n: 'English (International)', dir: 'ltr' },
    { c: 'id', n: 'Bahasa Indonesia', dir: 'ltr' },
    { c: 'jv', n: 'Basa Jawa', dir: 'ltr' },
    { c: 'ja', n: '日本語', dir: 'ltr' },
    { c: 'de', n: 'Deutsch', dir: 'ltr' },
    { c: 'ko', n: '한국어', dir: 'ltr' },
    { c: 'zh', n: '中文（简体）', dir: 'ltr' },
    { c: 'es', n: 'Español', dir: 'ltr' },
    { c: 'ar', n: 'العربية', dir: 'rtl' }
  ];
  var script = document.currentScript;
  var BASE = script && script.src ? script.src.replace(/js\/i18n\.js.*$/, 'i18n/') : 'assets/i18n/';
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|PRE|KBD|NOSCRIPT|SVG|CANVAS)$/;
  var HAS_LETTER = /\p{L}/u;

  var mem = null;
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return mem; } }
  function persist(c) { mem = c; try { localStorage.setItem(KEY, c); } catch (e) {} }
  function known(c) { return LANGS.some(function (l) { return l.c === c; }); }
  function detect() {
    var s = saved(); if (known(s)) return s;
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      var c = String(list[i]).toLowerCase().split('-')[0];
      if (c === 'in') c = 'id';
      if (known(c)) return c;
    }
    return 'en';
  }

  var lang = 'en', dict = null, templates = [], ready = false;

  /* ---------- lookup ---------- */
  var norm = function (s) { return s.replace(/\s+/g, ' ').trim(); };
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function fill(str, arr) {                       // "{}" = next capture, "{2}" = capture number 2
    var i = 0;
    return str.replace(/\{(\d*)\}/g, function (_, n) { var v = n ? arr[+n - 1] : arr[i++]; return v == null ? '' : v; });
  }

  function buildTemplates() {
    templates = [];
    if (!dict) return;
    Object.keys(dict).forEach(function (k) {
      if (k.indexOf('{}') < 0) return;
      templates.push({ re: new RegExp('^' + esc(k).replace(/\\\{\\\}/g, '(.+?)') + '$'), out: dict[k] });
    });
  }

  function lookup(en) {
    if (!dict) return null;
    var k = norm(en);
    if (!HAS_LETTER.test(k)) return null;
    if (has(dict, k)) return dict[k];
    var nums = [];
    var g = k.replace(/\d+(?:[.,]\d+)?/g, function (m) { nums.push(m); return '{}'; });
    if (nums.length && has(dict, g)) return fill(dict[g], nums);
    for (var i = 0; i < templates.length; i++) {
      var m = templates[i].re.exec(k);
      if (m) return fill(templates[i].out, m.slice(1).map(function (x) { var t = lookup(x); return t == null ? x : t; }));
    }
    return null;
  }

  function translateTitle(en) {
    return en.split(' · ').map(function (p) { var t = lookup(p); return t == null ? p : t; }).join(' · ');
  }

  /* ---------- DOM ---------- */
  function skipped(node) {
    for (var p = node.parentNode; p && p.nodeType === 1; p = p.parentNode) {
      if (SKIP.test(p.nodeName.toUpperCase())) return true;
      if (p.getAttribute('translate') === 'no' || p.hasAttribute('data-no-i18n')) return true;
    }
    return false;
  }

  function doText(node) {
    if (node.__tr !== undefined && node.data === node.__tr) { /* ours: keep recorded English */ }
    else node.__en = node.data;                              // new English text from the page
    var en = node.__en, out = en;
    if (lang !== 'en') {
      if (skipped(node)) { node.__tr = node.data; return; }
      var inTitle = node.parentNode && node.parentNode.nodeName === 'TITLE';
      var t = inTitle ? translateTitle(norm(en)) : lookup(en);
      if (t != null && t !== norm(en)) out = en.match(/^\s*/)[0] + t + en.match(/\s*$/)[0];
    }
    node.__tr = out;
    if (node.data !== out) node.data = out;
  }

  function doAttr(el, name) {
    var v = el.getAttribute(name);
    if (v == null) return;
    var rec = el.__trA || (el.__trA = {}), en = el.__enA || (el.__enA = {});
    if (rec[name] === undefined || rec[name] !== v) en[name] = v;   // new English value
    var out = en[name];
    if (lang !== 'en' && !(el.getAttribute('translate') === 'no')) {
      var t = lookup(out);
      if (t != null) out = t;
    }
    rec[name] = out;
    if (v !== out) el.setAttribute(name, out);
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var list = [], n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(doText);
    var els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],[aria-label],[alt]') : [];
    if (root.matches && root.matches('[placeholder],[title],[aria-label],[alt]')) ATTRS.forEach(function (a) { doAttr(root, a); });
    Array.prototype.forEach.call(els, function (el) { ATTRS.forEach(function (a) { doAttr(el, a); }); });
  }

  var observer = null;
  function observe() {
    if (observer || !window.MutationObserver) return;
    observer = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttr(m.target, m.attributeName);
        else m.addedNodes.forEach(walk);
      });
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  function applyAll() {
    observe();                                   // watch first, so text changed by 'daw-lang' listeners is caught
    var meta = LANGS.filter(function (l) { return l.c === lang; })[0];
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
    document.documentElement.dir = meta.dir;
    walk(document.documentElement);
    var sel = document.getElementById('daw-lang-select');
    if (sel) sel.value = lang;
    try { window.dispatchEvent(new CustomEvent('daw-lang', { detail: lang })); } catch (e) {}
  }

  /* ---------- loading ---------- */
  function load(code, cb) {
    window.DAW_I18N = window.DAW_I18N || {};
    if (code === 'en' || window.DAW_I18N[code]) return cb();
    var s = document.createElement('script');
    s.src = BASE + code + '.js';
    s.onload = function () { cb(false); };
    s.onerror = function () { cb(true); };
    document.head.appendChild(s);
  }

  var token = 0;
  function setLang(code, silent) {
    if (!known(code)) code = 'en';
    var my = ++token;
    load(code, function (failed) {
      if (my !== token) return;
      if (failed && code !== 'en') { code = 'en'; }
      lang = code;
      dict = code === 'en' ? null : (window.DAW_I18N && window.DAW_I18N[code]) || null;
      buildTemplates();
      if (!silent) persist(code);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { applyAll(); observe(); }, { once: true });
      else { applyAll(); observe(); }
    });
  }

  /* ---------- picker ---------- */
  function mount() {
    if (document.getElementById('daw-lang-select')) return;
    var slot = document.getElementById('langSlot'), bar = document.querySelector('.daw-bar');
    if (!slot && !bar) return;
    var sel = document.createElement('select');
    sel.id = 'daw-lang-select';
    sel.className = 'lang-select';
    sel.setAttribute('translate', 'no');
    sel.setAttribute('aria-label', 'Language');
    LANGS.forEach(function (l) {
      var o = document.createElement('option');
      o.value = l.c; o.textContent = l.n; o.lang = l.c;
      sel.appendChild(o);
    });
    sel.value = lang;
    sel.addEventListener('change', function () { setLang(sel.value); });
    if (slot) slot.appendChild(sel);
    else bar.insertBefore(sel, bar.lastChild);
    doAttr(sel, 'aria-label');
  }

  D.i18n = {
    langs: LANGS,
    get: function () { return lang; },
    set: function (c) { setLang(c); },
    t: function (s) { var t = lookup(String(s)); return t == null ? s : t; }
  };

  // Keep the hub and embedded apps in sync.
  window.addEventListener('storage', function (e) { if (e.key === KEY) setLang(detect(), true); });

  var first = detect();
  function init() { mount(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  setLang(first, true);
})();

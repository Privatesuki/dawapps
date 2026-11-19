/* DAWAPPS hub: bento grid, live search, category filters, workspace, PWA install + update. */
(function () {
  'use strict';

  var $ = DAW.$;
  var APPS = window.DAW_APPS;
  var CATS = window.DAW_CATEGORIES;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var catById = {}, appById = {};
  CATS.forEach(function (c) { catById[c.id] = c; });
  APPS.forEach(function (a, i) { a.idx = i; appById[a.id] = a; });

  var FAV_KEY = 'daw-favs';
  var favs = new Set(DAW.store.get(FAV_KEY, []));
  var state = { q: '', cat: 'all' };
  var tokens = [];

  var grid = $('grid'), search = $('search'), chipsEl = $('chips'), countEl = $('count');
  var emptyEl = $('empty'), emptyMsg = $('emptyMsg'), main = $('main');

  /* ------------------------------------------------------------------ tiles */
  APPS.forEach(function (a) {
    var c = catById[a.cat];
    var li = document.createElement('li');
    li.className = 'tile' + (a.wide ? ' wide' : '');
    li.style.setProperty('--h', c.hue);
    li.style.animationDelay = Math.min(a.idx * 18, 300) + 'ms';
    li.innerHTML =
      '<a class="tile-link" href="apps/' + a.id + '.html" data-id="' + a.id + '">' +
        '<span class="ico" aria-hidden="true">' + a.icon + '</span>' +
        '<span class="tile-body"><span class="tag">' + c.name + '</span>' +
        '<h3>' + DAW.esc(a.name) + '</h3><p>' + DAW.esc(a.desc) + '</p></span>' +
      '</a>' +
      '<button type="button" class="fav" data-fav="' + a.id + '" aria-pressed="false" aria-label="Pin ' + DAW.esc(a.name) + '">☆</button>';
    grid.appendChild(li);
    a.el = li;
    a.tagsLc = a.tags.join(' ').toLowerCase();
  });

  // Search matches English keywords and the names / descriptions in the selected language.
  function buildHay() {
    var tr = (DAW.i18n && DAW.i18n.t) || function (x) { return x; };
    APPS.forEach(function (a) {
      var c = catById[a.cat];
      a.hay = (a.name + ' ' + a.desc + ' ' + c.name + ' ' + a.tags.join(' ') + ' ' + tr(a.name) + ' ' + tr(a.desc) + ' ' + tr(c.name) + ' ' + (a.extra || '')).toLowerCase();
      a.nameLc = (a.name + ' ' + tr(a.name)).toLowerCase();
    });
  }
  buildHay();
  window.addEventListener('daw-lang', function () { buildHay(); if (typeof applyFilter === 'function') applyFilter(); });

  function syncFavButtons() {
    APPS.forEach(function (a) {
      var b = a.el.querySelector('.fav'), on = favs.has(a.id);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', (on ? 'Unpin ' : 'Pin ') + a.name);
      b.textContent = on ? '★' : '☆';
    });
  }

  grid.addEventListener('click', function (e) {
    var fav = e.target.closest('.fav');
    if (fav) {
      var id = fav.getAttribute('data-fav');
      if (favs.has(id)) favs['delete'](id); else favs.add(id);
      DAW.store.set(FAV_KEY, Array.from(favs));
      syncFavButtons();
      buildChips();
      if (state.cat === 'fav') applyFilter();
      return;
    }
    var link = e.target.closest('.tile-link');
    if (link && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1)) {
      e.preventDefault();
      lastFocus = link;
      pushed = true;
      location.hash = '#/' + link.getAttribute('data-id');
    }
  });

  /* --------------------------------------------------- snippet index (JSON) */
  // data/snippets.json is the only place snippets are defined. The hub reads it to make
  // snippets searchable and to deep-link into the vault (#/snippet-vault/<id>).
  var SNIPS = [], snipsEl = $('snips'), snipList = $('snipList');
  function loadSnippets() {
    fetch('data/snippets.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
      var boards = d.boards || {};
      SNIPS = (d.snippets || []).map(function (s) {
        var names = (s.boards || []).map(function (b) { return boards[b] || b; });
        s.boardNames = names;
        s.hay = [s.title, s.summary, s.category, s.difficulty, names.join(' '), (s.tags || []).join(' '),
          (s.libraries || []).map(function (l) { return l.name; }).join(' ')].join(' ').toLowerCase();
        s.titleLc = s.title.toLowerCase();
        return s;
      });
      var v = appById['snippet-vault'];
      if (v) { v.extra = SNIPS.map(function (s) { return s.hay; }).join(' '); buildHay(); }
      applyFilter();
    })['catch'](function () { /* snippets are optional; the apps still work */ });
  }
  function snipMatches(s) {
    if (state.cat !== 'all' && state.cat !== 'iot') return false;
    if (!tokens.length && state.cat !== 'iot') return false;
    for (var i = 0; i < tokens.length; i++) if (s.hay.indexOf(tokens[i]) === -1) return false;
    return true;
  }
  function renderSnips() {
    var list = SNIPS.filter(snipMatches);
    if (tokens.length) list.sort(function (x, y) {
      var a = tokens.some(function (t) { return x.titleLc.indexOf(t) > -1; }) ? 1 : 0;
      var b = tokens.some(function (t) { return y.titleLc.indexOf(t) > -1; }) ? 1 : 0;
      return b - a;
    });
    snipList.innerHTML = '';
    list.forEach(function (s) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'snip';
      a.href = 'apps/snippet-vault.html#' + s.id;
      a.setAttribute('data-snip', s.id);
      a.setAttribute('translate', 'no');
      a.innerHTML = '<strong></strong><span class="snip-sum"></span><span class="snip-meta"></span>';
      a.children[0].textContent = s.title;
      a.children[1].textContent = s.summary;
      a.children[2].textContent = s.category + ' · ' + s.boardNames.join(', ') + ' · ' + s.difficulty;
      li.appendChild(a); snipList.appendChild(li);
    });
    snipsEl.hidden = !list.length;
    return list;
  }
  snipList.addEventListener('click', function (e) {
    var a = e.target.closest('.snip');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    e.preventDefault();
    lastFocus = a; pushed = true;
    location.hash = '#/snippet-vault/' + a.getAttribute('data-snip');
  });

  /* ------------------------------------------------------------------ chips */
  function buildChips() {
    var counts = { all: APPS.length, fav: favs.size };
    APPS.forEach(function (a) { counts[a.cat] = (counts[a.cat] || 0) + 1; });
    var list = [{ id: 'all', name: 'All' }, { id: 'fav', name: '★ Pinned' }].concat(CATS);
    chipsEl.innerHTML = '';
    list.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('data-cat', c.id);
      b.setAttribute('aria-pressed', state.cat === c.id ? 'true' : 'false');
      b.innerHTML = DAW.esc(c.name) + '<span>' + (counts[c.id] || 0) + '</span>';
      chipsEl.appendChild(b);
    });
  }
  chipsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    state.cat = b.getAttribute('data-cat');
    Array.prototype.forEach.call(chipsEl.children, function (x) {
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
    });
    transition(applyFilter);
  });

  /* -------------------------------------------------------------- filtering */
  function matches(a) {
    if (state.cat === 'fav') { if (!favs.has(a.id)) return false; }
    else if (state.cat !== 'all' && a.cat !== state.cat) return false;
    for (var i = 0; i < tokens.length; i++) if (a.hay.indexOf(tokens[i]) === -1) return false;
    return true;
  }
  function score(a) {
    var s = 0;
    tokens.forEach(function (t) {
      if (a.nameLc.indexOf(t) === 0) s += 4;
      else if (a.nameLc.indexOf(t) > -1) s += 3;
      else if (a.tagsLc.indexOf(t) > -1) s += 2;
      else s += 1;
    });
    return s;
  }

  function applyFilter() {
    tokens = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    var visible = [];
    APPS.forEach(function (a) {
      var ok = matches(a);
      a.el.hidden = !ok;
      a.el.style.order = '';
      if (ok) visible.push(a);
    });
    if (tokens.length) {
      visible.sort(function (x, y) { return score(y) - score(x) || x.idx - y.idx; });
      visible.forEach(function (a, i) { a.el.style.order = i; });
    }
    visible._first = visible[0] || null;
    applyFilter.first = visible[0] || null;

    countEl.textContent = visible.length === APPS.length
      ? APPS.length + ' apps'
      : 'Showing ' + visible.length + ' of ' + APPS.length;
    var sn = renderSnips();
    applyFilter.firstSnip = sn[0] || null;
    if (sn.length && visible.length !== APPS.length) countEl.textContent += ' · ' + sn.length + (sn.length === 1 ? ' snippet' : ' snippets');
    emptyEl.hidden = visible.length > 0 || sn.length > 0;
    if (!visible.length && !sn.length) {
      emptyMsg.textContent = state.cat === 'fav' && !tokens.length
        ? 'Tap the ☆ on any app to pin it here.'
        : (state.q ? 'Nothing matches “' + state.q + '”. Try a different keyword.' : 'Nothing in this category yet.');
    }
  }

  // Smooth FLIP-style reflow when the browser supports View Transitions.
  function transition(fn) {
    if (!document.startViewTransition || reduced) return fn();
    APPS.forEach(function (a) { a.el.style.viewTransitionName = 't-' + a.id; });
    var vt = document.startViewTransition(fn);
    var clean = function () { APPS.forEach(function (a) { a.el.style.viewTransitionName = ''; }); };
    vt.finished.then(clean, clean);
  }

  search.addEventListener('input', function () {
    state.q = search.value;
    applyFilter();               // instant, no transition while typing
  });
  search.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (applyFilter.first || applyFilter.firstSnip)) {
      e.preventDefault();
      lastFocus = search;
      pushed = true;
      location.hash = applyFilter.first ? '#/' + applyFilter.first.id : '#/snippet-vault/' + applyFilter.firstSnip.id;
    } else if (e.key === 'ArrowDown' && applyFilter.first) {
      e.preventDefault();
      applyFilter.first.el.querySelector('.tile-link').focus();
    }
  });
  $('clear').addEventListener('click', function () {
    state.q = ''; state.cat = 'all'; search.value = '';
    buildChips(); applyFilter(); search.focus();
  });

  /* -------------------------------------------------------------- workspace */
  var ws = $('ws'), frame = $('frame'), wsTitle = $('wsTitle'), wsIcon = $('wsIcon');
  var wsNew = $('wsNew'), wsLoad = $('wsLoad'), wsClose = $('wsClose');
  var current = null, lastFocus = null, pushed = false, closeTimer = null;

  frame.addEventListener('load', function () {
    if (current) wsLoad.classList.remove('on');
  });

  function openApp(id, sub) {
    var a = appById[id];
    if (!a) return;
    clearTimeout(closeTimer);
    if (current !== id) {
      wsLoad.classList.add('on');
      frame.src = 'apps/' + id + '.html?embed=1' + (sub ? '#' + sub : '');
    } else if (sub) {
      try { frame.contentWindow.location.hash = sub; } catch (err) { /* cross-origin: ignore */ }
    }
    current = id;
    wsTitle.textContent = a.name;
    wsIcon.textContent = a.icon;
    wsNew.href = 'apps/' + id + '.html';
    ws.inert = false;
    main.inert = true;
    ws.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ws-open');
    document.title = a.name + ' · DAWAPPS';
    requestAnimationFrame(function () {
      ws.classList.add('open');
      setTimeout(function () { if (current === id) wsClose.focus({ preventScroll: true }); }, 60);
    });
  }

  function closeApp() {
    if (!current) return;
    current = null;
    pushed = false;
    ws.classList.remove('open');
    ws.inert = true;
    main.inert = false;
    ws.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('ws-open');
    document.title = 'DAWAPPS Playground — 28 mini tools, offline-ready';
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      if (!current) { frame.src = 'about:blank'; wsLoad.classList.remove('on'); }
    }, 340);
  }

  function requestClose() {
    if (!current) return;
    if (pushed) { pushed = false; history.back(); }
    else {
      history.replaceState(null, '', location.pathname + location.search);
      closeApp();
    }
  }

  function route() {
    var m = location.hash.match(/^#\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/);
    if (m && appById[m[1]]) openApp(m[1], m[2]);
    else closeApp();
  }
  window.addEventListener('hashchange', route);

  wsClose.addEventListener('click', requestClose);
  ws.addEventListener('click', function (e) { if (e.target === ws) requestClose(); });
  window.addEventListener('message', function (e) {
    if (e.origin === location.origin && e.data && e.data.daw === 'close') requestClose();
  });

  /* --------------------------------------------------------------- keyboard */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (current) { requestClose(); }
      else if (document.activeElement === search && search.value) {
        search.value = ''; state.q = ''; applyFilter();
      }
      return;
    }
    var tag = document.activeElement && document.activeElement.tagName;
    if (e.key === '/' && !current && !e.metaKey && !e.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) {
      e.preventDefault();
      search.focus();
      search.select();
    }
  });

  /* ------------------------------------------------------------------ theme */
  var sunIcon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var moonIcon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  function paintTheme() {
    var html = DAW.theme.get() === 'dark' ? sunIcon : moonIcon;
    $('themeBtn').innerHTML = html;
    $('wsTheme').innerHTML = html;
  }
  $('themeBtn').addEventListener('click', function () { DAW.theme.toggle(); });
  $('wsTheme').addEventListener('click', function () { DAW.theme.toggle(); });
  window.addEventListener('daw-theme', paintTheme);
  paintTheme();

  /* ------------------------------------------------------ network indicator */
  var net = $('net'), netText = $('netText'), swReady = false;
  function paintNet() {
    var online = navigator.onLine !== false;
    net.classList.toggle('off', !online);
    netText.textContent = online ? (swReady ? 'Online · offline-ready' : 'Online') : 'Offline · cached apps still work';
  }
  window.addEventListener('online', paintNet);
  window.addEventListener('offline', paintNet);

  /* ------------------------------------------------------------ PWA install */
  var installBtn = $('install'), deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', function () {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; installBtn.hidden = true; });
    } else {
      DAW.toast('Tap Share, then “Add to Home Screen”', 4200);
    }
  });
  window.addEventListener('appinstalled', function () {
    installBtn.hidden = true;
    DAW.toast('DAWAPPS installed');
  });
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  if (isIOS && !standalone) installBtn.hidden = false;

  /* ---------------------------------------------------------- service worker */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    var updating = false;
    var updateBar = $('update');
    var showUpdate = function (worker) {
      updateBar.hidden = false;
      $('reload').onclick = function () {
        updating = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
      };
    };
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (updating) location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        if (reg.active || navigator.serviceWorker.controller) { swReady = true; paintNet(); }
        if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
        reg.addEventListener('updatefound', function () {
          var w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', function () {
            if (w.state !== 'installed') return;
            if (navigator.serviceWorker.controller) showUpdate(w);
            else { swReady = true; paintNet(); DAW.toast('Ready to use offline', 2600); }
          });
        });
      }).catch(function () { /* offline support is a bonus; the hub works without it */ });
    });
  }

  /* -------------------------------------------------------------------- go */
  buildChips();
  syncFavButtons();
  applyFilter();
  loadSnippets();
  paintNet();
  route();
})();

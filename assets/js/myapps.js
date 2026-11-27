/* DAWAPPS — My Apps: the Dwix Labs software catalogue.
 * Data lives only in data/my-apps.json. Adding an app = edit JSON + upload the installer to external hosting.
 * Routes: #/my-apps · #/my-apps/<platform> · #/my-apps/<platform>/<app-id>
 */
(function () {
  'use strict';
  const D = window.DAW;
  const $ = D.$;
  const DATA_URL = 'data/my-apps.json';
  const BASE_TITLE = document.title;

  const PLATFORMS = [
    { id: 'android', name: 'Android', glyph: '🤖', hint: 'Android apps (.apk)' },
    { id: 'ios', name: 'iOS', glyph: '🍎', hint: 'iPhone & iPad apps' },
    { id: 'windows', name: 'Windows', glyph: '🪟', hint: 'Windows installers (.exe)' },
    { id: 'linux', name: 'Linux', glyph: '🐧', hint: 'Linux packages' }
  ];
  const STATUSES = {
    'available': 'Available',
    'coming-soon': 'Coming soon',
    'not-released': 'Not released'
  };
  const platById = {};
  PLATFORMS.forEach((p) => { platById[p.id] = p; });

  const el = {
    nav: $('views'), hub: $('hubView'), root: $('myApps'), main: $('main'),
    tabs: $('maTabs'), search: $('maSearch'), cat: $('maCat'), status: $('maStatus'), sort: $('maSort'),
    bar: $('maBar'), count: $('maCount'), reset: $('maReset'), grid: $('maGrid'), state: $('maState'),
    modal: $('maModal'), mTitle: $('maMTitle'), mBody: $('maMBody'), mFoot: $('maMFoot'), mClose: $('maMClose')
  };
  if (!el.root || !el.grid) return;               // markup missing: leave the rest of the hub untouched

  const state = { platform: 'android', q: '', cat: 'all', status: 'all', sort: 'name' };
  let apps = [];
  let load = 'idle';                               // idle | loading | ready | error
  let active = false;                              // My Apps view visible?
  let openId = null, detailPushed = false, lastFocusId = null;

  /* ---------------------------------------------------------------- helpers */
  const h = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');

  // A download button is only ever shown for a complete https URL that is not an obvious placeholder.
  function safeUrl(u) {
    if (!str(u)) return null;
    try {
      const x = new URL(u.trim());
      if (x.protocol !== 'https:' || !x.hostname.includes('.')) return null;
      if (/^(www\.)?example\.(com|org|net)$/i.test(x.hostname)) return null;
      return x;
    } catch (e) { return null; }
  }

  function fmtSize(v) {
    if (typeof v === 'number' && v > 0) {
      const u = ['B', 'KB', 'MB', 'GB'];
      let i = 0;
      while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
      return (v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)) + ' ' + u[i];
    }
    return str(v) || null;
  }
  function fmtDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return null;
    const d = new Date(iso.slice(0, 10) + 'T00:00:00');
    if (isNaN(d)) return null;
    try { return d.toLocaleDateString((D.i18n && D.i18n.get()) || undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return iso.slice(0, 10); }
  }
  function cmpVersion(a, b) {
    const x = String(a).split(/[^0-9]+/).filter(Boolean).map(Number);
    const y = String(b).split(/[^0-9]+/).filter(Boolean).map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (x[i] || 0) - (y[i] || 0);
      if (d) return d;
    }
    return 0;
  }
  function hue(s) {                                // stable colour per (dynamic) category
    let n = 0;
    for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 360;
    return n;
  }

  function normalize(raw, i, seen) {
    if (!raw || typeof raw !== 'object') return null;
    const id = str(raw.id), name = str(raw.name);
    const platform = str(raw.platform).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || !name || !platById[platform]) {
      console.warn('[My Apps] skipped apps[' + i + ']: needs a valid "id", "name" and "platform"');
      return null;
    }
    if (seen[id]) { console.warn('[My Apps] duplicate id "' + id + '" skipped'); return null; }
    seen[id] = true;
    const url = safeUrl(raw.downloadUrl);
    let status = STATUSES[raw.status] ? raw.status : 'not-released';
    const reqs = Array.isArray(raw.requirements)
      ? raw.requirements.map(str).filter(Boolean)
      : (raw.requirements && typeof raw.requirements === 'object'
        ? Object.keys(raw.requirements).map((k) => k + ': ' + raw.requirements[k]) : []);
    const log = (Array.isArray(raw.changelog) ? raw.changelog : []).map((c) => {
      if (typeof c === 'string') return { version: '', date: '', notes: [c] };
      if (!c || typeof c !== 'object') return null;
      const n = Array.isArray(c.notes) ? c.notes : (c.notes ? [c.notes] : []);
      return { version: str(c.version), date: str(c.date), notes: n.map(str).filter(Boolean) };
    }).filter(Boolean);
    return {
      id, name, platform, status, url,
      description: str(raw.description),
      category: str(raw.category) || 'Other',
      version: str(raw.version) || null,
      size: fmtSize(raw.fileSize),
      date: /^\d{4}-\d{2}-\d{2}$/.test(raw.releaseDate || '') ? raw.releaseDate : null,
      fileName: str(raw.fileName),
      icon: str(raw.icon),
      requirements: reqs, changelog: log,
      hay: [name, raw.description, raw.category].join(' ').toLowerCase()
    };
  }

  /* ------------------------------------------------------------------ icon */
  function iconNode(a) {
    const box = h('span', 'ma-ico');
    box.setAttribute('aria-hidden', 'true');
    const letter = () => { box.textContent = a.name.charAt(0).toUpperCase(); };
    if (/^(https:\/\/|\.\/|\/(?!\/)|assets\/|data\/)/i.test(a.icon) || /\.(png|jpe?g|svg|webp|gif)$/i.test(a.icon)) {
      const img = new Image();
      img.alt = ''; img.decoding = 'async'; img.loading = 'lazy';
      img.onerror = () => { img.remove(); letter(); };   // missing asset: fall back to the first letter
      img.src = a.icon;
      box.appendChild(img);
    } else if (a.icon) box.textContent = a.icon;
    else letter();
    return box;
  }

  /* -------------------------------------------------------------- download */
  function actionNode(a, extra) {
    if (a.status === 'available' && a.url) {
      const l = h('a', 'btn', 'Download');
      l.href = a.url.href;
      l.rel = 'noopener noreferrer';
      if (extra) l.className = 'btn ' + extra;
      return l;
    }
    const b = h('button', null, a.status === 'available' ? 'Download unavailable' : STATUSES[a.status]);
    b.type = 'button'; b.disabled = true;
    return b;
  }

  /* ------------------------------------------------------------------ cards */
  function card(a, i) {
    const li = h('li', 'ma-card');
    li.style.setProperty('--h', hue(a.category));
    li.style.animationDelay = Math.min(i * 30, 240) + 'ms';

    const head = h('div', 'ma-head');
    head.appendChild(iconNode(a));
    const id = h('div', 'ma-id');
    const name = h('h3', null, a.name);
    name.setAttribute('translate', 'no');
    id.appendChild(name);
    const tags = h('div', 'ma-tags');
    tags.appendChild(h('span', 'ma-tag', platById[a.platform].name));
    tags.appendChild(h('span', 'ma-tag cat', a.category));
    id.appendChild(tags);
    head.appendChild(id);
    li.appendChild(head);

    li.appendChild(h('p', 'ma-desc', a.description));
    li.appendChild(h('span', 'ma-status st-' + a.status, STATUSES[a.status]));

    const meta = h('dl', 'ma-meta');
    meta.setAttribute('translate', 'no');
    [['Version', a.version], ['Size', a.size]].forEach((r) => {
      const d = h('div');
      d.appendChild(h('dt', null, r[0] + ':')).setAttribute('translate', 'yes');
      d.appendChild(h('dd', null, r[1] || '—'));
      meta.appendChild(d);
    });
    li.appendChild(meta);

    const act = h('div', 'ma-act');
    act.appendChild(actionNode(a));
    const det = h('button', 'secondary', 'Details');
    det.type = 'button';
    det.setAttribute('data-open', a.id);
    det.setAttribute('aria-label', 'Details: ' + a.name);
    act.appendChild(det);
    li.appendChild(act);
    return li;
  }

  /* ------------------------------------------------------------ list render */
  function inPlatform() { return apps.filter((a) => a.platform === state.platform); }

  function visible() {
    const toks = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = inPlatform().filter((a) =>
      (state.cat === 'all' || a.category === state.cat) &&
      (state.status === 'all' || a.status === state.status) &&
      toks.every((t) => a.hay.indexOf(t) > -1));
    const byName = (x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: 'base', numeric: true });
    const missingLast = (x, y, f) => (x == null) - (y == null) || (x == null ? 0 : f(x, y));
    list.sort((x, y) => {
      if (state.sort === 'newest') return missingLast(x.date, y.date, (p, q) => (p < q ? 1 : p > q ? -1 : 0)) || byName(x, y);
      if (state.sort === 'version') return missingLast(x.version, y.version, (p, q) => cmpVersion(q, p)) || byName(x, y);
      return byName(x, y);
    });
    return list;
  }

  function renderTabs() {
    el.tabs.textContent = '';
    PLATFORMS.forEach((p) => {
      const n = apps.filter((a) => a.platform === p.id).length;
      const b = h('button', 'ma-tab');
      b.type = 'button';
      b.id = 'maTab-' + p.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('data-platform', p.id);
      b.setAttribute('aria-selected', state.platform === p.id ? 'true' : 'false');
      b.setAttribute('aria-controls', 'maGrid');
      b.tabIndex = state.platform === p.id ? 0 : -1;
      b.appendChild(h('span', null, p.name));
      if (load === 'ready') b.appendChild(h('span', 'n', String(n)));
      el.tabs.appendChild(b);
    });
  }

  function renderCategories() {
    const cats = Array.from(new Set(inPlatform().map((a) => a.category))).sort((x, y) => x.localeCompare(y));
    if (state.cat !== 'all' && cats.indexOf(state.cat) < 0) state.cat = 'all';
    el.cat.textContent = '';
    const all = h('option', null, 'All categories'); all.value = 'all';
    el.cat.appendChild(all);
    cats.forEach((c) => { const o = h('option', null, c); o.value = c; el.cat.appendChild(o); });
    el.cat.value = state.cat;
  }

  function showState(icon, title, text, btnLabel, onClick) {
    el.state.textContent = '';
    el.state.appendChild(h('div', 'empty-ico', icon)).setAttribute('aria-hidden', 'true');
    el.state.appendChild(h('h3', null, title));
    el.state.appendChild(h('p', null, text));
    if (btnLabel) {
      const b = h('button', 'secondary', btnLabel);
      b.type = 'button';
      b.addEventListener('click', onClick);
      el.state.appendChild(b);
    }
    el.state.hidden = false;
  }

  function render() {
    renderTabs();
    el.grid.textContent = '';
    el.grid.setAttribute('aria-busy', load === 'loading' ? 'true' : 'false');
    el.grid.setAttribute('aria-labelledby', 'maTab-' + state.platform);
    el.state.hidden = true;
    el.bar.hidden = true;

    if (load === 'loading' || load === 'idle') {
      for (let i = 0; i < 3; i++) { const s = h('li', 'ma-skel'); s.setAttribute('aria-hidden', 'true'); el.grid.appendChild(s); }
      return;
    }
    if (load === 'error') {
      showState('⚠️', 'Could not load My Apps', 'Check your connection and try again.', 'Retry', () => fetchApps(true));
      return;
    }
    renderCategories();
    const p = platById[state.platform];
    const total = inPlatform().length;
    if (!total) {
      showState(p.glyph, 'No ' + p.name + ' apps yet', 'Apps from Dwix Labs for this platform will appear here.');
      return;
    }
    const list = visible();
    list.forEach((a, i) => el.grid.appendChild(card(a, i)));
    el.bar.hidden = false;
    el.count.textContent = list.length === total
      ? total + (total === 1 ? ' app' : ' apps')
      : 'Showing ' + list.length + ' of ' + total;
    const filtered = state.q || state.cat !== 'all' || state.status !== 'all';
    el.reset.hidden = !filtered;
    if (!list.length) showState('🔎', 'No apps match', 'Try a different keyword or clear the filters.', 'Clear filters', resetFilters);
  }

  function resetFilters() {
    state.q = ''; state.cat = 'all'; state.status = 'all';
    el.search.value = ''; el.status.value = 'all';
    render();
    el.search.focus();
  }

  /* ----------------------------------------------------------------- data */
  function fetchApps(force) {
    if (load === 'loading' || (load === 'ready' && !force)) return;
    load = 'loading';
    render();
    fetch(DATA_URL, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((d) => {
        if (!d || !Array.isArray(d.apps)) throw new Error('"apps" must be an array');
        const seen = {};
        apps = d.apps.map((x, i) => normalize(x, i, seen)).filter(Boolean);
        load = 'ready';
        render();
        applyRoute();                              // a deep link may point at an app
      })
      .catch((e) => { console.error('[My Apps] could not load ' + DATA_URL + ':', e); load = 'error'; render(); });
  }

  /* ---------------------------------------------------------------- modal */
  function row(dl, k, v) {
    const d = h('div');
    d.appendChild(h('dt', null, k));
    const dd = h('dd', null, v || '—');
    if (v) dd.setAttribute('translate', 'no');
    d.appendChild(dd);
    dl.appendChild(d);
  }

  function fillModal(a) {
    el.mTitle.textContent = a.name;
    el.mTitle.setAttribute('translate', 'no');
    const body = el.mBody;
    body.textContent = '';

    const top = h('div', 'ma-mtop');
    top.style.setProperty('--h', hue(a.category));
    top.appendChild(iconNode(a));
    const t = h('div');
    t.style.minWidth = '0';
    const name = h('h2', null, a.name);
    name.id = 'maMName';
    name.setAttribute('translate', 'no');
    t.appendChild(name);
    t.appendChild(h('span', 'ma-status st-' + a.status, STATUSES[a.status]));
    const tags = h('div', 'ma-tags');
    tags.appendChild(h('span', 'ma-tag', platById[a.platform].name));
    tags.appendChild(h('span', 'ma-tag cat', a.category));
    t.appendChild(tags);
    top.appendChild(t);
    body.appendChild(top);
    body.appendChild(h('p', null, a.description)).style.marginTop = '16px';

    const info = h('dl', 'ma-info');
    row(info, 'Version', a.version);
    row(info, 'File size', a.size);
    row(info, 'Released', fmtDate(a.date));
    row(info, 'File', a.fileName);
    body.appendChild(info);

    body.appendChild(h('h4', null, 'Requirements'));
    if (a.requirements.length) {
      const ul = h('ul', 'ma-req');
      a.requirements.forEach((r) => ul.appendChild(h('li', null, r)));
      body.appendChild(ul);
    } else body.appendChild(h('p', 'ma-none', 'Not published yet.'));

    body.appendChild(h('h4', null, 'Changelog'));
    if (a.changelog.length) {
      a.changelog.forEach((c) => {
        const box = h('div', 'ma-log');
        const head = h('div');
        head.appendChild(h('b', null, c.version ? 'v' + c.version.replace(/^v/i, '') : 'Update'));
        const dt = fmtDate(c.date);
        if (dt) head.appendChild(h('time', null, dt));
        box.appendChild(head);
        if (c.notes.length) {
          const ul = h('ul');
          c.notes.forEach((n) => ul.appendChild(h('li', null, n)));
          box.appendChild(ul);
        }
        body.appendChild(box);
      });
    } else body.appendChild(h('p', 'ma-none', 'No release notes yet.'));
    body.scrollTop = 0;

    const foot = el.mFoot;
    foot.textContent = '';
    foot.appendChild(actionNode(a));
    if (a.url) {
      const host = h('p', 'ma-host', 'Hosted on ' + a.url.hostname);
      host.setAttribute('translate', 'no');
      foot.appendChild(host);
    }
    el.modal.setAttribute('aria-labelledby', 'maMName');
  }

  function openModal(a) {
    if (openId === a.id) return;
    openId = a.id;
    fillModal(a);
    el.modal.hidden = false;
    el.main.inert = true;
    el.modal.inert = false;
    el.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ma-lock');
    document.title = a.name + ' · My Apps · DAWAPPS';
    requestAnimationFrame(() => {
      el.modal.classList.add('open');
      setTimeout(() => { if (openId === a.id) el.mClose.focus({ preventScroll: true }); }, 60);
    });
  }

  function hideModal() {
    if (!openId) return;
    openId = null;
    el.modal.classList.remove('open');
    el.modal.inert = true;
    el.modal.setAttribute('aria-hidden', 'true');
    el.main.inert = false;
    document.body.classList.remove('ma-lock');
    document.title = active ? 'My Apps · ' + BASE_TITLE : BASE_TITLE;
    const back = lastFocusId && el.grid.querySelector('[data-open="' + lastFocusId + '"]');
    if (back) back.focus({ preventScroll: true });
    setTimeout(() => { if (!openId) el.modal.hidden = true; }, 300);
  }

  function requestCloseModal() {
    if (!openId) return;
    if (detailPushed) { detailPushed = false; history.back(); }
    else { history.replaceState(null, '', location.pathname + location.search + '#/my-apps/' + state.platform); hideModal(); }
  }

  /* --------------------------------------------------------------- routing */
  function setActive(on) {
    if (active === on) return;
    active = on;
    el.hub.hidden = on;
    el.root.hidden = !on;
    Array.prototype.forEach.call(el.nav.querySelectorAll('a'), (a) => {
      if ((a.getAttribute('data-view') === 'my-apps') === on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = on ? 'My Apps · ' + BASE_TITLE : BASE_TITLE;
    if (on) fetchApps();
  }

  function applyRoute() {
    const m = location.hash.match(/^#\/my-apps(?:\/([a-z0-9-]+))?(?:\/([a-z0-9-]+))?$/);
    if (!m) {
      hideModal();
      setActive(false);
      if (location.hash === '#/') history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    setActive(true);
    if (m[1] && platById[m[1]] && state.platform !== m[1]) { state.platform = m[1]; render(); }
    const a = m[2] && apps.filter((x) => x.id === m[2] && x.platform === state.platform)[0];
    if (a) openModal(a); else hideModal();
  }
  window.addEventListener('hashchange', applyRoute);

  /* ---------------------------------------------------------------- events */
  el.tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.ma-tab');
    if (!b) return;
    state.platform = b.getAttribute('data-platform');
    history.replaceState(null, '', location.pathname + location.search + '#/my-apps/' + state.platform);
    render();
    const nb = $('maTab-' + state.platform); if (nb) nb.focus({ preventScroll: true });
  });
  el.tabs.addEventListener('keydown', (e) => {     // arrow-key navigation between tabs
    const keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' };
    if (!(e.key in keys)) return;
    e.preventDefault();
    let i = PLATFORMS.map((p) => p.id).indexOf(state.platform);
    const k = keys[e.key];
    i = k === 'first' ? 0 : k === 'last' ? PLATFORMS.length - 1 : (i + k + PLATFORMS.length) % PLATFORMS.length;
    const b = $('maTab-' + PLATFORMS[i].id);
    if (b) b.click();
  });

  let typing;
  el.search.addEventListener('input', () => {
    clearTimeout(typing);
    typing = setTimeout(() => { state.q = el.search.value; render(); }, 120);
  });
  el.cat.addEventListener('change', () => { state.cat = el.cat.value; render(); });
  el.status.addEventListener('change', () => { state.status = el.status.value; render(); });
  el.sort.addEventListener('change', () => { state.sort = el.sort.value; render(); });
  el.reset.addEventListener('click', resetFilters);

  el.grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (!b) return;
    lastFocusId = b.getAttribute('data-open');
    detailPushed = true;
    location.hash = '#/my-apps/' + state.platform + '/' + lastFocusId;
  });
  el.mClose.addEventListener('click', requestCloseModal);
  el.modal.addEventListener('click', (e) => { if (e.target === el.modal) requestCloseModal(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openId) { e.preventDefault(); requestCloseModal(); return; }
    const tag = document.activeElement && document.activeElement.tagName;
    if (e.key === '/' && active && !openId && !e.metaKey && !e.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) {
      e.preventDefault();
      e.stopImmediatePropagation();                // the hub's own "/" shortcut targets its hidden search
      el.search.focus();
    }
  }, true);

  window.addEventListener('daw-lang', () => { if (load === 'ready') render(); });

  /* ------------------------------------------------------------------- go */
  const year = $('maYear');
  if (year) year.textContent = String(new Date().getFullYear());   // © <current year> Dwix Labs

  el.modal.inert = true;
  renderTabs();
  applyRoute();
})();

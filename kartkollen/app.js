(function () {
  'use strict';
  const KK = window.KK;
  const $ = id => document.getElementById(id);
  const svgEl = (name, attrs) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  const MASTERED = 3, ROUND_SIZE = 10, MAX_REASKS = 4, REASK_GAP = 3;
  const ALL = 'all';

  const PLACES = {};
  for (const w of KK.WEEKS) for (const p of w.places) if (!PLACES[p.id]) PLACES[p.id] = p;

  // ---------- Storage ----------
  // Progress is keyed by place id, so adding weeks never affects what is already saved.
  const KEY = 'kartkollen', VERSION = 1;
  const STORE_OK = (() => {
    try {
      const k = 'kk-probe';
      localStorage.setItem(k, '1');
      const ok = localStorage.getItem(k) === '1';
      localStorage.removeItem(k);
      return ok;
    } catch (e) { return false; }
  })();
  const freshState = () => ({ v: VERSION, scope: null, places: {}, round: null, rounds: 0 });

  function normalize(raw) {
    const s = freshState();
    if (!raw || typeof raw !== 'object') return s;
    // Later schema versions: migrate here, based on raw.v.
    s.scope = typeof raw.scope === 'string' ? raw.scope : null;
    s.rounds = raw.rounds | 0;
    if (raw.places && typeof raw.places === 'object') {
      for (const id in raw.places) {
        const r = raw.places[id] || {};
        // Ids unknown to this version are kept, in case they belong to a newer one.
        s.places[id] = {
          lvl: Math.max(0, Math.min(MASTERED, r.lvl | 0)),
          right: r.right | 0, near: r.near | 0, wrong: r.wrong | 0, seen: +r.seen || 0
        };
      }
    }
    const rd = raw.round;
    if (rd && Array.isArray(rd.queue)) {
      const dropped = rd.queue.slice(0, rd.idx | 0).filter(id => !PLACES[id]).length;
      const queue = rd.queue.filter(id => PLACES[id]);
      const idx = Math.max(0, (rd.idx | 0) - dropped);
      if (idx < queue.length) {
        s.round = {
          queue, idx,
          results: (Array.isArray(rd.results) ? rd.results : []).filter(r => r && PLACES[r.id]),
          reasked: (Array.isArray(rd.reasked) ? rd.reasked : []).filter(id => PLACES[id])
        };
      }
    }
    return s;
  }
  function load() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return freshState(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }
  let S = load();
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch (e) {}

  // ---------- Practice logic ----------
  const rec = id => S.places[id] || { lvl: 0, right: 0, near: 0, wrong: 0, seen: 0 };
  const lvl = id => rec(id).lvl;

  function scopeWeeks() {
    return S.scope === ALL ? KK.WEEKS : KK.WEEKS.filter(w => w.id === S.scope);
  }
  function scopePlaces() {
    const seen = new Set(), out = [];
    for (const w of scopeWeeks()) for (const p of w.places) if (!seen.has(p.id)) { seen.add(p.id); out.push(p); }
    return out;
  }
  if (S.scope !== ALL && !KK.WEEKS.some(w => w.id === S.scope)) S.scope = KK.WEEKS[0].id;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // Least-known first, then the one not seen for longest. Mastered places fill up any free slots
  // as review, so a round is always a full one if the scope has enough places.
  function pickRound() {
    const ids = shuffle(scopePlaces().map(p => p.id));
    ids.sort((a, b) => lvl(a) - lvl(b) || rec(a).seen - rec(b).seen);
    return shuffle(ids.slice(0, ROUND_SIZE));
  }
  function startRound() {
    S.round = { queue: pickRound(), idx: 0, results: [], reasked: [] };
    save();
    showQuiz();
  }
  function recordAnswer(id, tier, km, inside) {
    const r = Object.assign({}, rec(id));
    if (tier === 'right') { r.lvl = Math.min(MASTERED, r.lvl + 1); r.right++; }
    else if (tier === 'near') r.near++;
    else { r.lvl = Math.max(0, r.lvl - 1); r.wrong++; }
    r.seen = Date.now();
    S.places[id] = r;
    const rd = S.round;
    rd.results.push({ id, tier, km: Math.round(km), inside: !!inside, lvl: r.lvl });
    // A miss comes back later in the round, with other places in between.
    if (tier !== 'right' && !rd.reasked.includes(id) && rd.reasked.length < MAX_REASKS) {
      const at = Math.min(rd.idx + 1 + REASK_GAP, rd.queue.length);
      if (at > rd.idx + 1) { rd.queue.splice(at, 0, id); rd.reasked.push(id); }
    }
    rd.idx++;
    if (rd.idx >= rd.queue.length) { rd.finished = true; S.rounds++; }
    save();
  }

  // ---------- Small render helpers ----------
  function pips(id) {
    const n = lvl(id), wrap = document.createElement('span');
    wrap.className = 'pips';
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', n + ' av ' + MASTERED + ' steg');
    for (let i = 0; i < MASTERED; i++) {
      const p = document.createElement('span');
      p.className = 'pip' + (i < n ? ' on' : '');
      wrap.appendChild(p);
    }
    return wrap;
  }
  const ICONS = {
    right: '<svg viewBox="0 0 24 24"><path d="M5 13l5 5L19 7"/></svg>',
    near: '<svg viewBox="0 0 24 24"><path d="M4 9.5c3-3 5 3 8 0s5 3 8 0M4 16c3-3 5 3 8 0s5 3 8 0"/></svg>',
    wrong: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  const WORDS = { right: 'Rätt!', near: 'Nära!', wrong: 'Inte riktigt' };
  const SHORT = { right: 'Rätt', near: 'Nära', wrong: 'Fel' };
  const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function kmText(km) {
    if (km < 10) return 'mindre än 10 km';
    const step = km < 1000 ? 10 : 50;
    return 'cirka ' + num(Math.round(km / step) * step) + ' km';
  }
  function tierIcon(el, tier) {
    el.className = 'tier-icon t-' + tier;
    el.innerHTML = ICONS[tier];
  }

  // ---------- Screens ----------
  const screens = ['home', 'quiz', 'result'];
  let current = null;
  function show(name) {
    current = name;
    for (const s of screens) $(s).hidden = s !== name;
    document.body.classList.toggle('in-quiz', name === 'quiz');
    window.scrollTo(0, 0);
  }
  // The phone's back button leaves the quiz or result rather than the whole app.
  function enterSub() { if (!history.state || !history.state.kk) history.pushState({ kk: 1 }, ''); }
  function leaveSub() { if (history.state && history.state.kk) history.back(); else showHome(); }
  window.addEventListener('popstate', () => { if (current !== 'home') showHome(); });

  function showHome() {
    // Left after the last answer without opening the result: the round is over.
    if (S.round && S.round.finished) { S.round = null; save(); }
    renderHome();
    show('home');
  }
  function renderHome() {
    $('storageNote').hidden = STORE_OK;
    const scopes = $('scopes');
    scopes.textContent = '';
    const options = KK.WEEKS.map(w => ({ id: w.id, label: w.name, title: w.sub })).concat([{ id: ALL, label: 'Alla veckor' }]);
    for (const o of options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = o.label;
      if (o.title) b.title = o.title;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(S.scope === o.id));
      b.addEventListener('click', () => {
        if (S.scope === o.id) return;
        S.scope = o.id;
        S.round = null; // answers already given are saved per place, only the unfinished round is dropped
        save();
        renderHome();
      });
      scopes.appendChild(b);
    }

    const pool = scopePlaces(), done = pool.filter(p => lvl(p.id) >= MASTERED).length;
    $('summary').textContent = done + ' av ' + pool.length + ' platser sitter';
    $('meter').firstElementChild.style.width = (pool.length ? (done / pool.length) * 100 : 0) + '%';
    const allDone = pool.length > 0 && done === pool.length;
    $('doneNote').hidden = !allDone;
    const rd = S.round;
    $('startBtn').textContent = rd ? 'Fortsätt omgången (fråga ' + (rd.idx + 1) + ' av ' + rd.queue.length + ')'
      : allDone ? 'Repetera' : 'Starta omgång';

    const ov = $('overview');
    ov.textContent = '';
    const weeks = scopeWeeks();
    const listed = new Set();
    for (const w of weeks) {
      if (weeks.length > 1) {
        const h = document.createElement('h3');
        h.className = 'week-head';
        h.textContent = w.name;
        ov.appendChild(h);
      }
      const ul = document.createElement('ul');
      ul.className = 'rows';
      for (const p of w.places) {
        if (listed.has(p.id)) continue;
        listed.add(p.id);
        const li = document.createElement('li');
        li.className = 'row';
        const name = document.createElement('span');
        name.className = 'row-name';
        name.textContent = p.name;
        li.appendChild(name);
        if (lvl(p.id) >= MASTERED) {
          const d = document.createElement('span');
          d.className = 'row-done';
          d.textContent = 'Sitter';
          li.appendChild(d);
        }
        li.appendChild(pips(p.id));
        ul.appendChild(li);
      }
      ov.appendChild(ul);
    }
  }

  function showResult() {
    const rd = S.round;
    const rights = rd.results.filter(r => r.tier === 'right').length;
    const newlyDone = new Set(rd.results.filter(r => r.lvl >= MASTERED).map(r => r.id));
    let line = rights + ' rätt av ' + rd.results.length + ' frågor.';
    if (newlyDone.size) line += ' ' + newlyDone.size + (newlyDone.size === 1 ? ' plats sitter.' : ' platser sitter.');
    $('resultLine').textContent = line;
    const ul = $('resultList');
    ul.textContent = '';
    const shown = new Set();
    for (const r of rd.results) {
      const li = document.createElement('li');
      li.className = 'row';
      const ic = document.createElement('span');
      tierIcon(ic, r.tier);
      const name = document.createElement('span');
      name.className = 'row-name';
      name.textContent = PLACES[r.id].name + (shown.has(r.id) ? ' (igen)' : '');
      shown.add(r.id);
      const sub = document.createElement('span');
      sub.className = 'row-sub';
      sub.textContent = SHORT[r.tier] + (r.inside ? ', inne i området' : ', ' + kmText(r.km) + ' bort');
      name.appendChild(sub);
      li.append(ic, name);
      ul.appendChild(li);
    }
    S.round = null;
    save();
    show('result');
    $('againBtn').focus({ preventScroll: true });
  }

  // ---------- Map view ----------
  const map = $('map');
  const view = { cx: KK.MAP_W / 2, cy: KK.MAP_H / 2, k: 1 };
  let W = 1, H = 1, minK = 1, maxK = 16;
  let pin = null;       // {lon, lat}
  let answered = false;
  let anim = 0;
  const screenFixed = []; // overlay items that keep their size on screen: {el, x, y}

  $('land').setAttribute('d', KK.LAND_D);
  $('sphere').setAttribute('d', KK.SPHERE_D);

  function clampView(v) {
    v.k = Math.max(minK, Math.min(maxK, v.k));
    const vw = W / v.k, vh = H / v.k;
    v.cx = vw >= KK.MAP_W ? KK.MAP_W / 2 : Math.max(vw / 2, Math.min(KK.MAP_W - vw / 2, v.cx));
    v.cy = vh >= KK.MAP_H ? KK.MAP_H / 2 : Math.max(vh / 2, Math.min(KK.MAP_H - vh / 2, v.cy));
    return v;
  }
  function applyView() {
    clampView(view);
    const vw = W / view.k, vh = H / view.k;
    map.setAttribute('viewBox', (view.cx - vw / 2).toFixed(3) + ' ' + (view.cy - vh / 2).toFixed(3) + ' ' + vw.toFixed(3) + ' ' + vh.toFixed(3));
    const s = (1 / view.k).toFixed(5);
    for (const o of screenFixed) o.el.setAttribute('transform', 'translate(' + o.x.toFixed(3) + ' ' + o.y.toFixed(3) + ') scale(' + s + ')');
  }
  function measure() {
    const r = map.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const z = view.k / minK;
    W = r.width; H = r.height;
    minK = Math.min(W / KK.MAP_W, H / KK.MAP_H);
    maxK = minK * 20;
    view.k = minK * z;
    return true;
  }
  // No stopAnim here: showing the answer panel resizes the map while the view is animating to the answer.
  new ResizeObserver(() => { if (current === 'quiz' && measure()) applyView(); }).observe(map);

  function stopAnim() { if (anim) cancelAnimationFrame(anim); anim = 0; }
  function animateTo(target, ms) {
    stopAnim();
    clampView(target);
    if (!ms || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      Object.assign(view, target);
      applyView();
      return;
    }
    const a = Object.assign({}, view), t0 = performance.now();
    const step = t => {
      const u = Math.min(1, (t - t0) / ms), e = u * u * (3 - 2 * u);
      view.k = a.k * Math.pow(target.k / a.k, e);
      view.cx = a.cx + (target.cx - a.cx) * e;
      view.cy = a.cy + (target.cy - a.cy) * e;
      applyView();
      anim = u < 1 ? requestAnimationFrame(step) : 0;
    };
    anim = requestAnimationFrame(step);
  }
  const worldView = () => ({ cx: KK.MAP_W / 2, cy: KK.MAP_H / 2, k: minK });
  const toMap = (sx, sy) => [view.cx + (sx - W / 2) / view.k, view.cy + (sy - H / 2) / view.k];
  const toScreen = (x, y) => [(x - view.cx) * view.k + W / 2, (y - view.cy) * view.k + H / 2];
  function zoomAround(sx, sy, factor) {
    const [mx, my] = toMap(sx, sy);
    view.k = Math.max(minK, Math.min(maxK, view.k * factor));
    view.cx = mx - (sx - W / 2) / view.k;
    view.cy = my - (sy - H / 2) / view.k;
    applyView();
  }
  function zoomButton(factor) {
    const k = Math.max(minK, Math.min(maxK, view.k * factor));
    animateTo({ cx: view.cx, cy: view.cy, k }, 180);
  }

  // ---------- Pin ----------
  const pinEl = $('pin');
  const pinItem = { el: pinEl, x: 0, y: 0 };
  screenFixed.push(pinItem);
  const PIN_HEAD_Y = -30;

  function setPinScreen(sx, sy) {
    const [mx, my] = toMap(sx, sy);
    const [lon, lat] = KK.unproject(mx, my); // snaps to the edge of the globe
    pin = { lon, lat };
    drawPin();
    updateAskPanel();
  }
  function drawPin() {
    pinEl.toggleAttribute('hidden', !pin);
    if (pin) {
      const [x, y] = KK.project(pin.lon, pin.lat);
      pinItem.x = x; pinItem.y = y;
      pinEl.setAttribute('transform', 'translate(' + x.toFixed(3) + ' ' + y.toFixed(3) + ') scale(' + (1 / view.k).toFixed(5) + ')');
    }
  }
  function updateAskPanel() {
    $('confirmBtn').disabled = !pin;
    $('hint').textContent = pin
      ? 'Dra nålen eller tryck någon annanstans för att flytta den. Bekräfta när du är nöjd.'
      : 'Tryck på kartan för att sätta nålen. Nyp eller använd knapparna för att zooma.';
  }

  // ---------- Gestures ----------
  // A pin is only placed by a clean one-finger tap: panning, pinching or a second finger on the
  // way all rule it out until every finger has been lifted.
  const TAP_SLOP = 10; // px
  const ptrs = new Map();
  let g = null;

  function local(e) {
    const r = map.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  function pinGrab(p) {
    if (!pin || answered) return null;
    const [tx, ty] = toScreen(pinItem.x, pinItem.y);
    const toHead = Math.hypot(p[0] - tx, p[1] - (ty + PIN_HEAD_Y));
    const toTip = Math.hypot(p[0] - tx, p[1] - ty);
    if (toHead > 26 && toTip > 20) return null;
    return { dx: tx - p[0], dy: ty - p[1], onHead: toHead <= 16 };
  }
  function pinchInfo() {
    const [a, b] = [...ptrs.values()];
    return { c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])) };
  }

  map.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { map.setPointerCapture(e.pointerId); } catch (err) {}
    stopAnim();
    const p = local(e);
    ptrs.set(e.pointerId, p);
    if (ptrs.size === 1) {
      g = { mode: 'pending', start: p, last: p, clean: true, grab: pinGrab(p) };
    } else if (g) {
      g.clean = false;
      if (ptrs.size === 2) { g.mode = 'pinch'; g.pinch = pinchInfo(); }
    }
    e.preventDefault();
  });
  map.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId) || !g) return;
    const p = local(e);
    ptrs.set(e.pointerId, p);
    if (g.mode === 'pending' && Math.hypot(p[0] - g.start[0], p[1] - g.start[1]) > TAP_SLOP) {
      g.clean = false;
      g.mode = g.grab ? 'drag' : 'pan';
      g.last = p;
    }
    if (g.mode === 'drag') {
      setPinScreen(p[0] + g.grab.dx, p[1] + g.grab.dy);
    } else if (g.mode === 'pan') {
      view.cx -= (p[0] - g.last[0]) / view.k;
      view.cy -= (p[1] - g.last[1]) / view.k;
      g.last = p;
      applyView();
    } else if (g.mode === 'pinch' && ptrs.size >= 2) {
      const n = pinchInfo(), [mx, my] = toMap(g.pinch.c[0], g.pinch.c[1]);
      view.k = Math.max(minK, Math.min(maxK, view.k * (n.d / g.pinch.d)));
      view.cx = mx - (n.c[0] - W / 2) / view.k;
      view.cy = my - (n.c[1] - H / 2) / view.k;
      g.pinch = n;
      applyView();
    }
  });
  function endPointer(e, cancelled) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (!g) return;
    if (cancelled) g.clean = false;
    if (ptrs.size === 0) {
      if (g.clean && g.mode === 'pending' && !answered && !(g.grab && g.grab.onHead)) setPinScreen(g.start[0], g.start[1]);
      g = null;
    } else if (ptrs.size === 1 && g.mode === 'pinch') {
      g.mode = 'pan';
      g.last = [...ptrs.values()][0];
    }
  }
  map.addEventListener('pointerup', e => endPointer(e, false));
  map.addEventListener('pointercancel', e => endPointer(e, true));
  map.addEventListener('contextmenu', e => e.preventDefault());
  // iOS Safari: stop its own pinch from zooming the page.
  for (const t of ['gesturestart', 'gesturechange']) $('mapWrap').addEventListener(t, e => e.preventDefault());
  map.addEventListener('wheel', e => {
    e.preventDefault();
    stopAnim();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const rate = e.ctrlKey ? 0.01 : 0.002; // ctrlKey means a trackpad pinch
    const r = map.getBoundingClientRect();
    zoomAround(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * unit * rate));
  }, { passive: false });
  map.addEventListener('keydown', e => {
    const step = 50 / view.k;
    const pan = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (pan) { stopAnim(); view.cx += pan[0]; view.cy += pan[1]; applyView(); }
    else if (e.key === '+' || e.key === '=') zoomButton(1.6);
    else if (e.key === '-') zoomButton(1 / 1.6);
    else if ((e.key === 'Enter' || e.key === ' ') && !answered) setPinScreen(W / 2, H / 2);
    else return;
    e.preventDefault();
  });
  $('zoomIn').addEventListener('click', () => zoomButton(1.6));
  $('zoomOut').addEventListener('click', () => zoomButton(1 / 1.6));
  $('zoomAll').addEventListener('click', () => animateTo(worldView(), 220));

  // ---------- Quiz ----------
  const reveal = $('reveal'), connector = $('connector');

  function clearReveal() {
    reveal.textContent = '';
    connector.setAttribute('hidden', '');
    for (let i = screenFixed.length - 1; i >= 0; i--) if (screenFixed[i] !== pinItem) screenFixed.splice(i, 1);
  }
  function showQuiz() {
    enterSub();
    show('quiz');
    measure();
    askCurrent();
  }
  function askCurrent() {
    const rd = S.round, id = rd.queue[rd.idx];
    answered = false;
    pin = null;
    ptrs.clear();
    g = null;
    map.classList.remove('answered');
    clearReveal();
    drawPin();
    $('counter').textContent = 'Fråga ' + (rd.idx + 1) + ' av ' + rd.queue.length;
    $('roundBar').style.width = (rd.idx / rd.queue.length) * 100 + '%';
    $('placeName').textContent = PLACES[id].name;
    $('askPanel').hidden = false;
    $('answerPanel').hidden = true;
    updateAskPanel();
    measure();
    Object.assign(view, worldView());
    stopAnim();
    applyView();
  }

  function drawFeature(place, score) {
    const f = KK.featureShape(place);
    if (f.kind === 'area') {
      reveal.appendChild(svgEl('path', { d: f.d, class: 'f-area' }));
    } else if (f.kind === 'line') {
      reveal.appendChild(svgEl('path', { d: f.d, class: 'f-halo' }));
      reveal.appendChild(svgEl('path', { d: f.d, class: 'f-line' }));
    } else {
      const g2 = svgEl('g', {});
      g2.append(svgEl('circle', { r: 11, class: 'f-ring-halo' }), svgEl('circle', { r: 11, class: 'f-ring' }), svgEl('circle', { r: 3.5, class: 'f-dot' }));
      reveal.appendChild(g2);
      screenFixed.push({ el: g2, x: f.at[0], y: f.at[1] });
    }
    if (score.km > 0) {
      const a = KK.project(pin.lon, pin.lat), b = KK.project(score.at[0], score.at[1]);
      connector.setAttribute('x1', a[0]); connector.setAttribute('y1', a[1]);
      connector.setAttribute('x2', b[0]); connector.setAttribute('y2', b[1]);
      connector.removeAttribute('hidden');
    }
    return f;
  }

  // Frame the answer and the pin, with room for the pin's head and without losing the sense of
  // where on Earth we are.
  function frameAnswer(f) {
    const [px, py] = KK.project(pin.lon, pin.lat);
    let [x0, y0, x1, y1] = f.bbox;
    x0 = Math.min(x0, px); x1 = Math.max(x1, px);
    y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    const MIN_SPAN = 120; // map units (about 4 800 km), keeps small targets from zooming in too far
    const bw = Math.max(x1 - x0, MIN_SPAN), bh = Math.max(y1 - y0, MIN_SPAN);
    const pad = 46;
    const k = Math.min((W - pad * 2) / bw, (H - pad * 2 - 34) / bh);
    animateTo({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 - 17 / Math.max(k, minK), k: Math.max(minK, k) }, 500);
  }

  function confirmPin() {
    if (!pin || answered) return;
    const rd = S.round, id = rd.queue[rd.idx], place = PLACES[id];
    const score = KK.score(place, pin.lon, pin.lat);
    answered = true;
    map.classList.add('answered');
    recordAnswer(id, score.tier, score.km, score.inside);

    tierIcon($('verdictIcon'), score.tier);
    const word = $('verdictWord');
    word.textContent = WORDS[score.tier];
    word.className = 'verdict-word t-' + score.tier;
    $('verdictPips').replaceWith(Object.assign(pips(id), { id: 'verdictPips' }));

    const where = score.inside ? 'Nålen hamnade inne i området.' : kmText(score.km).replace(/^./, c => c.toUpperCase()) + ' bort.';
    const extra = score.tier === 'near' ? ' Du är på rätt spår, den kommer tillbaka.'
      : score.tier === 'wrong' ? ' Titta var den ligger, så kommer den tillbaka.' : '';
    $('distance').textContent = where + extra;
    $('fact').textContent = place.info;
    $('nextBtn').textContent = rd.finished ? 'Se resultatet' : 'Nästa';
    $('roundBar').style.width = (rd.idx / rd.queue.length) * 100 + '%';
    $('counter').textContent = 'Fråga ' + rd.idx + ' av ' + rd.queue.length;

    $('askPanel').hidden = true;
    $('answerPanel').hidden = false;
    measure(); // the panel may have changed the map's height
    applyView();
    const f = drawFeature(place, score);
    applyView();
    frameAnswer(f);
    $('nextBtn').focus({ preventScroll: true });
  }

  function next() {
    if (S.round.finished) { showResult(); return; }
    askCurrent();
    map.focus({ preventScroll: true }); // Next was just hidden; keeps keyboard users on the map
  }

  $('confirmBtn').addEventListener('click', confirmPin);
  $('nextBtn').addEventListener('click', next);
  $('exitBtn').addEventListener('click', leaveSub);
  $('startBtn').addEventListener('click', () => { if (S.round) showQuiz(); else startRound(); });
  $('againBtn').addEventListener('click', () => {
    S.round = { queue: pickRound(), idx: 0, results: [], reasked: [] };
    save();
    showQuiz();
  });
  $('toHomeBtn').addEventListener('click', leaveSub);

  // ---------- Reset ----------
  const dlg = $('resetDialog');
  $('resetBtn').addEventListener('click', () => dlg.showModal());
  $('resetCancel').addEventListener('click', () => dlg.close());
  $('resetConfirm').addEventListener('click', () => {
    const scope = S.scope;
    S = freshState();
    S.scope = scope;
    save();
    dlg.close();
    renderHome();
  });

  // A round that was fully answered before a reload has nothing left to show.
  if (S.round && S.round.idx >= S.round.queue.length) { S.round = null; save(); }
  showHome();
})();

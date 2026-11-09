/* Ordrummet: spelets regler, utan något som rör skärmen.
 * Laddas som vanligt skript i sidan (window.OrdrumCore) och kan köras i Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OrdrumCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- rules ---------- */
  const STEPS = 3;            // correct answers needed per word
  const SESSION_PROMPTS = 10; // prompts in one sitting
  const SESSION_EXTRAS = 3;   // extra prompts allowed so a missed word can come back
  const NEW_PER_SESSION = 5;  // don't introduce more new words than this in one sitting
  const RETURN_AFTER = 3;     // a missed word returns this many prompts later

  const shuffle = (a, rng = Math.random) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  /* ---------- course: turn word data into items ---------- */
  function autoMark(w) { return w.replace(/(([bdfgklmnprst])\2|ck|stj|skj|sj|tj|kj|dj|gj|hj|lj|ng|[åäö])/g, '[$1]'); }

  function genWrong(w) {
    const rule = new Set(), del = new Set();
    const ok = v => v && v !== w && /^[a-zåäöé]+$/.test(v);
    const add = v => { if (ok(v)) rule.add(v); };
    const V = 'aeiouyåäöé';
    w.replace(/([bcdfgklmnprstvxz])\1/g, (m, c, i) => { add(w.slice(0, i) + c + w.slice(i + 2)); return m; });
    for (let i = 1; i < w.length; i++) { const c = w[i]; if (!V.includes(c) && V.includes(w[i - 1]) && w[i + 1] !== c && !'hjvwqx'.includes(c)) add(w.slice(0, i) + c + w.slice(i)); }
    const swaps = [[/å/, 'o'], [/o/, 'å'], [/ä/, 'e'], [/e/, 'ä'], [/ck/, 'k'], [/n(?=[pb])/, 'm'], [/ng/, 'nk'], [/g$/, 'k'], [/d$/, 't'], [/^av/, 'af'], [/stj/, 'sj'], [/skj/, 'sj'], [/sj/, 'sch'], [/tj/, 'sj'], [/kj/, 'tj'], [/[dghl]j/, 'j'], [/x/, 'ks'], [/ks/, 'x']];
    for (const [re, r] of swaps) { const g = new RegExp(re.source, 'g'); let m; while ((m = g.exec(w))) { add(w.slice(0, m.index) + r + w.slice(m.index + m[0].length)); if (!m[0].length) g.lastIndex++; } }
    for (let i = 1; i < w.length - 1; i++) { const v = w.slice(0, i) + w.slice(i + 1); if (ok(v) && !rule.has(v)) del.add(v); }
    const out = shuffle([...rule]); if (out.length < 5) out.push(...shuffle([...del]).slice(0, 5 - out.length));
    return out.slice(0, 8);
  }

  function genWrongForeign(w, lang) {
    const rule = new Set();
    const ok = v => v && v !== w && v.length > 1;
    const add = v => { if (ok(v)) rule.add(v); };
    const swapAll = (re, r) => { const g = new RegExp(re.source, 'g'); let m; while ((m = g.exec(w))) { add(w.slice(0, m.index) + r + w.slice(m.index + m[0].length)); if (!m[0].length) g.lastIndex++; } };
    w.replace(/([bcdfgklmnprstz])\1/g, (m, c, i) => { add(w.slice(0, i) + c + w.slice(i + 2)); return m; });
    const V = lang === 'de' ? 'aeiouäöü' : 'aeiouy';
    for (let i = 1; i < w.length; i++) { const c = w[i]; if (!V.includes(c) && V.includes(w[i - 1]) && w[i + 1] !== c && /[bdfgklmnprst]/.test(c)) add(w.slice(0, i) + c + w.slice(i)); }
    const sw = lang === 'de'
      ? [[/ä/, 'a'], [/ö/, 'o'], [/ü/, 'u'], [/ü/, 'y'], [/ß/, 'ss'], [/ss/, 'ß'], [/ie/, 'ei'], [/ei/, 'ie'], [/z/, 's'], [/w/, 'v'], [/v/, 'f'], [/sch/, 'sh'], [/ch/, 'k'], [/eu/, 'oi'], [/tz/, 'z'], [/ck/, 'k'], [/h(?=[lmnr])/, ''], [/e$/, '']]
      : [[/ie/, 'ei'], [/ei/, 'ie'], [/ph/, 'f'], [/c(?=[aou])/, 'k'], [/k/, 'c'], [/ou/, 'o'], [/y$/, 'ie'], [/e$/, ''], [/ck/, 'k'], [/wh/, 'w'], [/th/, 't'], [/ee/, 'ea'], [/ea/, 'ee'], [/oo/, 'u']];
    for (const [re, r] of sw) swapAll(re, r);
    if (lang === 'de' && /^[A-ZÄÖÜ]/.test(w)) add(w[0].toLowerCase() + w.slice(1));
    const out = shuffle([...rule]);
    if (out.length < 3) for (let i = 1; i < w.length - 1 && out.length < 5; i++) { const v = w.slice(0, i) + w.slice(i + 1); if (ok(v) && !out.includes(v)) out.push(v); }
    return out.slice(0, 8);
  }

  function spellItem(entry) {
    const o = typeof entry === 'string' ? { w: entry } : entry;
    const w = o.w.trim();
    const wrong = (o.wrong && o.wrong.length >= 3) ? o.wrong : [...new Set([...(o.wrong || []), ...genWrong(w)])];
    return { key: w, kind: 'spell', lang: 'sv', f: w, core: w, toks: [w], mark: o.mark || autoMark(w), tip: o.tip || '', sentence: o.sentence || '', wrong, alts: [] };
  }
  function langItem(entry, lang) {
    const [f0, sv0, alts] = entry;
    const f = String(f0).trim(), sv = String(sv0).trim();
    const m = lang === 'de' ? f.match(/^(der|die|das)\s+(\S+)$/) : null;
    const toks = f.replace(/[…?!.,]/g, ' ').split(/\s+/).filter(Boolean);
    const core = m ? m[2] : f;
    const single = toks.length === 1 || !!m;
    return { key: f, kind: 'lang', lang, f, sv, art: m ? m[1] : null, core, toks, phrase: !single, alts: alts || [],
      wrongF: single && /^[\p{L}-]+$/u.test(core) ? genWrongForeign(core, lang) : [] };
  }
  /** Turns ORDRUM_DATA into subjects with lists of items. A word appearing twice in a list is kept once. */
  function buildCourse(data) {
    return data.map(s => {
      const lists = s.lists.map(l => {
        const raw = l.words ? l.words.map(spellItem) : l.items.map(e => langItem(e, s.lang));
        const seen = new Set(), items = raw.filter(it => it.key && !seen.has(it.key) && seen.add(it.key));
        return { id: l.id, uid: s.id + ':' + l.id, subject: s.id, name: l.name, sub: l.sub || '', items };
      }).filter(l => l.items.length);
      return { id: s.id, name: s.name, blurb: s.blurb || '', lang: s.lang, langName: s.langName || 'svenska', lists };
    });
  }

  /* ---------- state ---------- */
  /** v2 adds `room` (where the player has moved things). A v1 save is read as is, with everything in its usual spot. */
  const emptyState = () => ({ v: 2, lists: {}, seenLevel: 0, muted: false, subject: null, savedAt: 0, room: { at: 0, items: {} } });
  const clampStep = n => Math.max(0, Math.min(STEPS, Math.floor(Number(n) || 0)));
  const count = n => Math.max(0, Math.floor(Number(n) || 0));

  /** Accepts anything (old version, damaged, imported) and returns a well-formed state. */
  function normState(s) {
    const out = emptyState();
    if (!s || typeof s !== 'object') return out;
    out.seenLevel = count(s.seenLevel);
    out.muted = !!s.muted;
    out.subject = typeof s.subject === 'string' ? s.subject : null;
    out.savedAt = count(s.savedAt);
    if (s.lists && typeof s.lists === 'object') for (const uid of Object.keys(s.lists)) {
      const l = s.lists[uid]; if (!l || typeof l !== 'object') continue;
      const words = {};
      if (l.words && typeof l.words === 'object') for (const k of Object.keys(l.words)) {
        const w = l.words[k]; if (!w || typeof w !== 'object') continue;
        words[k] = { s: clampStep(w.s), seen: count(w.seen), ok: count(w.ok) };
      }
      out.lists[uid] = { done: !!l.done, doneAt: count(l.doneAt), words };
    }
    out.room = normRoom(s.room);
    return out;
  }

  /** Level = number of completed lists. Kept in the save itself, so editing the word data can never lower it. */
  const levelOf = st => Object.values(st.lists).filter(l => l.done).length;
  function listState(st, uid) { return st.lists[uid] || (st.lists[uid] = { done: false, doneAt: 0, words: {} }); }
  function wordState(st, list, it) { const l = st.lists[list.uid]; return (l && l.words[it.key]) || { s: 0, seen: 0, ok: 0 }; }
  function listProgress(st, list) {
    const l = st.lists[list.uid];
    let mastered = 0, fresh = 0, steps = 0;
    for (const it of list.items) { const w = wordState(st, list, it); if (w.s >= STEPS) mastered++; if (!w.seen) fresh++; steps += w.s; }
    return { mastered, total: list.items.length, done: !!(l && l.done), fresh, steps, stepsTotal: list.items.length * STEPS, started: steps > 0 || fresh < list.items.length };
  }
  /** Records one answer. A wrong answer drops the word one step. A completed list stays completed. */
  function recordAnswer(st, list, it, ok, now = Date.now()) {
    const l = listState(st, list.uid);
    const w = l.words[it.key] || (l.words[it.key] = { s: 0, seen: 0, ok: 0 });
    const was = w.s;
    w.seen++;
    if (ok) { w.ok++; w.s = Math.min(STEPS, w.s + 1); } else w.s = Math.max(0, w.s - 1);
    let completed = false;
    if (!l.done && list.items.every(x => wordState(st, list, x).s >= STEPS)) { l.done = true; l.doneAt = now; completed = true; }
    return { was, now: w.s, mastered: w.s >= STEPS, completed };
  }

  /* ---------- storage ---------- */
  const STORE_KEY = 'ordrummet1';
  function makeStore(getLS) {
    let ls = null, memory = null;
    try { const x = getLS(); const k = 'ordrummet-probe'; x.setItem(k, '1'); if (x.getItem(k) === '1') { x.removeItem(k); ls = x; } } catch (e) { ls = null; }
    const read = () => { try { const raw = ls ? ls.getItem(STORE_KEY) : memory; return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
    return {
      persistent: () => !!ls,
      load: () => normState(read()),
      /** Saves `st`. Unless replacing (reset/import), never loses a level or a further-practised word from another tab. */
      save(st, replace) {
        st.savedAt = Date.now();
        try {
          if (!replace) {
            const disk = read();
            if (disk) {
              const d = normState(disk);
              for (const uid of Object.keys(d.lists)) {
                const mine = listState(st, uid), theirs = d.lists[uid];
                if (theirs.done && !mine.done) { mine.done = true; mine.doneAt = theirs.doneAt; }
                for (const k of Object.keys(theirs.words)) if (!mine.words[k] || theirs.words[k].seen > mine.words[k].seen) mine.words[k] = theirs.words[k];
              }
              st.seenLevel = Math.max(st.seenLevel, d.seenLevel);
              if (d.room.at > ((st.room && st.room.at) || 0)) st.room = d.room; // furniture moved more recently in another tab
            }
          }
          const raw = JSON.stringify(st);
          if (ls) ls.setItem(STORE_KEY, raw); else memory = raw;
          return true;
        } catch (e) { memory = JSON.stringify(st); return false; }
      },
      clear() { memory = null; try { if (ls) ls.removeItem(STORE_KEY); } catch (e) {} },
    };
  }
  const b64enc = s => { const b = new TextEncoder().encode(s); let o = ''; for (const c of b) o += String.fromCharCode(c); return btoa(o); };
  const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
  function exportCode(st) { return 'OR1-' + b64enc(JSON.stringify(st)); }
  function importCode(str) {
    str = String(str || '').replace(/\s+/g, '');
    if (str.slice(0, 4) !== 'OR1-') throw new Error('fmt');
    const o = JSON.parse(b64dec(str.slice(4)));
    if (!o || typeof o !== 'object' || !o.lists) throw new Error('fmt');
    return normState(o);
  }

  /* ---------- session ---------- */
  function createSession(st, list, rng = Math.random) {
    return { list, rng, asked: 0, ok: 0, wrong: 0, newUsed: 0, limit: SESSION_PROMPTS, extras: 0, history: [], due: [], introduced: new Set(), askedCount: {} };
  }
  /** Picks the next word, or null when the sitting is over. Missed words come back; recent words wait. */
  function nextItem(st, ses) {
    const { list, rng } = ses;
    const unmastered = list.items.filter(it => wordState(st, list, it).s < STEPS);
    const wasDone = listProgress(st, list).done;
    if (!unmastered.length && !wasDone) return null;           // just finished
    if (ses.asked >= ses.limit && !ses.due.length) return null;
    if (ses.asked >= SESSION_PROMPTS + SESSION_EXTRAS) return null;

    const dueNow = ses.due.find(d => d.at <= ses.asked);
    const last = ses.history[ses.history.length - 1], last2 = ses.history[ses.history.length - 2];
    if (dueNow) { ses.due.splice(ses.due.indexOf(dueNow), 1); if (dueNow.key !== last || list.items.length === 1) return list.items.find(i => i.key === dueNow.key); ses.due.push({ key: dueNow.key, at: ses.asked + 1 }); }

    let pool = unmastered.length ? unmastered : list.items;     // a finished list is reviewed in full
    // Fill out a short list of open words with mastered ones rather than drilling two words back to back.
    if (pool.length < 3 && wasDone) pool = list.items;
    const pendingDue = new Set(ses.due.map(d => d.key));
    let cands = pool.filter(it => !pendingDue.has(it.key));
    if (!cands.length) cands = pool;
    if (ses.newUsed >= NEW_PER_SESSION) { const old = cands.filter(it => wordState(st, list, it).seen > 0 || ses.introduced.has(it.key)); if (old.length) cands = old; }
    const notRecent = cands.filter(it => it.key !== last && it.key !== last2);
    if (notRecent.length) cands = notRecent;
    else { const notLast = cands.filter(it => it.key !== last); if (notLast.length) cands = notLast; }
    const score = it => (ses.askedCount[it.key] || 0) * 2 + wordState(st, list, it).s * 0.5 + rng();
    return cands.slice().sort((a, b) => score(a) - score(b))[0];
  }
  function startPrompt(st, ses, it) {
    const fresh = wordState(st, ses.list, it).seen === 0 && !ses.introduced.has(it.key);
    if (fresh) { ses.introduced.add(it.key); ses.newUsed++; }
    return fresh; // caller shows the intro card first
  }
  function afterAnswer(st, ses, it, ok, now) {
    const res = recordAnswer(st, ses.list, it, ok, now);
    ses.asked++;
    ses.askedCount[it.key] = (ses.askedCount[it.key] || 0) + 1;
    ses.history.push(it.key);
    if (ok) ses.ok++;
    else {
      ses.wrong++;
      ses.due.push({ key: it.key, at: ses.asked + RETURN_AFTER - 1 });
      if (ses.limit < SESSION_PROMPTS + SESSION_EXTRAS && ses.asked + RETURN_AFTER > ses.limit) ses.limit = Math.min(SESSION_PROMPTS + SESSION_EXTRAS, ses.asked + RETURN_AFTER);
    }
    return res;
  }

  /* ---------- exercises ---------- */
  const svParts = s => s.toLowerCase().replace(/^att\s+/, '').split(/[,/]/).map(x => x.trim()).filter(Boolean);
  function clashes(a, b) { if (a.f === b.f || a.sv === b.sv) return true; const A = svParts(a.sv), B = svParts(b.sv); return A.some(x => B.includes(x)); }
  /** Wrong options for a multiple-choice question, preferring the same list and the same kind (word/phrase). */
  function distractors(it, dir, n, list, all, rng = Math.random) {
    const pool = shuffle(all.filter(x => !clashes(x, it)), rng);
    const score = x => (list.items.includes(x) ? 0 : 2) + (x.phrase === it.phrase ? 0 : 3) + rng();
    const scored = pool.map(x => [score(x), x]).sort((a, b) => a[0] - b[0]).map(p => p[1]);
    const out = [], seen = new Set([dir === 's2f' ? it.f : it.sv]);
    for (const x of scored) { const t = dir === 's2f' ? x.f : x.sv; if (seen.has(t)) continue; seen.add(t); out.push(x); if (out.length >= n) break; }
    return out;
  }
  /**
   * Chooses the exercise for a word by its step:
   *   step 0: recognise it (choose among options)
   *   step 1: write it with some letters given (long phrases: put the words in order)
   *   step 2+: write it freely, no hints
   */
  function exerciseFor(it, step, rng = Math.random) {
    const pick = a => a[Math.floor(rng() * a.length)];
    if (it.kind === 'spell') {
      if (step <= 0) return { t: 'spellpick' };
      if (step === 1) return { t: 'type', hint: skeleton(it, rng) };
      return { t: 'type', hint: null };
    }
    if (step <= 0) {
      const opts = ['f2s', 'f2s', 's2f'];
      if (it.art) opts.push('art');
      if (it.wrongF.length >= 3) opts.push('lspell');
      const t = pick(opts);
      return (t === 'f2s' || t === 's2f') ? { t: 'choose', dir: t } : { t };
    }
    if (step === 1) {
      if (it.phrase && it.toks.length >= 3) return { t: 'order' };
      return { t: 'type', hint: skeleton(it, rng) };
    }
    return { t: 'type', hint: null };
  }

  const isLetter = c => /\p{L}/u.test(c);
  /**
   * Shows a word with some letters hidden. Swedish spelling words hide their tricky parts (the marked segments);
   * other words keep the first letter of each word and roughly half of the rest.
   */
  function skeleton(it, rng = Math.random) {
    if (it.kind === 'spell') {
      const parts = []; it.mark.replace(/\[([^\]]+)\]|([^\[]+)/g, (m, h, p) => { parts.push(h ? '_'.repeat(h.length) : p); return m; });
      const s = parts.join('');
      if (s.includes('_') && s.replace(/_/g, '').length > 0) return s;
    }
    const text = it.f.replace(/\s*…\s*/g, ' ').replace(/[?!.,]+$/g, '').trim();
    let out = '', atStart = true, hidden = 0, letters = 0;
    for (const c of text) {
      if (!isLetter(c) && !/\d/.test(c)) { out += c; atStart = true; continue; }
      letters++;
      if (atStart) { out += c; atStart = false; continue; }
      if (rng() < 0.55) { out += '_'; hidden++; } else out += c;
    }
    if (!hidden && letters > 1) { // make sure something is left to write
      for (let i = out.length - 1; i > 0; i--) if (isLetter(out[i]) && isLetter(out[i - 1])) { out = out.slice(0, i) + '_' + out.slice(i + 1); break; }
    }
    return out;
  }

  /* ---------- grading typed answers ---------- */
  const cleanSpaces = s => s.replace(/\s+/g, ' ').trim();
  /** Punctuation and the "…" placeholder never count; apostrophes are unified. */
  function normAnswer(s) {
    return cleanSpaces(String(s == null ? '' : s).normalize('NFC').replace(/[’‘`´]/g, "'").replace(/[…?!.,;:]/g, ' '));
  }
  /**
   * Returns {result:'ok'} | {result:'almost', why:'case'|'art'} | {result:'wrong', why?}.
   * "Almost" asks the player to fix a detail without counting as a miss.
   */
  function gradeTyped(it, input) {
    const got = normAnswer(input);
    if (!got) return { result: 'empty' };
    const targets = [it.f].concat(it.alts || []).map(normAnswer);
    if (targets.includes(got)) return { result: 'ok' };
    const lower = s => s.toLocaleLowerCase(it.lang || 'sv');
    const gl = lower(got);
    for (const t of targets) {
      if (lower(t) !== gl) continue;
      // Same letters, different capitals. A capital at the very start of a Swedish/English word or of a sentence is fine.
      const firstFree = a => a.charAt(0).toLowerCase() + a.slice(1);
      const sentence = it.phrase && it.toks.length >= 2;
      const initialOnlyDiffers = firstFree(t) === firstFree(got);
      if (initialOnlyDiffers && (sentence || it.lang !== 'de')) {
        const onlyAddsCapital = t.charAt(0) === t.charAt(0).toLowerCase() || sentence;
        if (onlyAddsCapital) return { result: 'ok' };
      }
      return { result: 'almost', why: 'case' };
    }
    if (it.art) {
      const low = lower(it.core);
      if (gl === low) return { result: 'almost', why: 'art' };
      const m = gl.match(/^(der|die|das|den|dem)\s+(.+)$/);
      if (m && m[2] === low) return { result: 'wrong', why: 'wrongart' };
    }
    return { result: 'wrong' };
  }

  /** Marks which letters of `target` the player got right, for showing the difference after a miss. */
  function diffTarget(typed, target) {
    const a = [...normAnswer(typed)], b = [...target];
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (j < b.length) {
      if (i < a.length && a[i] === b[j]) { out.push({ c: b[j], ok: true }); i++; j++; }
      else if (i < a.length && dp[i + 1][j] >= dp[i][j + 1]) i++;
      else { out.push({ c: b[j], ok: !isLetter(b[j]) }); j++; }
    }
    return out;
  }

  /* ---------- furniture: the plan for the room ----------
   * Coordinates are metres. The room spans x,z from -3 to 3 with walls at x=-3 and z=-3.
   * `fp` is the default floor footprint [x0,x1,z0,z1] and `h` the height; `flat` items can be walked on.
   * `wall` items hang on a wall: wall:'z' is the back wall (u = x), wall:'x' the left wall (u = z),
   * rect = [u0,u1,y0,y1] is the default spot and `d` how far it sticks out. `on` items stand on another
   * item's top (see SURFACES), with footprint `s` = [width, depth]. `fixed` items can't be moved.
   */
  const FURNITURE = [
    { id: 'bed',       name: 'Säng',           a: 'en säng',            fp: [-2.95, -1.75, -2.95, -0.85], h: 1.0 },
    { id: 'desk',      name: 'Skrivbord',      a: 'ett skrivbord',      fp: [-0.4, 1.2, -2.95, -2.2], h: 0.86 },
    { id: 'drawers',   name: 'Byrå',           a: 'en byrå',            fp: [-2.95, -2.4, -0.6, 0.5], h: 0.9 },
    { id: 'lamp',      name: 'Golvlampa',      a: 'en golvlampa',       fp: [-1.65, -1.3, -2.95, -2.6], h: 1.66 },
    { id: 'plant',     name: 'Krukväxt',       a: 'en krukväxt',        fp: [2.45, 2.95, -2.95, -2.45], h: 1.26 },
    { id: 'cat',       name: 'Katt',           a: 'en katt',            moving: true },
    { id: 'rug',       name: 'Matta',          a: 'en matta',           fp: [-1.3, 1.2, -1, 1.2], h: 0.03, flat: true },
    { id: 'bookshelf', name: 'Bokhylla',       a: 'en bokhylla',        fp: [1.5, 2.35, -2.95, -2.6], h: 2.1 },
    { id: 'chair',     name: 'Stol',           a: 'en stol',            fp: [0.1, 0.7, -2.1, -1.5], h: 0.95 },
    { id: 'poster',    name: 'Poster',         a: 'en poster',          wall: 'z', rect: [-2.75, -1.85, 1.35, 2.45], d: 0.04 },
    { id: 'curtains',  name: 'Gardiner',       a: 'gardiner',           wall: 'z', rect: [-0.7, 1.45, 1.0, 2.5], d: 0.16, over: 'window', fixed: true },
    { id: 'clock',     name: 'Väggklocka',     a: 'en väggklocka',      wall: 'z', rect: [-1.35, -0.85, 1.85, 2.35], d: 0.07 },
    { id: 'beanbag',   name: 'Sittsäck',       a: 'en sittsäck',        fp: [2.0, 2.85, 0.4, 1.25], h: 0.73 },
    { id: 'guitar',    name: 'Gitarr',         a: 'en gitarr',          fp: [-2.95, -2.6, 0.6, 1.15], h: 1.32 },
    { id: 'teddy',     name: 'Nalle',          a: 'en nalle',           on: 'bed', s: [0.28, 0.26], h: 0.45 },
    { id: 'laptop',    name: 'Dator',          a: 'en dator',           on: 'desk', s: [0.4, 0.34], h: 0.27 },
    { id: 'aquarium',  name: 'Akvarium',       a: 'ett akvarium',       on: 'drawers', s: [0.3, 0.6], h: 0.33 },
    { id: 'shelf',     name: 'Vägghylla',      a: 'en vägghylla',       wall: 'x', rect: [-0.6, 0.5, 1.45, 2.0], d: 0.25 },
    { id: 'globe',     name: 'Jordglob',       a: 'en jordglob',        on: 'desk', s: [0.26, 0.26], h: 0.38 },
    { id: 'basket',    name: 'Papperskorg',    a: 'en papperskorg',     fp: [-1.15, -0.8, -2.95, -2.6], h: 0.42 },
    { id: 'cattree',   name: 'Klösträd',       a: 'ett klösträd',       fp: [2.4, 2.95, -2.0, -1.45], h: 1.39 },
    { id: 'football',  name: 'Fotboll',        a: 'en fotboll',         fp: [1.55, 1.85, 1.6, 1.9], h: 0.26 },
    { id: 'lights',    name: 'Ljusslinga',     a: 'en ljusslinga',      wall: 'x', rect: [-2.9, 2.9, 2.55, 2.8], d: 0.05 },
    { id: 'pennants',  name: 'Vimplar',        a: 'vimplar',            wall: 'z', rect: [-2.9, -1.0, 2.5, 2.8], d: 0.03 },
    { id: 'corkboard', name: 'Anslagstavla',   a: 'en anslagstavla',    wall: 'x', rect: [0.55, 1.25, 1.25, 2.1], d: 0.06 },
    { id: 'map',       name: 'Världskarta',    a: 'en världskarta',     wall: 'x', rect: [-2.65, -1.05, 1.2, 2.2], d: 0.03 },
    { id: 'cushions',  name: 'Golvkuddar',     a: 'golvkuddar',         fp: [-2.9, -2.05, 2.45, 2.95], h: 0.34 },
    { id: 'telescope', name: 'Teleskop',       a: 'ett teleskop',       fp: [-1.9, -1.35, 2.3, 2.85], h: 1.28 },
    { id: 'record',    name: 'Skivspelare',    a: 'en skivspelare',     fp: [2.3, 2.9, -1.0, -0.4], h: 0.67 },
    { id: 'trophy',    name: 'Pokal',          a: 'en pokal',           on: 'bookshelf', s: [0.28, 0.15], h: 0.3 },
  ];
  /** Fixed parts of the empty room, kept here so the layout checks include them. */
  const FIXED = {
    door: { wall: 'x', rect: [1.35, 2.3, 0, 2.2] }, // the floor in front of it stays clear
    doorClear: { fp: [-3, -2.2, 1.3, 2.35] },
    window: { wall: 'z', rect: [-0.35, 1.15, 1.1, 2.3] },
  };
  /**
   * Tops that small things can stand on, in the item's own coordinates (before it is moved or turned).
   * y is the height of the top, rect = [x0,x1,z0,z1] the usable part of it.
   */
  const SURFACES = {
    bed:       { y: 0.5,  rect: [-0.55, 0.55, -0.5, 0.98] },
    desk:      { y: 0.76, rect: [-0.8, 0.8, -0.375, 0.375] },
    drawers:   { y: 0.9,  rect: [-0.29, 0.29, -0.57, 0.57] },
    bookshelf: { y: 2.1,  rect: [-0.425, 0.425, -0.175, 0.175] },
  };
  /** Where each `on` item stands at first, in its host's coordinates. */
  const ON_AT = { teddy: [0, -0.22], laptop: [-0.12, -0.045], aquarium: [0, 0], globe: [-0.45, -0.145], trophy: [0, 0] };
  /** After the 30th item, each new level lights one more star on the wall. These spots come first. */
  const STAR_SPOTS = [
    ['z', -0.2, 2.65], ['z', 0.3, 2.72], ['z', 0.8, 2.62], ['z', 1.3, 2.72], ['z', 1.8, 2.6], ['z', 2.3, 2.72], ['z', 2.75, 2.6],
    ['z', 1.65, 2.34], ['z', 2.15, 2.4], ['z', 2.7, 2.25], ['z', 2.5, 1.85], ['z', 2.85, 1.55],
    ['x', -0.45, 2.3], ['x', 0.0, 2.42], ['x', 0.45, 2.28], ['x', 0.85, 2.38], ['x', 1.3, 2.42], ['x', 1.8, 2.36], ['x', 2.3, 2.44],
    ['x', 2.65, 2.2], ['x', 2.55, 1.7], ['x', 2.75, 1.25], ['x', -2.2, 2.42], ['x', -1.5, 2.36],
  ];
  const furnitureFor = level => FURNITURE.slice(0, Math.min(level, FURNITURE.length));
  const nextFurniture = level => FURNITURE[level] || null;
  const starCount = level => Math.min(STAR_SPOTS.length, Math.max(0, level - FURNITURE.length));

  /* ---------- moving furniture: where each thing may stand ----------
   * A placement is one of
   *   floor: { k:'f', x, z, r }      centre of the footprint, r = turns of 45° around the vertical axis
   *   wall:  { k:'w', w:'x'|'z', u, y }  centre of the rectangle on the back (z) or left (x) wall
   *   on:    { k:'o', on, x, z, r }  centre on top of item `on`, in that item's own coordinates
   * A layout maps item id -> placement. Only items the player has moved are saved; the rest use their default.
   */
  const BY_ID = Object.fromEntries(FURNITURE.map(f => [f.id, f]));
  const TURN = Math.PI / 4, TOL = 0.015, FLOOR_LO = -2.96, FLOOR_HI = 2.97, WALL_LO = -2.96, WALL_HI = 2.97, WALL_TOP = 2.82, WALL_BOTTOM = 0.15;
  const r3 = v => Math.round(v * 1000) / 1000;
  const turn = r => ((Math.round(Number(r) || 0) % 8) + 8) % 8;
  const kindOf = f => !f ? null : f.moving ? 'cat' : f.fp ? 'floor' : f.wall ? 'wall' : 'on';
  const canMove = id => { const f = BY_ID[id]; return !!f && !f.moving && !f.fixed; };

  function defaultPlacement(f) {
    if (f.fp) return { k: 'f', x: r3((f.fp[0] + f.fp[1]) / 2), z: r3((f.fp[2] + f.fp[3]) / 2), r: 0 };
    if (f.wall) return { k: 'w', w: f.wall, u: r3((f.rect[0] + f.rect[1]) / 2), y: r3((f.rect[2] + f.rect[3]) / 2) };
    if (f.on) return { k: 'o', on: f.on, x: ON_AT[f.id][0], z: ON_AT[f.id][1], r: 0 };
    return null;
  }
  const finite = v => typeof v === 'number' && isFinite(v);
  const clampN = (v, a, b) => r3(Math.max(a, Math.min(b, v)));
  /** A saved placement for item f, cleaned up, or null if it doesn't fit the kind of item (a bed never hangs on a wall). */
  function normPlacement(f, p) {
    if (!f || f.moving || f.fixed || !p || typeof p !== 'object') return null;
    if (f.fp && p.k === 'f' && finite(p.x) && finite(p.z)) return { k: 'f', x: clampN(p.x, -3, 3), z: clampN(p.z, -3, 3), r: turn(p.r) };
    if (f.wall && p.k === 'w' && (p.w === 'x' || p.w === 'z') && finite(p.u) && finite(p.y)) return { k: 'w', w: p.w, u: clampN(p.u, -3, 3), y: clampN(p.y, 0, 3) };
    if (f.on && p.k === 'o' && SURFACES[p.on] && finite(p.x) && finite(p.z)) return { k: 'o', on: p.on, x: clampN(p.x, -1.5, 1.5), z: clampN(p.z, -1.5, 1.5), r: turn(p.r) };
    return null;
  }
  const samePlacement = (a, b) => !!a && !!b && a.k === b.k && a.w === b.w && a.on === b.on &&
    Math.abs((a.x || 0) - (b.x || 0)) < 1e-6 && Math.abs((a.z || 0) - (b.z || 0)) < 1e-6 && Math.abs((a.u || 0) - (b.u || 0)) < 1e-6 && Math.abs((a.y || 0) - (b.y || 0)) < 1e-6 && (a.r || 0) === (b.r || 0);

  /* --- geometry: turned rectangles on the floor (local x axis = (cos,-sin), local z axis = (sin,cos), as in three.js) --- */
  function obb(x, z, hw, hd, r) { const a = turn(r) * TURN; return { x, z, hw, hd, c: Math.cos(a), s: Math.sin(a) }; }
  function obbBox(o) {
    const ex = Math.abs(o.hw * o.c) + Math.abs(o.hd * o.s), ez = Math.abs(o.hw * o.s) + Math.abs(o.hd * o.c);
    return { x0: o.x - ex, x1: o.x + ex, z0: o.z - ez, z1: o.z + ez };
  }
  /** True if two turned rectangles overlap by more than `tol` (touching is fine). */
  function obbOverlap(a, b, tol = TOL) {
    const dx = b.x - a.x, dz = b.z - a.z;
    for (const [nx, nz] of [[a.c, -a.s], [a.s, a.c], [b.c, -b.s], [b.s, b.c]]) {
      const ra = a.hw * Math.abs(a.c * nx - a.s * nz) + a.hd * Math.abs(a.s * nx + a.c * nz);
      const rb = b.hw * Math.abs(b.c * nx - b.s * nz) + b.hd * Math.abs(b.s * nx + b.c * nz);
      if (Math.abs(dx * nx + dz * nz) >= ra + rb - tol) return false;
    }
    return true;
  }
  const rectObb = fp => obb((fp[0] + fp[1]) / 2, (fp[2] + fp[3]) / 2, (fp[1] - fp[0]) / 2, (fp[3] - fp[2]) / 2, 0);
  const boxOverlap = (a, b, tol = TOL) => a.x1 - b.x0 > tol && b.x1 - a.x0 > tol && a.y1 - b.y0 > tol && b.y1 - a.y0 > tol && a.z1 - b.z0 > tol && b.z1 - a.z0 > tol;

  /** The floor footprint of a floor item. */
  function floorObb(f, p) { return obb(p.x, p.z, (f.fp[1] - f.fp[0]) / 2, (f.fp[3] - f.fp[2]) / 2, p.r); }
  /** The footprint of an `on` item in its host's coordinates. */
  function onObb(f, p) { return obb(p.x, p.z, f.s[0] / 2, f.s[1] / 2, p.r); }
  /** The box a wall item takes up in the room. */
  function wallBox(f, p) {
    const hw = (f.rect[1] - f.rect[0]) / 2, hh = (f.rect[3] - f.rect[2]) / 2, d = f.d || 0.03;
    const y0 = p.y - hh, y1 = p.y + hh;
    return p.w === 'z' ? { x0: p.u - hw, x1: p.u + hw, y0, y1, z0: -3, z1: -3 + d } : { x0: -3, x1: -3 + d, y0, y1, z0: p.u - hw, z1: p.u + hw };
  }
  /** Height of a floor item including whatever stands on top of it. */
  function heightWith(layout, id) {
    const f = BY_ID[id], s = SURFACES[id]; let h = f.h || 0;
    if (s) for (const k of Object.keys(layout)) { const p = layout[k]; if (p.k === 'o' && p.on === id) h = Math.max(h, s.y + BY_ID[k].h); }
    return h;
  }
  function floorBox(layout, id, p = layout[id]) { return Object.assign(obbBox(floorObb(BY_ID[id], p)), { y0: 0, y1: heightWith(layout, id) }); }
  /** Door and window, as boxes on their walls with a little margin for the frames. */
  const FIXED_BOXES = [
    wallBox({ rect: [FIXED.door.rect[0] - 0.05, FIXED.door.rect[1] + 0.05, -0.1, FIXED.door.rect[3] + 0.05], d: 0.06 }, { w: 'x', u: (FIXED.door.rect[0] + FIXED.door.rect[1]) / 2, y: (FIXED.door.rect[3] - 0.05) / 2 }),
    wallBox({ rect: [FIXED.window.rect[0] - 0.08, FIXED.window.rect[1] + 0.08, FIXED.window.rect[2] - 0.12, FIXED.window.rect[3] + 0.06], d: 0.06 }, { w: 'z', u: (FIXED.window.rect[0] + FIXED.window.rect[1]) / 2, y: (FIXED.window.rect[2] - 0.12 + FIXED.window.rect[3] + 0.06) / 2 }),
  ];
  const DOOR_CLEAR = rectObb(FIXED.doorClear.fp);

  /**
   * Can item `id` stand at placement `p`, given the other items in `layout`? Only items in `layout` count.
   * Floor things stay on the floor, inside the room, out of each other and of the doorway.
   * Wall things stay on a wall, clear of the door, the window and each other. Small things stand on a top
   * that has room for them. Nothing may poke into anything on the walls.
   */
  function canPlace(layout, id, p) {
    const f = BY_ID[id];
    if (!f || !p || f.moving) return false;
    const others = Object.keys(layout).filter(k => k !== id && BY_ID[k] && !BY_ID[k].moving);
    const lay = Object.assign({}, layout, { [id]: p });
    const wallOk = box => others.every(k => { const x = BY_ID[k]; return !x.wall || x.over || !boxOverlap(box, wallBox(x, layout[k])); });

    if (f.fp) {
      if (p.k !== 'f') return false;
      const o = floorObb(f, p), bb = obbBox(o);
      if (bb.x0 < FLOOR_LO || bb.z0 < FLOOR_LO || bb.x1 > FLOOR_HI || bb.z1 > FLOOR_HI) return false;
      if (f.flat) return others.every(k => !BY_ID[k].flat || !obbOverlap(o, floorObb(BY_ID[k], layout[k])));
      if (obbOverlap(o, DOOR_CLEAR)) return false;
      for (const k of others) { const x = BY_ID[k]; if (x.fp && !x.flat && obbOverlap(o, floorObb(x, layout[k]))) return false; }
      return wallOk(floorBox(lay, id));
    }
    if (f.wall) {
      if (p.k !== 'w' || (p.w !== 'x' && p.w !== 'z')) return false;
      const b = wallBox(f, p), u0 = p.w === 'z' ? b.x0 : b.z0, u1 = p.w === 'z' ? b.x1 : b.z1;
      if (u0 < WALL_LO || u1 > WALL_HI || b.y0 < WALL_BOTTOM || b.y1 > WALL_TOP) return false;
      if (FIXED_BOXES.some(x => boxOverlap(b, x))) return false;
      for (const k of others) {
        const x = BY_ID[k];
        if (x.wall && boxOverlap(b, wallBox(x, layout[k]))) return false;
        if (x.fp && !x.flat && boxOverlap(b, floorBox(layout, k))) return false;
      }
      return true;
    }
    if (f.on) {
      const s = p.k === 'o' && SURFACES[p.on];
      if (!s || !layout[p.on]) return false;
      const bb = obbBox(onObb(f, p)), [x0, x1, z0, z1] = s.rect;
      if (bb.x0 < x0 - TOL || bb.x1 > x1 + TOL || bb.z0 < z0 - TOL || bb.z1 > z1 + TOL) return false;
      for (const k of others) { const q = layout[k]; if (q.k === 'o' && q.on === p.on && obbOverlap(onObb(f, p), onObb(BY_ID[k], q))) return false; }
      // whatever it stands on gets taller, which must not poke into anything on the walls either
      return heightWith(lay, p.on) <= heightWith(layout, p.on) || wallOk(floorBox(lay, p.on));
    }
    return false;
  }

  /** Spots to try for item `id`, nearest to `pref` first. `reach` limits how far from `pref` (metres). */
  function* candidates(f, pref, layout, reach = 9) {
    if (f.fp) {
      const turns = [pref.r, pref.r + 2, pref.r + 6, pref.r + 4].map(turn);
      const pts = [];
      for (let x = -2.9; x <= 2.91; x += 0.1) for (let z = -2.9; z <= 2.91; z += 0.1) {
        const d = Math.hypot(x - pref.x, z - pref.z); if (d <= reach) pts.push([d, r3(x), r3(z)]);
      }
      pts.sort((a, b) => a[0] - b[0]);
      for (const [, x, z] of pts) for (const r of turns) yield { k: 'f', x, z, r };
    } else if (f.wall) {
      const pts = [];
      for (const w of ['z', 'x']) for (let u = -2.95; u <= 2.96; u += 0.05) for (let y = 0.2; y <= 2.8; y += 0.05) {
        const d = Math.hypot(u - pref.u, y - pref.y) + (w === pref.w ? 0 : 1.5); if (d <= reach) pts.push([d, w, r3(u), r3(y)]);
      }
      pts.sort((a, b) => a[0] - b[0]);
      for (const [, w, u, y] of pts) yield { k: 'w', w, u, y };
    } else if (f.on) {
      const hosts = [pref.on, ...Object.keys(SURFACES).filter(h => h !== pref.on && layout[h])];
      for (const on of hosts) {
        const [x0, x1, z0, z1] = SURFACES[on].rect, pts = [];
        for (let x = x0; x <= x1 + 1e-6; x += 0.05) for (let z = z0; z <= z1 + 1e-6; z += 0.05) {
          const d = on === pref.on ? Math.hypot(x - pref.x, z - pref.z) : 0; if (on !== pref.on || d <= reach) pts.push([d, r3(x), r3(z)]);
        }
        pts.sort((a, b) => a[0] - b[0]);
        for (const [, x, z] of pts) for (const r of [pref.r, pref.r + 2].map(turn)) yield { k: 'o', on, x, z, r };
      }
    }
  }
  /** The nearest free spot for `id` around `pref`, or null. */
  function findSpot(layout, id, pref, reach) {
    const f = BY_ID[id];
    if (canPlace(layout, id, pref)) return pref;
    for (const p of candidates(f, pref, layout, reach)) if (canPlace(layout, id, p)) return p;
    return null;
  }
  /** Turns item `id` by the next 45° that fits, nudging it a little if needed. Returns the new placement or null. */
  function turnItem(layout, id) {
    const f = BY_ID[id], p = layout[id];
    if (!f || f.wall || !p || f.moving || f.fixed) return null;
    for (let k = 1; k < 8; k++) {
      const q = Object.assign({}, p, { r: turn(p.r + k) });
      if (canPlace(layout, id, q)) return q;
      // nudge: same turn, nearby spot, same top
      for (const c of candidates(f, q, layout, 0.6)) if (c.r === q.r && (c.k !== 'o' || c.on === q.on) && canPlace(layout, id, c)) return c;
    }
    return null;
  }

  /** Saved layout, whatever came in. */
  function normRoom(r) {
    const out = { at: 0, items: {} };
    if (!r || typeof r !== 'object') return out;
    out.at = Math.max(0, Math.floor(Number(r.at) || 0));
    if (r.items && typeof r.items === 'object') for (const id of Object.keys(r.items)) {
      const p = normPlacement(BY_ID[id], r.items[id]);
      if (p) out.items[id] = p;
    }
    return out;
  }
  /** The layout of the room at `level`: every item present (except the cat) -> its placement. */
  function layoutFor(st, level) {
    const saved = (st.room && st.room.items) || {}, out = {};
    for (const f of furnitureFor(level)) if (!f.moving) out[f.id] = saved[f.id] || defaultPlacement(f);
    return out;
  }
  /**
   * Makes sure everything at `level` has a valid spot, and saves spots it had to choose.
   * Things the player moved keep their spot; a newcomer whose usual spot is taken goes to the nearest free one.
   * Returns true if `st.room` changed.
   */
  function settleLayout(st, level) {
    if (!st.room) st.room = normRoom(null);
    const saved = st.room.items, present = furnitureFor(level).filter(f => !f.moving), lay = {};
    let changed = false;
    for (const f of present) if (f.fixed) lay[f.id] = defaultPlacement(f);
    for (const kind of ['floor', 'wall', 'on']) {
      const group = present.filter(f => !f.fixed && kindOf(f) === kind);
      for (const pass of [true, false]) for (const f of group) {
        if (!!saved[f.id] !== pass) continue;
        const want = saved[f.id] || defaultPlacement(f);
        let p = canPlace(lay, f.id, want) ? want : findSpot(lay, f.id, want);
        if (!p) p = want; // the room is full: let it overlap rather than vanish
        if (!samePlacement(p, want)) { saved[f.id] = p; changed = true; }
        lay[f.id] = p;
      }
    }
    return changed;
  }

  /** Where the stars go: the usual spots first, skipping any that furniture now covers, then more spots up high. */
  function starSpots(level, layout) {
    const n = starCount(level); if (!n) return [];
    layout = layout || {};
    const extra = [];
    for (const y of [2.6, 2.2, 1.8]) for (const w of ['z', 'x']) for (let u = -2.75; u <= 2.76; u += 0.35) extra.push([w, r3(u), y]);
    const walls = Object.keys(layout).filter(k => BY_ID[k] && BY_ID[k].wall).map(k => wallBox(BY_ID[k], layout[k]));
    const floors = Object.keys(layout).filter(k => BY_ID[k] && BY_ID[k].fp && !BY_ID[k].flat).map(k => Object.assign(obbBox(floorObb(BY_ID[k], layout[k])), { y0: 0, y1: BY_ID[k].h }));
    const out = [];
    for (const sp of STAR_SPOTS.concat(extra)) {
      const [w, u, y] = sp, b = wallBox({ rect: [-0.09, 0.09, -0.09, 0.09], d: 0.02 }, { w, u, y });
      if (b.y1 > WALL_TOP + 0.05 || FIXED_BOXES.some(x => boxOverlap(b, x, 0)) || walls.some(x => boxOverlap(b, x, 0))) continue;
      // hidden behind something tall standing near the wall
      const behind = w === 'z' ? { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, z0: -3, z1: -2.4 } : { x0: -3, x1: -2.4, y0: b.y0, y1: b.y1, z0: b.z0, z1: b.z1 };
      if (floors.some(x => boxOverlap(behind, x, 0))) continue;
      if (out.some(o => o[0] === w && Math.hypot(o[1] - u, o[2] - y) < 0.3)) continue;
      out.push(sp); if (out.length >= n) break;
    }
    return out;
  }

  /* ---------- cat navigation ---------- */
  const CELL = 0.25, MARGIN = 0.2, ROOM = 3, GRID_N = Math.round((ROOM * 2) / CELL);
  const cellCenter = i => -ROOM + (i + 0.5) * CELL;
  const cellOf = v => Math.max(0, Math.min(GRID_N - 1, Math.floor((v + ROOM) / CELL)));
  /** Cells the cat may stand on, given what is in the room at this level and where it stands (default: usual spots). */
  function navGrid(level, layout) {
    const blocked = new Uint8Array(GRID_N * GRID_N);
    const boxes = furnitureFor(level).filter(f => f.fp && !f.flat).map(f => floorObb(f, (layout && layout[f.id]) || defaultPlacement(f)));
    const inside = (o, x, z) => { const dx = x - o.x, dz = z - o.z; return Math.abs(dx * o.c - dz * o.s) < o.hw + MARGIN && Math.abs(dx * o.s + dz * o.c) < o.hd + MARGIN; };
    for (let z = 0; z < GRID_N; z++) for (let x = 0; x < GRID_N; x++) {
      const cx = cellCenter(x), cz = cellCenter(z);
      const wallish = cx < -ROOM + 0.3 || cz < -ROOM + 0.3 || cx > ROOM - 0.3 || cz > ROOM - 0.3;
      if (wallish || boxes.some(o => inside(o, cx, cz))) blocked[z * GRID_N + x] = 1;
    }
    return { n: GRID_N, blocked };
  }
  const isFree = (g, x, z) => x >= 0 && z >= 0 && x < g.n && z < g.n && !g.blocked[z * g.n + x];
  /** Breadth-first path over free cells, as world coordinates. Diagonals only where both sides are free. */
  function findPath(g, from, to) {
    const n = g.n, start = cellOf(from[1]) * n + cellOf(from[0]), goal = cellOf(to[1]) * n + cellOf(to[0]);
    if (g.blocked[goal]) return null;
    const prev = new Int32Array(n * n).fill(-1); prev[start] = start;
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      const c = q[h]; if (c === goal) break;
      const x = c % n, z = (c - x) / n;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (!isFree(g, nx, nz)) continue;
        if (dx && dz && (!isFree(g, nx, z) || !isFree(g, x, nz))) continue;
        const k = nz * n + nx; if (prev[k] !== -1) continue;
        prev[k] = c; q.push(k);
      }
    }
    if (prev[goal] === -1) return null;
    const cells = []; for (let c = goal; ; c = prev[c]) { cells.push(c); if (c === start) break; }
    return cells.reverse().map(c => { const x = c % n; return [cellCenter(x), cellCenter((c - x) / n)]; });
  }
  function freeCells(g) { const out = []; for (let z = 0; z < g.n; z++) for (let x = 0; x < g.n; x++) if (isFree(g, x, z)) out.push([cellCenter(x), cellCenter(z)]); return out; }
  function nearestFree(g, p) {
    let best = null, d = Infinity;
    for (const c of freeCells(g)) { const v = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2; if (v < d) { d = v; best = c; } }
    return best;
  }

  return {
    STEPS, SESSION_PROMPTS, SESSION_EXTRAS, NEW_PER_SESSION, RETURN_AFTER, STORE_KEY,
    shuffle, autoMark, genWrong, genWrongForeign, buildCourse,
    emptyState, normState, levelOf, listState, wordState, listProgress, recordAnswer, makeStore, exportCode, importCode,
    createSession, nextItem, startPrompt, afterAnswer, distractors, exerciseFor, skeleton, normAnswer, gradeTyped, diffTarget,
    FURNITURE, FIXED, STAR_SPOTS, SURFACES, furnitureFor, nextFurniture, starCount, starSpots,
    kindOf, canMove, defaultPlacement, normPlacement, normRoom, layoutFor, settleLayout, canPlace, findSpot, turnItem, samePlacement, floorObb, onObb, wallBox,
    navGrid, findPath, freeCells, nearestFree, isFree, CELL, cellOf,
  };
});

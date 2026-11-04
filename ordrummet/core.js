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
  const emptyState = () => ({ v: 1, lists: {}, seenLevel: 0, muted: false, subject: null, savedAt: 0 });
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
   * `fp` is the floor footprint [x0,x1,z0,z1]; `flat` items can be walked on. `wall` items reserve wall space:
   * wall:'z' is the back wall (u = x), wall:'x' the left wall (u = z), rect = [u0,u1,y0,y1]. `on` items sit on another item.
   */
  const FURNITURE = [
    { id: 'bed',       name: 'Säng',           a: 'en säng',            fp: [-2.95, -1.75, -2.95, -0.85] },
    { id: 'desk',      name: 'Skrivbord',      a: 'ett skrivbord',      fp: [-0.4, 1.2, -2.95, -2.2] },
    { id: 'drawers',   name: 'Byrå',           a: 'en byrå',            fp: [-2.95, -2.4, -0.6, 0.5] },
    { id: 'lamp',      name: 'Golvlampa',      a: 'en golvlampa',       fp: [-1.65, -1.3, -2.95, -2.6] },
    { id: 'plant',     name: 'Krukväxt',       a: 'en krukväxt',        fp: [2.45, 2.95, -2.95, -2.45] },
    { id: 'cat',       name: 'Katt',           a: 'en katt',            moving: true },
    { id: 'rug',       name: 'Matta',          a: 'en matta',           fp: [-1.3, 1.2, -1, 1.2], flat: true },
    { id: 'bookshelf', name: 'Bokhylla',       a: 'en bokhylla',        fp: [1.5, 2.35, -2.95, -2.6] },
    { id: 'chair',     name: 'Stol',           a: 'en stol',            fp: [0.1, 0.7, -2.1, -1.5] },
    { id: 'poster',    name: 'Poster',         a: 'en poster',          wall: 'z', rect: [-2.75, -1.85, 1.35, 2.45] },
    { id: 'curtains',  name: 'Gardiner',       a: 'gardiner',           wall: 'z', rect: [-0.7, 1.45, 1.0, 2.5], over: 'window' },
    { id: 'clock',     name: 'Väggklocka',     a: 'en väggklocka',      wall: 'z', rect: [-1.35, -0.85, 1.85, 2.35] },
    { id: 'beanbag',   name: 'Sittsäck',       a: 'en sittsäck',        fp: [2.0, 2.85, 0.4, 1.25] },
    { id: 'guitar',    name: 'Gitarr',         a: 'en gitarr',          fp: [-2.95, -2.6, 0.6, 1.15] },
    { id: 'teddy',     name: 'Nalle',          a: 'en nalle',           on: 'bed' },
    { id: 'laptop',    name: 'Dator',          a: 'en dator',           on: 'desk' },
    { id: 'aquarium',  name: 'Akvarium',       a: 'ett akvarium',       on: 'drawers' },
    { id: 'shelf',     name: 'Vägghylla',      a: 'en vägghylla',       wall: 'x', rect: [-0.6, 0.5, 1.45, 2.0] },
    { id: 'globe',     name: 'Jordglob',       a: 'en jordglob',        on: 'desk' },
    { id: 'basket',    name: 'Papperskorg',    a: 'en papperskorg',     fp: [-1.15, -0.8, -2.95, -2.6] },
    { id: 'cattree',   name: 'Klösträd',       a: 'ett klösträd',       fp: [2.4, 2.95, -2.0, -1.45] },
    { id: 'football',  name: 'Fotboll',        a: 'en fotboll',         fp: [1.55, 1.85, 1.6, 1.9] },
    { id: 'lights',    name: 'Ljusslinga',     a: 'en ljusslinga',      wall: 'x', rect: [-2.9, 2.9, 2.55, 2.8] },
    { id: 'pennants',  name: 'Vimplar',        a: 'vimplar',            wall: 'z', rect: [-2.9, -1.0, 2.5, 2.8] },
    { id: 'corkboard', name: 'Anslagstavla',   a: 'en anslagstavla',    wall: 'x', rect: [0.55, 1.25, 1.25, 2.1] },
    { id: 'map',       name: 'Världskarta',    a: 'en världskarta',     wall: 'x', rect: [-2.65, -1.05, 1.2, 2.2] },
    { id: 'cushions',  name: 'Golvkuddar',     a: 'golvkuddar',         fp: [-2.9, -2.05, 2.45, 2.95] },
    { id: 'telescope', name: 'Teleskop',       a: 'ett teleskop',       fp: [-1.9, -1.35, 2.3, 2.85] },
    { id: 'record',    name: 'Skivspelare',    a: 'en skivspelare',     fp: [2.3, 2.9, -1.0, -0.4] },
    { id: 'trophy',    name: 'Pokal',          a: 'en pokal',           on: 'bookshelf' },
  ];
  /** Fixed parts of the empty room, kept here so the layout checks include them. */
  const FIXED = {
    door: { wall: 'x', rect: [1.35, 2.3, 0, 2.2] }, // the floor in front of it stays clear
    doorClear: { fp: [-3, -2.2, 1.3, 2.35] },
    window: { wall: 'z', rect: [-0.35, 1.15, 1.1, 2.3] },
  };
  /** After the 30th item, each new level lights one more star on the wall. These spots stay free. */
  const STAR_SPOTS = [
    ['z', -0.2, 2.65], ['z', 0.3, 2.72], ['z', 0.8, 2.62], ['z', 1.3, 2.72], ['z', 1.8, 2.6], ['z', 2.3, 2.72], ['z', 2.75, 2.6],
    ['z', 1.65, 2.34], ['z', 2.15, 2.4], ['z', 2.7, 2.25], ['z', 2.5, 1.85], ['z', 2.85, 1.55],
    ['x', -0.45, 2.3], ['x', 0.0, 2.42], ['x', 0.45, 2.28], ['x', 0.85, 2.38], ['x', 1.3, 2.42], ['x', 1.8, 2.36], ['x', 2.3, 2.44],
    ['x', 2.65, 2.2], ['x', 2.55, 1.7], ['x', 2.75, 1.25], ['x', -2.2, 2.42], ['x', -1.5, 2.36],
  ];
  const furnitureFor = level => FURNITURE.slice(0, Math.min(level, FURNITURE.length));
  const nextFurniture = level => FURNITURE[level] || null;
  const starCount = level => Math.min(STAR_SPOTS.length, Math.max(0, level - FURNITURE.length));

  /* ---------- cat navigation ---------- */
  const CELL = 0.25, MARGIN = 0.2, ROOM = 3, GRID_N = Math.round((ROOM * 2) / CELL);
  const cellCenter = i => -ROOM + (i + 0.5) * CELL;
  const cellOf = v => Math.max(0, Math.min(GRID_N - 1, Math.floor((v + ROOM) / CELL)));
  /** Cells the cat may stand on, given what is in the room at this level. */
  function navGrid(level) {
    const blocked = new Uint8Array(GRID_N * GRID_N);
    const rects = furnitureFor(level).filter(f => f.fp && !f.flat).map(f => f.fp);
    for (let z = 0; z < GRID_N; z++) for (let x = 0; x < GRID_N; x++) {
      const cx = cellCenter(x), cz = cellCenter(z);
      const wallish = cx < -ROOM + 0.3 || cz < -ROOM + 0.3 || cx > ROOM - 0.3 || cz > ROOM - 0.3;
      if (wallish || rects.some(r => cx > r[0] - MARGIN && cx < r[1] + MARGIN && cz > r[2] - MARGIN && cz < r[3] + MARGIN)) blocked[z * GRID_N + x] = 1;
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
    FURNITURE, FIXED, STAR_SPOTS, furnitureFor, nextFurniture, starCount,
    navGrid, findPath, freeCells, nearestFree, isFree, CELL, cellOf,
  };
});

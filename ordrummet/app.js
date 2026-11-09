/* Ordrummet: skärmarna. Reglerna finns i core.js, rummet i room.js, orden i data.js. */
const C = window.OrdrumCore;
const COURSE = C.buildCourse(window.ORDRUM_DATA);
const ALL_LISTS = COURSE.flatMap(s => s.lists);
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DEBUG = new URLSearchParams(location.search).has('debug');

const store = C.makeStore(() => window.localStorage);
let ST = store.load();
const save = replace => store.save(ST, replace);
try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch (e) {}

/* ---------- keep layout inside the visible area ---------- */
function syncViewport() {
  const vv = window.visualViewport;
  document.documentElement.style.setProperty('--vh', (vv ? vv.height : window.innerHeight) + 'px');
}
syncViewport();
window.addEventListener('resize', syncViewport);
if (window.visualViewport) window.visualViewport.addEventListener('resize', syncViewport);

/* ---------- speech ---------- */
const VOICES = {};
function findVoices() {
  try {
    const vs = speechSynthesis.getVoices();
    VOICES.sv = vs.find(v => /^sv[-_]SE/i.test(v.lang)) || vs.find(v => /^sv/i.test(v.lang)) || null;
    VOICES.de = vs.find(v => /^de[-_]DE/i.test(v.lang)) || vs.find(v => /^de/i.test(v.lang)) || null;
    VOICES.en = vs.find(v => /^en[-_]GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  } catch (e) {}
  document.querySelectorAll('[data-say]').forEach(b => { b.hidden = !VOICES[b.dataset.lang]; });
}
try { if ('speechSynthesis' in window) { findVoices(); speechSynthesis.onvoiceschanged = findVoices; } } catch (e) {}
function speak(text, lang) {
  const v = VOICES[lang]; if (!v) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(text).replace(/…/g, '')); u.voice = v; u.lang = v.lang; u.rate = .85; speechSynthesis.speak(u); } catch (e) {}
}
const autoSay = (text, lang) => { if (!ST.muted) setTimeout(() => speak(text, lang), 250); };
const SPEAK_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const speakBtn = (t, lang) => `<button class="speak" data-say="${esc(t)}" data-lang="${lang}" aria-label="Lyssna"${VOICES[lang] ? '' : ' hidden'}>${SPEAK_ICON}</button>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) speak(b.dataset.say, b.dataset.lang); });

/* ---------- the room ---------- */
let room = null, roomReady = false, shownLevel = 0;
/** Where everything stands at `level`. Newcomers whose usual spot is taken get a free one, which is saved. */
function layoutAt(level) {
  if (C.settleLayout(ST, level)) save();
  return C.layoutFor(ST, level);
}
function showRoom(level) { shownLevel = level; if (room) room.setLevel(level, layoutAt(level)); updateEditBtn(); }
function showFallback() {
  const f = $('#roomFallback'); f.hidden = false; drawFallback();
}
function drawFallback() {
  const f = $('#roomFallback'); if (f.hidden) return;
  const have = C.furnitureFor(C.levelOf(ST));
  f.innerHTML = '<p>Din webbläsare kan inte visa rummet i 3D, men allt du samlat finns kvar.</p>' +
    (have.length ? '<ul>' + have.map(x => `<li>${esc(x.name)}</li>`).join('') + '</ul>' : '<p>Rummet är tomt än så länge.</p>');
}
async function initRoom() {
  try {
    const mod = await import('./room.js');
    room = mod.createRoom($('#roomHost'));
  } catch (e) { room = null; }
  roomReady = true;
  if (!room) { showFallback(); maybeReveal(); return; }
  if (DEBUG) window.__room = room.debug;
  showRoom(Math.min(C.levelOf(ST), ST.seenLevel));
  room.setActive(!L);
  maybeReveal();
}

/* ---------- home ---------- */
const subjectById = id => COURSE.find(s => s.id === id);
function currentSubject() { return subjectById(ST.subject) || COURSE[0]; }
function levelLine() {
  const lv = C.levelOf(ST);
  if (lv === 0) return 'Nivå 0 · ett tomt rum';
  return `<b>Nivå ${lv}</b>`;
}
function renderHome() {
  const lv = C.levelOf(ST), next = C.nextFurniture(lv), s = currentSubject();
  $('#lvlLine').innerHTML = levelLine();
  const intro = lv === 0 && !Object.keys(ST.lists).length
    ? '<p class="intro">Välj en ordlista. Varje ord ska bli rätt tre gånger, och det blir svårare för varje gång. När hela listan sitter får du något nytt till ditt rum.</p>' : '';
  const nextLine = next ? `<p class="next">Nästa klara lista ger: <b>${esc(next.a)}</b></p>` : '<p class="next">Rummet är fullt av saker. Varje ny klar lista tänder en stjärna på väggen.</p>';
  const tabs = COURSE.map(x => `<button class="tab" role="tab" aria-selected="${x.id === s.id}" data-sub="${x.id}">${esc(x.name)}<small>${esc(x.blurb)}</small></button>`).join('');
  const lists = s.lists.map(l => {
    const p = C.listProgress(ST, l), pct = Math.round(p.steps / p.stepsTotal * 100);
    const meta = p.done ? (p.fresh ? `Klar · ${p.fresh} ${p.fresh === 1 ? 'nytt' : 'nya'}` : 'Klar') : p.started ? `${p.mastered} av ${p.total} ord` : `${p.total} ord`;
    return `<li><button class="listbtn${p.done ? ' done' : ''}" data-list="${esc(l.uid)}"><span class="listmain"><span class="listname">${esc(l.name)}</span><div class="listsub">${esc(l.sub)}</div>${p.done || !p.started ? '' : `<div class="bar"><i style="width:${pct}%"></i></div>`}</span><span class="listmeta">${meta}</span></button></li>`;
  }).join('');
  const warn = store.persistent() ? '' : '<p class="note">Den här webbläsaren tillåter inte sparning, så det du gör försvinner när sidan stängs. Prova utan privat läge.</p>';
  $('#panel').innerHTML = `<div class="panelinner">${nextLine}${intro}<div class="tabs" role="tablist">${tabs}</div><ul class="lists">${lists}</ul>${warn}</div>`;
  drawFallback();
}
$('#panel').addEventListener('click', e => {
  const t = e.target.closest('[data-sub]');
  if (t) { ST.subject = t.dataset.sub; save(); renderHome(); $('#panel').scrollTop = 0; return; }
  const b = e.target.closest('[data-list]');
  if (b) { const l = ALL_LISTS.find(x => x.uid === b.dataset.list); if (l) startLesson(l); }
});
$('#settingsBtn').addEventListener('click', openSettings);

/* ---------- reveal after finishing a list ---------- */
let revealing = false;
async function maybeReveal() {
  if (revealing || L || !roomReady || EDIT) return;
  const lv = C.levelOf(ST);
  if (lv <= ST.seenLevel) return;
  revealing = true; updateEditBtn();
  const nl = ST.seenLevel + 1, meta = C.FURNITURE[nl - 1], card = $('#revealCard');
  card.innerHTML = `<div><h2>Nivå ${nl}</h2><p>${meta ? 'Nu har du ' + esc(meta.a) + ' i rummet.' : 'En ny stjärna på väggen.'}</p></div><button class="btn" id="revealOk">Fint</button>`;
  card.hidden = false;
  const dismissed = new Promise(res => { $('#revealOk').onclick = res; });
  ST.seenLevel = nl; save();
  shownLevel = nl;
  if (room) await room.reveal(nl, layoutAt(nl)); else drawFallback();
  await dismissed;
  card.hidden = true; revealing = false; updateEditBtn();
  maybeReveal();
}

/* ---------- moving furniture ---------- */
let EDIT = null;
const MOVE_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/></svg>';
function updateEditBtn() {
  const b = $('#editBtn');
  b.hidden = !room || !roomReady || revealing || !!EDIT || !!L || shownLevel < 1;
  $('#settingsBtn').hidden = !!EDIT;
}
const NOT_MOVABLE = { cat: 'Katten går dit den vill.', curtains: 'Gardinerna sitter vid fönstret.' };
function whereText(id) {
  const f = C.FURNITURE.find(x => x.id === id), k = C.kindOf(f);
  if (k === 'floor') return f.flat ? 'Ligger på golvet. Dra den dit du vill, eller vrid den.' : 'Står på golvet. Dra den dit du vill, eller vrid den.';
  if (k === 'wall') return 'Sitter på väggen. Dra den längs väggarna.';
  const tops = Object.keys(C.SURFACES).filter(h => C.furnitureFor(shownLevel).some(x => x.id === h)).map(h => C.FURNITURE.find(x => x.id === h).name.toLowerCase());
  const list = tops.length > 1 ? tops.slice(0, -1).join(', ') + ' eller ' + tops[tops.length - 1] : tops[0];
  return `Står ovanpå något. Dra den till ${list}, eller vrid den.`;
}
function openEdit() {
  if (!room || revealing || L) return;
  EDIT = { sel: null, msg: '' };
  $('#home').classList.add('editing');
  room.setEditing(true, {
    onSelect: id => { EDIT.sel = id; EDIT.msg = ''; renderEditPanel(); },
    onChange: (id, p) => { if (!ST.room) ST.room = { at: 0, items: {} }; ST.room.items[id] = p; ST.room.at = Date.now(); save(); },
    onInfo: id => { if (NOT_MOVABLE[id]) { EDIT.msg = NOT_MOVABLE[id]; renderEditPanel(); } },
  });
  updateEditBtn();
  renderEditPanel();
}
function closeEdit() {
  if (!EDIT) return;
  room.setEditing(false);
  EDIT = null;
  $('#home').classList.remove('editing');
  updateEditBtn();
  renderHome();
  maybeReveal();
}
function renderEditPanel() {
  if (!EDIT) return;
  const id = EDIT.sel, f = id && C.FURNITURE.find(x => x.id === id), canTurn = f && C.kindOf(f) !== 'wall';
  const selHTML = f
    ? `<div class="editsel"><div class="editname"><b>${esc(f.name)}</b><span>${esc(whereText(id))}</span></div>${canTurn ? '<button class="btn quiet" id="turnB">Vrid</button>' : ''}</div>`
    : '<p class="edithelp">Tryck på en sak och dra den dit du vill. Saker på golvet stannar på golvet, tavlor och hyllor sitter på väggarna och små saker står på bord, byrå, säng eller bokhylla. Dra på en tom yta för att titta runt.</p>';
  $('#panel').innerHTML = `<div class="panelinner editpanel">
    <div class="edithead"><h2>Möblera</h2><button class="btn" id="editDone">Klar</button></div>
    ${selHTML}
    <p class="editmsg" id="editMsg" role="status">${esc(EDIT.msg || '')}</p>
    <div id="editResetArea"><button class="textbtn" id="editReset">Ställ tillbaka allt</button></div>
  </div>`;
  $('#editDone').onclick = closeEdit;
  if ($('#turnB')) $('#turnB').onclick = () => { if (!room.turnSelected()) { EDIT.msg = 'Den får inte plats om den vrids här. Flytta den lite först.'; $('#editMsg').textContent = EDIT.msg; } else $('#editMsg').textContent = ''; };
  $('#editReset').onclick = () => {
    $('#editResetArea').innerHTML = `<p class="editmsg">Allt flyttas tillbaka dit det stod från början.</p><div class="sheetbtns"><button class="btn danger" id="resetLayoutYes">Ja, ställ tillbaka</button><button class="btn quiet" id="resetLayoutNo">Nej</button></div>`;
    $('#resetLayoutNo').onclick = renderEditPanel;
    $('#resetLayoutYes').onclick = () => {
      ST.room = { at: Date.now(), items: {} }; save();
      room.select(null); EDIT.sel = null; EDIT.msg = '';
      showRoom(shownLevel); renderEditPanel();
    };
  };
}
$('#editBtn').innerHTML = MOVE_ICON;
$('#editBtn').addEventListener('click', openEdit);
document.addEventListener('keydown', e => {
  if (!EDIT || !$('#sheet').hidden || e.target.closest('input,textarea')) return;
  const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
  if (dir && room.selected()) { e.preventDefault(); room.nudge(dir); return; }
  if ((e.key === 'r' || e.key === 'R') && room.selected() && $('#turnB')) { e.preventDefault(); $('#turnB').click(); return; }
  if (e.key === 'Escape') { e.preventDefault(); if (room.selected()) room.select(null); else closeEdit(); }
});

/* ---------- lesson ---------- */
let L = null;
const COARSE = matchMedia('(pointer: coarse)').matches;
const SPECIAL = { sv: ['å', 'ä', 'ö'], de: ['ä', 'ö', 'ü', 'ß'], en: [] };

function subjectOf(list) { return subjectById(list.subject); }
function allItemsOf(list) { return subjectOf(list).lists.flatMap(l => l.items); }
const STEP_WORD = ['Känn igen ordet', 'Skriv med ledtråd', 'Skriv utan hjälp', 'Repetition'];

function startLesson(list) {
  L = { list, ses: C.createSession(ST, list), item: null, ex: null, answered: false, startedDone: C.listProgress(ST, list).done, onCheck: null, typed: null };
  $('#home').hidden = true;
  $('#lesson').hidden = false;
  if (room) room.setActive(false);
  updateEditBtn();
  next();
}
function endLesson() {
  L = null;
  $('#lesson').hidden = true; $('#lesson').innerHTML = '';
  $('#home').hidden = false;
  renderHome();
  if (room) room.setActive(true);
  updateEditBtn();
  maybeReveal();
}

function frame(bodyHTML, footHTML, opts = {}) {
  const ses = L.ses, list = L.list, sub = subjectOf(list);
  const shown = Math.min(ses.asked + (L.answered ? 0 : 1), ses.limit);
  $('#lesson').innerHTML = `
    <div class="ltop">
      <button class="closebtn" id="closeL" aria-label="Sluta öva"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <div class="lwhere">${esc(sub.name)} · ${esc(list.name)}</div>
      ${opts.noCount ? '' : `<div class="lcount">${shown} av ${ses.limit}</div>`}
    </div>
    <div class="lbar"><i style="width:${Math.round(ses.asked / ses.limit * 100)}%"></i></div>
    <div class="lbody" id="lbody"><div class="lcenter">${bodyHTML}</div></div>
    <div class="lfoot" id="lfoot">${footHTML}</div>
    <div id="kbSlot"></div>`;
  $('#closeL').onclick = endLesson;
  updateFootPad();
}
function updateFootPad() {
  const f = $('#lfoot'), kb = $('#kbSlot'), on = !!(kb && kb.children.length);
  if (f) f.classList.toggle('padsafe', !on);
  $('#lesson').classList.toggle('haskb', on);
}

function stepsHTML(step) {
  const s = Math.min(step, C.STEPS);
  return `<div class="steps" aria-label="${s} av ${C.STEPS} rätt">${[0, 1, 2].map(i => `<i class="${i < s ? 'on' : ''}"></i>`).join('')}<span>${esc(STEP_WORD[s])}</span></div>`;
}

function next() {
  if (!L) return;
  const it = C.nextItem(ST, L.ses);
  if (!it) return showSummary();
  L.item = it; L.answered = false; L.typed = null; L.onEnter = null;
  const step = C.wordState(ST, L.list, it).s;
  L.step = step;
  L.ex = C.exerciseFor(it, step);
  if (C.startPrompt(ST, L.ses, it)) showIntro(it); else showExercise();
}

function showIntro(it) {
  if (it.kind === 'spell') {
    const m = esc(it.mark).replace(/\[([^\]]+)\]/g, '<mark>$1</mark>');
    frame(`<div class="q">Nytt ord</div>
      <div class="card"><div class="row"><div class="word" style="flex:1" lang="sv">${m}</div>${speakBtn(it.f, 'sv')}</div></div>
      ${it.sentence ? `<div class="sentence">${esc(it.sentence).replace('___', '<b>' + esc(it.f) + '</b>')}</div>` : ''}
      ${it.tip ? `<p class="tip">${esc(it.tip)}</p>` : ''}`,
      `<div class="footin"><button class="btn" id="goB">Jag har läst</button></div>`);
    autoSay(it.f, 'sv');
  } else {
    frame(`<div class="q">${it.phrase ? 'Ny fras' : 'Nytt ord'}</div>
      <div class="card"><div class="row"><div class="word" style="flex:1" lang="${it.lang}">${esc(it.f)}</div>${speakBtn(it.f, it.lang)}</div><div class="meaning">${esc(it.sv)}</div></div>`,
      `<div class="footin"><button class="btn" id="goB">Jag har läst</button></div>`);
    autoSay(it.f, it.lang);
  }
  $('#goB').onclick = showExercise;
  L.onEnter = null;
  $('#goB').focus({ preventScroll: true });
}

function showExercise() {
  const { ex } = L;
  ({ spellpick: exSpellPick, choose: exChoose, art: exArt, lspell: exLSpell, order: exOrder, type: exType })[ex.t](L.item, ex);
}

/* ----- options ----- */
function optionsScreen(head, opts, correctId, onDone) {
  const body = `${stepsHTML(L.step)}${head}
    <div class="choices" id="opts">${opts.map(o => `<button class="choice" data-id="${esc(o.id)}"${o.lang ? ` lang="${o.lang}"` : ''}>${esc(o.label)}</button>`).join('')}</div>`;
  frame(body, '<div class="footin"><div class="hintline">Tryck på ditt svar.</div></div>');
  $('#opts').onclick = e => {
    const b = e.target.closest('.choice'); if (!b || L.answered) return;
    const ok = b.dataset.id === correctId;
    document.querySelectorAll('#opts .choice').forEach(x => { x.disabled = true; if (x.dataset.id === correctId) x.classList.add('right'); });
    if (!ok) b.classList.add('miss');
    finish(ok, onDone ? onDone(ok) : {});
  };
}
function exSpellPick(it) {
  const opts = C.shuffle([it.f, ...C.shuffle(it.wrong).slice(0, 3)]).map(v => ({ id: v, label: v, lang: 'sv' }));
  const head = `<div class="q">Vilken stavning är rätt?</div><div class="row">${it.sentence ? `<div class="sentence" style="flex:1">${blanked(it.sentence)}</div>` : '<div style="flex:1"></div>'}${speakBtn(it.f, 'sv')}</div>`;
  optionsScreen(head, opts, it.f);
  autoSay(it.f, 'sv');
}
function exChoose(it, ex) {
  const sub = subjectOf(L.list), f2s = ex.dir === 'f2s';
  const wrong = C.distractors(it, ex.dir, 3, L.list, allItemsOf(L.list));
  const opts = C.shuffle([it, ...wrong]).map(x => ({ id: x.key, label: f2s ? x.sv : x.f, lang: f2s ? null : it.lang }));
  const head = f2s
    ? `<div class="q">Vad betyder det?</div><div class="row"><div class="prompt" style="flex:1" lang="${it.lang}">${esc(it.f)}</div>${speakBtn(it.f, it.lang)}</div>`
    : `<div class="q">Hur säger man det på ${esc(sub.langName)}?</div><div class="prompt">${esc(it.sv)}</div>`;
  optionsScreen(head, opts, it.key);
  if (f2s) autoSay(it.f, it.lang);
}
function exLSpell(it) {
  const show = v => it.art ? it.art + ' ' + v : v;
  const opts = C.shuffle([it.core, ...C.shuffle(it.wrongF).slice(0, 3)]).map(v => ({ id: v, label: show(v), lang: it.lang }));
  const sub = subjectOf(L.list);
  optionsScreen(`<div class="q">Vilken stavning är rätt?</div><div class="prompt small">${esc(it.sv)} <span class="hintline">på ${esc(sub.langName)}</span></div>`, opts, it.core);
}
function exArt(it) {
  const body = `${stepsHTML(L.step)}<div class="q">der, die eller das?</div><div class="prompt small">${esc(it.sv)}</div><div class="prompt" lang="de">… ${esc(it.core)}</div>
    <div class="artrow" id="opts">${['der', 'die', 'das'].map(a => `<button class="choice" data-id="${a}" lang="de">${a}</button>`).join('')}</div>`;
  frame(body, '<div class="footin"><div class="hintline">Tryck på ditt svar.</div></div>');
  $('#opts').onclick = e => {
    const b = e.target.closest('.choice'); if (!b || L.answered) return;
    const ok = b.dataset.id === it.art;
    document.querySelectorAll('#opts .choice').forEach(x => { x.disabled = true; if (x.dataset.id === it.art) x.classList.add('right'); });
    if (!ok) b.classList.add('miss');
    finish(ok, {});
  };
}
const blanked = s => esc(s).replace('___', '<span class="blank"></span>');

/* ----- word order for longer phrases ----- */
function exOrder(it) {
  const sub = subjectOf(L.list);
  const low = new Set(it.toks.map(t => t.toLowerCase()));
  const others = C.shuffle(allItemsOf(L.list).filter(x => x !== it).flatMap(x => x.toks)).filter(t => !low.has(t.toLowerCase()));
  const chips = C.shuffle(it.toks.concat([...new Set(others)].slice(0, 2))).map((w, id) => ({ w, id, used: false }));
  const placed = [];
  frame(`${stepsHTML(L.step)}<div class="q">Lägg orden i rätt ordning på ${esc(sub.langName)}</div><div class="prompt small">${esc(it.sv)}</div>
    <div class="wline" id="wline" lang="${it.lang}"></div><div class="wpool" id="wpool" lang="${it.lang}"></div>`,
    `<div class="footin"><button class="textbtn" id="dunnoB">Vet inte</button><button class="btn" id="checkB" disabled>Kontrollera</button></div>`);
  const draw = () => {
    $('#wline').innerHTML = placed.map((id, k) => `<button class="wchip" data-k="${k}">${esc(chips[id].w)}</button>`).join('');
    $('#wpool').innerHTML = chips.map(c => `<button class="wchip${c.used ? ' used' : ''}" data-id="${c.id}">${esc(c.w)}</button>`).join('');
    $('#checkB').disabled = !placed.length;
  };
  draw();
  $('#wpool').onclick = e => { const b = e.target.closest('[data-id]'); if (!b || L.answered) return; const c = chips[+b.dataset.id]; if (c.used) return; c.used = true; placed.push(c.id); draw(); };
  $('#wline').onclick = e => { const b = e.target.closest('[data-k]'); if (!b || L.answered) return; const id = placed.splice(+b.dataset.k, 1)[0]; chips[id].used = false; draw(); };
  $('#checkB').onclick = () => {
    const got = placed.map(id => chips[id].w);
    finish(got.join(' ') === it.toks.join(' '), { showAnswer: true, yours: got.join(' ') });
  };
  $('#dunnoB').onclick = () => finish(false, { showAnswer: true });
  L.onEnter = () => { if (!$('#checkB').disabled) $('#checkB').click(); };
}

/* ----- free typing with the whole keyboard ----- */
function exType(it, ex) {
  const sub = subjectOf(L.list), lang = it.lang;
  let head;
  if (it.kind === 'spell') {
    head = `<div class="q">${ex.hint ? 'Skriv hela ordet' : 'Skriv ordet'}</div><div class="row"><div class="sentence" style="flex:1">${it.sentence ? blanked(it.sentence) : 'Lyssna och skriv ordet.'}</div>${speakBtn(it.f, 'sv')}</div>`;
    autoSay(it.f, 'sv');
  } else {
    const extra = it.art ? '<div class="hintline">Med der, die eller das.</div>' : '';
    head = `<div class="q">Skriv på ${esc(sub.langName)}</div><div class="prompt">${esc(it.sv)}</div>${extra}`;
  }
  const skel = ex.hint ? `<div class="skel" aria-label="Ledtråd" lang="${lang}">${[...ex.hint].map(c => c === '_' ? '<b>_</b>' : esc(c)).join('')}</div>` : '';
  const chars = !COARSE && SPECIAL[lang].length ? `<div class="chars" id="chars">${SPECIAL[lang].map(c => `<button type="button" data-c="${c}" tabindex="-1">${c}</button>`).join('')}</div>` : '';
  const mode = COARSE ? 'none' : 'text';
  frame(`${stepsHTML(L.step)}${head}${skel}<div id="fbSlot"></div>
    <input class="field" id="answer" type="text" lang="${lang}" inputmode="${mode}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Ditt svar" data-gramm="false">${chars}`,
    `<div class="footin"><button class="textbtn" id="dunnoB">Vet inte</button><button class="btn" id="checkB" disabled>Kontrollera</button></div>`);
  const input = $('#answer');
  const sync = () => { $('#checkB').disabled = !input.value.trim(); };
  input.addEventListener('input', sync);
  const insert = c => {
    const a = input.selectionStart == null ? input.value.length : input.selectionStart, b = input.selectionEnd == null ? a : input.selectionEnd;
    input.setRangeText(c, a, b, 'end'); sync();
  };
  const del = () => {
    let a = input.selectionStart == null ? input.value.length : input.selectionStart, b = input.selectionEnd == null ? a : input.selectionEnd;
    if (a === b && a > 0) a -= 1;
    if (a !== b) input.setRangeText('', a, b, 'end');
    sync();
  };
  if ($('#chars')) {
    $('#chars').addEventListener('pointerdown', e => e.preventDefault());
    $('#chars').addEventListener('click', e => { const c = e.target.closest('[data-c]'); if (c) { insert(c.dataset.c); input.focus(); } });
  }
  if (COARSE) mountKeyboard(lang, insert, del);
  L.typed = { input, tries: 0 };
  $('#checkB').onclick = () => checkTyped(it);
  $('#dunnoB').onclick = () => finish(false, { showAnswer: true, yours: input.value });
  L.onEnter = () => { if (!$('#checkB').disabled) checkTyped(it); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (L && !L.answered && L.onEnter) L.onEnter(); } });
  input.focus({ preventScroll: true });
  input.scrollIntoView({ block: 'nearest' });
}
function checkTyped(it) {
  const input = L.typed.input, r = C.gradeTyped(it, input.value);
  if (r.result === 'empty') return;
  if (r.result === 'almost') {
    L.typed.tries++;
    const msg = r.why === 'art' ? 'Glöm inte der, die eller das.' : 'Titta på stora och små bokstäver.';
    $('#fbSlot').innerHTML = `<div class="fb almost"><h3>Nästan!</h3><p>${msg} Det räknas inte som fel, ändra och försök igen.</p></div>`;
    input.focus({ preventScroll: true });
    $('#lbody').scrollTop = $('#lbody').scrollHeight;
    return;
  }
  finish(r.result === 'ok', { showAnswer: true, yours: input.value, why: r.why });
}

/* ----- on-screen keyboard (touch screens only) ----- */
function mountKeyboard(lang, insert, del) {
  const rows = {
    sv: ['qwertyuiopå', 'asdfghjklöä', 'zxcvbnm'],
    de: ['qwertyuiopü', 'asdfghjklöä', 'zxcvbnmß'],
    en: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  }[lang];
  const numRows = ['1234567890', "-'?!.,:;", ''];
  let shift = false, nums = false;
  const slot = $('#kbSlot');
  const draw = () => {
    const src = nums ? numRows : rows;
    const key = c => { const out = shift && c !== 'ß' ? c.toLocaleUpperCase(lang) : c; return `<button type="button" class="key" data-k="${esc(out)}" aria-label="${esc(out)}">${esc(out)}</button>`; };
    const r1 = [...src[0]].map(key).join(''), r2 = [...src[1]].map(key).join(''), r3 = [...src[2]].map(key).join('');
    slot.innerHTML = `<div class="kb" id="kb" role="group" aria-label="Tangentbord">
      <div class="kbrow">${r1}</div>
      <div class="kbrow">${r2}</div>
      <div class="kbrow">${nums ? '' : `<button type="button" class="key fn${shift ? ' on' : ''}" data-fn="shift" aria-label="Stor bokstav" aria-pressed="${shift}">⇧</button>`}${r3}<button type="button" class="key fn" data-fn="del" aria-label="Sudda">⌫</button></div>
      <div class="kbrow"><button type="button" class="key fn" data-fn="nums" aria-label="${nums ? 'Bokstäver' : 'Siffror och tecken'}">${nums ? 'abc' : '123'}</button><button type="button" class="key narrow" data-k="'" aria-label="apostrof">'</button><button type="button" class="key space" data-k=" " aria-label="Mellanslag">mellanslag</button><button type="button" class="key narrow" data-k="-" aria-label="bindestreck">-</button><button type="button" class="key narrow" data-k="." aria-label="punkt">.</button></div>
    </div>`;
    updateFootPad();
  };
  const press = t => {
    if (!t || !L || L.answered) return;
    if (t.dataset.k !== undefined) { insert(t.dataset.k); if (shift) { shift = false; draw(); } return; }
    if (t.dataset.fn === 'del') del();
    else if (t.dataset.fn === 'shift') { shift = !shift; draw(); }
    else if (t.dataset.fn === 'nums') { nums = !nums; shift = false; draw(); }
  };
  draw();
  let handledByPointer = false;
  slot.addEventListener('pointerdown', e => {
    const t = e.target.closest('.key'); if (!t) return;
    e.preventDefault(); handledByPointer = true; press(t);
  });
  slot.addEventListener('click', e => { // keyboards and screen readers trigger click without a pointer
    if (handledByPointer) { handledByPointer = false; return; }
    press(e.target.closest('.key'));
  });
}

/* ----- result ----- */
function finish(ok, opt) {
  if (!L || L.answered) return;
  L.answered = true;
  const it = L.item;
  const res = C.afterAnswer(ST, L.ses, it, ok);
  save();
  if (L.typed) { L.typed.input.readOnly = true; L.typed.input.classList.add('locked'); L.typed.input.blur(); if ($('#chars')) $('#chars').hidden = true; if ($('#fbSlot')) $('#fbSlot').innerHTML = ''; }
  const slot = $('#kbSlot'); if (slot) { const fresh = slot.cloneNode(false); slot.replaceWith(fresh); }
  let fb;
  const answerTxt = it.f.replace(/\s*…\s*/g, ' …');
  if (ok) {
    const left = C.STEPS - res.now;
    const text = res.mastered ? 'Det här ordet sitter nu.' : left === 1 ? 'En gång till, så sitter det.' : `${left} gånger till, så sitter det.`;
    fb = `<div class="fb ok"><h3>Rätt.</h3><p>${L.startedDone && res.was >= C.STEPS ? 'Det sitter fortfarande.' : text}</p></div>`;
    if (it.kind !== 'spell' && !opt.showAnswer) fb = `<div class="fb ok"><h3>Rätt.</h3><p lang="${it.lang}"><b>${esc(it.f)}</b> = ${esc(it.sv)}. ${L.startedDone && res.was >= C.STEPS ? '' : text}</p></div>`;
  } else {
    const typed = opt.yours && String(opt.yours).trim();
    let ans = esc(answerTxt);
    if (typed) ans = C.diffTarget(typed, answerTxt).map(d => d.ok ? esc(d.c) : `<em>${esc(d.c)}</em>`).join('');
    const artNote = opt.why === 'wrongart' ? '<p>Rätt ord, men fel der/die/das.</p>' : '';
    const tip = it.kind === 'spell' && it.tip ? `<p>${esc(it.tip)}</p>` : '';
    const mean = it.kind !== 'spell' ? ` <span style="font-weight:400;font-size:15px">= ${esc(it.sv)}</span>` : '';
    fb = `<div class="fb no"><h3>Inte riktigt. Ordet kommer tillbaka snart.</h3>
      <p class="ans" lang="${it.lang}">${ans}${mean}</p>${typed ? `<p class="yours">Du skrev: ${esc(typed)}</p>` : ''}${artNote}${tip}</div>`;
  }
  if (!ST.muted && !ok) autoSay(it.f, it.lang);
  const listDoneNow = res.completed;
  $('#lfoot').innerHTML = `${fb}<div class="footin"><button class="btn" id="nextB">${listDoneNow ? 'Klart! Till rummet' : 'Nästa'}</button></div>`;
  updateFootPad();
  const stepEl = document.querySelector('.steps');
  if (stepEl) stepEl.outerHTML = stepsHTML(res.now);
  const go = () => { if (res.completed) endLesson(); else next(); };
  $('#nextB').onclick = go;
  L.onEnter = go;
  $('#nextB').focus({ preventScroll: true });
}
document.addEventListener('keydown', e => { if (e.key === 'Enter' && L && L.answered && L.onEnter && document.activeElement && document.activeElement.id !== 'nextB') { e.preventDefault(); L.onEnter(); } });

function showSummary() {
  const list = L.list, p = C.listProgress(ST, list), ses = L.ses;
  const pct = Math.round(p.steps / p.stepsTotal * 100);
  const line = p.done
    ? 'Listan var redan klar, och nu är orden färska igen.'
    : `Listan är klar till ${pct} %.${p.mastered ? ` ${p.mastered} av ${p.total} ord sitter.` : ''} Allt är sparat, så du kan fortsätta när du vill.`;
  frame(`<div class="sum"><h2>${ses.ok} av ${ses.asked} rätt</h2><p>${line}</p>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="btns"><button class="btn" id="moreB">Öva vidare</button><button class="btn quiet" id="backB">Till rummet</button></div></div>`, '', { noCount: true });
  updateFootPad();
  $('#moreB').onclick = () => startLesson(list);
  $('#backB').onclick = endLesson;
}

/* ---------- settings ---------- */
function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; }
function openSettings() {
  const lv = C.levelOf(ST);
  const saveNote = store.persistent()
    ? 'Allt sparas bara i den här webbläsaren. Vi använder inga kakor och skickar inget någonstans. Lägg gärna spelet på hemskärmen, så rensar inte telefonen det lika lätt.'
    : 'Den här webbläsaren tillåter inte sparning just nu, så framstegen försvinner när sidan stängs. Du kan fortfarande spara en kod och läsa in den senare.';
  $('#sheet').innerHTML = `<div class="sheetbox" role="dialog" aria-modal="true" aria-labelledby="stTitle">
    <div class="sheethead"><h2 id="stTitle">Inställningar</h2><button class="textbtn" id="stClose">Stäng</button></div>
    <div class="sheetsec"><button class="toggle" id="muteT" role="switch" aria-checked="${!ST.muted}"><span>Läs upp orden automatiskt</span><i></i></button></div>
    <div class="sheetsec"><h3>Spara och flytta</h3><p>${saveNote}</p>
      <div id="codeArea"></div>
      <div class="sheetbtns"><button class="btn quiet" id="copyB">Visa sparkod</button><button class="btn quiet" id="loadB">Läs in sparkod</button></div></div>
    <div class="sheetsec"><h3>Börja om</h3><p>Tömmer rummet och nollställer alla ordlistor. Du är på nivå ${lv}.</p><div id="resetArea"><button class="btn quiet" id="resetB">Börja om från början</button></div></div>
  </div>`;
  $('#sheet').hidden = false;
  $('#stClose').onclick = closeSheet;
  $('#muteT').onclick = () => { ST.muted = !ST.muted; save(); $('#muteT').setAttribute('aria-checked', String(!ST.muted)); };
  $('#copyB').onclick = async () => {
    const code = C.exportCode(ST);
    $('#codeArea').innerHTML = `<textarea class="code" id="codeOut" readonly aria-label="Din sparkod">${esc(code)}</textarea><p class="oktxt" id="copied"></p>`;
    const area = $('#codeOut'); area.focus(); area.select();
    try { await navigator.clipboard.writeText(code); $('#copied').textContent = 'Koden är kopierad. Klistra in den på den andra enheten.'; }
    catch (e) { $('#copied').textContent = 'Markera och kopiera koden, och klistra in den på den andra enheten.'; }
  };
  $('#loadB').onclick = () => {
    $('#codeArea').innerHTML = `<textarea class="code" id="codeIn" aria-label="Klistra in sparkod" placeholder="Klistra in koden här"></textarea><p class="errtxt" id="codeErr" hidden></p><div class="sheetbtns" style="margin-bottom:8px"><button class="btn" id="codeGo">Läs in, ersätter det som finns här</button></div>`;
    $('#codeIn').focus();
    $('#codeGo').onclick = () => {
      let st;
      try { st = C.importCode($('#codeIn').value); } catch (e) { const er = $('#codeErr'); er.hidden = false; er.textContent = 'Koden går inte att läsa. Kontrollera att hela koden kom med.'; return; }
      ST = st; ST.seenLevel = C.levelOf(ST); save(true);
      showRoom(C.levelOf(ST));
      $('#revealCard').hidden = true; revealing = false;
      closeSheet(); renderHome();
    };
  };
  $('#resetB').onclick = () => {
    $('#resetArea').innerHTML = `<p style="color:var(--warn)">Säker? Det går inte att ångra.</p><div class="sheetbtns"><button class="btn danger" id="resetYes">Ja, börja om</button><button class="btn quiet" id="resetNo">Nej, behåll allt</button></div>`;
    $('#resetNo').onclick = openSettings;
    $('#resetYes').onclick = () => {
      store.clear(); ST = C.emptyState(); save(true);
      showRoom(0);
      $('#revealCard').hidden = true; revealing = false;
      closeSheet(); renderHome();
    };
  };
}
$('#sheet').addEventListener('click', e => { if (e.target === $('#sheet')) closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

/* ---------- another tab changed the save ---------- */
window.addEventListener('storage', e => {
  if (e.key !== C.STORE_KEY || L) return;
  ST = store.load();
  if (!EDIT) renderHome();
  showRoom(Math.min(C.levelOf(ST), ST.seenLevel));
  maybeReveal();
});

/* ---------- go ---------- */
renderHome();
initRoom();
if (DEBUG) window.__app = { state: () => ST, lesson: () => L, C, list: uid => ALL_LISTS.find(l => l.uid === uid), core: C };

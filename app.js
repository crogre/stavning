import { judge } from "./match.js";
import { diffChars, renderDiffRow } from "./diff.js";
import { speak, ttsReady, hasSwedishVoice } from "./tts.js";

const STR = {
  start: "Starta",
  answer: "Svara",
  skip: "Hoppa över",
  retry: "Försök igen",
  correct: "Rätt!",
  correctSynonym: (p) => `Bra! Det rätta ordet är "${p}", men din variant fungerar också.`,
  nearCase: "Nästan! Kolla stora och små bokstäver.",
  nearPunct: "Nästan! Kolla skiljetecknet.",
  nearMixed: "Nästan! Kolla skiljetecken och bokstäver.",
  wrong: "Inte riktigt — försök igen.",
  questionOf: (n, total) => `Fråga ${n} / ${total}`,
  score: (n) => `Rätt: ${n}`,
  streak: (n) => `${n} i rad`,
  endScore: (n, total) => `${n} av ${total} rätt!`,
  endStreak: (n) => `Längsta streak: ${n}`,
  endMissed: "Ord att öva på:",
  youWrote: "Du skrev:",
  expectedLabel: "Rätt:",
  loadFailed: (err) => `Kunde inte ladda ord: ${err}`,
  noVoice: "Ingen svensk röst hittades på den här enheten — appen behöver en sv-SE-röst för att fungera.",
  pickAtLeastOne: "Välj minst en kategori.",
  countWords: (n) => `${n} ord valda`,
};

const RUN_SIZE = 20;
const ADVANCE_DELAY_OK = 800;
const ADVANCE_DELAY_SYNONYM = 1500;

const state = {
  data: null,
  selectedCategories: new Set(),
  run: null,
  current: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  attemptedThisItem: false,
  pendingAdvance: null,
  missed: [],
};

const $ = (sel) => document.querySelector(sel);

async function loadWords() {
  const res = await fetch(`words.json?v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function filterWordsByCategories() {
  const words = state.data?.words || [];
  if (state.selectedCategories.size === 0) return [];
  return words.filter(
    (w) =>
      Array.isArray(w.categories) &&
      w.categories.some((c) => state.selectedCategories.has(c))
  );
}

function pickEntries() {
  const pool = filterWordsByCategories();
  shuffle(pool);
  return pool.slice(0, Math.min(RUN_SIZE, pool.length));
}

function buildRunItem(entry) {
  const sources = entry.sv || [];
  const prompt = sources[0] || "";
  return { entry, prompt, fromLang: "sv", toLang: "sv" };
}

function showView(name) {
  for (const v of document.querySelectorAll(".view")) {
    v.hidden = v.id !== `view-${name}`;
  }
}

function renderCategoryChips() {
  const cats = state.data?.categories || [];
  const wrap = $("#category-chips");
  wrap.innerHTML = "";
  for (const c of cats) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.dataset.key = c.key;
    btn.textContent = c.label;
    if (state.selectedCategories.has(c.key)) btn.classList.add("selected");
    btn.addEventListener("click", () => {
      if (state.selectedCategories.has(c.key)) state.selectedCategories.delete(c.key);
      else state.selectedCategories.add(c.key);
      btn.classList.toggle("selected");
      updateSetupSummary();
    });
    wrap.appendChild(btn);
  }
}

function updateSetupSummary() {
  const summary = $("#category-summary");
  const matchingCount = filterWordsByCategories().length;
  if (state.selectedCategories.size === 0) {
    summary.textContent = STR.pickAtLeastOne;
  } else {
    summary.textContent = STR.countWords(matchingCount);
  }
  $("#start").disabled = matchingCount === 0;
}

function selectAllCategories() {
  const cats = state.data?.categories || [];
  state.selectedCategories = new Set(cats.map((c) => c.key));
  renderCategoryChips();
  updateSetupSummary();
}

function clearAllCategories() {
  state.selectedCategories.clear();
  renderCategoryChips();
  updateSetupSummary();
}

function renderSetup() {
  renderCategoryChips();
  updateSetupSummary();
  $("#setup-msg").textContent = hasSwedishVoice() ? "" : STR.noVoice;
  showView("setup");
}

function startRun() {
  const items = pickEntries().map(buildRunItem);
  if (items.length === 0) return;
  state.run = items;
  state.current = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.missed = [];
  showView("quiz");
  showQuestion();
}

function showQuestion() {
  const item = state.run[state.current];
  const inp = $("#input");
  inp.value = "";
  inp.lang = "sv";
  inp.placeholder = "";
  $("#feedback").className = "feedback";
  $("#feedback").innerHTML = "";
  $("#answer").textContent = STR.answer;
  state.attemptedThisItem = false;
  if (state.pendingAdvance) {
    clearTimeout(state.pendingAdvance);
    state.pendingAdvance = null;
  }
  updateStatus();
  // Speak first, then focus the input. The small delay lets iOS Safari
  // settle from the previous gesture and avoids audio being killed when
  // the on-screen keyboard pops up.
  setTimeout(() => speak(item.prompt), 80);
  setTimeout(() => inp.focus(), 220);
}

function updateStatus() {
  $("#question-of").textContent = STR.questionOf(state.current + 1, state.run.length);
  $("#score").textContent = STR.score(state.score);
  $("#streak").textContent = state.streak >= 2 ? STR.streak(state.streak) : "";
}

function scheduleAdvance(delay) {
  if (state.pendingAdvance) clearTimeout(state.pendingAdvance);
  state.pendingAdvance = setTimeout(() => {
    state.pendingAdvance = null;
    advance();
  }, delay);
}

function advance() {
  state.current += 1;
  if (state.current >= state.run.length) showEnd();
  else showQuestion();
}

function recordMissed(item, lastAttempt) {
  state.missed.push({
    prompt: item.prompt,
    lastAttempt: lastAttempt && lastAttempt.trim() ? lastAttempt : null,
    expected: (item.entry.sv && item.entry.sv[0]) || "",
  });
}

function renderDiff(raw, expected) {
  const segs = diffChars(raw, expected);
  const wrap = document.createElement("div");
  wrap.className = "diff";
  for (const [side, label] of [["input", STR.youWrote], ["expected", STR.expectedLabel]]) {
    const line = document.createElement("div");
    line.className = "diff-line";
    const lab = document.createElement("span");
    lab.className = "diff-label";
    lab.textContent = label;
    line.appendChild(lab);
    line.appendChild(renderDiffRow(segs, side));
    wrap.appendChild(line);
  }
  return wrap;
}

function onAnswer() {
  const item = state.run[state.current];
  const raw = $("#input").value;
  const result = judge(raw, item.entry, item.toLang);
  if (result.kind === "empty") return;

  const fb = $("#feedback");
  fb.innerHTML = "";

  if (result.kind === "correct" || result.kind === "correct_synonym") {
    fb.className = "feedback correct";
    fb.textContent =
      result.kind === "correct" ? STR.correct : STR.correctSynonym(result.expected);
    if (!state.attemptedThisItem) {
      state.score += 1;
      state.streak += 1;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    }
    updateStatus();
    scheduleAdvance(
      result.kind === "correct" ? ADVANCE_DELAY_OK : ADVANCE_DELAY_SYNONYM
    );
    return;
  }

  if (!state.attemptedThisItem) {
    state.attemptedThisItem = true;
    state.streak = 0;
  }
  recordMissed(item, raw);

  const headline = document.createElement("div");
  headline.className = "feedback-headline";
  if (result.kind === "near_miss") {
    fb.className = "feedback near";
    headline.textContent =
      result.flavor === "case"
        ? STR.nearCase
        : result.flavor === "punct"
        ? STR.nearPunct
        : STR.nearMixed;
  } else {
    fb.className = "feedback wrong";
    headline.textContent = STR.wrong;
  }
  fb.appendChild(headline);
  fb.appendChild(renderDiff(raw, result.expected));

  $("#answer").textContent = STR.retry;
  const inp = $("#input");
  inp.value = "";
  inp.blur();
  updateStatus();
}

function onSkip() {
  const item = state.run[state.current];
  if (!state.attemptedThisItem) {
    state.attemptedThisItem = true;
    state.streak = 0;
    recordMissed(item, $("#input").value);
  }
  if (state.pendingAdvance) {
    clearTimeout(state.pendingAdvance);
    state.pendingAdvance = null;
  }
  advance();
}

function showEnd() {
  $("#end-headline").textContent = STR.endScore(state.score, state.run.length);
  $("#end-streak").textContent =
    state.bestStreak >= 2 ? STR.endStreak(state.bestStreak) : "";

  const heading = $("#end-missed-heading");
  const ul = $("#end-missed-list");
  ul.innerHTML = "";

  const seen = new Set();
  const unique = state.missed.filter((m) => {
    if (seen.has(m.prompt)) return false;
    seen.add(m.prompt);
    return true;
  });

  if (unique.length === 0) {
    heading.hidden = true;
  } else {
    heading.hidden = false;
    heading.textContent = STR.endMissed;
    for (const m of unique) {
      const li = document.createElement("li");
      const replay = document.createElement("button");
      replay.type = "button";
      replay.className = "missed-play";
      replay.setAttribute("aria-label", `Spela upp ${m.expected}`);
      replay.textContent = "▶";
      replay.addEventListener("click", () => speak(m.expected));
      const e = document.createElement("span");
      e.className = "missed-expected";
      e.textContent = m.expected;
      li.appendChild(replay);
      li.appendChild(e);
      if (m.lastAttempt) {
        const a = document.createElement("div");
        a.className = "missed-attempt";
        a.textContent = `Du skrev: ${m.lastAttempt}`;
        li.appendChild(a);
      }
      ul.appendChild(li);
    }
  }
  showView("end");
}

function bindEvents() {
  $("#start").addEventListener("click", startRun);
  $("#answer").addEventListener("click", onAnswer);
  $("#skip").addEventListener("click", onSkip);
  $("#speak").addEventListener("click", () => {
    if (state.run && state.run[state.current]) {
      speak(state.run[state.current].prompt);
    }
  });
  $("#input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAnswer();
    }
  });
  $("#play-again").addEventListener("click", () => {
    state.run = null;
    renderSetup();
  });
  $("#select-all").addEventListener("click", selectAllCategories);
  $("#clear-all").addEventListener("click", clearAllCategories);
}

(async () => {
  bindEvents();
  try {
    state.data = await loadWords();
  } catch (e) {
    showView("setup");
    $("#setup-msg").textContent = STR.loadFailed(e.message || e);
    return;
  }
  await ttsReady();
  renderSetup();
})();

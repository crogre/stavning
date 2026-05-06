// Normalization + judging for student answers.

const SMART_QUOTES = /[‘’‚‛“”„‟]/g;
const QUOTE_MAP = {
  "‘": "'", "’": "'", "‚": "'", "‛": "'",
  "“": '"', "”": '"', "„": '"', "‟": '"',
};
const DASHES = /[–—−]/g;
const PUNCT = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g;

export function normalize(s, level = "strict") {
  let out = String(s).normalize("NFC").trim();
  if (level === "strict") return out;

  out = out.replace(SMART_QUOTES, c => QUOTE_MAP[c]);
  out = out.replace(DASHES, "-");
  out = out.replace(/ /g, " ");
  out = out.replace(/\s+/g, " ");
  out = out.toLowerCase();
  out = out.replace(/[.!?]+$/, "");
  if (level === "lenient") return out;

  out = out.replace(PUNCT, "");
  return out.trim();
}

function arrayMatches(arr, value, level) {
  const v = normalize(value, level);
  return arr.some(item => normalize(item, level) === v);
}

function classifyDiff(input, expected) {
  const a = String(input).normalize("NFC").trim();
  const b = String(expected).normalize("NFC").trim();
  if (a === b) return "exact";
  if (a.toLowerCase() === b.toLowerCase()) return "case";
  const stripped = s => s.replace(PUNCT, "").replace(/\s+/g, " ").trim();
  if (stripped(a) === stripped(b)) return "punct";
  if (stripped(a).toLowerCase() === stripped(b).toLowerCase()) return "mixed";
  return "mixed";
}

function editDistance(a, b) {
  const aa = Array.from(String(a).normalize("NFC"));
  const bb = Array.from(String(b).normalize("NFC"));
  const m = aa.length;
  const n = bb.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function closestPrimary(input, primary) {
  if (primary.length === 0) return "";
  if (primary.length === 1) return primary[0];
  return primary
    .map(p => ({ p, d: editDistance(input, p) }))
    .sort((x, y) => x.d - y.d)[0].p;
}

function targetsFor(entry, targetLang) {
  return {
    primary: entry[targetLang] || [],
    accept: entry[`accept_${targetLang}`] || [],
  };
}

export function judge(rawInput, entry, targetLang) {
  if (!rawInput || !rawInput.trim()) return { kind: "empty" };
  const { primary, accept } = targetsFor(entry, targetLang);

  // 1. Strict match against any primary form → fully correct.
  if (arrayMatches(primary, rawInput, "strict")) {
    return { kind: "correct", expected: primary[0] };
  }

  // 2. Match against an accepted synonym (strict or lenient) → correct, mention primary.
  if (arrayMatches(accept, rawInput, "strict") || arrayMatches(accept, rawInput, "lenient")) {
    return { kind: "correct_synonym", expected: primary[0] };
  }

  // 3. Lenient or loose match against a primary → near miss.
  if (arrayMatches(primary, rawInput, "lenient") || arrayMatches(primary, rawInput, "loose")) {
    const expected = closestPrimary(rawInput, primary);
    const flavor = classifyDiff(rawInput, expected);
    return { kind: "near_miss", expected, flavor };
  }

  // 4. Wrong — return the closest primary so the diff is informative.
  const expected = closestPrimary(rawInput, primary);
  return { kind: "wrong", expected };
}

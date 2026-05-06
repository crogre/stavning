// Character-level LCS diff. Operates on graphemes via Array.from()
// after NFC normalization so combined letters like "å" stay one unit.

export function diffChars(input, expected) {
  const a = Array.from(String(input).normalize("NFC"));
  const b = Array.from(String(expected).normalize("NFC"));
  const m = a.length;
  const n = b.length;

  const lcs = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) lcs[i][j] = lcs[i - 1][j - 1] + 1;
      else lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
    }
  }

  const ops = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ tag: "match", char: a[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      ops.push({ tag: "missing", char: b[j - 1] });
      j--;
    } else {
      ops.push({ tag: "extra", char: a[i - 1] });
      i--;
    }
  }
  ops.reverse();

  const segments = [];
  for (const op of ops) {
    const last = segments[segments.length - 1];
    if (last && last.tag === op.tag) last.text += op.char;
    else segments.push({ tag: op.tag, text: op.char });
  }
  return segments;
}

export function renderDiffRow(segments, side) {
  const row = document.createElement("span");
  row.className = "diff-row";
  for (const seg of segments) {
    if (side === "input" && seg.tag === "missing") continue;
    if (side === "expected" && seg.tag === "extra") continue;
    const el = document.createElement("span");
    el.className = `diff-${seg.tag}`;
    el.textContent = seg.text;
    row.appendChild(el);
  }
  return row;
}

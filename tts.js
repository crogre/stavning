// Thin wrapper around the Web Speech API, picking the best available
// Swedish voice and exposing speak() / hasSwedishVoice() / ttsReady().

let cachedVoice = null;

function pickSwedishVoice() {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices();
  const preferredNames = [
    "Alva (Premium)", "Alva (Enhanced)", "Alva", "Klara",
    "Microsoft Bengt", "Microsoft Hedvig", "Google svenska",
  ];
  for (const name of preferredNames) {
    const v = voices.find((x) => x.name === name);
    if (v) return v;
  }
  return (
    voices.find((v) => v.lang === "sv-SE") ||
    voices.find((v) => v.lang && v.lang.startsWith("sv")) ||
    null
  );
}

export function ttsReady() {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === "undefined") return resolve();
    if (speechSynthesis.getVoices().length) return resolve();
    const onChange = () => {
      speechSynthesis.removeEventListener("voiceschanged", onChange);
      resolve();
    };
    speechSynthesis.addEventListener("voiceschanged", onChange);
    setTimeout(resolve, 1500);
  });
}

export function hasSwedishVoice() {
  return !!pickSwedishVoice();
}

export function speak(text, { rate = 0.9 } = {}) {
  if (typeof speechSynthesis === "undefined" || !text) return;
  speechSynthesis.cancel();
  if (!cachedVoice) cachedVoice = pickSwedishVoice();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "sv-SE";
  if (cachedVoice) u.voice = cachedVoice;
  u.rate = rate;
  u.pitch = 1;
  speechSynthesis.speak(u);
}

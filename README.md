# Stavning

Liten webbsida för att öva svensk stavning. Lyssna på ordet och skriv det rätt — själva ordet visas aldrig.

Spinoff av [`english-words`](https://github.com/crogre/english-words). 20 ord per omgång. Felaktiga svar visas med en färgad diff mot det rätta ordet.

## Hur det fungerar

- **Välj kategorier:** kryssa i en eller flera kategorier på startsidan (t.ex. *Sje-ljudet*, *Tysta bokstäver*, *Lånord*).
- **Lyssna och skriv:** appen läser upp ordet på svenska via webbläsarens `SpeechSynthesis`. Tryck "Spela upp" om du vill höra det igen. Ordet visas aldrig som text.
- **Få feedback:** rätt eller fel; vid fel ser du en diff mellan det du skrev och rätt stavning.

## Krav

Webbläsaren måste ha en svensk röst (`sv-SE`) installerad. Det finns på alla moderna iOS- och macOS-enheter (Alva). På Windows finns Microsoft Bengt/Hedvig. Linux-Chromium kan sakna svensk röst — då varnar appen.

## Lägg till ord

Redigera [`words.json`](./words.json) — gärna direkt i GitHubs webbgränssnitt.

```json
{
  "sv": ["ord"],
  "categories": ["sje", "lanord"]
}
```

- `sv` är en lista. Det första elementet är "rätt svaret"; ytterligare element accepteras också som strikt rätt.
- `categories` refererar till `key`-värdena i topp-listan `categories`. Ett ord kan tillhöra flera kategorier.
- Lägg till en ny kategori genom att lägga in ett objekt i topp-listan `categories`: `{ "key": "egennamn", "label": "Egennamn" }`.
- (Frivilligt) `accept_sv: ["alternativ"]` — alternativa stavningar som accepteras med en uppmuntrande kommentar.

## Köra lokalt

```sh
python3 -m http.server 8000
```

Öppna sedan http://localhost:8000/. (`file://` fungerar inte — `fetch` behöver HTTP.)

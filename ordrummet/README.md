# Ordrummet

Glosor och stavning för 6B, utan poängjakt: du börjar i ett tomt rum och varje klar ordlista ger en ny sak till rummet.

Spelet ligger på <https://crogre.github.io/stavning/ordrummet/>. Det är statiska filer utan byggsteg.

## Reglerna

- **En nivå är en klar ordlista.** Spelaren väljer själv lista och ämne. Nivå 0 är ett tomt rum.
- **Varje ord ska bli rätt tre gånger**, och blir svårare för varje gång:
  1. Känna igen ordet bland flera alternativ.
  2. Skriva det med en del bokstäver givna (längre fraser: lägga orden i rätt ordning).
  3. Skriva det helt fritt på hela tangentbordet.
- **Fel svar sänker ordet ett steg**, och ordet kommer tillbaka några frågor senare.
- **Ett pass är cirka 10 frågor** (som mest 13 när missade ord kommer tillbaka). Allt sparas efter varje svar, så man kan sluta när som helst.
- Små missar ger "Nästan!" utan avdrag: glömt der/die/das eller fel stor/liten bokstav. Skiljetecken och "…" spelar ingen roll, men å, ä, ö, ü och ß måste stämma.

## Lägga in en ny vecka

Lägg till ett block överst i rätt ämne i `data.js`; instruktionen står längst upp i filen. Ändra aldrig `id` på en lista som redan finns, eftersom sparade framsteg hänger på ämne + id + ordet.

## Filerna

| Fil | Innehåll |
| --- | --- |
| `data.js` | Ordlistorna |
| `core.js` | Reglerna: nivåer, pass, rättning, sparning, möbelplanen och kattens vägar |
| `app.js` | Skärmarna och tangentbordet |
| `room.js` | 3D-rummet och möblerna |
| `vendor/` | three.js 0.170.0, hämtas inte från något CDN |

Allt sparas i webbläsarens `localStorage` (nyckel `ordrummet1`). Spelet sätter inga kakor. Med sparkoden i inställningarna kan man flytta framstegen till en annan enhet.

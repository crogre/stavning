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

## Möblera

Knappen med pilarna uppe i rummet startar möblering. Tryck på en sak och dra den dit du vill:

- **Saker på golvet** (säng, skrivbord, sittsäck …) stannar på golvet och kan vridas ett åttondels varv i taget med *Vrid*.
- **Saker på väggen** (poster, karta, klocka, vägghylla …) glider längs bakväggen och vänsterväggen och kan flyttas mellan dem.
- **Små saker** (nalle, dator, akvarium, jordglob, pokal) står ovanpå säng, skrivbord, byrå eller bokhylla och följer med när den flyttas.

En sak följer bara med till platser där den får plats: inte genom andra möbler, inte ut ur rummet, inte framför dörren och inte över fönstret. Katten och gardinerna går inte att flytta. Kommer en ny sak till en plats som redan är upptagen, hamnar den på närmaste lediga ställe. *Ställ tillbaka allt* flyttar allt till där det stod från början. Med tangentbord: piltangenterna flyttar, R vrider, Esc släpper.

## Lägga in en ny vecka

Lägg till ett block överst i rätt ämne i `data.js`; instruktionen står längst upp i filen. Ändra aldrig `id` på en lista som redan finns, eftersom sparade framsteg hänger på ämne + id + ordet.

## Filerna

| Fil | Innehåll |
| --- | --- |
| `data.js` | Ordlistorna |
| `core.js` | Reglerna: nivåer, pass, rättning, sparning, möbelplanen, var saker får stå och kattens vägar |
| `app.js` | Skärmarna och tangentbordet |
| `room.js` | 3D-rummet och möblerna |
| `vendor/` | three.js 0.170.0, hämtas inte från något CDN |

Allt sparas i webbläsarens `localStorage` (nyckel `ordrummet1`). Spelet sätter inga kakor. Med sparkoden i inställningarna kan man flytta framstegen till en annan enhet.

Sparningen har version 2: den lägger till `room`, med platsen för de saker man har flyttat. En sparning eller sparkod från version 1 läses in som den är, med allt på sin vanliga plats, så inga nivåer eller ord försvinner. Sparkoder börjar fortfarande med `OR1-`.

# Deployment zu CrazyGames

Dieser Guide bringt dich vom GitHub-Repo zur Live-Veröffentlichung auf
[CrazyGames](https://crazygames.com).

## Voraussetzungen

- Ein **CrazyGames Developer Account** (kostenlos): https://developer.crazygames.com/
- Repository in finalem Zustand (alle 9 Schritte abgeschlossen)
- Ca. 30 Minuten Zeit für Upload + Asset-Vorbereitung

---

## Schritt 1: Repository als ZIP packen

CrazyGames akzeptiert **statische HTML5-Pakete als ZIP**. Wichtig: `index.html`
muss im **Root des ZIP** liegen, nicht in einem Unterordner.

### Variante A: GitHub Web-UI (langsamer aber einfacher)

1. Im GitHub-Repo auf **Code** → **Download ZIP** klicken
2. Das geladene ZIP enthält einen Ordner `spaghetti-io-main/` mit ALLEN Dateien
   (inklusive `.github/`, `.kiro/`, `.gitignore`, `DEPLOYMENT.md`, `README.md`)
3. **Entpacke das ZIP**
4. Erstelle einen neuen Ordner, kopier nur diese zwei Dinge rein:
   - `index.html`
   - `src/` (komplett mit allen Unterordnern)
5. Packe diesen neuen Ordner-Inhalt zu einem ZIP (NICHT den Ordner selbst,
   sondern seinen Inhalt — `index.html` muss im ZIP-Root liegen)

### Variante B: lokales Terminal (sauberer, schneller)

```bash
git clone https://github.com/nexusbetde/spaghetti-io.git
cd spaghetti-io

# Nur die Runtime-Dateien zippen — KEINE Git-/CI-/Doku-Sachen
zip -r spaghetti-io.zip index.html src/
```

Das ergibt ein winziges ZIP von **~25 KB** das genau die Dateien enthält
die CrazyGames braucht. Nichts überflüssiges.

### Was definitiv NICHT ins ZIP gehört

| Pfad | Warum es ausgeschlossen werden muss |
|---|---|
| `.git/` | Git-Datenbank, oft mehrere MB |
| `.github/` | GitHub Actions Workflow (für GitHub Pages, nicht für CG) |
| `.kiro/` | Interne Doku |
| `.gitignore` | Egal aber Müll |
| `DEPLOYMENT.md`, `README.md` | Diese Doku-Files braucht das Spiel nicht |

Falls du Variante A nutzt: einfach `index.html` + `src/` Ordner separat
markieren und zippen, alles andere ignorieren.

---

## Schritt 2: Assets vorbereiten

CrazyGames braucht Cover-Bilder. Du kannst sie aus dem laufenden Spiel
screenshotten oder selbst basteln.

### Thumbnail (PFLICHT)

- **Größe:** 512 × 384 px (4:3)
- **Format:** PNG oder JPG
- **Inhalt:** Das ikonischste Moment des Spiels
- **Empfehlung:** Screenshot mit
  - aktiver Rampage (rote Aura sichtbar)
  - mehreren Bots in der Nähe
  - Score oben rechts gut lesbar
  - Spielname als großer Text-Overlay (z.B. "SPAGHETTI.IO")

### Cover Image / Banner (EMPFOHLEN)

- **Größe:** 1280 × 720 px (16:9)
- Wird in Featured-Listings benutzt — etwas "artistischer" als das Thumbnail

### Screenshots (mind. 1, ideal 3-5)

- **Größe:** 1280 × 720 px
- Verschiedene Spielmomente:
  1. Schlange beim Wachsen mit Bots im Hintergrund
  2. Rampage-Mode aktiv (rote Aura + Vignette)
  3. Sprint-Mode mit grüner Aura
  4. Game-Over-Screen mit hohem Score
  5. Mini-Map mit voller Welt sichtbar

**Tipp:** Drücke F12 → DevTools → Device Toolbar (Strg+Shift+M) →
1280×720 setzen → Strg+Shift+P → "Capture screenshot" für saubere Shots.

---

## Schritt 3: Auf CrazyGames hochladen

1. Geh auf https://developer.crazygames.com/
2. **Log in** oder erstelle einen Account
3. Klick **"Upload new game"**
4. Fülle das Formular aus:

   | Feld | Empfehlung |
   |---|---|
   | **Title** | Spaghetti.io |
   | **Short description** (max ~150 Zeichen) | Eat meatballs, dodge other pasta, and unleash chili-pepper rampage to dominate the leaderboard! |
   | **Long description** | Siehe Vorlage unten |
   | **Tags** | io, snake, food, multiplayer, arcade, casual |
   | **Category** | .io Games |
   | **Genre** | Action |
   | **Controls** | Mouse + Keyboard / Touch |
   | **Languages** | English, German |
   | **Age rating** | All ages |
   | **Has Ads (via SDK)** | Ja (Rewarded für Revive) |

### Vorlage Long Description

```
Spaghetti.io is a snake-style .io battle royale set on a giant Italian
dinner table. Slither across the world, devour meatballs, golden cheese
balls, and rare truffles to grow longer and score points.

🌶️ Find a Chili Pepper for 3 seconds of RAMPAGE: invincibility,
   double speed and one-shot kills.
🫑 Grab a green Pepperoncini for a 5-second SPRINT boost.
🏆 Outscore 8 AI-controlled pasta rivals to top the live leaderboard.
💀 Hit a wall, your own body, or another snake and you're toast.

Built with Phaser 3 — instant-load HTML5, no installation needed.
Works on desktop (mouse + keyboard) and mobile (touch + boost button).

Tips:
- Use boost to outrun bigger snakes
- Wait for bots to crash into your body — free kills + +50 score!
- Rampage Mode doubles all points during its 3 seconds
- Watch the mini-map for nearby chili peppers
```

5. **Upload die ZIP-Datei** (Schritt 1)
6. **Upload Thumbnail + Screenshots** (Schritt 2)
7. Klicke **Submit for review**

---

## Schritt 4: Warten auf Review

- CrazyGames Reviewer testen dein Spiel manuell, in der Regel **1–2 Wochen**
- Sie schreiben dir Feedback wenn etwas geändert werden muss
- Sobald approved → das Spiel geht live unter `crazygames.com/game/spaghetti-io`

### Häufige Review-Stolperfallen (alle bei uns schon korrekt)

- ✅ Game lädt in < 5 Sekunden
- ✅ Funktioniert auf Mobile (Touch + Boost-Button)
- ✅ Kein Escape-Key Hijack (wir nutzen ihn nicht)
- ✅ Keine externen Links die CrazyGames verlassen
- ✅ Englisch als Default-Sprache (Auto-Detect für DE)
- ✅ CrazyGames SDK eingebunden + lifecycle calls
- ✅ Rewarded Ad sauber integriert (Revive)

---

## Schritt 5: Nach dem Launch

### Analytics

Im Developer-Portal siehst du:
- Tägliche Spielerzahlen
- Durchschnittliche Session-Dauer
- Ad-Impressions / Revenue
- Geo-Verteilung

### Updates pushen

Für jedes Update:
1. Repo aktualisieren
2. Neues ZIP erstellen
3. Im Developer-Portal "Update game" → ZIP hochladen
4. Updates gehen meist ohne erneuten Full-Review live (kleinere Reviews)

### Tipps für virale Sichtbarkeit

- **Regelmäßige Updates** (alle 2-4 Wochen ein neues Feature/Skin)
- **TikTok / YouTube Shorts** mit "OMG-Momenten" (Rampage-Kills,
  Highscore-Runs)
- **Reddit r/iogames** — kündig Updates dort an
- **Community-Feedback ernst nehmen** und Patches schnell pushen

---

## Lokales Testen mit SDK-Simulation

Die CrazyGames SDK funktioniert lokal in einem "Test-Modus" wenn du
die URL mit `?CrazyGames=1` aufrufst. Ads erscheinen als graue Platzhalter.

```
http://localhost:8000/?CrazyGames=1
```

Auf GitHub Pages funktioniert die SDK ebenfalls — Ads sind dann
allerdings deaktiviert, weil die Domain nicht crazygames.com ist.

---

## Roadmap nach dem Launch

Wenn das Spiel live ist und Spieler hat, mögliche Erweiterungen:

- **Skins** (verschiedene Pasta-Sorten auswählbar)
- **Achievements** ("Erster Kill", "5-Combo-Rampage" etc.)
- **Daily Challenge** (jeden Tag ein anderes Ziel)
- **Real Multiplayer** (statt Bots gegen echte Spieler — Server nötig)
- **Banner Ads** zwischen Sessions (CrazyGames SDK unterstützt das)

Viel Erfolg beim Launch! 🍝🚀

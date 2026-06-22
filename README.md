# Spaghetti.io

Ein .io-Style Browser-Game fuer Crazy Games. Du steuerst eine Pasta, frisst Fleischbaellchen, wirst groesser und dominierst andere Pasta-Sorten.

## Tech Stack

- **Phaser 3** — HTML5 Game Engine (geladen aus dem CDN, keine Installation noetig)
- **Vanilla JavaScript** (ES Modules)
- **HTML5 + CSS**

Kein npm, kein Build-Step, kein Node.js noetig zum Entwickeln.

## Live-Demo

Nach jedem Push auf `main` wird das Spiel automatisch deployed:
<https://nexusbetde.github.io/spaghetti-io/>

## Lokal starten

Du brauchst nur einen lokalen Webserver. Drei einfache Varianten:

### Variante A: Python (vorinstalliert auf Mac/Linux, leicht zu installieren auf Windows)

```bash
# Im Projektordner ausfuehren:
python3 -m http.server 8000
```

Dann im Browser oeffnen: <http://localhost:8000>

### Variante B: VS Code "Live Server" Extension

1. VS Code oeffnen
2. Extension "Live Server" (von Ritwick Dey) installieren
3. Rechtsklick auf `index.html` -> "Open with Live Server"

### Variante C: Node.js (falls installiert)

```bash
npx serve
```

## Projektstruktur

```
spaghetti-io/
  index.html              # Einstiegspunkt, laedt Phaser aus dem CDN
  src/
    main.js               # Phaser-Konfiguration und Spielstart
    style.css             # CSS fuer die HTML-Seite
    scenes/
      GameScene.js        # Die Haupt-Spielszene
```

## Entwicklungs-Roadmap

- [x] Schritt 1: Projekt-Setup
- [x] Schritt 2: Spaghetti-Spieler steuern (Maus/Touch + Boost)
- [x] Schritt 3: Fleischbaellchen essen, wachsen und Score
- [ ] Schritt 4: Kollision und Game Over
- [ ] Schritt 5: KI-Bots als Gegner
- [ ] Schritt 6: Polish, Sounds, Highscore, Crazy Games SDK

## Deployment zu Crazy Games

Sobald das Spiel fertig ist, wird der gesamte Ordner als zip-Datei zu Crazy Games hochgeladen. Die Plattform serviert dann `index.html` direkt.

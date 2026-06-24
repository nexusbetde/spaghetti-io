import GameScene from './scenes/GameScene.js';
import CrazyGamesAdapter from './integrations/CrazyGamesAdapter.js';

// Phaser wird global aus dem CDN geladen (siehe index.html)
// Daher hier kein "import Phaser from ..." noetig

// CrazyGames: Loading-Phase signalisieren
const cg = new CrazyGamesAdapter();
cg.loadingStart();

// Phaser-Konfiguration: das "Setup-Rezept" fuer unser Spiel
const config = {
  // AUTO = Phaser entscheidet ob WebGL oder Canvas (WebGL wenn verfuegbar = schneller)
  type: Phaser.AUTO,

  // Wo soll das Spiel im HTML eingefuegt werden?
  parent: 'game-container',

  // Hintergrundfarbe (dunkles Braun = Holztisch-Vibes)
  backgroundColor: '#2d1810',

  // Skalierung: 1280x720 ist die Standard-Aufloesung fuer Crazy Games (16:9)
  scale: {
    mode: Phaser.Scale.FIT, // proportional skalieren, Letterbox falls noetig
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },

  // Die Scenes (Spielszenen) — wir haben aktuell nur eine
  scene: [GameScene],

  // Callback wenn Phaser bereit ist
  callbacks: {
    postBoot: () => {
      // CrazyGames: Loading beendet, Spiel ist spielbereit
      cg.loadingStop();
    }
  }
};

// Spiel starten
new Phaser.Game(config);

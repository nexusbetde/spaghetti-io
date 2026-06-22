import GameScene from './scenes/GameScene.js';

// Phaser wird global aus dem CDN geladen (siehe index.html)
// Daher hier kein "import Phaser from ..." noetig

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
  scene: [GameScene]
};

// Spiel starten
new Phaser.Game(config);

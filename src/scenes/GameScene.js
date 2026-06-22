import SpaghettiPlayer from '../game/SpaghettiPlayer.js';

/**
 * GameScene — Die Haupt-Spielszene.
 *
 * Schritt 2: Spieler-Steuerung
 *  - Spaghetti folgt der Maus oder dem Finger
 *  - Linke Maustaste / Leertaste = Boost
 *  - Funktioniert auf Desktop und Mobile
 */
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;

    // Hintergrund: karierte Pizzeria-Tischdecke
    this.drawCheckerboard();

    // Spieler mittig erstellen
    this.player = new SpaghettiPlayer(this, width / 2, height / 2);

    // Spielfeld-Grenzen merken, damit der Spieler nicht raus laeuft
    this.worldBounds = { width, height };

    // === Eingaben einrichten ===
    this.setupInput();

    // === HUD ===
    this.createHUD();
  }

  update() {
    // Aktueller Pointer (funktioniert sowohl fuer Maus als auch Touch)
    const pointer = this.input.activePointer;

    // Falls der Pointer noch nie bewegt wurde, nimm den Spielfeld-Mittelpunkt
    const targetX = pointer.x || this.scale.width / 2;
    const targetY = pointer.y || this.scale.height / 2;

    this.player.update(targetX, targetY, this.worldBounds);

    // Boost-Anzeige aktualisieren
    if (this.boostIndicator) {
      this.boostIndicator.setVisible(this.player.isBoosting);
    }
  }

  // ---------------------------------------------------------------------------
  // Eingaben
  // ---------------------------------------------------------------------------

  setupInput() {
    // Linke Maustaste / Touch gedrueckt halten = Boost
    this.input.on('pointerdown', () => this.player.setBoosting(true));
    this.input.on('pointerup', () => this.player.setBoosting(false));
    this.input.on('pointerout', () => this.player.setBoosting(false));

    // Leertaste als Alternative fuer Desktop
    const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey.on('down', () => this.player.setBoosting(true));
    spaceKey.on('up', () => this.player.setBoosting(false));

    // Shift-Taste als zweite Boost-Alternative
    const shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    shiftKey.on('down', () => this.player.setBoosting(true));
    shiftKey.on('up', () => this.player.setBoosting(false));
  }

  // ---------------------------------------------------------------------------
  // HUD (Steuerungshinweise und Boost-Indikator)
  // ---------------------------------------------------------------------------

  createHUD() {
    const padX = 16;
    const padY = 14;
    const labelStyle = {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 6 }
    };

    this.add.text(padX, padY, 'Maus / Finger bewegen = Richtung', labelStyle).setDepth(20);
    this.add.text(padX, padY + 36, 'KLICK / SPACE / SHIFT halten = BOOST', labelStyle).setDepth(20);

    // Boost-Indikator mittig oben — nur sichtbar wenn aktiv
    this.boostIndicator = this.add
      .text(this.scale.width / 2, 40, 'BOOST!', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '36px',
        color: '#ff6b35',
        stroke: '#000000',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);

    // Pulsierende Animation fuer den Boost-Indikator
    this.tweens.add({
      targets: this.boostIndicator,
      scale: { from: 1, to: 1.15 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Status unten
    this.add
      .text(this.scale.width / 2, this.scale.height - 24, 'Schritt 2: Steuerung aktiv  |  Schritt 3 folgt: Fleischbaellchen essen', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        color: '#aaaaaa'
      })
      .setOrigin(0.5, 1)
      .setDepth(20);
  }

  // ---------------------------------------------------------------------------
  // Hintergrund
  // ---------------------------------------------------------------------------

  /**
   * Zeichnet eine rot-weiss karierte Tischdecke als Hintergrund.
   */
  drawCheckerboard() {
    const tileSize = 80;
    const { width, height } = this.scale;
    const graphics = this.add.graphics();
    graphics.setDepth(0);

    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        graphics.fillStyle(isEven ? 0xc41e3a : 0xffffff, 0.12);
        graphics.fillRect(x, y, tileSize, tileSize);
      }
    }
  }
}
